import pLimit from 'p-limit';

import type { IZcashInspectedTransaction } from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { LRUCache } from '@onekeyhq/shared/src/utils/cacheUtils';

import { isLocalWalletCacheEpochCurrent } from '../../localWallet/privacyChainCacheStore';

import { getZcashStoredUfvk } from './accountMeta';
import { canReadZcashPrivateData } from './vaultUtils';

import type Vault from './Vault';

type IEnrichment = {
  epoch: string | undefined;
  result: IZcashInspectedTransaction;
};

// Decrypted facts stay in memory. The lifecycle clears these with public snapshots.
const results = new LRUCache<string, IEnrichment>({
  max: 500,
  ttl: 5 * 60_000,
});
const running = new Map<string, Promise<void>>();
const limit = pLimit(2);
let generation = 0;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
const keyOf = (networkId: string, accountId: string, txid: string) =>
  `${networkId}:${accountId}:${txid.toLowerCase()}`;

export function getZcashHistoryEnrichment({
  networkId,
  accountId,
  txid,
  epoch,
}: {
  networkId: string;
  accountId: string;
  txid: string;
  epoch: string | undefined;
}): IZcashInspectedTransaction | undefined {
  const value = results.get(keyOf(networkId, accountId, txid));
  return value?.epoch === epoch ? value?.result : undefined;
}

export function clearZcashHistoryEnrichment({
  networkId,
  accountIds,
}: {
  networkId: string;
  accountIds?: string[];
}) {
  generation += 1;
  for (const key of results.keys()) {
    if (
      accountIds
        ? accountIds.some((id) => key.startsWith(`${networkId}:${id}:`))
        : key.startsWith(`${networkId}:`)
    ) {
      results.delete(key);
    }
  }
}

// Starts after returning backend rows. Only the wallet backend receives these
// already-public txids; the UFVK is passed only to the local keys worker.
export function scheduleZcashHistoryEnrichment(
  vault: Vault,
  {
    accountId,
    txids,
    epoch,
  }: {
    accountId: string;
    txids: string[];
    epoch: string | undefined;
  },
): void {
  const startedAtGeneration = generation;
  txids.slice(0, 40).forEach((txid) => {
    if (running.size >= 40) return;
    const key = keyOf(vault.networkId, accountId, txid);
    if (
      running.has(key) ||
      getZcashHistoryEnrichment({
        networkId: vault.networkId,
        accountId,
        txid,
        epoch,
      })
    )
      return;
    const task = limit(async () => {
      const fence = { backgroundApi: vault.backgroundApi, accountId, epoch };
      if (
        generation !== startedAtGeneration ||
        !(await isLocalWalletCacheEpochCurrent(fence))
      )
        return;
      const state =
        await vault.backgroundApi.simpleDb.privacyChainState.getZcashPrivacyModeState(
          { accountId },
        );
      const ufvk = canReadZcashPrivateData(state)
        ? await getZcashStoredUfvk({
            backgroundApi: vault.backgroundApi,
            networkId: vault.networkId,
            accountId,
          }).catch(() => undefined)
        : undefined;
      const api = await vault.zcashGetApi();
      const raws = await vault.backgroundApi.serviceSend.getRawTransactions({
        networkId: vault.networkId,
        txids: [txid],
        retries: 0,
      });
      const rawTx = raws[txid]?.rawTx;
      if (!rawTx) return;
      const transaction = { txid, rawTx };
      let inspected = await api.inspectTransaction({ transaction, ufvk });
      const previousIds = [
        ...new Set(inspected.inputs.map((input) => input.txid)),
      ];
      if (
        inspected.feeZat === null &&
        previousIds.length > 0 &&
        previousIds.length <= 256
      ) {
        const previous =
          await vault.backgroundApi.serviceSend.getRawTransactions({
            networkId: vault.networkId,
            txids: previousIds,
            retries: 0,
          });
        const previousTransactions = previousIds.flatMap((id) =>
          previous[id]?.rawTx ? [{ txid: id, rawTx: previous[id].rawTx }] : [],
        );
        inspected = await api.inspectTransaction({
          transaction,
          previousTransactions,
          ufvk,
        });
      }
      if (
        generation !== startedAtGeneration ||
        !(await isLocalWalletCacheEpochCurrent(fence))
      )
        return;
      results.set(key, { epoch, result: inspected });
      if (refreshTimer === undefined) {
        refreshTimer = setTimeout(() => {
          refreshTimer = undefined;
          appEventBus.emit(EAppEventBusNames.RefreshHistoryList, undefined);
        }, 500);
      }
    });
    running.set(key, task);
    void task
      .catch(() => undefined)
      .finally(() => {
        if (running.get(key) === task) running.delete(key);
      });
  });
}
