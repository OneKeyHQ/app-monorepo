import type { StdSignDoc } from './sdkCosmos';
import type { ProtoMsgsOrWithAminoMsgs } from './sdkCosmos/ITxMsgBuilder';

export interface ICosmosCoin {
  denom: string;
  amount: string;
}

export interface ICosmosSignDocHex {
  bodyBytes: string;
  authInfoBytes: string;
  chainId: string;
  accountNumber: string;
}

export interface ICosmosStdFee {
  amount: ICosmosCoin[];
  gas_limit: string;
  payer: string;
  granter: string;

  feePayer?: string;
}

export interface IEncodedTxCosmos {
  mode: string;
  msg: ProtoMsgsOrWithAminoMsgs | undefined;
  signDoc: StdSignDoc | ICosmosSignDocHex;
};
