/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Cell,
  beginCell,
  external,
  fromNano,
  internal,
  loadStateInit,
  storeMessage,
  toNano,
} from '@ton/core';
import { Address, SendMode } from '@ton/ton';
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

import { Provider } from './provider';

import type { StateInit as ITonStateInit } from '@ton/core';
import type { TransferBodyParams } from 'tonweb/dist/types/contract/token/ft/jetton-wallet';

export { decodePayload } from './payload';

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

export type IInitData = ITonStateInit;

export const getTonSendMode = (max: string | undefined) => {
  return max === '1'
    ? SendMode.CARRY_ALL_REMAINING_BALANCE
    : SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS;
};

export const seeIfBounceable = (address: string) => {
  return Address.isFriendly(address)
    ? Address.parseFriendly(address).isBounceable
    : false;
};

export const toStateInit = (
  stateInit?: string,
  { complete = false }: { complete?: boolean } = {},
): IInitData | undefined => {
  if (!stateInit) {
    return undefined;
  }

  const initSlice = Cell.fromBase64(stateInit).beginParse();
  // Preserve the existing software/App-assembled transaction behavior.
  // A device rebuilding from the original StateInit uses the complete form.
  if (!complete) {
    return { code: initSlice.loadRef(), data: initSlice.loadRef() };
  }
  const init = loadStateInit(initSlice);
  initSlice.endParse();
  return init;
};

export async function serializeUnsignedTransaction({
  contract,
  encodedTx,
  sendMode = SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
  timeout,
  fullStateInit = false,
}: {
  contract: IWallet;
  encodedTx: IEncodedTxTon;
  sendMode?: number;
  timeout?: number;
  fullStateInit?: boolean;
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
      timeout,
      messages: encodedTx.messages.map((message) => {
        let body: Cell | undefined;

        if (message.payload) {
          body = Cell.fromBase64(message.payload);
        }

        return internal({
          to: message.address,
          value: toNano(fromNano(message.amount)),
          bounce: seeIfBounceable(message.address),
          body,
          init: toStateInit(message.stateInit, { complete: fullStateInit }),
        });
      }),
      sendMode,
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
    return accountId.split(SEPERATOR)?.[3] || '';
  }
  const { idSuffix: version } = accountUtils.parseAccountId({ accountId });
  return version || '';
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
