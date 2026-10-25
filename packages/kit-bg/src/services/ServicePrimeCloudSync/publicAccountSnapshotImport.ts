import {
  getBip32FromBase58,
  getBtcForkNetwork,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';
import type {
  ICloudPublicAccountSnapshot,
  ICloudPublicAccountSnapshotResult,
} from '@onekeyhq/shared/types/prime/publicAccountSnapshot';

import { vaultFactory } from '../../vaults/factory';

import {
  PublicAccountSnapshotUnsupportedError,
  getPublicAccountSnapshotId,
  getPublicAccountSnapshotTaprootDescriptor,
  normalizePublicAccountSnapshot,
  normalizePublicAccountWalletXfp,
  publicAccountIdentityEqual,
  publicAccountSnapshotToAccount,
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
    deleted: number;
    issuesBySnapshotId: Record<string, 'pending' | 'conflicts' | 'rejected'>;
  };

function emptyResult(): IPublicAccountSnapshotApplyResult {
  return {
    added: 0,
    deleted: 0,
    issuesBySnapshotId: {},
    unchanged: 0,
    pending: 0,
    conflicts: 0,
    rejected: 0,
    cancelled: false,
    appliedSnapshotIds: [],
  };
}

function walletMatchKey(wallet: IDBWallet): string | undefined {
  const hardware = accountUtils.isHwWallet({ walletId: wallet.id });
  if (
    wallet.isMocked ||
    wallet.isTemp ||
    (!hardware &&
      (!accountUtils.isHdWallet({ walletId: wallet.id }) ||
        accountUtils.isBotWallet({ walletId: wallet.id })))
  ) {
    return undefined;
  }
  try {
    return `${hardware ? 'hardware' : 'hd'}__${normalizePublicAccountWalletXfp(wallet.xfp || '')}__${Boolean(wallet.passphraseState)}`;
  } catch (_error) {
    return undefined;
  }
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
  action = 'copy',
}: {
  backgroundApi: IBackgroundApi;
  snapshots: readonly unknown[];
  isCurrent: () => boolean;
  sourceItemsBySnapshotId?: ReadonlyMap<string, IDBCloudSyncItem>;
  action?: 'copy' | 'delete';
}): Promise<IPublicAccountSnapshotApplyResult> {
  const result = emptyResult();
  const recordIssue = (
    snapshot: ICloudPublicAccountSnapshot,
    issue: 'pending' | 'conflicts' | 'rejected',
  ) => {
    result.issuesBySnapshotId[getPublicAccountSnapshotId(snapshot)] = issue;
  };
  if (!isCurrent()) return { ...result, cancelled: true };
  const { localDb } = backgroundApi;
  const { wallets } = await localDb.getAllWallets();
  if (!isCurrent()) return { ...result, cancelled: true };
  const walletsByIdentity = new Map<string, IDBWallet[]>();
  for (const wallet of wallets) {
    const key = walletMatchKey(wallet);
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
      if (!isCurrent()) return { ...result, cancelled: true };
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
        const matches =
          walletsByIdentity.get(
            `${snapshot.wallet.kind}__${snapshot.wallet.xfp}__${snapshot.wallet.hidden}`,
          ) || [];
        if (matches.length !== 1) {
          result.pending += 1;
          recordIssue(snapshot, 'pending');
          return;
        }
        const wallet = matches[0];
        const key = `${wallet.id}__${snapshot.account.networkId}__${snapshot.account.template}__${snapshot.account.idSuffix || ''}`;
        const group = groups.get(key) || { wallet, snapshots: [] };
        group.snapshots.push(snapshot);
        groups.set(key, group);
      });

      const processGroup = async ({
        wallet,
        snapshots: group,
      }: {
        wallet: IDBWallet;
        snapshots: ICloudPublicAccountSnapshot[];
      }): Promise<IPublicAccountSnapshotApplyResult | undefined> => {
        if (!isCurrent()) return { ...result, cancelled: true };
        const first = group[0];
        const context = await getContext(wallet, first.wallet.kind);
        if (!isCurrent()) return { ...result, cancelled: true };
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
          if (!isCurrent()) return { ...result, cancelled: true };
          const settings = await vault.getVaultSettings();
          if (!isCurrent()) return { ...result, cancelled: true };
          if (settings.impl === first.account.impl) {
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
        for (const snapshot of group) {
          try {
            if (
              await validatePublicAccount({
                snapshot,
                vault,
                deriveInfo,
                isCurrent,
              })
            ) {
              const account = publicAccountSnapshotToAccount(
                snapshot,
                wallet.id,
              );
              const previous = valid.find((item) => item.id === account.id);
              if (conflictingIds.has(account.id)) {
                result.conflicts += 1;
                recordIssue(snapshot, 'conflicts');
              } else if (
                previous &&
                !publicAccountIdentityEqual(previous, account)
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
          if (!isCurrent()) return { ...result, cancelled: true };
        }

        if (!isCurrent()) return { ...result, cancelled: true };
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
          const params = {
            walletId: wallet.id,
            expectedWallet: {
              ...first.wallet,
              associatedDevice: wallet.associatedDevice,
              passphraseState: wallet.passphraseState,
            },
            expectedCredential: credential,
            accounts: candidates,
            sourceItemsByAccountId,
            isCurrent,
          };
          if (action === 'delete' && !sourceItemsByAccountId) {
            result.pending += candidates.length;
            validSnapshots.forEach((snapshot) =>
              recordIssue(snapshot, 'pending'),
            );
            return undefined;
          }
          const imported =
            action === 'delete'
              ? await localDb.deletePublicCloudAccounts({
                  ...params,
                  sourceItemsByAccountId: sourceItemsByAccountId ?? new Map(),
                })
              : await localDb.importPublicCloudAccounts(params);
          result.added += imported.added;
          result.deleted += imported.deleted ?? 0;
          result.unchanged += imported.unchanged;
          result.pending += imported.pending;
          result.conflicts += imported.conflicts;
          for (const snapshot of validSnapshots) {
            const account = publicAccountSnapshotToAccount(snapshot, wallet.id);
            if (
              !conflictingIds.has(account.id) &&
              imported.appliedAccountIds.includes(account.id)
            ) {
              result.appliedSnapshotIds.push(
                getPublicAccountSnapshotId(snapshot),
              );
              delete result.issuesBySnapshotId[
                getPublicAccountSnapshotId(snapshot)
              ];
            } else if (!conflictingIds.has(account.id)) {
              recordIssue(
                snapshot,
                imported.issueByAccountId?.[account.id] ?? 'pending',
              );
            }
          }
          if (imported.cancelled) return { ...result, cancelled: true };
        }
        return undefined;
      };
      for (const group of groups.values()) {
        const cancelled = await processGroup(group);
        if (cancelled) return cancelled;
      }
      // Let large restores yield to cancellation on background JS runtimes.
      if (offset + BATCH_SIZE < snapshots.length) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }
    return {
      ...result,
      appliedSnapshotIds: Array.from(new Set(result.appliedSnapshotIds)),
      cancelled: !isCurrent(),
    };
  } finally {
    contexts.clear();
    walletsByIdentity.clear();
  }
}
