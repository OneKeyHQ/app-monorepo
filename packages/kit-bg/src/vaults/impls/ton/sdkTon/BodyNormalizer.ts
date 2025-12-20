import { Cell, SendMode } from '@ton/core';

import type {
  IEncodedTxTon,
  ITonMessage,
} from '@onekeyhq/core/src/chains/ton/types';

import { type IWallet, seeIfBounceable, toStateInit } from './utils';
import { WalletAdapterFactory } from './WalletVersionAdapter';

import type { StateInit } from '@ton/core';

export async function createNormalizedWalletTransfer(
  contract: IWallet,
  encodedTx: IEncodedTxTon,
) {
  const stateInit =
    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/await-thenable
    (await contract.createStateInit()) as unknown as StateInit;

  const version = contract.getName ? contract.getName() : 'v4R2';
  const adapter = WalletAdapterFactory.getAdapter(version);

  const walletId =
    (await contract?.getWalletId()) ?? adapter.getDefaultWalletId(0);

  const messages = encodedTx.messages.map((message: ITonMessage) => {
    const sendMode =
      message.sendMode ?? SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS;

    let body: Cell | undefined;

    if (message.payload) {
      body = Cell.fromBase64(message.payload);
    }

    const bounce = seeIfBounceable(message.address);

    let amount;
    try {
      amount = BigInt(message.amount);
    } catch (error) {
      amount = BigInt(0);
    }

    return {
      address: message.address,
      amount,
      body,
      bounce,
      stateInit: toStateInit(message.stateInit),
      sendMode,
    };
  });

  const signingMessage = adapter.buildSigningMessage({
    walletId,
    seqno: encodedTx.sequenceNo || 0,
    timeout: encodedTx.validUntil,
    messages,
  });

  const { code, data } = stateInit;

  return {
    signingMessage,
    code,
    data,
  };
}
