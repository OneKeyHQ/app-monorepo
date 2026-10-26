import { assign, isEmpty, isNil, uniqBy } from 'lodash';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { gateLocalWalletHistoryTx } from '@onekeyhq/shared/src/utils/privacyChainHistoryAddressGate';
import type { ILocalWalletHistoryAddressGate } from '@onekeyhq/shared/src/utils/privacyChainHistoryAddressGate';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import type { IDecodedTxAction } from '@onekeyhq/shared/types/tx';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

const { buildAccountLocalAssetsKey } = accountUtils;

function clearHistoryTxDisplayStatus(tx: IAccountHistoryTx) {
  if (!tx.displayStatus && !tx.displayStatusSource) {
    return tx;
  }
  const { displayStatus, displayStatusSource, ...rest } = tx;
  return rest;
}

// Local-wallet chains tag every row with its history side. Only public-side
// rows may be persisted here; private rows are owned by the chain runtime and
// must never be cached outside it.
export function canPersistLocalHistoryTx({
  tx,
}: {
  networkId: string;
  tx: IAccountHistoryTx;
}) {
  if (tx.privacyChainHistorySide === undefined) {
    // A row that carries pool ids came from a local-wallet runtime; without
    // an explicit public marker it must not be cached here.
    return tx.privacyChainHistoryPoolIds === undefined;
  }
  return tx.privacyChainHistorySide === 'public';
}

function clearHistoryTxsDisplayStatus(txs: IAccountHistoryTx[]) {
  return txs.map((tx) => clearHistoryTxDisplayStatus(tx));
}

function sanitizeLocalHistoryTxs({
  networkId,
  txs,
}: {
  networkId: string;
  txs: IAccountHistoryTx[];
}) {
  return clearHistoryTxsDisplayStatus(
    txs.filter((tx) => canPersistLocalHistoryTx({ networkId, tx })),
  );
}

// An older concurrent poll must not put an expired public local-wallet send
// back into Pending. A subsequently mined/terminal backend row still wins.
function preserveDroppedLocalWalletHistory({
  currentConfirmed,
  pending,
  confirmed,
}: {
  currentConfirmed: IAccountHistoryTx[];
  pending: IAccountHistoryTx[];
  confirmed: IAccountHistoryTx[];
}) {
  const dropped = currentConfirmed.filter(
    (tx) =>
      tx.privacyChainHistorySide === 'public' &&
      tx.decodedTx.status === EDecodedTxStatus.Dropped &&
      tx.decodedTx.broadcastOutcomeUnknown === false,
  );
  if (!dropped.length) return { pending, confirmed };
  const ids = new Set(dropped.map((tx) => tx.decodedTx.txid.toLowerCase()));
  const minedPendingIds = new Set(
    pending
      .filter((tx) => (tx.decodedTx.block ?? 0) > 0)
      .map((tx) => tx.decodedTx.txid.toLowerCase()),
  );
  return {
    pending: pending.filter(
      (tx) =>
        !ids.has(tx.decodedTx.txid.toLowerCase()) ||
        minedPendingIds.has(tx.decodedTx.txid.toLowerCase()),
    ),
    confirmed: [
      ...dropped
        .filter((tx) => !minedPendingIds.has(tx.decodedTx.txid.toLowerCase()))
        .map(
          (tx) =>
            confirmed.find(
              (candidate) =>
                candidate.decodedTx.txid.toLowerCase() ===
                  tx.decodedTx.txid.toLowerCase() &&
                (candidate.decodedTx.status === EDecodedTxStatus.Confirmed ||
                  candidate.decodedTx.status === EDecodedTxStatus.Failed ||
                  (candidate.decodedTx.block ?? 0) > 0),
            ) ?? tx,
        ),
      ...confirmed.filter((tx) => !ids.has(tx.decodedTx.txid.toLowerCase())),
    ],
  };
}

function getStoredLocalHistoryNetworkId({
  key,
  txs,
}: {
  key: string;
  txs: IAccountHistoryTx[];
}) {
  // Keys are `${networkId}_...`; networkIds never contain '_'.
  const [prefix] = key.split('_');
  if (prefix && prefix.includes('--')) {
    return prefix;
  }
  return txs[0]?.decodedTx.networkId ?? '';
}

function clearLocalHistoryDisplayStatus(
  data?: ILocalHistory | null,
): ILocalHistory | undefined | null {
  if (!data) {
    return data;
  }
  return {
    ...data,
    pendingTxs: Object.fromEntries(
      Object.entries(data.pendingTxs ?? {}).map(([key, txs]) => [
        key,
        sanitizeLocalHistoryTxs({
          networkId: getStoredLocalHistoryNetworkId({ key, txs }),
          txs,
        }),
      ]),
    ),
    confirmedTxs: Object.fromEntries(
      Object.entries(data.confirmedTxs ?? {}).map(([key, txs]) => [
        key,
        sanitizeLocalHistoryTxs({
          networkId: getStoredLocalHistoryNetworkId({ key, txs }),
          txs,
        }),
      ]),
    ),
  };
}

export interface ILocalHistory {
  pendingTxs: Record<string, IAccountHistoryTx[]>; // Record<networkId_accountAddress/xpub, IAccountHistoryTx[]>
  confirmedTxs: Record<string, IAccountHistoryTx[]>; // Record<networkId_accountAddress/xpub, IAccountHistoryTx[]>
}

export class SimpleDbEntityLocalHistory extends SimpleDbEntityBase<ILocalHistory> {
  entityName = 'localHistory';

  override enableCache = false;

  // Background-only: an unsuccessful broadcast may have an input journal but
  // no history row. Serialize its cleanup against concurrent history writers.
  async runIfHistoryTxAbsent({
    networkId,
    accountAddress,
    xpub,
    txid,
    operation,
  }: {
    networkId: string;
    accountAddress: string;
    xpub?: string;
    txid: string;
    operation: () => Promise<void>;
  }): Promise<void> {
    const key = buildAccountLocalAssetsKey({ networkId, accountAddress, xpub });
    await this.mutex.runExclusive(async () => {
      const raw = await this.getRawData();
      if (
        [
          ...(raw?.pendingTxs?.[key] ?? []),
          ...(raw?.confirmedTxs?.[key] ?? []),
        ].some((tx) => tx.decodedTx.txid.toLowerCase() === txid.toLowerCase())
      )
        return;
      await operation();
    });
  }

  // Background-only: read and change the current row under the same mutex as
  // cache/account deletion. Never rebuild a row from a pre-network snapshot.
  async dropPendingLocalHistoryTx({
    networkId,
    accountAddress,
    xpub,
    txid,
    addressGate,
    isCurrent,
  }: {
    networkId: string;
    accountAddress: string;
    xpub?: string;
    txid: string;
    addressGate: ILocalWalletHistoryAddressGate;
    isCurrent: () => Promise<boolean>;
  }): Promise<boolean> {
    const key = buildAccountLocalAssetsKey({ networkId, accountAddress, xpub });
    const matches = (tx: IAccountHistoryTx) =>
      tx.decodedTx.txid.toLowerCase() === txid.toLowerCase();
    const result = await this.setRawDataTransaction({
      shouldCommit: () => true,
      beforePublish: isCurrent,
      build: async (raw) => {
        const pending = raw?.pendingTxs?.[key] ?? [];
        const confirmed = raw?.confirmedTxs?.[key] ?? [];
        const row = confirmed.find(matches) ?? pending.find(matches);
        if (
          !raw ||
          !row ||
          row.decodedTx.networkId !== networkId ||
          !canPersistLocalHistoryTx({ networkId, tx: row }) ||
          (row.decodedTx.block ?? 0) > 0 ||
          (row.decodedTx.status !== EDecodedTxStatus.Pending &&
            row.decodedTx.status !== EDecodedTxStatus.Dropped) ||
          !(await isCurrent())
        )
          return undefined;
        const dropped = gateLocalWalletHistoryTx(
          addressGate,
          clearHistoryTxDisplayStatus({
            ...row,
            decodedTx: {
              ...row.decodedTx,
              status: EDecodedTxStatus.Dropped,
              broadcastOutcomeUnknown: false,
            },
          }),
        );
        return {
          data: {
            ...raw,
            pendingTxs: {
              ...raw.pendingTxs,
              [key]: pending.filter((tx) => !matches(tx)),
            },
            confirmedTxs: {
              ...raw.confirmedTxs,
              [key]: [dropped, ...confirmed.filter((tx) => !matches(tx))].slice(
                0,
                50,
              ),
            },
          },
        };
      },
    });
    return result.committed;
  }

  @backgroundMethod()
  override async getRawData() {
    const data = await super.getRawData();
    return clearLocalHistoryDisplayStatus(data);
  }

  @backgroundMethod()
  public async getLocalHistoryTxById({
    networkId,
    accountAddress,
    xpub,
    historyId,
  }: {
    networkId: string;
    accountAddress?: string;
    xpub?: string;
    historyId: string;
  }) {
    if (!accountAddress && !xpub) {
      throw new OneKeyInternalError('accountAddress or xpub is required');
    }

    const key = buildAccountLocalAssetsKey({ networkId, accountAddress, xpub });

    const rawData = await this.getRawData();
    const pendingTxs = rawData?.pendingTxs?.[key] || [];
    const confirmedTxs = rawData?.confirmedTxs?.[key] || [];

    const tx = [...pendingTxs, ...confirmedTxs].find(
      (item) => item.id === historyId,
    );
    return tx ? clearHistoryTxDisplayStatus(tx) : undefined;
  }

  @backgroundMethod()
  public async getLocalPendingHistoryByNetwork({
    networkId,
  }: {
    networkId: string;
  }): Promise<{ pendingTxs: ILocalHistory['pendingTxs'] }> {
    const rawData = await this.getRawData();

    const pendingTxs = Object.fromEntries(
      Object.entries(rawData?.pendingTxs ?? {}).filter(([key]) =>
        key.startsWith(networkId),
      ),
    );

    return {
      pendingTxs: Object.fromEntries(
        Object.entries(pendingTxs).map(([key, txs]) => [
          key,
          sanitizeLocalHistoryTxs({ networkId, txs }),
        ]),
      ),
    };
  }

  // Drop pending/confirmed history belonging to deleted accounts and prune stale
  // pending txs. `validOwners` is the set of lowercased addresses/xpubs of all
  // surviving accounts. Pure-cache cleanup (re-derived from chain on next refresh).
  // See ServiceAppCleanup.cleanupOrphanedAssetCaches.
  @backgroundMethod()
  async removeOrphanData({ validOwners }: { validOwners: string[] }) {
    const existing = await this.getRawData();
    if (!existing) {
      return;
    }
    const validOwnerSet = new Set(validOwners.map((o) => o.toLowerCase()));
    await this.setRawData((rawData) => {
      // Trust the in-mutex fresh value, not the pre-mutex `existing` snapshot: a
      // concurrent clearRawData ("Clear cache" calls localHistory.clearRawData)
      // nulls the store, and `?? existing` would resurrect the cleared cache.
      const base = rawData;
      // Only orphan-filter (drop keys for removed accounts); do NOT age-prune
      // pendingTxs. ServiceFreshAddress derives "addresses occupied by a local
      // pending tx" from pendingTxs, so dropping a still-unconfirmed entry would
      // let BTC fresh-address hand back an address that is already in use — even
      // when the chain has not yet surfaced the tx. pendingTxs drains naturally
      // as txs confirm, and removed-account keys are still dropped below.
      const nextPending: Record<string, IAccountHistoryTx[]> = {};
      for (const [key, txs] of Object.entries(base?.pendingTxs ?? {})) {
        if (
          accountUtils.isLocalAssetsKeyOwnedBy({
            key,
            validOwners: validOwnerSet,
          })
        ) {
          nextPending[key] = txs;
        }
      }
      const nextConfirmed: Record<string, IAccountHistoryTx[]> = {};
      for (const [key, txs] of Object.entries(base?.confirmedTxs ?? {})) {
        if (
          accountUtils.isLocalAssetsKeyOwnedBy({
            key,
            validOwners: validOwnerSet,
          })
        ) {
          nextConfirmed[key] = txs;
        }
      }
      return {
        ...base,
        pendingTxs: nextPending,
        confirmedTxs: nextConfirmed,
      };
    });
  }

  @backgroundMethod()
  public async restoreLocalHistoryPendingTx({
    networkId,
    accountAddress,
    historyTx,
  }: {
    networkId: string;
    accountAddress: string;
    historyTx: IAccountHistoryTx;
  }): Promise<boolean> {
    if (
      !accountAddress ||
      historyTx.decodedTx.networkId !== networkId ||
      historyTx.decodedTx.status !== EDecodedTxStatus.Pending ||
      historyTx.replacedNextId
    ) {
      throw new OneKeyInternalError('Invalid pending history recovery');
    }
    const key = buildAccountLocalAssetsKey({ networkId, accountAddress });
    let restored = false;
    await this.setRawData((rawData) => {
      const pending = rawData?.pendingTxs?.[key] ?? [];
      const confirmed = rawData?.confirmedTxs?.[key] ?? [];
      // Check inside the storage lock: a confirmation or replacement may have
      // been recorded while the recovery's chain request was in flight.
      if (
        [...pending, ...confirmed].some(
          (tx) =>
            tx.id === historyTx.id ||
            tx.replacedPrevId === historyTx.id ||
            tx.decodedTx.nonce === historyTx.decodedTx.nonce,
        )
      )
        return rawData ?? { pendingTxs: {}, confirmedTxs: {} };
      restored = true;
      return {
        ...rawData,
        confirmedTxs: rawData?.confirmedTxs ?? {},
        pendingTxs: {
          ...rawData?.pendingTxs,
          [key]: [clearHistoryTxDisplayStatus(historyTx), ...pending],
        },
      };
    });
    return restored;
  }

  @backgroundMethod()
  public async saveLocalHistoryPendingTxs({
    networkId,
    accountAddress,
    xpub,
    txs,
  }: {
    networkId: string;
    accountAddress?: string;
    xpub?: string;
    txs: IAccountHistoryTx[];
  }) {
    return this.saveLocalHistoryTxs({
      networkId,
      accountAddress,
      xpub,
      pendingTxs: txs,
    });
  }

  @backgroundMethod()
  public async saveLocalHistoryConfirmedTxs({
    networkId,
    accountAddress,
    xpub,
    txs,
  }: {
    networkId: string;
    accountAddress?: string;
    xpub?: string;
    txs: IAccountHistoryTx[];
  }) {
    return this.saveLocalHistoryTxs({
      networkId,
      accountAddress,
      xpub,
      confirmedTxs: txs,
    });
  }

  @backgroundMethod()
  public async updateLocalHistoryConfirmedTxs({
    networkId,
    accountAddress,
    xpub,
    confirmedTxsToSave,
    confirmedTxsToRemove,
  }: {
    networkId: string;
    accountAddress?: string;
    xpub?: string;
    confirmedTxsToSave?: IAccountHistoryTx[];
    confirmedTxsToRemove?: IAccountHistoryTx[];
  }) {
    return this.batchUpdateLocalHistoryTxs([
      {
        networkId,
        accountAddress,
        xpub,
        confirmedTxsToSave,
        confirmedTxsToRemove,
      },
    ]);
  }

  @backgroundMethod()
  public async saveLocalHistoryTxs({
    networkId,
    accountAddress,
    xpub,
    pendingTxs,
    confirmedTxs,
  }: {
    networkId: string;
    accountAddress?: string;
    xpub?: string;
    pendingTxs?: IAccountHistoryTx[];
    confirmedTxs?: IAccountHistoryTx[];
  }) {
    if (!accountAddress && !xpub) {
      throw new OneKeyInternalError('accountAddress or xpub is required');
    }

    const key = buildAccountLocalAssetsKey({ networkId, accountAddress, xpub });

    if (isEmpty(pendingTxs) && isEmpty(confirmedTxs)) return;
    const now = Date.now();
    const result = await this.setRawDataTransaction({
      shouldCommit: () => true,
      build: (rawData) => {
        let finalPendingTxs = rawData?.pendingTxs?.[key] ?? [];
        let finalConfirmedTxs = rawData?.confirmedTxs?.[key] ?? [];

        if (pendingTxs) {
          const previousById = new Map(
            finalPendingTxs.map((tx) => [tx.id, tx]),
          );
          const storablePendingTxs = sanitizeLocalHistoryTxs({
            networkId,
            txs: pendingTxs,
          });
          finalPendingTxs = uniqBy(
            [
              ...storablePendingTxs.map((tx) => {
                const previous = previousById.get(tx.id)?.decodedTx;
                const createdAt = Math.min(
                  previous?.createdAt ?? now,
                  tx.decodedTx.createdAt ?? now,
                );
                return {
                  ...tx,
                  decodedTx: {
                    ...tx.decodedTx,
                    createdAt,
                    updatedAt: createdAt,
                  },
                };
              }),
              ...finalPendingTxs,
            ],
            (tx) => tx.id,
          ).filter((tx) => tx.decodedTx.status === EDecodedTxStatus.Pending);
        }

        if (confirmedTxs) {
          finalConfirmedTxs = uniqBy(
            [
              ...sanitizeLocalHistoryTxs({ networkId, txs: confirmedTxs }),
              ...finalConfirmedTxs.map((tx) => clearHistoryTxDisplayStatus(tx)),
            ],
            (tx) => tx.id,
          ).filter((tx) => tx.decodedTx.status !== EDecodedTxStatus.Pending);
        }

        const preserved = preserveDroppedLocalWalletHistory({
          currentConfirmed: rawData?.confirmedTxs?.[key] ?? [],
          pending: finalPendingTxs,
          confirmed: finalConfirmedTxs,
        });
        return {
          data: {
            ...rawData,
            pendingTxs: assign({}, rawData?.pendingTxs, {
              [key]: preserved.pending,
            }),
            confirmedTxs: assign({}, rawData?.confirmedTxs, {
              [key]: preserved.confirmed.slice(0, 50),
            }),
          },
        };
      },
    });
    return result.committed ? (result.data ?? undefined) : undefined;
  }

  @backgroundMethod()
  public async updateLocalHistoryPendingTxs({
    networkId,
    accountAddress,
    xpub,
    confirmedTxs,
    onChainHistoryTxs,
    pendingTxs: pendingTxsFromOut,
  }: {
    networkId: string;
    accountAddress?: string;
    xpub?: string;
    confirmedTxs?: IAccountHistoryTx[];
    onChainHistoryTxs?: IAccountHistoryTx[];
    pendingTxs?: IAccountHistoryTx[];
  }) {
    return this.batchUpdateLocalHistoryTxs([
      {
        networkId,
        accountAddress,
        xpub,
        confirmedTxs,
        onChainHistoryTxs,
        pendingTxs: pendingTxsFromOut,
      },
    ]);
  }

  @backgroundMethod()
  async batchUpdateLocalHistoryTxs(
    params: {
      networkId: string;
      accountAddress?: string;
      xpub?: string;
      confirmedTxs?: IAccountHistoryTx[];
      onChainHistoryTxs?: IAccountHistoryTx[];
      pendingTxs?: IAccountHistoryTx[];
      confirmedTxsToSave?: IAccountHistoryTx[];
      confirmedTxsToRemove?: IAccountHistoryTx[];
      pendingTxsToModify?: IAccountHistoryTx[];
    }[],
  ) {
    const result = await this.setRawDataTransaction({
      shouldCommit: () => true,
      build: (rawData) => {
        const pendingTxsToUpdateMap: Record<string, IAccountHistoryTx[]> = {};
        const confirmedTxsToUpdateMap: Record<string, IAccountHistoryTx[]> = {};

        for (const param of params) {
          const {
            networkId,
            accountAddress,
            xpub,
            confirmedTxs,
            onChainHistoryTxs,
            pendingTxs: pendingTxsFromOut,
            confirmedTxsToSave,
            confirmedTxsToRemove,
            pendingTxsToModify,
          } = param;
          if (!accountAddress && !xpub) {
            throw new OneKeyInternalError('accountAddress or xpub is required');
          }
          const key = buildAccountLocalAssetsKey({
            networkId,
            accountAddress,
            xpub,
          });

          // pendingTxsToUpdate build
          let pendingTxsToUpdate: IAccountHistoryTx[] | undefined;
          const currentPendingTxs = rawData?.pendingTxs?.[key];
          if (pendingTxsFromOut) {
            if (isEmpty(pendingTxsFromOut) && isEmpty(currentPendingTxs)) {
              pendingTxsToUpdate = undefined;
            } else {
              pendingTxsToUpdate = pendingTxsFromOut;

              if (pendingTxsToModify?.length) {
                pendingTxsToUpdate = uniqBy(
                  [...pendingTxsToModify, ...pendingTxsToUpdate],
                  (tx) => tx.id,
                );
              }
            }
          } else {
            // eslint-disable-next-line no-lonely-if
            if (isEmpty(confirmedTxs) && isEmpty(onChainHistoryTxs)) {
              pendingTxsToUpdate = undefined;
            } else if (currentPendingTxs?.length) {
              //
              const newPendingTxs: IAccountHistoryTx[] = [];
              for (const pendingTx of currentPendingTxs) {
                const onChainHistoryTx = onChainHistoryTxs?.find(
                  (item) =>
                    item.id === pendingTx.id ||
                    (item.originalId && item.originalId === pendingTx.id),
                );

                const confirmedTx = confirmedTxs?.find(
                  (item) =>
                    item.id === pendingTx.id ||
                    (item.originalId && item.originalId === pendingTx.id),
                );

                if (!onChainHistoryTx && !confirmedTx) {
                  const modifiedTx = pendingTxsToModify?.find(
                    (modTx) => modTx.id === pendingTx.id,
                  );
                  newPendingTxs.push(modifiedTx || pendingTx);
                }
              }

              if (pendingTxsToModify?.length) {
                const existingIds = new Set(newPendingTxs.map((tx) => tx.id));
                const newModifiedTxs = pendingTxsToModify.filter(
                  (tx) => !existingIds.has(tx.id),
                );
                newPendingTxs.push(...newModifiedTxs);
              }
              pendingTxsToUpdate = newPendingTxs;
            }
          }
          if (pendingTxsToUpdate) {
            pendingTxsToUpdateMap[key] = sanitizeLocalHistoryTxs({
              networkId,
              txs: pendingTxsToUpdate,
            });
          }

          // confirmedTxsToUpdate build
          let confirmedTxsToUpdate: IAccountHistoryTx[] | undefined;
          if (isEmpty(confirmedTxsToSave) && isEmpty(confirmedTxsToRemove)) {
            confirmedTxsToUpdate = undefined;
          } else {
            let finalConfirmedTxs = rawData?.confirmedTxs?.[key] || [];
            finalConfirmedTxs = uniqBy(
              [
                ...sanitizeLocalHistoryTxs({
                  networkId,
                  txs: confirmedTxsToSave ?? [],
                }),
                ...finalConfirmedTxs.map((tx) =>
                  clearHistoryTxDisplayStatus(tx),
                ),
              ],
              (tx) => tx.id,
            );
            if (confirmedTxsToRemove && !isEmpty(confirmedTxsToRemove)) {
              finalConfirmedTxs = finalConfirmedTxs.filter(
                (tx) => !confirmedTxsToRemove.find((item) => item.id === tx.id),
              );
            }
            confirmedTxsToUpdate = finalConfirmedTxs.slice(0, 50);
          }
          if (confirmedTxsToUpdate) {
            confirmedTxsToUpdateMap[key] = confirmedTxsToUpdate;
          }
          if (pendingTxsToUpdate || confirmedTxsToUpdate) {
            const preserved = preserveDroppedLocalWalletHistory({
              currentConfirmed: (rawData?.confirmedTxs?.[key] ?? []).filter(
                (tx) =>
                  !confirmedTxsToRemove?.some(
                    (removed) => removed.id === tx.id,
                  ),
              ),
              pending: pendingTxsToUpdate ?? rawData?.pendingTxs?.[key] ?? [],
              confirmed:
                confirmedTxsToUpdate ?? rawData?.confirmedTxs?.[key] ?? [],
            });
            pendingTxsToUpdateMap[key] = preserved.pending;
            confirmedTxsToUpdateMap[key] = preserved.confirmed.slice(0, 50);
          }
        }

        if (
          isEmpty(pendingTxsToUpdateMap) &&
          isEmpty(confirmedTxsToUpdateMap)
        ) {
          return undefined;
        }

        return {
          data: {
            ...rawData,
            pendingTxs: assign({}, rawData?.pendingTxs, pendingTxsToUpdateMap),
            confirmedTxs: assign(
              {},
              rawData?.confirmedTxs,
              confirmedTxsToUpdateMap,
            ),
          },
        };
      },
    });
    return result.committed ? (result.data ?? undefined) : undefined;
  }

  @backgroundMethod()
  public async updateLocalHistoryConfirmedTxStatus(params: {
    networkId: string;
    accountAddress?: string;
    xpub?: string;
    txid: string;
    status: EDecodedTxStatus;
  }) {
    const { networkId, accountAddress, xpub, txid, status } = params;

    if (!accountAddress && !xpub) {
      throw new OneKeyInternalError('accountAddress or xpub is required');
    }
    const key = buildAccountLocalAssetsKey({ networkId, accountAddress, xpub });

    const result = await this.setRawDataTransaction({
      shouldCommit: () => true,
      build: (rawData) => {
        const confirmedTxs = rawData?.confirmedTxs?.[key] || [];

        const targetTxIndex = confirmedTxs.findIndex(
          (tx) => tx.decodedTx.txid === txid,
        );

        if (targetTxIndex === -1) {
          return undefined;
        }

        const targetTx = confirmedTxs[targetTxIndex];
        const updatedTx = clearHistoryTxDisplayStatus({
          ...targetTx,
          decodedTx: {
            ...targetTx.decodedTx,
            status,
          },
        });

        if (targetTx.decodedTx.status === status && targetTx === updatedTx) {
          return undefined;
        }

        const updatedConfirmedTxs = [...confirmedTxs];
        updatedConfirmedTxs[targetTxIndex] = updatedTx;

        const preserved = preserveDroppedLocalWalletHistory({
          currentConfirmed: confirmedTxs,
          pending: rawData?.pendingTxs?.[key] ?? [],
          confirmed: updatedConfirmedTxs,
        });
        return {
          data: {
            ...rawData,
            pendingTxs: { ...rawData?.pendingTxs, [key]: preserved.pending },
            confirmedTxs: assign({}, rawData?.confirmedTxs, {
              [key]: preserved.confirmed,
            }),
          },
        };
      },
    });
    return result.committed ? (result.data ?? undefined) : undefined;
  }

  @backgroundMethod()
  public async getAccountsLocalHistoryPendingTxs(
    params: {
      networkId: string;
      accountAddress: string;
      xpub?: string;
      tokenIdOnNetwork?: string;
    }[],
  ) {
    params.forEach(({ accountAddress, xpub }) => {
      if (!accountAddress && !xpub) {
        throw new OneKeyInternalError('accountAddress or xpub is required');
      }
    });

    const pendingTxs = (await this.getRawData())?.pendingTxs;

    let accountsPendingTxs = params.flatMap(
      ({ networkId, accountAddress, xpub }) => {
        const key = buildAccountLocalAssetsKey({
          networkId,
          accountAddress,
          xpub,
        });
        return pendingTxs?.[key] ?? [];
      },
    );

    accountsPendingTxs = this._arrangeLocalTxs({
      txs: accountsPendingTxs,
    });

    return accountsPendingTxs;
  }

  @backgroundMethod()
  public async getAccountLocalHistoryPendingTxs(params: {
    networkId: string;
    accountAddress: string;
    xpub?: string;
    tokenIdOnNetwork?: string;
  }) {
    const { accountAddress, xpub, networkId, tokenIdOnNetwork } = params;

    if (!accountAddress && !xpub) {
      throw new OneKeyInternalError('accountAddress or xpub is required');
    }

    const key = buildAccountLocalAssetsKey({ networkId, accountAddress, xpub });

    let accountPendingTxs = (await this.getRawData())?.pendingTxs?.[key] ?? [];

    accountPendingTxs = this._arrangeLocalTxs({
      txs: accountPendingTxs,
      tokenIdOnNetwork,
    });

    return accountPendingTxs;
  }

  @backgroundMethod()
  public async getAccountLocalHistoryConfirmedTxs(params: {
    networkId: string;
    accountAddress?: string;
    xpub?: string;
    tokenIdOnNetwork?: string;
  }) {
    const { accountAddress, xpub, networkId, tokenIdOnNetwork } = params;

    if (!accountAddress && !xpub) {
      throw new OneKeyInternalError('accountAddress or xpub is required');
    }

    const key = buildAccountLocalAssetsKey({ networkId, accountAddress, xpub });

    let accountConfirmedTxs =
      (await this.getRawData())?.confirmedTxs?.[key] || [];

    accountConfirmedTxs = this._arrangeLocalTxs({
      txs: accountConfirmedTxs,
      tokenIdOnNetwork,
    });

    return accountConfirmedTxs;
  }

  @backgroundMethod()
  public async getAccountsLocalHistoryConfirmedTxs(
    params: {
      networkId: string;
      accountAddress?: string;
      xpub?: string;
      tokenIdOnNetwork?: string;
    }[],
  ) {
    params.forEach(({ accountAddress, xpub }) => {
      if (!accountAddress && !xpub) {
        throw new OneKeyInternalError('accountAddress or xpub is required');
      }
    });

    const confirmedTxs = (await this.getRawData())?.confirmedTxs;

    let accountsConfirmedTxs = params.flatMap(
      ({ networkId, accountAddress, xpub }) => {
        const key = buildAccountLocalAssetsKey({
          networkId,
          accountAddress,
          xpub,
        });
        return confirmedTxs?.[key] ?? [];
      },
    );

    accountsConfirmedTxs = this._arrangeLocalTxs({
      txs: accountsConfirmedTxs,
    });

    return accountsConfirmedTxs;
  }

  @backgroundMethod()
  async getPendingNonceList(props: {
    networkId: string;
    accountAddress: string;
    xpub?: string;
  }): Promise<number[]> {
    const { accountAddress, xpub, networkId } = props;
    const pendingTxs = await this.getAccountLocalHistoryPendingTxs({
      accountAddress,
      xpub,
      networkId,
    });
    const nonceList = pendingTxs.map((tx) => tx.decodedTx.nonce);
    return nonceList || [];
  }

  @backgroundMethod()
  async getMaxPendingNonce(props: {
    networkId: string;
    accountAddress: string;
    xpub?: string;
  }): Promise<number | null> {
    const nonceList = await this.getPendingNonceList(props);
    if (nonceList.length) {
      const nonce = Math.max(...nonceList);
      if (Number.isNaN(nonce) || nonce === Infinity || nonce === -Infinity) {
        return null;
      }
      return nonce;
    }
    return null;
  }

  @backgroundMethod()
  async getMinPendingNonce(props: {
    networkId: string;
    accountAddress: string;
    xpub?: string;
  }): Promise<number | null> {
    const nonceList = await this.getPendingNonceList(props);
    if (nonceList.length) {
      const nonce = Math.min(...nonceList);
      if (Number.isNaN(nonce) || nonce === Infinity || nonce === -Infinity) {
        return null;
      }
      return nonce;
    }
    return null;
  }

  @backgroundMethod()
  async clearLocalHistoryPendingTxs() {
    return this.setRawData((rawData) => {
      const confirmedTxs = rawData?.confirmedTxs || {};
      return {
        ...rawData,
        pendingTxs: {},
        confirmedTxs,
      };
    });
  }

  async clearAccountLocalHistory({
    networkId,
    accountAddress,
    xpub,
  }: {
    networkId: string;
    accountAddress?: string;
    xpub?: string;
  }) {
    const key = buildAccountLocalAssetsKey({
      networkId,
      accountAddress,
      xpub,
    });
    return this.setRawData((rawData) => {
      const pendingTxs = { ...rawData?.pendingTxs };
      const confirmedTxs = { ...rawData?.confirmedTxs };
      delete pendingTxs[key];
      delete confirmedTxs[key];
      return { ...rawData, pendingTxs, confirmedTxs };
    });
  }

  @backgroundMethod()
  async clearLocalHistory() {
    return this.setRawData({
      pendingTxs: {},
      confirmedTxs: {},
    });
  }

  private _getAccountLocalHistoryTxs(params: {
    networkId: string;
    accountAddress: string;
    xpub?: string;
    txs: IAccountHistoryTx[];
  }) {
    const { accountAddress, xpub, networkId, txs } = params;

    if (xpub) {
      return txs.filter(
        (tx) =>
          tx.decodedTx.xpub?.toLowerCase() === xpub.toLowerCase() &&
          tx.decodedTx.networkId === networkId,
      );
    }

    return txs.filter(
      (tx) =>
        tx.decodedTx.owner.toLowerCase() === accountAddress.toLowerCase() &&
        tx.decodedTx.networkId === networkId,
    );
  }

  private _checkIsActionIncludesToken(params: {
    historyTx: IAccountHistoryTx;
    action: IDecodedTxAction;
    tokenIdOnNetwork: string;
  }) {
    const { action, tokenIdOnNetwork, historyTx } = params;

    const { assetTransfer, tokenApprove } = action;

    return (
      assetTransfer?.sends.find(
        (send) => send.tokenIdOnNetwork === tokenIdOnNetwork,
      ) ||
      assetTransfer?.receives.find(
        (receive) => receive.tokenIdOnNetwork === tokenIdOnNetwork,
      ) ||
      tokenApprove?.tokenIdOnNetwork === tokenIdOnNetwork ||
      (historyTx.decodedTx?.tokenIdOnNetwork === tokenIdOnNetwork &&
        tokenIdOnNetwork)
    );
  }

  private _arrangeLocalTxs({
    txs,
    tokenIdOnNetwork,
  }: {
    txs: IAccountHistoryTx[];
    tokenIdOnNetwork?: string;
  }) {
    let result = clearHistoryTxsDisplayStatus(txs).toSorted(
      (b, a) =>
        (a.decodedTx.updatedAt ?? a.decodedTx.createdAt ?? 0) -
        (b.decodedTx.updatedAt ?? b.decodedTx.createdAt ?? 0),
    );

    if (!isNil(tokenIdOnNetwork)) {
      result = result.filter(
        (tx) =>
          ([] as IDecodedTxAction[])
            .concat(tx.decodedTx.actions)
            .concat(tx.decodedTx.outputActions || [])
            .filter(
              (action) =>
                action &&
                this._checkIsActionIncludesToken({
                  historyTx: tx,
                  action,
                  tokenIdOnNetwork,
                }),
            ).length > 0,
      );
    }

    return result;
  }
}
