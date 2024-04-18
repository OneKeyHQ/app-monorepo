import { bytes, number } from '@ckb-lumos/codec';
import { parseAddress } from '@ckb-lumos/helpers';
import BigNumber from 'bignumber.js';

import { getConfig } from './config';

import type { Cell, Script } from '@ckb-lumos/base';
import type { Indexer } from '@ckb-lumos/ckb-indexer';
import type { Config } from '@ckb-lumos/config-manager';
import type { RPC } from '@ckb-lumos/rpc';

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

async function collectFilteredCellsByAddress({
  indexer,
  address,
  type,
  onAllowCollect = () => true,
}: {
  indexer: Indexer;
  address: string;
  type?: Script;
  onAllowCollect?: (cell: Cell) => Promise<boolean> | boolean;
}) {
  let config;
  if (address.startsWith('ckt')) {
    config = getConfig('testnet');
  } else {
    config = getConfig('mainnet');
  }

  const script = parseAddress(address, { config });
  const collector = indexer.collector({ lock: script, type: type ?? 'empty' });
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
  type?: Script;
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
  type?: Script;
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
  type?: Script;
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
  type?: Script;
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
  config,
  type,
}: {
  indexer: Indexer;
  address: string;
  type?: Script;
  config: Config;
}) {
  const cells = await fetchCellsByAddress({ indexer, address, type });

  return cells.reduce(
    (acc, cell) => acc.plus(decodeBalanceWithCell(cell, config)),
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
