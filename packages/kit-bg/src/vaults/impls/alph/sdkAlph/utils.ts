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
  SignUnsignedTxParams,
} from '@alephium/web3';

export const NATIVE_TOKEN_ADDRESS =
  '0000000000000000000000000000000000000000000000000000000000000000';

export const MAX_GAS_AMOUNT = '10000000000000000';

export function serializeUnsignedTransaction({
  encodedTx,
  publicKey,
  networkId,
  backgroundApi,
}: {
  encodedTx: IEncodedTxAlph;
  publicKey: string;
  networkId: string;
  backgroundApi: IBackgroundApi;
}) {
  const provider = new Provider({
    backgroundApi,
    networkId,
  });
  const builder = TransactionBuilder.from(provider);
  if (encodedTx.type === EAlphTxType.ExecuteScript) {
    return builder.buildExecuteScriptTx(
      encodedTx.params as SignExecuteScriptTxParams,
      publicKey,
    );
  }
  if (encodedTx.type === EAlphTxType.DeployContract) {
    return builder.buildDeployContractTx(
      encodedTx.params as SignDeployContractTxParams,
      publicKey,
    );
  }
  if (encodedTx.type === EAlphTxType.UnsignedTx) {
    return builder.buildUnsignedTx(encodedTx.params as SignUnsignedTxParams);
  }
  return builder.buildTransferTx(
    encodedTx.params as SignTransferTxParams,
    publicKey,
  );
}

export function deserializeUnsignedTransaction({
  unsignedTx,
  networkId,
  backgroundApi,
}: {
  unsignedTx: string;
  networkId: string;
  backgroundApi: IBackgroundApi;
}) {
  const provider = new Provider({
    backgroundApi,
    networkId,
  });
  return provider.transactions.postTransactionsDecodeUnsignedTx({
    unsignedTx,
  });
}
