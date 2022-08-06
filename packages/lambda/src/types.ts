import { utils } from "ethers";

export interface IContractResolver {
  contractAddress: string;
  overrides: Record<string, number>;
}

export type TContractRecords = Record<string, IContractResolver>;

export interface DatabaseResult {
  result: any[];
  ttl: number;
}


export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export interface RPCCall {
  to: utils.BytesLike;
  data: utils.BytesLike;
}
