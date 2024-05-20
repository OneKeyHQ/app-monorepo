import { bytes, number } from '@ckb-lumos/codec';
import BigNumber from 'bignumber.js';

import type { Cell } from '@ckb-lumos/base';
import type { Config } from '@ckb-lumos/config-manager';

export const DEFAULT_CONFIRM_BLOCK = 24;

export function decodeNaiveBalance(cell: Cell): BigNumber {
  // Native CKB
  return new BigNumber(cell.cellOutput.capacity, 16);
}

export function decodeBalanceWithCell(cell: Cell, config: Config): BigNumber {
  if (cell?.cellOutput?.type) {
    // XUDT
    if (cell?.cellOutput?.type?.codeHash === config.SCRIPTS.XUDT?.CODE_HASH) {
      return new BigNumber(
        number.Uint128.unpack(bytes.bytify(cell.data).slice(0, 16)).toString(),
      );
    }

    // SUDT
    if (cell?.cellOutput?.type?.codeHash === config.SCRIPTS.SUDT?.CODE_HASH) {
      return new BigNumber(
        number.Uint128LE.unpack(
          bytes.bytify(cell.data).slice(0, 16),
        ).toString(),
      );
    }
  }

  // Native CKB
  return decodeNaiveBalance(cell);
}

export function selectCellsByAddress(
  confirmCell: Cell[],
  targetAmount: BigNumber,
) {
  let collectedSum = new BigNumber(0);
  const collected: Cell[] = [];

  for (const cell of confirmCell) {
    collectedSum = collectedSum.plus(
      new BigNumber(cell.cellOutput.capacity, 16),
    );
    collected.push(cell);
    if (collectedSum.isGreaterThanOrEqualTo(targetAmount)) break;
  }

  return { collected, collectedSum };
}
