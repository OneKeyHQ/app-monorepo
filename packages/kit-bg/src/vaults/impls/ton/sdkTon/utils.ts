import TonWeb from 'tonweb';

import type { IEncodedTxTon } from '@onekeyhq/core/src/chains/ton/types';
import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import { SEPERATOR } from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { EDecodedTxActionType } from '@onekeyhq/shared/types/tx';

import { Provider } from './provider';

import type BigNumber from 'bignumber.js';
import type { Cell } from 'tonweb/dist/types/boc/cell';
import type { Address } from 'tonweb/dist/types/utils/address';

export function decodePayload(payload?: string | Uint8Array | Cell): {
  type: EDecodedTxActionType;
  tokenAddress?: string;
} {
  let type = EDecodedTxActionType.UNKNOWN;
  if (!payload) {
    type = EDecodedTxActionType.ASSET_TRANSFER;
    return { type };
  }
  if (typeof payload === 'string') {
    try {
      const buf = Buffer.from(payload, 'base64');
      if (
        buf.length >= 32 &&
        buf.subarray(0, 32).toString('hex') ===
          '0000000000000000000000000000000000000000000000000000000000000000'
      ) {
        type = EDecodedTxActionType.ASSET_TRANSFER;
        return { type };
      }
    } catch (e) {
      type = EDecodedTxActionType.ASSET_TRANSFER;
      return { type };
    }
  }
  return { type };
}

type IV4R2 = typeof TonWeb.Wallets.all.v4R2;

export interface IWallet extends IV4R2 {
  createTransferMessages(
    secretKey: Uint8Array,
    sequenceNo: number,
    messages: {
      toAddress: Address | string;
      amount: BigNumber;
      payload?: string | Uint8Array | Cell;
      sendMode?: number;
      stateInit?: Cell;
    }[],
    dummySignature?: boolean,
    expireAt?: number,
  ): {
    address: Address;
    signature: Uint8Array;
    signingMessage: Cell;
    message: Cell;
    cell: Cell;
    body: Cell;
    resultMessage: Cell;
  };
}

export function getWalletContractClass(version: string) {
  if (!(version in TonWeb.Wallets.all)) {
    throw new OneKeyInternalError(`Wallet ${version} not found`);
  }
  return TonWeb.Wallets.all[version as keyof typeof TonWeb.Wallets.all];
}

export function getWalletContractInstance({
  version,
  publicKey,
  backgroundApi,
}: {
  version: string;
  publicKey: string;
  backgroundApi: IBackgroundApi;
}) {
  const Contract = getWalletContractClass(version);
  return new Contract(new Provider(backgroundApi), {
    publicKey: bufferUtils.hexToBytes(publicKey),
  });
}

export async function serializeUnsignedTransaction({
  version,
  encodedTx,
  backgroundApi,
}: {
  version: string;
  encodedTx: IEncodedTxTon;
  backgroundApi: IBackgroundApi;
}) {
  const Contract = getWalletContractClass(version);
  const contract = new Contract(new Provider(backgroundApi), {
    address: encodedTx.fromAddress,
  }) as unknown as IWallet;
  return contract.createTransferMessages(
    new Uint8Array(64),
    encodedTx.sequenceNo,
    encodedTx.messages.map((message) => ({
      toAddress: message.toAddress,
      amount: message.amount,
      payload: message.payload,
      sendMode: message.sendMode,
      stateInit:
        typeof message.stateInit === 'string'
          ? TonWeb.boc.Cell.oneFromBoc(message.stateInit)
          : message.stateInit,
    })),
    true,
    encodedTx.expireAt,
  );
}

export function getAccountVersion(accountId: string) {
  if (accountUtils.isImportedAccount({ accountId })) {
    return accountId.split(SEPERATOR)[3];
  }
  const { idSuffix: version } = accountUtils.parseAccountId({ accountId });
  return version;
}
