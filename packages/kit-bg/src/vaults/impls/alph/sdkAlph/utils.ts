import { TransactionBuilder } from '@alephium/web3';

import {
  EAlphTxType,
  type IEncodedTxAlph,
} from '@onekeyhq/core/src/chains/alph/types';
import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';

import { Provider } from './provider';

import type {
  SignDeployContractTxParams,
  SignExecuteScriptTxParams,
  SignTransferTxParams,
} from '@alephium/web3';

export const NATIVE_TOKEN_ADDRESS =
  '0000000000000000000000000000000000000000000000000000000000000000';

export function serializeUnsignedTransaction({
  tx,
  publicKey,
  networkId,
  backgroundApi,
}: {
  tx: IEncodedTxAlph;
  publicKey: string;
  networkId: string;
  backgroundApi: IBackgroundApi;
}) {
  const provider = new Provider({
    backgroundApi,
    networkId,
  });
  const builder = TransactionBuilder.from(provider);
  if (tx.type === EAlphTxType.ExecuteScript) {
    return builder.buildExecuteScriptTx(
      tx.params as SignExecuteScriptTxParams,
      publicKey,
    );
  }
  if (tx.type === EAlphTxType.DeployContract) {
    return builder.buildDeployContractTx(
      tx.params as SignDeployContractTxParams,
      publicKey,
    );
  }
  return builder.buildTransferTx(tx.params as SignTransferTxParams, publicKey);
}
