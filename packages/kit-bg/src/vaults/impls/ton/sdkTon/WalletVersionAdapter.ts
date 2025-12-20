/* eslint-disable spellcheck/spell-checker */
/* eslint-disable max-classes-per-file */
import { Address, beginCell } from '@ton/core';

import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';

import type { Cell, StateInit } from '@ton/core';

/**
 * The general internal message constructor
 * All wallet versions are shared because this is the ton standard
 */
export function buildInternalMessage(
  dest: string,
  amount: bigint,
  body: Cell | undefined,
  bounce: boolean,
  stateInit: StateInit | undefined,
): Cell {
  const msgCell = beginCell();

  // Internal message header
  msgCell.storeBit(0); // tag
  msgCell.storeBit(true); // ihr_disabled
  msgCell.storeBit(bounce); // bounce
  msgCell.storeBit(false); // bounced
  msgCell.storeAddress(null); // src
  msgCell.storeAddress(Address.parse(dest)); // dest
  msgCell.storeCoins(amount); // value
  msgCell.storeBit(false); // currency_collection
  msgCell.storeCoins(0); // ihr_fee
  msgCell.storeCoins(0); // fwd_fee
  msgCell.storeUint(0, 64); // created_lt
  msgCell.storeUint(0, 32); // created_at

  // StateInit handling
  if (stateInit) {
    msgCell.storeBit(true);
    msgCell.storeBit(true); // always as ref
    const stateInitCell = beginCell()
      .storeBit(Boolean(stateInit.code))
      .storeBit(Boolean(stateInit.data))
      .storeBit(false)
      .storeMaybeRef(stateInit.code)
      .storeMaybeRef(stateInit.data);
    msgCell.storeRef(stateInitCell.endCell());
  } else {
    msgCell.storeBit(false);
  }

  // Body handling - classic compatibility logic
  if (body) {
    const freeBits = msgCell.availableBits - 1;
    const freeRefs = 4 - msgCell.refs;

    if (freeBits >= body.bits.length && freeRefs >= body.refs.length) {
      // Inline body
      msgCell.storeBit(false);
      msgCell.storeBuilder(body.asBuilder());
    } else {
      // Ref body
      msgCell.storeBit(true);
      msgCell.storeRef(body);
    }
  } else {
    msgCell.storeBit(false);
  }

  return msgCell.endCell();
}

export interface IWalletVersionAdapter {
  /**
   * wallet version
   */
  getName(): string;

  /**
   * build signing message
   */
  buildSigningMessage(params: {
    walletId: number;
    seqno: number;
    timeout?: number;
    messages: Array<{
      address: string;
      amount: bigint;
      body?: Cell;
      bounce: boolean;
      stateInit?: StateInit;
      sendMode: number;
    }>;
  }): Cell;

  getDefaultWalletId(workchain: number): number;
}

export class WalletV4R2Adapter implements IWalletVersionAdapter {
  getName(): string {
    return 'v4R2';
  }

  getDefaultWalletId(workchain: number): number {
    return 698_983_191 + workchain;
  }

  buildSigningMessage(params: {
    walletId: number;
    seqno: number;
    timeout?: number;
    messages: Array<{
      address: string;
      amount: bigint;
      body?: Cell;
      bounce: boolean;
      stateInit?: StateInit;
      sendMode: number;
    }>;
  }): Cell {
    const { walletId, seqno, timeout, messages } = params;

    const signingMessageBuilder = beginCell().storeUint(walletId, 32);

    // v4 r2 specific logic: Write 0xffffffff when seqno 0
    if (seqno === 0) {
      // eslint-disable-next-line no-plusplus
      for (let i = 0; i < 32; i++) {
        signingMessageBuilder.storeBit(1);
      }
    } else {
      const expireAt = timeout || Math.floor(Date.now() / 1e3) + 60;
      signingMessageBuilder.storeUint(expireAt, 32);
    }

    signingMessageBuilder.storeUint(seqno, 32).storeUint(0, 8); // op = 0 for simple send

    // push messages
    for (const message of messages) {
      const internalMsg = buildInternalMessage(
        message.address,
        message.amount,
        message.body,
        message.bounce,
        message.stateInit,
      );

      signingMessageBuilder
        .storeUint(message.sendMode, 8)
        .storeRef(internalMsg);
    }

    return signingMessageBuilder.endCell();
  }
}

export class WalletAdapterFactory {
  private static adapters: Map<string, IWalletVersionAdapter> = new Map([
    ['v4R2', new WalletV4R2Adapter()],
  ]);

  static getAdapter(version: string): IWalletVersionAdapter {
    const adapter = this.adapters.get(version);
    if (!adapter) {
      throw new OneKeyInternalError(`Unsupported wallet version: ${version}`);
    }
    return adapter;
  }

  static registerAdapter(
    version: string,
    adapter: IWalletVersionAdapter,
  ): void {
    this.adapters.set(version, adapter);
  }

  static getSupportedVersions(): string[] {
    return Array.from(this.adapters.keys());
  }
}
