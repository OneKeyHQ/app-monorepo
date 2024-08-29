import type {
  SignDeployContractTxParams,
  SignExecuteScriptTxParams,
  SignTransferTxParams,
} from '@alephium/web3';

export type IEncodedTxAlph =
  | SignTransferTxParams
  | SignDeployContractTxParams
  | SignExecuteScriptTxParams;
