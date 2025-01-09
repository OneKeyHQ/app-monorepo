import type { ICosmosStdSignDoc } from './sdkCosmos';
import type { ICosmosProtoMsgsOrWithAminoMsgs } from './sdkCosmos/ITxMsgBuilder';

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
  msg: ICosmosProtoMsgsOrWithAminoMsgs | undefined;
  signDoc: ICosmosStdSignDoc | ICosmosSignDocHex;
}
