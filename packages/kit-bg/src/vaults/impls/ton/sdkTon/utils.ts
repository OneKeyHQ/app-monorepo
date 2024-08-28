/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import BigNumber from 'bignumber.js';
import TonWeb from 'tonweb';

import type { IEncodedTxTon } from '@onekeyhq/core/src/chains/ton/types';
import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import { SEPERATOR } from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { EDecodedTxActionType } from '@onekeyhq/shared/types/tx';

import { Provider } from './provider';

import type { IAddressToString, ICell } from './types';
import type { Cell } from 'tonweb/dist/types/boc/cell';
import type { TransferBodyParams } from 'tonweb/dist/types/contract/token/ft/jetton-wallet';
import type { Address } from 'tonweb/dist/types/utils/address';

export function decodePayload(payload?: string | Uint8Array | Cell): {
  type: EDecodedTxActionType;
  bytes?: Uint8Array;
  jetton?: {
    queryId?: string;
    toAddress: string;
    amount: string;
    forwardAmount?: string;
    responseAddress?: string;
    forwardPayload?: Uint8Array;
  };
} {
  let type = EDecodedTxActionType.UNKNOWN;
  if (!payload) {
    type = EDecodedTxActionType.ASSET_TRANSFER;
    return { type };
  }
  let bytes;
  if (typeof payload === 'string') {
    try {
      bytes = Buffer.from(payload, 'hex');
    } catch (e) {
      try {
        bytes = Buffer.from(payload, 'base64');
      } catch (ee) {
        // ignore
      }
    }
  } else if (payload instanceof Uint8Array) {
    bytes = payload;
  }
  if (
    bytes &&
    bytes.length >= 32 &&
    bytes.subarray(0, 32).toString('hex') ===
      '0000000000000000000000000000000000000000000000000000000000000000'
  ) {
    type = EDecodedTxActionType.ASSET_TRANSFER;
  }

  let jetton;
  if (bytes) {
    try {
      const cell = TonWeb.boc.Cell.oneFromBoc(bytes.toString('hex'));
      const slice = (cell as unknown as ICell).beginParse();
      const data = slice.loadUint(32);
      const op = new BigNumber(data.toString()).toString(16);
      if (op === 'f8a7ea5') {
        const queryId = slice.loadUint(64);
        const amount = slice.loadCoins();
        const toAddress = slice.loadAddress();
        const responseAddress = slice.loadAddress();
        slice.loadBit(); // isCustomPayload
        const forwardAmount = slice.loadCoins();
        const isForwardPayloadRef = slice.loadBit();
        let forwardPayload;
        if (isForwardPayloadRef) {
          const ref = slice.loadRef();
          if (ref && ref.getFreeBits() > 0) {
            forwardPayload = ref.loadBits(ref.getFreeBits());
          }
        } else if (slice.getFreeBits() > 0) {
          forwardPayload = slice.loadBits(slice.getFreeBits());
        }
        if (!forwardPayload) {
          type = EDecodedTxActionType.ASSET_TRANSFER;
        }
        jetton = {
          queryId: queryId ? queryId.toString() : undefined,
          toAddress: (toAddress.toString as IAddressToString)(
            true,
            true,
            false,
          ),
          amount: amount.toString(),
          forwardAmount: forwardAmount ? forwardAmount.toString() : undefined,
          responseAddress: responseAddress
            ? (responseAddress.toString as IAddressToString)(true, true, false)
            : undefined,
          forwardPayload,
        };
      }
    } catch (e) {
      // ignore
    }
  }

  return { type, bytes, jetton };
}

type IV4R2 = typeof TonWeb.Wallets.all.v4R2;

export interface IWallet extends IV4R2 {
  createTransferMessages(
    secretKey: Uint8Array,
    sequenceNo: number,
    messages: {
      toAddress: Address | string;
      amount: string;
      payload?: string | Uint8Array | Cell;
      sendMode?: number;
      stateInit?: Cell;
    }[],
    dummySignature?: boolean,
    expireAt?: number,
  ): {
    data: Cell;
    code: Cell;
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
  networkId,
}: {
  version: string;
  publicKey: string;
  backgroundApi: IBackgroundApi;
  networkId: string;
}) {
  const Contract = getWalletContractClass(version);
  return new Contract(new Provider({ backgroundApi, networkId }), {
    publicKey: bufferUtils.hexToBytes(publicKey),
  });
}

export async function serializeUnsignedTransaction({
  version,
  encodedTx,
  backgroundApi,
  networkId,
}: {
  version: string;
  encodedTx: IEncodedTxTon;
  backgroundApi: IBackgroundApi;
  networkId: string;
}) {
  const Contract = getWalletContractClass(version);
  const contract = new Contract(
    new Provider({
      backgroundApi,
      networkId,
    }),
    {
      address: encodedTx.from,
    },
  ) as unknown as IWallet;
  return contract.createTransferMessages(
    new Uint8Array(64),
    encodedTx.sequenceNo || 0,
    encodedTx.messages.map((message) => ({
      toAddress: message.address,
      amount: message.amount,
      payload:
        typeof message.payload === 'string'
          ? TonWeb.boc.Cell.oneFromBoc(
              Buffer.from(message.payload, 'base64').toString('hex'),
            )
          : message.payload,
      sendMode: message.sendMode,
      stateInit:
        typeof message.stateInit === 'string'
          ? TonWeb.boc.Cell.oneFromBoc(
              Buffer.from(message.stateInit, 'base64').toString('hex'),
            )
          : message.stateInit,
    })),
    true,
    encodedTx.validUntil,
  );
}

export function getAccountVersion(accountId: string) {
  if (accountUtils.isImportedAccount({ accountId })) {
    return accountId.split(SEPERATOR)[3];
  }
  const { idSuffix: version } = accountUtils.parseAccountId({ accountId });
  return version;
}

export interface IJettonTransferBodyParams {
  queryId?: number;
  tokenAmount: string;
  toAddress: string;
  responseAddress: string;
  forwardAmount?: string;
  forwardPayload?: Uint8Array | Cell;
}

export async function encodeJettonPayload({
  backgroundApi,
  params,
  networkId,
  jettonAddress,
}: {
  backgroundApi: IBackgroundApi;
  address: string;
  jettonAddress: string;
  params: IJettonTransferBodyParams;
  networkId: string;
}) {
  const jettonWallet = new TonWeb.token.jetton.JettonWallet(
    new Provider({ backgroundApi, networkId }),
    {
      address: jettonAddress,
    },
  );
  const body = await jettonWallet.createTransferBody({
    queryId: params.queryId,
    jettonAmount: new TonWeb.utils.BN(params.tokenAmount),
    toAddress: new TonWeb.Address(params.toAddress),
    responseAddress: new TonWeb.Address(params.responseAddress),
    forwardAmount: params.forwardAmount
      ? new TonWeb.utils.BN(params.forwardAmount)
      : undefined,
    forwardPayload: params.forwardPayload,
  } as unknown as TransferBodyParams);
  return {
    payload: Buffer.from(await body.toBoc()).toString('base64'),
  };
}

export async function getJettonData({
  backgroundApi,
  networkId,
  address,
}: {
  backgroundApi: IBackgroundApi;
  networkId: string;
  address: string;
}) {
  const jettonWallet = new TonWeb.token.jetton.JettonWallet(
    new Provider({ backgroundApi, networkId }),
    {
      address,
    } as any,
  );
  return jettonWallet.getData();
}
