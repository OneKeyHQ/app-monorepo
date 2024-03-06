import { parseAddress } from '@ckb-lumos/helpers';
import BigNumber from 'bignumber.js';

import type { Cell } from '@ckb-lumos/base';
import type { Indexer } from '@ckb-lumos/ckb-indexer';
import type { RPC } from '@ckb-lumos/rpc';

export const DEFAULT_CONFIRM_BLOCK = 20;

export async function loadCellsByAddress(indexer: Indexer, address: string) {
  const script = parseAddress(address);

  const collector = indexer.collector({ lock: script, type: 'empty' });
  const collected: Cell[] = [];
  for await (const cell of collector.collect()) {
    collected.push(cell);
  }

  return collected;
}

export async function fetchConfirmCellsByAddress(
  client: RPC,
  indexer: Indexer,
  address: string,
) {
  const script = parseAddress(address);
  const blockNumber = await client.getTipBlockNumber();
  const collector = indexer.collector({ lock: script, type: 'empty' });
  const collected: Cell[] = [];
  for await (const cell of collector.collect()) {
    if (
      new BigNumber(blockNumber, 16)
        .minus(new BigNumber(cell.blockNumber ?? '0x0', 16))
        .isGreaterThan(DEFAULT_CONFIRM_BLOCK)
    ) {
      collected.push(cell);
    }
  }

  return collected;
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

export async function getBalancesByAddress(indexer: Indexer, address: string) {
  const cells = await loadCellsByAddress(indexer, address);

  return cells.reduce(
    (acc, cell) => acc.plus(new BigNumber(cell.cellOutput.capacity, 16)),
    new BigNumber(0),
  );
}
