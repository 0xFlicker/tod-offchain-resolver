import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { SSM } from "@aws-sdk/client-ssm";
import { Fragment, Interface, JsonFragment } from "@ethersproject/abi";
import { abi as IResolverService_abi } from "@ensdomains/offchain-resolver-contracts/artifacts/contracts/OffchainResolver.sol/IResolverService.json";
import { abi as Resolver_abi } from "@ensdomains/ens-contracts/artifacts/contracts/resolvers/Resolver.sol/Resolver.json";

import {
  IERC721__factory,
  IERC721Metadata__factory
} from "./typechain/index.js";
import { providers, utils } from "ethers";
import { ETH_COIN_TYPE } from "./utils.js";
import { DatabaseResult, RPCCall, TContractRecords } from "./types.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
};
const Resolver = new utils.Interface(Resolver_abi);

const ssm = new SSM({});

const params = Promise.all([
  ssm
    .getParameter({ Name: "/offchain-ens-resolver/PrivateKey" })
    .then(r => r.Parameter?.Value ?? ""),
  ssm
    .getParameter({ Name: "/offchain-ens-resolver/RpcUrl" })
    .then(r => r.Parameter?.Value ?? ""),
  ssm
    .getParameter({ Name: "/offchain-ens-resolver/ContractMappings" })
    .then(r => JSON.parse(r.Parameter?.Value ?? "{}") as TContractRecords)
]);

const ttl = 300;
const EMPTY_RESPONSE = { result: [""], ttl };
const EMPTY_HEX_RESPONSE = { result: ["0x"], ttl };
const queryHandlers: Record<
  string,
  (name: string, args: utils.Result) => Promise<DatabaseResult>
> = {
  "addr(bytes32)": async (name, _args) => {
    return fetchOwnerOf(name);
  },
  "addr(bytes32,uint256)": async (name, args) => {
    if (args[0] !== ETH_COIN_TYPE) {
      return EMPTY_RESPONSE;
    }
    try {
      return fetchOwnerOf(name);
    } catch (err) {
      console.error(err);
      return EMPTY_RESPONSE;
    }
  },
  "text(bytes32,string)": async (name, args) => {
    return EMPTY_RESPONSE;
  },
  "contenthash(bytes32)": async (name, _args) => {
    return EMPTY_HEX_RESPONSE;
  }
};

function toInterface(
  abi: string | readonly (string | Fragment | JsonFragment)[] | Interface
) {
  if (Interface.isInterface(abi)) {
    return abi;
  }
  return new Interface(abi);
}

const abiInterface = toInterface(IResolverService_abi);

const fn = abiInterface.getFunction("resolve");
const resolveSigHash = Interface.getSighash(fn);

async function fetchOwnerOf(name: string) {
  const [_, rpcUrl, contractMappings] = await params;
  const { contractAddress, tokenId } = resolveDnsName(name, contractMappings);

  const provider = new providers.JsonRpcProvider(rpcUrl);

  const erc721 = IERC721__factory.connect(contractAddress, provider);
  const owner = await erc721.ownerOf(tokenId);
  return { result: [owner], ttl };
}

function resolveDnsName(
  name: string,
  contractMappings: TContractRecords
): { contractAddress: string; tokenId: number } {
  const components = name.split(".");
  const subDomain = components[0];
  const domain = components.slice(1).join(".");
  if (!contractMappings[domain]) {
    throw new Error(`No mapping for domain ${domain}`);
  }
  const contractInfo = contractMappings[domain];
  const { contractAddress, overrides } = contractInfo;

  let tokenId: number;
  if (overrides && overrides[subDomain]) {
    tokenId = overrides[subDomain];
  } else {
    const tokenAsId = +subDomain;
    if (!Number.isInteger(tokenAsId)) {
      throw new Error(`No mapping for domain ${domain} at ${subDomain}`);
    }
    tokenId = tokenAsId;
  }
  return { contractAddress, tokenId };
}

function decodeDnsName(dnsname: Buffer) {
  const labels = [];
  let idx = 0;
  while (true) {
    const len = dnsname.readUInt8(idx);
    if (len === 0) break;
    labels.push(dnsname.slice(idx + 1, idx + len + 1).toString("utf8"));
    idx += len + 1;
  }
  return labels.join(".");
}

async function query(
  name: string,
  data: string
): Promise<{ result: utils.BytesLike; validUntil: number }> {
  // Parse the data nested inside the second argument to `resolve`
  const { signature, args } = Resolver.parseTransaction({ data });

  if (utils.nameprep(name) !== name) {
    throw new Error("Name must be normalised");
  }

  if (utils.namehash(name) !== args[0]) {
    throw new Error("Name does not match namehash");
  }

  const handler = queryHandlers[signature];
  if (handler === undefined) {
    throw new Error(`Unsupported query function ${signature}`);
  }

  const { result, ttl } = await handler(name, args.slice(1));
  return {
    result: Resolver.encodeFunctionResult(signature, result),
    validUntil: Math.floor(Date.now() / 1000 + ttl)
  };
}

const resolver = async (
  [encodedName, data]: utils.Result,
  request: RPCCall
) => {
  const [privateKey] = await params;

  const signer = new utils.SigningKey(privateKey);
  const name = decodeDnsName(Buffer.from(encodedName.slice(2), "hex"));
  // Query the database
  const { result, validUntil } = await query(name, data);

  // Hash and sign the response
  let messageHash = utils.solidityKeccak256(
    ["bytes", "address", "uint64", "bytes32", "bytes32"],
    [
      "0x1900",
      request?.to,
      validUntil,
      utils.keccak256(request?.data || "0x"),
      utils.keccak256(result)
    ]
  );
  const sig = signer.signDigest(messageHash);
  const sigData = utils.hexConcat([sig.r, sig._vs]);
  return [result, validUntil, sigData];
};

async function call(call: RPCCall): Promise<APIGatewayProxyResult> {
  const calldata = utils.hexlify(call.data);
  const selector = calldata.slice(0, 10).toLowerCase();

  // Find a function handler for this selector
  if (selector !== resolveSigHash) {
    console.log(`Unsupported selector ${selector}`);
    return {
      statusCode: 400,
      body: "Unsupported function",
      headers: {
        ...CORS_HEADERS
      }
    };
  }

  // Decode function arguments
  const args = utils.defaultAbiCoder.decode(
    fn.inputs,
    "0x" + calldata.slice(10)
  );

  // Call the handler
  const result = await resolver(args, call);

  // Encode return data
  return {
    statusCode: 200,
    headers: {
      ...CORS_HEADERS
    },
    body: JSON.stringify({
      data: fn.outputs
        ? utils.hexlify(utils.defaultAbiCoder.encode(fn.outputs, result))
        : "0x"
    })
  };
}

export async function handler(event: APIGatewayProxyEvent) {
  let sender: string;
  let callData: string;
  if (event.httpMethod === "POST" && event.body) {
    const body = JSON.parse(event.body);
    sender = body.sender;
    callData = body.data;
  } else if (
    event.httpMethod === "GET" &&
    event.pathParameters &&
    event.pathParameters.sender &&
    event.pathParameters.callData
  ) {
    sender = event.pathParameters.sender;
    callData = event.pathParameters.callData;
  } else {
    console.log(`Invalid request: ${event.httpMethod} ${event.path}`);
    return {
      statusCode: 400,
      body: "Invalid request",
      headers: {
        ...CORS_HEADERS
      }
    };
  }

  if (!utils.isAddress(sender) || !utils.isBytesLike(callData)) {
    console.log(`Invalid request: ${sender} ${callData}`);
    return {
      statusCode: 400,
      body: "Invalid request",
      headers: {
        ...CORS_HEADERS
      }
    };
  }

  try {
    return await call({ to: sender, data: callData });
  } catch (e) {
    console.error(e);
    return {
      statusCode: 500,
      body: "Internal server error",
      headers: {
        ...CORS_HEADERS
      }
    };
  }
}
