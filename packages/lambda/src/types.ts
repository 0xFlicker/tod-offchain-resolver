import { utils } from "ethers";

export interface IEnsContent {
  eth?: string;
}

export interface IContractResolver {
  contractAddress?: string;
  overrides?: Record<string, number | undefined>;
  root?: IEnsContent;
}

export type TContractRecords = Record<string, IContractResolver | undefined>;

export interface DatabaseResult {
  result: any[];
  ttl: number;
}

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export interface RPCCall {
  to: utils.BytesLike;
  data: utils.BytesLike;
}
