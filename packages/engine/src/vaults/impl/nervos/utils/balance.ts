import { parseAddress } from '@ckb-lumos/helpers';
import BigNumber from 'bignumber.js';

import type { Cell, Script } from '@ckb-lumos/base';
import type { Indexer } from '@ckb-lumos/ckb-indexer';
import type { RPC } from '@ckb-lumos/rpc';

export const DEFAULT_CONFIRM_BLOCK = 24;

async function collectFilteredCellsByAddress({
  indexer,
  address,
  onAllowCollect = () => true,
}: {
  indexer: Indexer;
  address: string;
  type?: Script | string;
  onAllowCollect?: (cell: Cell) => Promise<boolean> | boolean;
}) {
  const script = parseAddress(address);
  const collector = indexer.collector({ lock: script, type: 'empty' });
  const collected: Cell[] = [];
  for await (const cell of collector.collect()) {
    if (await onAllowCollect?.(cell)) {
      collected.push(cell);
    }
  }
  return collected;
}

export async function fetchCellsByAddress({
  indexer,
  address,
  type,
}: {
  indexer: Indexer;
  address: string;
  type?: Script | string;
}) {
  return collectFilteredCellsByAddress({
    indexer,
    address,
    type,
  });
}

export async function fetchConfirmCellsByAddress({
  indexer,
  address,
  type,
  client,
}: {
  indexer: Indexer;
  address: string;
  client: RPC;
  type?: Script | string;
}) {
  const blockNumber = await client.getTipBlockNumber();

  return collectFilteredCellsByAddress({
    indexer,
    address,
    type,
    onAllowCollect: (cell) =>
      new BigNumber(blockNumber, 16)
        .minus(new BigNumber(cell.blockNumber ?? '0x0', 16))
        .isGreaterThan(DEFAULT_CONFIRM_BLOCK),
  });
}

export async function fetchFrozenCellsByAddress({
  indexer,
  address,
  client,
  type,
}: {
  indexer: Indexer;
  address: string;
  client: RPC;
  type?: Script | string;
}) {
  const blockNumber = await client.getTipBlockNumber();

  return collectFilteredCellsByAddress({
    indexer,
    address,
    type,
    onAllowCollect: (cell) =>
      new BigNumber(blockNumber, 16)
        .minus(new BigNumber(cell.blockNumber ?? '0x0', 16))
        .isLessThan(DEFAULT_CONFIRM_BLOCK),
  });
}

export async function getFrozenBalancesByAddress({
  indexer,
  address,
  client,
  type,
}: {
  indexer: Indexer;
  address: string;
  client: RPC;
  type?: Script | string;
}) {
  const cells = await fetchFrozenCellsByAddress({
    indexer,
    address,
    client,
    type,
  });

  return cells.reduce(
    (acc, cell) => acc.plus(new BigNumber(cell.cellOutput.capacity, 16)),
    new BigNumber(0),
  );
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

export async function getBalancesByAddress({
  indexer,
  address,
}: {
  indexer: Indexer;
  address: string;
}) {
  const cells = await fetchCellsByAddress({ indexer, address });

  return cells.reduce(
    (acc, cell) => acc.plus(new BigNumber(cell.cellOutput.capacity, 16)),
    new BigNumber(0),
  );
}

export async function getConfirmBalancesByAddress({
  indexer,
  address,
  client,
}: {
  indexer: Indexer;
  address: string;
  client: RPC;
}) {
  const cells = await fetchConfirmCellsByAddress({ indexer, address, client });

  return cells.reduce(
    (acc, cell) => acc.plus(new BigNumber(cell.cellOutput.capacity, 16)),
    new BigNumber(0),
  );
}
