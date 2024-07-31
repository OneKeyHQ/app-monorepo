import { EDecodedTxActionType } from '@onekeyhq/shared/types/tx';

import type { Cell } from 'tonweb/dist/types/boc/cell';

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
