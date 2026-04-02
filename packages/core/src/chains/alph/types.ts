import type {
  Number256,
  SignDeployContractTxParams,
  SignExecuteScriptTxParams,
  SignTransferTxParams,
  SignUnsignedTxParams,
} from '@alephium/web3';

export enum EAlphTxType {
  Transfer = 'Transfer',
  DeployContract = 'DeployContract',
  ExecuteScript = 'ExecuteScript',
  UnsignedTx = 'UnsignedTx',
}

export type IEncodedTxAlph = {
  type: EAlphTxType;
  params:
    | SignTransferTxParams
    | SignDeployContractTxParams
    | SignExecuteScriptTxParams
    | (SignUnsignedTxParams & {
        gasAmount?: number;
        gasPrice?: Number256;
      });
};
