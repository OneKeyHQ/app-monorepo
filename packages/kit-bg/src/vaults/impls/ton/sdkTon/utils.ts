/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Cell,
  beginCell,
  external,
  fromNano,
  internal,
  storeMessage,
  toNano,
} from '@ton/core';
import { Address, SendMode } from '@ton/ton';
import BigNumber from 'bignumber.js';
import TonWeb, { type StateInit } from 'tonweb';

import {
  createWalletTransferV4,
  packSignatureToFront,
} from '@onekeyhq/core/src/chains/ton/sdkTon/createWalletTransfer';
import type { IEncodedTxTon } from '@onekeyhq/core/src/chains/ton/types';
import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import { SEPERATOR } from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { EDecodedTxActionType } from '@onekeyhq/shared/types/tx';

import { Provider } from './provider';

import type { IAddressToString, ICell } from './types';
import type { TransferBodyParams } from 'tonweb/dist/types/contract/token/ft/jetton-wallet';

export function decodePayload(payload?: string | Uint8Array): {
  type: EDecodedTxActionType;
  bytes?: Uint8Array;
  jetton?: {
    queryId?: string;
    toAddress: string;
    amount: string;
    forwardAmount?: string;
    responseAddress?: string;
    forwardPayload?: Uint8Array;
    comment?: string;
  };
  comment?: string;
} {
  let type = EDecodedTxActionType.UNKNOWN;
  if (!payload) {
    type = EDecodedTxActionType.ASSET_TRANSFER;
    return { type };
  }
  let bytes;
  if (typeof payload === 'string') {
    try {
      bytes = Buffer.from(payload, 'base64');
    } catch (e) {
      try {
        bytes = Buffer.from(payload, 'hex');
      } catch (ee) {
        // ignore
      }
    }
  } else {
    bytes = Buffer.from(payload);
  }

  let jetton;
  if (bytes) {
    try {
      const cell = TonWeb.boc.Cell.oneFromBoc(bytes.toString('hex'));
      const slice = (cell as unknown as ICell).beginParse();
      const data = slice.loadUint(32);
      const op = new BigNumber(data.toString()).toString(16);
      if (op === 'f8a7ea5') {
        // jetton
        const queryId = slice.loadUint(64);
        const amount = slice.loadCoins();
        const toAddress = slice.loadAddress();
        const responseAddress = slice.loadAddress();
        slice.loadBit(); // isCustomPayload
        const forwardAmount = slice.loadCoins();
        const isForwardPayloadRef = slice.loadBit();
        let forwardPayload;
        let comment;
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
        } else {
          const fwdBuf = Buffer.from(forwardPayload);
          const fwdOp = new BigNumber(
            fwdBuf.subarray(0, 4).toString('hex'),
            16,
          ).toString(16);
          if (fwdOp === '0') {
            // comment
            type = EDecodedTxActionType.ASSET_TRANSFER;
            comment = fwdBuf.subarray(4).toString();
          }
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
          comment,
        };
      } else if (op === '0') {
        // comment
        type = EDecodedTxActionType.ASSET_TRANSFER;
        const comment = Buffer.from(
          slice.loadBits(slice.getFreeBits()),
        ).toString();
        return { type, comment };
      }
    } catch (e) {
      // ignore
    }
  }

  return { type, bytes, jetton };
}

type IV4R2 = typeof TonWeb.Wallets.all.v4R2;

export interface IWallet extends IV4R2 {
  getWalletId(): Promise<number>;
  getName(): string;
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
  address,
}: {
  version: string;
  publicKey?: string;
  backgroundApi: IBackgroundApi;
  networkId: string;
  address?: string;
}) {
  const Contract = getWalletContractClass(version);
  return new Contract(new Provider({ backgroundApi, networkId }), {
    publicKey: publicKey ? bufferUtils.hexToBytes(publicKey) : undefined,
    address,
  });
}

export interface IAmountValue {
  max?: string;
  amount: string;
}

export interface ITransactionState extends IAmountValue {
  address: string;
  data: string | Cell | undefined;
  hex?: string;
  isEncrypt?: boolean;
}

export interface IInitData {
  code?: Cell;
  data?: Cell;
}

export const getTonSendMode = (max: string | undefined) => {
  return max === '1'
    ? SendMode.CARRY_ALL_REMAINING_BALANCE
    : SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS;
};

const seeIfBounceable = (address: string) => {
  return Address.isFriendly(address)
    ? Address.parseFriendly(address).isBounceable
    : false;
};

export const toStateInit = (stateInit?: string): IInitData | undefined => {
  if (!stateInit) {
    return undefined;
  }

  const initSlice = Cell.fromBase64(stateInit).asSlice();
  return {
    code: initSlice.loadRef(),
    data: initSlice.loadRef(),
  };
};

export async function serializeUnsignedTransaction({
  contract,
  encodedTx,
}: {
  contract: IWallet;
  encodedTx: IEncodedTxTon;
}) {
  const name = contract.getName();

  if (name === 'v4R2') {
    // @ts-expect-error
    const walletId = contract?.options?.walletId;
    const stateInit =
      // @ts-expect-error
      // eslint-disable-next-line @typescript-eslint/await-thenable
      (await contract.createStateInit()) as unknown as StateInit;

    const signingMessage = createWalletTransferV4({
      seqno: encodedTx.sequenceNo || 0,
      messages: encodedTx.messages.map((message) =>
        internal({
          to: message.address,
          value: toNano(fromNano(message.amount)),
          bounce: seeIfBounceable(message.address),
          body: message.payload ? Cell.fromBase64(message.payload) : undefined,
          init: toStateInit(message.stateInit),
        }),
      ),
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
      walletId,
    });

    const { code, data } = stateInit;
    return {
      signingMessage: signingMessage.endCell(),

      stateInit: Cell.fromHex(
        Buffer.from(await stateInit.stateInit.toBoc(false)).toString('hex'),
      ),
      init_code: Cell.fromHex(
        Buffer.from(await code.toBoc(false)).toString('hex'),
      ),
      init_data: Cell.fromHex(
        Buffer.from(await data.toBoc(false)).toString('hex'),
      ),
    };
  }

  throw new OneKeyInternalError('Unsupported wallet contract version');
}

export async function createSignedExternalMessage({
  contract,
  encodedTx,
  signature,
  signingMessage,
}: {
  contract: IWallet;
  encodedTx: IEncodedTxTon;
  signature: string;
  signingMessage: Cell;
}) {
  const body = packSignatureToFront(
    Buffer.from(signature, 'hex'),
    signingMessage,
  );

  let stateInit: StateInit | undefined;
  // Activate Contract
  if (encodedTx.sequenceNo === 0) {
    // call createStateInit() return Promise<StateInit>
    // not call static method createStateInit()
    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/await-thenable
    stateInit = (await contract.createStateInit()) as StateInit;
  }

  const selfAddress = encodedTx.from;
  let ext;
  if (stateInit) {
    const { code, data } = stateInit;
    const codeCell = Cell.fromHex(
      Buffer.from(await code.toBoc(false)).toString('hex'),
    );
    const dataCell = Cell.fromHex(
      Buffer.from(await data.toBoc(false)).toString('hex'),
    );

    ext = external({
      to: selfAddress,
      init: stateInit ? { code: codeCell, data: dataCell } : undefined,
      body,
    });
  } else {
    ext = external({
      to: selfAddress,
      body,
    });
  }

  const resultMessage = beginCell().store(storeMessage(ext)).endCell();

  return {
    address: selfAddress,
    message: resultMessage, // old wallet_send_generate_external_message

    body,
    signature,
    signingMessage,

    stateInit: stateInit?.stateInit,
  };
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
  forwardPayload?: string;
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
    forwardPayload: params.forwardPayload
      ? TonWeb.boc.Cell.oneFromBoc(
          Buffer.from(params.forwardPayload, 'base64').toString('hex'),
        ).bits.array
      : undefined,
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

export async function getJettonWalletAddress({
  backgroundApi,
  networkId,
  masterAddress,
  address,
}: {
  backgroundApi: IBackgroundApi;
  networkId: string;
  masterAddress: string;
  address: string;
}) {
  const jettonMinter = new TonWeb.token.jetton.JettonMinter(
    new Provider({ backgroundApi, networkId }),
    {
      address: masterAddress,
    } as any,
  );
  return jettonMinter.getJettonWalletAddress(new TonWeb.Address(address));
}

export async function encodeComment(comment: string) {
  const cell = new TonWeb.boc.Cell();
  cell.bits.writeUint(0, 32);
  cell.bits.writeString(comment);
  return Buffer.from(await cell.toBoc()).toString('base64');
}
