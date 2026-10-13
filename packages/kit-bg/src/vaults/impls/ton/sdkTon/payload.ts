import { Address, Cell, beginCell } from '@ton/core';

import { EDecodedTxActionType } from '@onekeyhq/shared/types/tx';

export type IDecodedTonJetton = {
  queryId: string;
  toAddress: string;
  amount: string;
  forwardAmount: string;
  responseAddress?: string;
  customPayload?: Cell;
  forwardPayload: Cell;
  comment?: string;
};

export type IDecodedTonPayload = {
  type: EDecodedTxActionType;
  bytes?: Uint8Array;
  jetton?: IDecodedTonJetton;
  comment?: string;
};

function decodeComment(cell: Cell): string | undefined {
  try {
    const slice = cell.beginParse();
    if (
      slice.loadUint(32) !== 0 ||
      (slice.remainingBits >= 8 && slice.preloadUint(8) === 0xff)
    ) {
      return undefined;
    }
    return slice.loadStringTail();
  } catch {
    return undefined;
  }
}

export function decodePayload(
  payload?: string | Uint8Array,
): IDecodedTonPayload {
  if (!payload) {
    return { type: EDecodedTxActionType.ASSET_TRANSFER };
  }
  const bytes =
    typeof payload === 'string'
      ? Buffer.from(payload, 'base64')
      : Buffer.from(payload);
  try {
    const roots = Cell.fromBoc(bytes);
    if (roots.length !== 1) {
      return { type: EDecodedTxActionType.UNKNOWN, bytes };
    }
    const cell = roots[0];
    const slice = cell.beginParse();
    const op = slice.loadUint(32);
    if (op === 0) {
      return {
        type: EDecodedTxActionType.ASSET_TRANSFER,
        bytes,
        comment: decodeComment(cell),
      };
    }
    if (op === 0x0f_8a_7e_a5) {
      const queryId = slice.loadUintBig(64).toString();
      const amount = slice.loadCoins().toString();
      const toAddress = slice.loadAddress().toString({ bounceable: false });
      const responseAddress = slice
        .loadMaybeAddress()
        ?.toString({ bounceable: false });
      const customPayload = slice.loadMaybeRef() ?? undefined;
      const forwardAmount = slice.loadCoins().toString();
      const isForwardPayloadRef = slice.loadBit();
      // Preserve every bit and reference; extracting bytes alone loses nested payloads.
      const forwardPayload = isForwardPayloadRef
        ? slice.loadRef()
        : slice.asCell();
      if (isForwardPayloadRef) {
        slice.endParse();
      }
      const comment = decodeComment(forwardPayload);
      const isEmpty =
        forwardPayload.bits.length === 0 && forwardPayload.refs.length === 0;
      return {
        type:
          isEmpty || comment !== undefined
            ? EDecodedTxActionType.ASSET_TRANSFER
            : EDecodedTxActionType.UNKNOWN,
        bytes,
        jetton: {
          queryId,
          amount,
          toAddress,
          responseAddress,
          customPayload,
          forwardAmount,
          forwardPayload,
          comment,
        },
      };
    }
  } catch {
    // Unknown or malformed payloads must not inherit dApp-provided transfer metadata.
  }
  return { type: EDecodedTxActionType.UNKNOWN, bytes };
}

export function encodeDecodedJetton(
  jetton: IDecodedTonJetton,
  forwardAsRef = true,
): Cell {
  const builder = beginCell()
    .storeUint(0x0f_8a_7e_a5, 32)
    .storeUint(BigInt(jetton.queryId), 64)
    .storeCoins(BigInt(jetton.amount))
    .storeAddress(Address.parse(jetton.toAddress))
    .storeAddress(
      jetton.responseAddress ? Address.parse(jetton.responseAddress) : null,
    )
    .storeMaybeRef(jetton.customPayload)
    .storeCoins(BigInt(jetton.forwardAmount));
  const forward = jetton.forwardPayload;
  const useRef =
    forwardAsRef ||
    builder.availableBits < forward.bits.length + 1 ||
    builder.refs + forward.refs.length > 4;
  builder.storeBit(useRef);
  if (useRef) {
    builder.storeRef(forward);
  } else {
    builder.storeSlice(forward.beginParse());
  }
  return builder.endCell();
}
