/* eslint-disable no-plusplus */
import { beginCell, storeMessageRelaxed } from '@ton/core';

import type { Cell, MessageRelaxed, SendMode } from '@ton/ton';

export type IMaybe<T> = T | null | undefined;

export type IWalletV4BasicSendArgs = {
  seqno: number;
  messages: MessageRelaxed[];
  sendMode?: IMaybe<SendMode>;
  timeout?: IMaybe<number>;
};

export function packSignatureToFront(
  signature: Buffer,
  signingMessage: Cell,
): Cell {
  const body = beginCell()
    .storeBuffer(signature)
    // .storeBuilder(signingMessage)
    .storeSlice(signingMessage.beginParse())
    .endCell();

  return body;
}

export function createWalletTransferV4<T extends IWalletV4BasicSendArgs>(
  args: T & { sendMode: number; walletId: number },
) {
  // Check number of messages
  if (args.messages.length > 4) {
    throw Error('Maximum number of messages in a single transfer is 4');
  }

  const signingMessage = beginCell().storeUint(args.walletId, 32);
  if (args.seqno === 0) {
    for (let i = 0; i < 32; i++) {
      signingMessage.storeBit(1);
    }
  } else {
    signingMessage.storeUint(
      args.timeout || Math.floor(Date.now() / 1e3) + 60,
      32,
    ); // Default timeout: 60 seconds
  }
  signingMessage.storeUint(args.seqno, 32);
  signingMessage.storeUint(0, 8); // Simple order
  for (const m of args.messages) {
    signingMessage.storeUint(args.sendMode, 8);
    signingMessage.storeRef(beginCell().store(storeMessageRelaxed(m)));
  }

  return signingMessage;
}
