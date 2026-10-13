import {
  Cell,
  beginCell,
  loadCommonMessageInfoRelaxed,
  loadStateInit,
  storeCommonMessageInfoRelaxed,
  storeMessageRelaxed,
} from '@ton/core';
import TonWeb from 'tonweb';

import type {
  IEncodedTxTon,
  ITonMessage,
} from '@onekeyhq/core/src/chains/ton/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import { decodePayload, encodeDecodedJetton } from './payload';

import type { MessageRelaxed, StateInit } from '@ton/core';

function readMessage(cell: Cell): { message: MessageRelaxed; initCell?: Cell } {
  const slice = cell.beginParse();
  const info = loadCommonMessageInfoRelaxed(slice);
  let init: StateInit | undefined;
  let originalInit: Cell | undefined;
  if (slice.loadBit()) {
    if (slice.loadBit()) {
      const initCell = slice.loadRef();
      const initSlice = initCell.beginParse();
      init = loadStateInit(initSlice);
      initSlice.endParse();
      originalInit = initCell;
    } else {
      const start = slice.clone();
      init = loadStateInit(slice);
      const builder = beginCell().storeBits(
        start.loadBits(start.remainingBits - slice.remainingBits),
      );
      const refs = start.remainingRefs - slice.remainingRefs;
      for (let index = 0; index < refs; index += 1) {
        builder.storeRef(start.loadRef());
      }
      originalInit = builder.endCell();
    }
  }
  let body: Cell;
  if (slice.loadBit()) {
    body = slice.loadRef();
    slice.endParse();
  } else {
    body = slice.asCell();
  }
  return { message: { info, init, body }, initCell: originalInit };
}

function canonicalMessage(cell: Cell): { cell: Cell; initHash?: string } {
  const { message, initCell } = readMessage(cell);
  const jetton = decodePayload(message.body.toBoc()).jetton;
  if (jetton) {
    // The Either wrapper can differ while the forwarded Cell stays identical.
    message.body = encodeDecodedJetton(jetton);
  }
  // Re-encoding the complete parsed message also covers extra currencies,
  // all header flags and the full StateInit, including libraries.
  return {
    cell: beginCell()
      .store(storeMessageRelaxed(message, { forceRef: true }))
      .endCell(),
    // The inner StateInit hash determines a deployment address; only its
    // outer Either wrapper may change without changing transaction semantics.
    initHash: initCell?.hash().toString('hex'),
  };
}

export function preserveTonStateInitCells(
  signingMessage: Cell,
  messages: ITonMessage[],
): Cell {
  const slice = signingMessage.beginParse();
  const builder = beginCell().storeBits(slice.loadBits(104));
  let index = 0;
  while (slice.remainingRefs > 0) {
    builder.storeUint(slice.loadUint(8), 8);
    const messageCell = slice.loadRef();
    const stateInit = messages[index]?.stateInit;
    index += 1;
    if (stateInit) {
      // Firmware preserves the supplied Cell. Re-encoding its dictionary can
      // change the deployment address even when all parsed fields are equal.
      const originalInit = Cell.fromBase64(stateInit);
      const initSlice = originalInit.beginParse();
      loadStateInit(initSlice);
      initSlice.endParse();
      const messageSlice = messageCell.beginParse();
      const info = loadCommonMessageInfoRelaxed(messageSlice);
      if (!messageSlice.loadBit()) {
        throw new OneKeyLocalError('Missing TON StateInit in signing message');
      }
      const asRef = messageSlice.loadBit();
      if (asRef) {
        messageSlice.loadRef();
      } else {
        loadStateInit(messageSlice);
      }
      const messageBuilder = beginCell()
        .store(storeCommonMessageInfoRelaxed(info))
        .storeBit(true)
        .storeBit(asRef);
      if (asRef) {
        messageBuilder.storeRef(originalInit);
      } else {
        messageBuilder.storeSlice(originalInit.beginParse());
      }
      builder.storeRef(messageBuilder.storeSlice(messageSlice).endCell());
    } else {
      builder.storeRef(messageCell);
    }
  }
  slice.endParse();
  return builder.endCell();
}

export function getTonHardwareSigningMessageCandidates(
  expected: Cell,
  forwardVariants: boolean[],
): Cell[] {
  const slice = expected.beginParse();
  const header = slice.loadBits(104);
  let batches: { mode: number; message: Cell }[][] = [[]];
  let index = 0;
  while (slice.remainingRefs > 0) {
    const mode = slice.loadUint(8);
    const { message, initCell } = readMessage(slice.loadRef());
    const jetton = forwardVariants[index]
      ? decodePayload(message.body.toBoc()).jetton
      : undefined;
    const bodies = jetton
      ? [encodeDecodedJetton(jetton, false), encodeDecodedJetton(jetton, true)]
      : [message.body];
    const layouts: Cell[] = [];
    for (const body of bodies) {
      for (const asRef of [false, true]) {
        const builder = beginCell()
          .store(storeCommonMessageInfoRelaxed(message.info))
          .storeBit(!!initCell);
        if (initCell) {
          builder.storeBit(true).storeRef(initCell);
        }
        if (asRef && builder.refs < 4) {
          layouts.push(builder.storeBit(true).storeRef(body).endCell());
        } else if (
          !asRef &&
          !body.isExotic &&
          builder.availableBits >= body.bits.length + 1 &&
          builder.refs + body.refs.length <= 4
        ) {
          layouts.push(
            builder.storeBit(false).storeSlice(body.beginParse()).endCell(),
          );
        }
      }
    }
    const unique = [
      ...new Map(
        layouts.map((cell) => [cell.hash().toString('hex'), cell]),
      ).values(),
    ];
    batches = batches.flatMap((batch) =>
      unique.map((cell) => [...batch, { mode, message: cell }]),
    );
    index += 1;
  }
  slice.endParse();
  return batches.map((batch) => {
    const builder = beginCell().storeBits(header);
    batch.forEach((item) =>
      builder.storeUint(item.mode, 8).storeRef(item.message),
    );
    return builder.endCell();
  });
}

export function areTonSigningMessagesEquivalent(
  expected: Cell,
  actual: Cell,
): boolean {
  try {
    const expectedSlice = expected.beginParse();
    const actualSlice = actual.beginParse();
    // Wallet v4: wallet ID, valid-until, seqno and operation.
    if (
      expectedSlice.loadUintBig(104) !== actualSlice.loadUintBig(104) ||
      expectedSlice.remainingRefs !== actualSlice.remainingRefs
    ) {
      return false;
    }
    while (expectedSlice.remainingRefs > 0) {
      if (expectedSlice.loadUint(8) !== actualSlice.loadUint(8)) {
        return false;
      }
      const expectedMessage = canonicalMessage(expectedSlice.loadRef());
      const actualMessage = canonicalMessage(actualSlice.loadRef());
      if (
        expectedMessage.initHash !== actualMessage.initHash ||
        !expectedMessage.cell.hash().equals(actualMessage.cell.hash())
      ) {
        return false;
      }
    }
    expectedSlice.endParse();
    actualSlice.endParse();
    return true;
  } catch {
    return false;
  }
}

export function resolveTonHardwareSigningMessage({
  expected,
  alternateExpected,
  candidates,
  returnedMessage,
  signature,
  publicKey,
}: {
  expected: Cell;
  alternateExpected?: Cell;
  candidates: Cell[];
  returnedMessage?: string | null;
  signature: Uint8Array;
  publicKey: Uint8Array;
}): Cell {
  try {
    // The SDK may rebuild a transaction or sign the App's representation.
    // Both expectations must be prepared from trusted inputs before signing.
    const isExpected = (actual: Cell) =>
      areTonSigningMessagesEquivalent(expected, actual) ||
      (!!alternateExpected &&
        areTonSigningMessagesEquivalent(alternateExpected, actual));
    // Interpret the receipt itself. Legacy skip_validate conflates Classic
    // hashes with responses that omit the signing message altogether.
    const receipt = returnedMessage?.replace(/^0x/u, '');
    if (receipt && !/^[a-f\d]{64}$/iu.test(receipt)) {
      const actual = Cell.fromHex(receipt);
      if (isExpected(actual)) {
        return actual;
      }
    } else {
      for (const candidate of candidates) {
        const matches = receipt
          ? candidate.hash().toString('hex') === receipt.toLowerCase()
          : TonWeb.utils.nacl.sign.detached.verify(
              candidate.hash(),
              signature,
              publicKey,
            );
        if (matches && isExpected(candidate)) {
          return candidate;
        }
      }
    }
  } catch {
    // Reject malformed responses and signatures without replacing transaction content.
  }
  throw new OneKeyLocalError(
    appLocale.intl.formatMessage({
      id: ETranslations.feedback_failed_to_sign_transaction,
    }),
  );
}

export function decodeTonSigningMessage({
  signingMessage,
  from,
}: {
  signingMessage: Cell;
  from: string;
}): IEncodedTxTon {
  const slice = signingMessage.beginParse();
  slice.loadUint(32); // Wallet ID belongs to the selected wallet contract.
  const validUntil = slice.loadUint(32);
  const sequenceNo = slice.loadUint(32);
  if (slice.loadUint(8) !== 0) {
    throw new OneKeyLocalError('Unsupported TON wallet operation');
  }
  const messages: ITonMessage[] = [];
  while (slice.remainingRefs > 0) {
    const sendMode = slice.loadUint(8);
    const { message, initCell } = readMessage(slice.loadRef());
    if (message.info.type !== 'internal') {
      throw new OneKeyLocalError('Unsupported TON message type');
    }
    messages.push({
      address: message.info.dest.toString({ bounceable: message.info.bounce }),
      amount: message.info.value.coins.toString(),
      sendMode,
      payload:
        message.body.bits.length || message.body.refs.length
          ? message.body.toBoc({ idx: false }).toString('base64')
          : undefined,
      stateInit: initCell?.toBoc({ idx: false }).toString('base64'),
    });
  }
  slice.endParse();
  return { from, sequenceNo, validUntil, messages };
}
