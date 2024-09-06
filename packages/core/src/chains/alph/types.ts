import type {
  SignDeployContractTxParams,
  SignExecuteScriptTxParams,
  SignTransferTxParams,
} from '@alephium/web3';

export enum EAlphTxType {
  Transfer = 'Transfer',
  DeployContract = 'DeployContract',
  ExecuteScript = 'ExecuteScript',
}

export type IEncodedTxAlph = {
  type: EAlphTxType;
  params:
    | SignTransferTxParams
    | SignDeployContractTxParams
    | SignExecuteScriptTxParams;
};
