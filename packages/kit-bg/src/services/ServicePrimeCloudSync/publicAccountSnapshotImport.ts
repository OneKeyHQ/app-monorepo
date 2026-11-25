import {
  getBip32FromBase58,
  getBtcForkNetwork,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';
import type { ICloudSyncCredential } from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';
import type {
  ICloudPublicAccountSnapshot,
  ICloudPublicAccountSnapshotResult,
} from '@onekeyhq/shared/types/prime/publicAccountSnapshot';

import { ELocalDBStoreNames } from '../../dbs/local/localDBStoreNames';
import { vaultFactory } from '../../vaults/factory';

import { preparePublicAccountIndexedNames } from './publicAccountIndexedNames';
import {
  PublicAccountSnapshotUnsupportedError,
  getLocalPublicAccountWalletMatchKey,
  getPublicAccountSnapshotId,
  getPublicAccountSnapshotTaprootDescriptor,
  getPublicAccountWalletMatchKey,
  normalizePublicAccountSnapshot,
  publicAccountSnapshotToAccount,
  publicAccountSyncIdentityEqual,
} from './publicAccountSnapshot';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type {
  IDBAccount,
  IDBCloudSyncItem,
  IDBWallet,
} from '../../dbs/local/types';
import type { VaultBase } from '../../vaults/base/VaultBase';
import type { IAccountDeriveInfo } from '../../vaults/types';

const BATCH_SIZE = 50;

export type IPublicAccountSnapshotApplyResult =
  ICloudPublicAccountSnapshotResult & {
    updated: number;
    deleted: number;
    indexedAccountsChanged: boolean;
    skippedSnapshotIds: string[];
    issuesBySnapshotId: Record<string, 'pending' | 'conflicts' | 'rejected'>;
  };

function emptyResult(): IPublicAccountSnapshotApplyResult {
  return {
    added: 0,
    updated: 0,
    deleted: 0,
    indexedAccountsChanged: false,
    issuesBySnapshotId: {},
    unchanged: 0,
    pending: 0,
    conflicts: 0,
    rejected: 0,
    cancelled: false,
    appliedSnapshotIds: [],
    skippedSnapshotIds: [],
  };
}

async function validatePublicAccount({
  snapshot,
  vault,
  deriveInfo,
  isCurrent,
}: {
  snapshot: ICloudPublicAccountSnapshot;
  vault: VaultBase;
  deriveInfo: IAccountDeriveInfo;
  isCurrent: () => boolean;
}): Promise<boolean> {
  if (snapshot.version === 2) {
    const { validatePublicAccount: validateV2PublicAccount } =
      await import('./publicAccountSnapshotValidation');
    return validateV2PublicAccount({ snapshot, vault, deriveInfo, isCurrent });
  }
  const account = snapshot.account;
  const address = await vault.validateAddress(account.address);
  if (!isCurrent() || !address.isValid) return false;

  if (account.impl === 'btc') {
    const xpub = account.xpub;
    const relPath = account.relPath;
    if (!xpub || !relPath || !account.addresses) return false;
    const validation = await vault.validateXpub(xpub);
    if (!isCurrent() || !validation.isValid) return false;
    const networkInfo = await vault.getCoreApiNetworkInfo();
    if (!isCurrent()) return false;
    const network = getBtcForkNetwork(networkInfo.networkChainCode);
    const node = getBip32FromBase58({ network, key: xpub });
    // Metadata consistency only: this cannot prove a hardened account key's
    // ancestry from the wallet fingerprint or another branch's public key.
    if (
      !node.isNeutered() ||
      node.depth !== 3 ||
      node.index !== 0x80_00_00_00 + account.pathIndex
    )
      return false;
    const derived = await coreChainApi.btc.hd.getAddressFromXpub({
      network,
      xpub,
      relativePaths: Array.from(
        new Set([relPath, ...Object.keys(account.addresses)]),
      ),
      addressEncoding: deriveInfo.addressEncoding,
    });
    return (
      isCurrent() &&
      derived.addresses[relPath] === account.address &&
      Object.entries(account.addresses).every(
        ([path, value]) => derived.addresses[path] === value,
      ) &&
      (!account.pub ||
        derived.publicKeys[relPath]?.toLowerCase() ===
          account.pub.toLowerCase()) &&
      (!account.xpubSegwit ||
        account.xpubSegwit === derived.xpubSegwit ||
        (derived.xpubSegwit === `tr(${xpub})` &&
          account.xpubSegwit ===
            getPublicAccountSnapshotTaprootDescriptor({
              walletXfp: snapshot.wallet.xfp,
              path: account.path,
              xpub,
            })))
    );
  }

  // Historical hardware accounts have no public key. Their provenance is the
  // authenticated Cloud snapshot plus the pre-existing local wallet binding.
  if (!account.pub) return true;
  const api =
    account.impl === 'evm' ? coreChainApi.evm.hd : coreChainApi.sol.hd;
  const networkInfo = await vault.getCoreApiNetworkInfo();
  if (!isCurrent()) return false;
  const derived = await api.getAddressFromPublic({
    networkInfo,
    publicKey: account.pub,
  });
  if (!isCurrent()) return false;
  const expected = await vault.validateAddress(derived.address);
  return (
    isCurrent() &&
    expected.isValid &&
    expected.normalizedAddress === address.normalizedAddress
  );
}

/** Restores public records only into wallets already added on this device. */
export async function importPublicAccountSnapshots({
  backgroundApi,
  snapshots,
  isCurrent,
  sourceItemsBySnapshotId,
  foreignAccountsByWireId,
  syncCredential,
  action = 'copy',
}: {
  backgroundApi: IBackgroundApi;
  snapshots: readonly unknown[];
  isCurrent: () => boolean;
  sourceItemsBySnapshotId?: ReadonlyMap<string, IDBCloudSyncItem>;
  foreignAccountsByWireId?: ReadonlyMap<string, IDBCloudSyncItem>;
  syncCredential?: ICloudSyncCredential;
  action?: 'copy' | 'delete';
}): Promise<IPublicAccountSnapshotApplyResult> {
  const result = emptyResult();
  const remainingWalletsBySnapshotId = new Map<string, Set<string>>();
  const finish = (cancelled: boolean): IPublicAccountSnapshotApplyResult => {
    for (const [id, remainingWallets] of remainingWalletsBySnapshotId) {
      if (!remainingWallets.size && !result.issuesBySnapshotId[id]) {
        result.appliedSnapshotIds.push(id);
      }
    }
    return { ...result, cancelled };
  };
  const recordIssue = (
    snapshot: ICloudPublicAccountSnapshot,
    issue: 'pending' | 'conflicts' | 'rejected',
  ) => {
    const id = getPublicAccountSnapshotId(snapshot);
    const previous = result.issuesBySnapshotId[id];
    if (!previous || previous === 'pending')
      result.issuesBySnapshotId[id] = issue;
  };
  if (!isCurrent()) return { ...result, cancelled: true };
  const { localDb } = backgroundApi;
  const { wallets } = await localDb.getAllWallets();
  if (!isCurrent()) return { ...result, cancelled: true };
  const walletsByIdentity = new Map<string, IDBWallet[]>();
  for (const wallet of wallets) {
    const key = getLocalPublicAccountWalletMatchKey(wallet);
    if (key) {
      const matches = walletsByIdentity.get(key) || [];
      matches.push({ ...wallet });
      walletsByIdentity.set(key, matches);
    }
  }

  const contexts = new Map<
    string,
    Promise<{
      ready: boolean;
      credential?: string;
    }>
  >();
  const getContext = (wallet: IDBWallet, kind: 'hardware' | 'hd') => {
    let context = contexts.get(wallet.id);
    if (!context) {
      context = (async () => {
        if (kind === 'hardware') {
          const device = wallet.associatedDevice
            ? await localDb.getDeviceSafe(wallet.associatedDevice)
            : undefined;
          return {
            ready: Boolean(
              isCurrent() &&
              device &&
              (device.vendor ?? EHardwareVendor.onekey) ===
                EHardwareVendor.onekey,
            ),
          };
        }
        const credential = (await localDb.getCredentialSafe(wallet.id))
          ?.credential;
        if (!isCurrent() || !credential) return { ready: false };
        return { ready: true, credential };
      })();
      contexts.set(wallet.id, context);
    }
    return context;
  };

  try {
    for (let offset = 0; offset < snapshots.length; offset += BATCH_SIZE) {
      if (!isCurrent()) return finish(true);
      const groups = new Map<
        string,
        {
          wallet: IDBWallet;
          snapshots: ICloudPublicAccountSnapshot[];
        }
      >();
      snapshots.slice(offset, offset + BATCH_SIZE).forEach((value) => {
        let snapshot: ICloudPublicAccountSnapshot;
        try {
          snapshot = normalizePublicAccountSnapshot(value);
        } catch (error) {
          if (error instanceof PublicAccountSnapshotUnsupportedError)
            result.pending += 1;
          else result.rejected += 1;
          return;
        }
        const matches = walletsByIdentity.get(
          getPublicAccountWalletMatchKey(snapshot.wallet),
        );
        const snapshotId = getPublicAccountSnapshotId(snapshot);
        if (!matches?.length) {
          result.skippedSnapshotIds.push(snapshotId);
          return;
        }
        const source = sourceItemsBySnapshotId?.get(snapshotId);
        // A cross-space cache handoff acknowledges its source inside the
        // single-wallet transaction. Keep it separate from shared scene replay.
        if (
          matches.length > 1 &&
          (snapshot.wallet.kind !== 'hardware' ||
            (source && foreignAccountsByWireId?.has(source.id)))
        ) {
          result.pending += 1;
          recordIssue(snapshot, 'pending');
          return;
        }
        if (!remainingWalletsBySnapshotId.has(snapshotId)) {
          remainingWalletsBySnapshotId.set(
            snapshotId,
            new Set(matches.map((wallet) => wallet.id)),
          );
        }
        for (const wallet of matches) {
          const key = `${wallet.id}__${snapshot.account.networkId}__${snapshot.account.template}__${snapshot.account.idSuffix || ''}`;
          const group = groups.get(key) || { wallet, snapshots: [] };
          group.snapshots.push(snapshot);
          groups.set(key, group);
        }
      });

      const processGroup = async ({
        wallet,
        snapshots: group,
      }: {
        wallet: IDBWallet;
        snapshots: ICloudPublicAccountSnapshot[];
      }): Promise<IPublicAccountSnapshotApplyResult | undefined> => {
        if (!isCurrent()) return finish(true);
        const first = group[0];
        const context = await getContext(wallet, first.wallet.kind);
        if (!isCurrent()) return finish(true);
        if (!context.ready) {
          result.pending += group.length;
          group.forEach((snapshot) => recordIssue(snapshot, 'pending'));
          return undefined;
        }
        const { credential } = context;

        let vault: VaultBase;
        let deriveInfo: IAccountDeriveInfo | undefined;
        try {
          vault = await vaultFactory.getWalletOnlyVault({
            walletId: wallet.id,
            networkId: first.account.networkId,
          });
          if (!isCurrent()) return finish(true);
          const settings = await vault.getVaultSettings();
          if (!isCurrent()) return finish(true);
          if (
            settings.impl === first.account.impl &&
            !(first.wallet.kind === 'hd' && settings.softwareAccountDisabled)
          ) {
            deriveInfo = Object.values(settings.accountDeriveInfo).find(
              (info) =>
                info.template === first.account.template &&
                info.coinType === first.account.coinType &&
                (info.idSuffix || '') === (first.account.idSuffix || ''),
            );
          }
        } catch (_error) {
          result.pending += group.length;
          group.forEach((snapshot) => recordIssue(snapshot, 'pending'));
          return undefined;
        }
        if (!deriveInfo) {
          result.pending += group.length;
          group.forEach((snapshot) => recordIssue(snapshot, 'pending'));
          return undefined;
        }

        const valid: IDBAccount[] = [];
        const validSnapshots: ICloudPublicAccountSnapshot[] = [];
        const conflictingIds = new Set<string>();
        const existingById = new Map<string, IDBAccount>();
        if (first.version === 2) {
          const { records } = await localDb.getRecordsByIds({
            name: ELocalDBStoreNames.Account,
            ids: group.map(
              (snapshot) =>
                publicAccountSnapshotToAccount(snapshot, wallet.id).id,
            ),
          });
          if (!isCurrent()) return finish(true);
          for (const account of records)
            if (account) existingById.set(account.id, account);
        }
        for (const snapshot of group) {
          try {
            const account = publicAccountSnapshotToAccount(snapshot, wallet.id);
            const existing = existingById.get(account.id);
            if (
              (existing && publicAccountSyncIdentityEqual(existing, account)) ||
              (await validatePublicAccount({
                snapshot,
                vault,
                deriveInfo,
                isCurrent,
              }))
            ) {
              const previous = valid.find((item) => item.id === account.id);
              if (conflictingIds.has(account.id)) {
                result.conflicts += 1;
                recordIssue(snapshot, 'conflicts');
              } else if (
                previous &&
                !publicAccountSyncIdentityEqual(previous, account)
              ) {
                conflictingIds.add(account.id);
                result.conflicts +=
                  valid.filter((item) => item.id === account.id).length + 1;
                recordIssue(snapshot, 'conflicts');
                validSnapshots
                  .filter(
                    (value) =>
                      publicAccountSnapshotToAccount(value, wallet.id).id ===
                      account.id,
                  )
                  .forEach((value) => recordIssue(value, 'conflicts'));
              } else {
                valid.push(account);
                validSnapshots.push(snapshot);
              }
            } else if (isCurrent()) {
              result.rejected += 1;
              recordIssue(snapshot, 'rejected');
            }
          } catch (_error) {
            result.pending += 1;
            recordIssue(snapshot, 'pending');
          }
          if (!isCurrent()) return finish(true);
        }

        if (!isCurrent()) return finish(true);
        const candidates = valid.filter(
          (account) => !conflictingIds.has(account.id),
        );
        if (candidates.length) {
          const sourceItemsByAccountId =
            sourceItemsBySnapshotId &&
            new Map(
              validSnapshots
                .map((snapshot) => [
                  publicAccountSnapshotToAccount(snapshot, wallet.id).id,
                  sourceItemsBySnapshotId.get(
                    getPublicAccountSnapshotId(snapshot),
                  ),
                ])
                .filter(
                  (entry): entry is [string, IDBCloudSyncItem] =>
                    typeof entry[0] === 'string' && !!entry[1],
                ),
            );
          const indexedNames =
            action === 'copy'
              ? await preparePublicAccountIndexedNames({
                  backgroundApi,
                  wallet,
                  accounts: candidates,
                  syncCredential,
                })
              : undefined;
          if (!isCurrent()) return finish(true);
          const params = {
            indexedNames,
            walletId: wallet.id,
            expectedWallet: {
              ...first.wallet,
              associatedDevice: wallet.associatedDevice,
              passphraseState: wallet.passphraseState,
            },
            expectedCredential: credential,
            accounts: candidates,
            sourceItemsByAccountId,
            foreignAccountsByWireId,
            isCurrent,
          };
          if (action === 'delete' && !sourceItemsByAccountId) {
            result.pending += candidates.length;
            validSnapshots.forEach((snapshot) =>
              recordIssue(snapshot, 'pending'),
            );
            return undefined;
          }
          const hasForeignCollision = Array.from(
            sourceItemsByAccountId?.values() ?? [],
          ).some((item) => foreignAccountsByWireId?.has(item.id));
          const apply = () =>
            action === 'delete'
              ? localDb.deletePublicCloudAccounts({
                  ...params,
                  sourceItemsByAccountId: sourceItemsByAccountId ?? new Map(),
                })
              : localDb.importPublicCloudAccounts(params);
          let imported;
          if (hasForeignCollision) {
            const hardware = syncCredential?.keylessCredential;
            if (hardware) {
              imported =
                await backgroundApi.serviceKeylessCloudSync.runWithVerifiedHardwareAccountArchiveSession(
                  hardware,
                  apply,
                );
            }
          } else {
            imported = await apply();
          }
          if (!imported) {
            result.pending += candidates.length;
            validSnapshots.forEach((snapshot) =>
              recordIssue(snapshot, 'pending'),
            );
            return undefined;
          }
          result.added += imported.added;
          result.updated += imported.updated ?? 0;
          result.deleted += imported.deleted ?? 0;
          result.indexedAccountsChanged ||= imported.indexedAccountsChanged;
          result.unchanged += imported.unchanged;
          result.pending += imported.pending;
          result.conflicts += imported.conflicts;
          for (const snapshot of validSnapshots) {
            const account = publicAccountSnapshotToAccount(snapshot, wallet.id);
            if (
              !conflictingIds.has(account.id) &&
              imported.appliedAccountIds.includes(account.id)
            ) {
              remainingWalletsBySnapshotId
                .get(getPublicAccountSnapshotId(snapshot))
                ?.delete(wallet.id);
            } else if (!conflictingIds.has(account.id)) {
              recordIssue(
                snapshot,
                imported.issueByAccountId?.[account.id] ?? 'pending',
              );
            }
          }
          if (imported.cancelled) return finish(true);
        }
        return undefined;
      };
      for (const group of groups.values()) {
        // Public BIP32 validation is expensive even without a seed/device.
        // Commit small validated groups so a cancelled round can retry cheaply.
        const heavy = [
          'btc',
          'tbtc',
          'ltc',
          'bch',
          'doge',
          'neurai',
          'lightning',
          'tlightning',
        ].includes(group.snapshots[0].account.impl);
        // Deletions scan account references once per transaction. Existing v2
        // accounts use the identity fast path, so keep deletes in full batches
        // instead of repeating that full-table scan for every pair of accounts.
        const size = heavy && action === 'copy' ? 2 : BATCH_SIZE;
        for (let cursor = 0; cursor < group.snapshots.length; cursor += size) {
          const cancelled = await processGroup({
            ...group,
            snapshots: group.snapshots.slice(cursor, cursor + size),
          });
          if (cancelled) return cancelled;
          if (cursor + size < group.snapshots.length)
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
      }
      // Let large restores yield to cancellation on background JS runtimes.
      if (offset + BATCH_SIZE < snapshots.length) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }
    return finish(!isCurrent());
  } finally {
    contexts.clear();
    walletsByIdentity.clear();
  }
}
