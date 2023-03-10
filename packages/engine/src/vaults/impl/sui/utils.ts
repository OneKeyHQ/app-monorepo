/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/naming-convention */
import {
  Coin,
  IntentScope,
  LocalTxnDataSerializer,
  SUI_TYPE_ARG,
  fromB64,
  getMoveObject,
  getObjectExistsResponse,
  getPaySuiTransaction,
  getPayTransaction,
  getTransferSuiTransaction,
  messageWithIntent,
} from '@mysten/sui.js';
import { isArray } from 'lodash';

import { IDecodedTxActionType } from '../../types';

import type { QueryJsonRpcProvider } from './provider/QueryJsonRpcProvider';
import type { IEncodedTxSUI } from './types';
import type {
  GetObjectDataResponse,
  JsonRpcProvider,
  Pay,
  PayAllSui,
  PayTransaction,
  Provider,
  SignableTransaction,
  SuiMoveObject,
  SuiObject,
  SuiTransactionKind,
} from '@mysten/sui.js';

export const APTOS_SIGN_MESSAGE_PREFIX = 'APTOS';
export const ED25519_PUBLIC_KEY_SIZE = 32;
export const SECP256K1_PUBLIC_KEY_SIZE = 33;

export const DEFAULT_GAS_BUDGET_FOR_PAY = 150;
export const DEFAULT_GAS_BUDGET_FOR_STAKE = 10000;
export const GAS_TYPE_ARG = '0x2::sui::SUI';
export const GAS_SYMBOL = 'SUI';
export const DEFAULT_NFT_TRANSFER_GAS_FEE = 450;
export const SUI_SYSTEM_STATE_OBJECT_ID =
  '0x0000000000000000000000000000000000000005';

export const SUI_NATIVE_COIN = SUI_TYPE_ARG;

/* -------------------------------------------------------------------------- */
/*                              Helper functions                              */
/* -------------------------------------------------------------------------- */

export function getTransactionType({ tx }: { tx: IEncodedTxSUI }) {
  const { kind } = tx;

  switch (kind) {
    case 'transferSui':
    case 'paySui':
    case 'payAllSui':
      return IDecodedTxActionType.NATIVE_TRANSFER;

    case 'moveCall':
      return IDecodedTxActionType.FUNCTION_CALL;

    default:
      return IDecodedTxActionType.UNKNOWN;
  }
}

export function decodeBytesTransaction(txn: any) {
  let bcsTxn: Uint8Array;
  if (isArray(txn)) {
    bcsTxn = Uint8Array.from(txn);
  } else if (typeof txn === 'object') {
    bcsTxn = new Uint8Array(Object.values(txn));
  } else if (typeof txn === 'string') {
    if (txn.indexOf(',') !== -1) {
      bcsTxn = new Uint8Array(txn.split(',').map((item) => parseInt(item, 10)));
    } else {
      bcsTxn = fromB64(txn);
    }
  } else {
    throw new Error('invalidParams');
  }

  return bcsTxn;
}

export function handleSignDataWithRpcVersion(
  client: Provider,
  txBase64: Uint8Array,
) {
  return messageWithIntent(IntentScope.TransactionData, txBase64);
}

export async function toTransaction(
  client: Provider,
  sender: string,
  tx: SignableTransaction | string | Uint8Array,
) {
  const address = sender;
  let transactionBytes: Uint8Array;
  if (typeof tx === 'string') {
    transactionBytes = fromB64(tx);
  } else if (
    tx instanceof Uint8Array ||
    (typeof tx !== 'string' && 'kind' in tx && tx.kind === 'bytes')
  ) {
    transactionBytes = tx instanceof Uint8Array ? tx : tx.data;
  } else {
    const serializer = new LocalTxnDataSerializer(client);
    transactionBytes = await serializer.serializeToBytes(address, tx, 'Commit');
    // transactionBytes = await convertToTransactionBuilder(
    //   await this.getAddress(),
    //   transaction,
    //   this.provider,
    // );
  }

  return transactionBytes;
}

export function computeGasBudget(inputSize: number) {
  return DEFAULT_GAS_BUDGET_FOR_PAY * Math.max(2, Math.min(100, inputSize / 2));
}

export function computeGasBudgetForPay(
  coins: GetObjectDataResponse[],
  amount: string,
) {
  const numInputCoins = Coin.selectCoinSetWithCombinedBalanceGreaterThanOrEqual(
    coins,
    BigInt(amount),
  );
  return computeGasBudget(numInputCoins.length);
}

export function getTxnAmount(
  txnData: SuiTransactionKind,
  address?: string,
): { [key: string]: bigint } | bigint {
  // TODO: add PayAllSuiTransaction
  const transferSui = getTransferSuiTransaction(txnData);
  if (transferSui?.amount) {
    return BigInt(transferSui.amount);
  }

  const paySuiData =
    getPaySuiTransaction(txnData) ?? getPayTransaction(txnData);

  const amountByRecipient =
    paySuiData?.recipients.reduce(
      (acc, value, index) => ({
        ...acc,
        [value]:
          BigInt(paySuiData.amounts[index]) +
          BigInt(value in acc ? acc[value] : 0),
      }),
      {} as { [key: string]: bigint },
    ) ?? null;

  // return amount if only one recipient or if address is in recipient object
  const amountByRecipientList = Object.values(amountByRecipient || {});

  const amount =
    amountByRecipientList.length === 1
      ? amountByRecipientList[0]
      : amountByRecipient;

  return (
    (address && amountByRecipient ? amountByRecipient[address] : amount) ??
    BigInt(0)
  );
}

function getObjectVersionFoundResponse(
  resp: GetObjectDataResponse,
): SuiObject | undefined {
  // @ts-expect-error
  return resp.status !== 'VersionFound'
    ? undefined
    : (resp.details as SuiObject);
}

function getPastObjectResponse(
  resp: GetObjectDataResponse,
): SuiObject | undefined {
  return getObjectExistsResponse(resp) || getObjectVersionFoundResponse(resp);
}

function getPastMoveObject(
  data: GetObjectDataResponse | SuiObject,
): SuiMoveObject | undefined {
  const suiObject = 'data' in data ? data : getPastObjectResponse(data);
  if (suiObject?.data.dataType !== 'moveObject') {
    return undefined;
  }
  return suiObject.data as SuiMoveObject;
}

export const deduplicate = (results: string[] | undefined) =>
  results
    ? results.filter((value, index, self) => self.indexOf(value) === index)
    : [];

export const moveCallTxnName = (moveCallFunctionName?: string): string =>
  moveCallFunctionName ? moveCallFunctionName.replace(/_/g, ' ') : '';

/* -------------------------------- Decode Action ------------------------------- */

export async function decodeActionAllPay(
  client: QueryJsonRpcProvider,
  paySuiAll: PayAllSui | undefined,
) {
  if (!paySuiAll) return undefined;
  const coins = await client.tryGetPastObjectBatch(
    paySuiAll.coins.map((c) => ({
      objectId: c.objectId,
      version: c.version,
    })),
  );

  const moveObject = coins
    .map((obj) => getPastMoveObject(obj))
    .filter((obj) => !!obj)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    .filter((obj) => Coin.isSUI(obj!)) as SuiMoveObject[];

  const amount = Coin.totalBalance(moveObject);

  return {
    type: IDecodedTxActionType.NATIVE_TRANSFER,
    amount,
  };
}

export async function decodeActionPay(
  client: QueryJsonRpcProvider,
  tx: Pay | undefined,
) {
  if (!tx) return undefined;
  const objects = await client.tryGetPastObjectBatch(
    tx.coins.map((c) => ({
      objectId: c.objectId,
      version: c.version,
    })),
  );

  const moveObject = objects
    .map((obj) => getPastMoveObject(obj))
    .filter((obj) => !!obj)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    .filter((obj) => Coin.isCoin(obj!)) as SuiMoveObject[];

  if (moveObject.length === 0) return undefined;

  const coinType = Coin.getCoinType(moveObject[0].type);
  const isNative = Coin.isSUI(moveObject[0]);

  const amount = tx.amounts.reduce((acc, cur) => acc + cur, 0);

  return {
    type: isNative
      ? IDecodedTxActionType.NATIVE_TRANSFER
      : IDecodedTxActionType.TOKEN_TRANSFER,
    isNative,
    coinType,
    amount,
    recipient: tx.recipients[0],
  };
}

export async function decodeActionPayTransaction(
  client: JsonRpcProvider,
  tx: PayTransaction | undefined,
) {
  if (!tx) return undefined;
  const objects = await client.getObjectBatch(tx.inputCoins);

  const moveObject = objects
    .filter((obj) => Coin.isCoin(obj))
    .map((obj) => getMoveObject(obj))
    .filter((obj) => !!obj) as SuiMoveObject[];

  if (moveObject.length === 0) return undefined;

  const coinType = Coin.getCoinType(moveObject[0].type);
  const isNative = Coin.isSUI(moveObject[0]);

  const amount = tx.amounts.reduce((acc, cur) => {
    if (
      typeof cur === 'string' ||
      typeof cur === 'number' ||
      typeof cur === 'bigint'
    ) {
      return acc + BigInt(cur);
    }
    return acc;
  }, BigInt(0));

  return {
    type: isNative
      ? IDecodedTxActionType.NATIVE_TRANSFER
      : IDecodedTxActionType.TOKEN_TRANSFER,
    isNative,
    coinType,
    amount,
    recipient: tx.recipients[0],
  };
}
