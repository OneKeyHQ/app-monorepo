import {
  getErc20TransferHistories,
  getTxHistories,
} from '../../../../managers/covalent';
import { TxStatus } from '../../../../types/covalent';

import { parseCovalent } from './covalentParser';
import { EVMTxDecoder } from './decoder';

import type { Engine } from '../../../..';
import type { Transaction } from '../../../../types/covalent';
import type { HistoryEntryTransaction } from '../../../../types/history';
import type { Network } from '../../../../types/network';

const PAGE_SIZE = 50;

const getTxHash = (h: HistoryEntryTransaction) => h.id.split('--').pop() ?? '';

const getMergedTxs = async (
  historyEntries: HistoryEntryTransaction[],
  network: Network,
  address: string,
  engine: Engine,
  contract?: string | null,
  isLocalOnly?: boolean,
) => {
  const chainId = parseInt(network.extraInfo.chainId).toString();

  let covalentTxs: Transaction[] = [];
  if (!isLocalOnly) {
    let covalent;
    try {
      if (contract) {
        covalent = await getErc20TransferHistories(
          chainId,
          address,
          contract,
          0,
          PAGE_SIZE,
        );
      } else {
        covalent = await getTxHistories(chainId, address, 0, PAGE_SIZE);
      }
    } catch (e) {
      console.error(e);
    }
    covalentTxs = covalent?.data.txList || [];
  }

  const settledCovalentTxs = covalentTxs.filter(
    (tx) => tx.successful !== TxStatus.Pending,
  );
  const localTxHashs = new Set(historyEntries.map((h) => getTxHash(h)));

  const { remote, both } = settledCovalentTxs.reduce<{
    remote: Transaction[];
    both: Record<string, Transaction>;
  }>(
    (acc, cur) => {
      const { txHash } = cur;
      if (localTxHashs.has(txHash)) {
        acc.both[txHash] = cur;
      } else {
        acc.remote.push(cur);
      }
      return acc;
    },
    { remote: [], both: {} },
  );

  const remoteTxs = remote.map((tx) => parseCovalent(tx, network, address));

  const localTxs = historyEntries.map(async (h) =>
    EVMTxDecoder.getDecoder(engine).decodeHistoryEntry(h, both[getTxHash(h)]),
  );
  const localTxsRes = await Promise.all(localTxs);
  return [...localTxsRes, ...remoteTxs];
};

export { getMergedTxs };
