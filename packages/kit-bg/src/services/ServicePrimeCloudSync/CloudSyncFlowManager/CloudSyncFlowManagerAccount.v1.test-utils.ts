// Frozen 5e352660 reader; only its snapshot-module import points to the frozen codec.
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';
import type {
  ICloudSyncCredential,
  ICloudSyncDBRecords,
  ICloudSyncPayloadAccount,
  ICloudSyncTargetAccount,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';
import type {
  ICloudPublicAccountSnapshot,
  ICloudPublicAccountSnapshotResult,
} from '@onekeyhq/shared/types/prime/publicAccountSnapshot';

import cloudSyncItemBuilder from '../cloudSyncItemBuilder';
import { isPublicAccountCreationContext } from '../publicAccountCreationContext';
import {
  PUBLIC_ACCOUNT_IMPORT_BATCH_SIZE,
  PUBLIC_ACCOUNT_SNAPSHOT_PREFIX,
  PublicAccountSnapshotUnsupportedError,
  buildPublicAccountSnapshot,
  getPublicAccountSnapshotId,
  normalizePublicAccountSnapshot,
  normalizePublicAccountSnapshotRecord,
  normalizePublicAccountWalletXfp,
  publicAccountIdentityEqual,
  publicAccountSnapshotToAccount,
} from '../publicAccountSnapshotV1.test-utils';
import { rememberPublicAccountSnapshotWrite } from '../publicAccountSnapshotWriteGuard';

import { CloudSyncFlowManagerBase } from './CloudSyncFlowManagerBase';

import type {
  IDBAccount,
  IDBCloudSyncItem,
  IDBDevice,
} from '../../../dbs/local/types';
import type { IPublicAccountCreationContext } from '../publicAccountCreationContext';

export class CloudSyncFlowManagerAccount extends CloudSyncFlowManagerBase<
  EPrimeCloudSyncDataType.Account,
  IDBAccount
> {
  override dataType = EPrimeCloudSyncDataType.Account as any;

  // Retain tombstones after applying account deletion, so replay, legacy
  // clients, or a later initialization cannot resurrect the account.
  override removeSyncItemIfServerDeleted = false;

  private async snapshotForTarget(target: ICloudSyncTargetAccount) {
    const walletId = accountUtils.getWalletIdFromAccountId({
      accountId: target.account.id,
    });
    if (
      !walletId ||
      (!accountUtils.isHwWallet({ walletId }) &&
        !accountUtils.isHdWallet({ walletId }))
    )
      return undefined;
    const wallet =
      target.wallet ??
      (await this.backgroundApi.localDb.getWalletSafe({ walletId }));
    if (!wallet || wallet.isMocked || wallet.isTemp) return undefined;
    if (accountUtils.isHwWallet({ walletId })) {
      const device =
        target.dbDevice ??
        (wallet.associatedDevice
          ? await this.backgroundApi.localDb.getDeviceSafe(
              wallet.associatedDevice,
            )
          : undefined);
      if (
        !device ||
        (device.vendor ?? EHardwareVendor.onekey) !== EHardwareVendor.onekey
      )
        return undefined;
    }
    try {
      return buildPublicAccountSnapshot({ wallet, account: target.account });
    } catch {
      return undefined;
    }
  }

  override async isSupportSync(
    target: ICloudSyncTargetAccount,
  ): Promise<boolean> {
    const { account } = target;

    if (accountUtils.isUrlAccountFn({ accountId: account.id })) {
      return false;
    }

    return (
      !!(await this.snapshotForTarget(target)) ||
      accountUtils.isWatchingAccount({ accountId: account.id }) ||
      accountUtils.isImportedAccount({ accountId: account.id })
    );
  }

  override async buildSyncRawKey({
    target,
  }: {
    target: ICloudSyncTargetAccount;
  }): Promise<string> {
    const { account } = target;
    const snapshot = await this.snapshotForTarget(target);
    return snapshot ? getPublicAccountSnapshotId(snapshot) : account.id;
  }

  override async buildSyncPayload({
    target,
  }: {
    target: ICloudSyncTargetAccount;
  }): Promise<ICloudSyncPayloadAccount> {
    const { account } = target;
    const snapshot = await this.snapshotForTarget(target);
    if (snapshot)
      return {
        name: snapshot.account.name,
        accountId: getPublicAccountSnapshotId(snapshot),
        publicAccountSnapshot: snapshot,
      };
    return {
      name: account.name,
      accountId: account.id,
    };
  }

  override async buildSyncItem(
    params: Parameters<
      CloudSyncFlowManagerBase<
        EPrimeCloudSyncDataType.Account,
        IDBAccount
      >['buildSyncItem']
    >[0],
  ) {
    const snapshot = await this.snapshotForTarget(params.target);
    let existing: IDBCloudSyncItem | undefined;
    if (snapshot) {
      const key = this.rawKeyToHashKey(
        `${this.dataType} >> ${getPublicAccountSnapshotId(snapshot)}`,
      );
      existing = await this.backgroundApi.localDb.getSyncItemSafe({ id: key });
      if (existing) {
        if (existing.isDeleted && !params.isDeleted) return undefined;
        try {
          if (!params.syncCredential && !existing.rawData && params.isDeleted)
            throw new OneKeyLocalError(
              'Unlock Cloud before removing this synced account. Existing data has been preserved.',
            );
          const raw = existing.rawData
            ? (JSON.parse(existing.rawData) as {
                dataType?: unknown;
                payload?: { publicAccountSnapshot?: unknown };
              })
            : (
                await cloudSyncItemBuilder.decryptSyncItem({
                  item: existing,
                  syncCredential: params.syncCredential,
                })
              ).rawDataJson;
          const parsed = normalizePublicAccountSnapshotRecord(raw);
          if (this.rawKeyToHashKey(parsed.rawKey) !== existing.id)
            throw new OneKeyLocalError('Invalid public account sync identity');
        } catch (error) {
          if (params.isDeleted) throw error;
          return undefined;
        }
      }
    }
    const built = await super.buildSyncItem(params);
    if (snapshot && built) {
      if (built.data) built.rawData = '';
      rememberPublicAccountSnapshotWrite(built, existing);
    }
    return built;
  }

  async buildSyncItemForExplicitAccountCreation({
    target,
    syncCredential,
    creationContext,
  }: {
    target: ICloudSyncTargetAccount;
    syncCredential: ICloudSyncCredential | undefined;
    creationContext: IPublicAccountCreationContext | undefined;
  }): Promise<{ item: IDBCloudSyncItem; name: string } | undefined> {
    if (!isPublicAccountCreationContext(creationContext)) return undefined;
    const snapshot = await this.snapshotForTarget(target);
    if (!snapshot) return undefined;
    const key = this.rawKeyToHashKey(
      `${this.dataType} >> ${getPublicAccountSnapshotId(snapshot)}`,
    );
    const existing = await this.backgroundApi.localDb.getSyncItemSafe({
      id: key,
    });
    if (!existing?.isDeleted) return undefined;
    if (!syncCredential)
      throw new OneKeyLocalError(
        'Unlock Cloud before restoring this synced account.',
      );
    const decrypted = await cloudSyncItemBuilder.decryptSyncItem({
      item: { ...existing },
      syncCredential,
    });
    const parsed = normalizePublicAccountSnapshotRecord(decrypted.rawDataJson);
    const walletId = accountUtils.getWalletIdFromAccountId({
      accountId: target.account.id,
    });
    if (
      this.rawKeyToHashKey(parsed.rawKey) !== key ||
      !publicAccountIdentityEqual(
        publicAccountSnapshotToAccount(parsed.snapshot, walletId),
        target.account,
      )
    )
      throw new OneKeyLocalError(
        'The deleted account has different public data. Existing data has been preserved.',
      );
    let name = parsed.snapshot.account.name;
    const indexedManager =
      this.backgroundApi.servicePrimeCloudSync.syncManagers?.indexedAccount;
    if (indexedManager) {
      try {
        const wallet = await this.backgroundApi.localDb.getWalletSafe({
          walletId,
        });
        if (wallet) {
          const indexedAccount = {
            id: accountUtils.buildIndexedAccountId({
              walletId,
              index: parsed.snapshot.account.pathIndex,
            }),
            walletId,
            index: parsed.snapshot.account.pathIndex,
            name,
            idHash: '',
          };
          const indexedItem = await indexedManager.getSyncItem({
            syncCredential,
            target: {
              dataType: EPrimeCloudSyncDataType.IndexedAccount,
              targetId: indexedAccount.id,
              wallet: { ...wallet, avatarInfo: wallet.avatarInfo },
              indexedAccount,
            },
          });
          if (indexedItem && !indexedItem.isDeleted) {
            const raw = (
              await cloudSyncItemBuilder.decryptSyncItem({
                item: { ...indexedItem },
                syncCredential,
              })
            ).rawDataJson;
            if (
              raw?.dataType === EPrimeCloudSyncDataType.IndexedAccount &&
              raw.payload.index === indexedAccount.index &&
              normalizePublicAccountWalletXfp(raw.payload.walletXfp) ===
                parsed.snapshot.wallet.xfp
            ) {
              name = normalizePublicAccountSnapshot({
                ...parsed.snapshot,
                account: { ...parsed.snapshot.account, name: raw.payload.name },
              }).account.name;
            }
          }
        }
      } catch (_error) {
        // The account tombstone remains the fallback when optional legacy
        // naming metadata is missing or cannot be read with this Cloud key.
      }
    }
    const item = await super.buildSyncItem({
      target: { ...target, account: { ...target.account, name } },
      syncCredential,
      isDeleted: false,
      dataTime: undefined,
      existingDataTime: existing.dataTime,
    });
    if (
      !item?.data ||
      !item.dataTime ||
      item.dataTime <= (existing.dataTime ?? 0)
    ) {
      throw new OneKeyLocalError(
        'A newer Cloud timestamp is required to restore this account.',
      );
    }
    item.rawData = '';
    rememberPublicAccountSnapshotWrite(item, existing);
    return { item, name };
  }

  override async buildInitSyncDBItems({
    dbRecords,
    allDevices,
    initDataTime,
    syncCredential,
  }: {
    dbRecords: ICloudSyncDBRecords;
    allDevices?: IDBDevice[];
    initDataTime: number | undefined;
    syncCredential: ICloudSyncCredential;
  }) {
    const { wallets } = await this.backgroundApi.localDb.getAllWallets();
    const byWallet = new Map(wallets.map((wallet) => [wallet.id, wallet]));
    const byDevice = new Map(allDevices?.map((device) => [device.id, device]));
    const { items } =
      await this.backgroundApi.servicePrimeCloudSync.getAllLocalSyncItems();
    const existing = new Map(items.map((item) => [item.id, item]));
    const built: IDBCloudSyncItem[] = [];
    const accounts = dbRecords as IDBAccount[];
    const buildEach = async (account: IDBAccount) => {
      const wallet = byWallet.get(
        accountUtils.getWalletIdFromAccountId({ accountId: account.id }) ?? '',
      );
      const target: ICloudSyncTargetAccount = {
        targetId: account.id,
        dataType: this.dataType,
        account,
        wallet,
        dbDevice: byDevice.get(wallet?.associatedDevice ?? ''),
      };
      if (!(await this.isSupportSync(target))) return;
      const keyInfo = await this.buildSyncKeyInfo({ target });
      if (!keyInfo) return;
      const old = existing.get(keyInfo.key);
      // Never regenerate an existing snapshot during a full scan. This also
      // preserves unknown future payloads, conflicts, and sticky tombstones.
      if (keyInfo.payload.publicAccountSnapshot && old) return;
      if (
        old &&
        old.pwdHash === cloudSyncItemBuilder.getPwdHash(syncCredential)
      )
        return;
      const item = await super.buildSyncItem({
        target,
        dataTime: initDataTime,
        preserveUndefinedDataTime: true,
        syncCredential,
      });
      if (item) {
        if (keyInfo.payload.publicAccountSnapshot) {
          if (item.data) item.rawData = '';
          rememberPublicAccountSnapshotWrite(item, old);
        }
        built.push(item);
      }
    };
    for (
      let offset = 0;
      offset < accounts.length;
      offset += PUBLIC_ACCOUNT_IMPORT_BATCH_SIZE
    ) {
      for (const account of accounts.slice(
        offset,
        offset + PUBLIC_ACCOUNT_IMPORT_BATCH_SIZE,
      )) {
        await buildEach(account);
      }
      if (offset + PUBLIC_ACCOUNT_IMPORT_BATCH_SIZE < accounts.length)
        await timerUtils.wait(0);
    }
    return built;
  }

  override async syncToScene({
    syncCredential,
    items,
    forceSync,
    isCurrent: isOperationCurrent,
  }: {
    syncCredential: ICloudSyncCredential | undefined;
    items: IDBCloudSyncItem[];
    forceSync?: boolean;
    isCurrent?: () => boolean;
  }) {
    if (!syncCredential || !items.length) return;
    const keyless = this.backgroundApi.serviceKeylessCloudSync;
    const generation = keyless.getCloudAccountImportGeneration();
    const importGeneration =
      this.backgroundApi.servicePrimeCloudSync.getPublicAccountSnapshotImportGeneration();
    const isCurrent = () =>
      (isOperationCurrent?.() ?? true) &&
      keyless.getCloudAccountImportGeneration() === generation &&
      this.backgroundApi.servicePrimeCloudSync.getPublicAccountSnapshotImportGeneration() ===
        importGeneration;
    const legacy: IDBCloudSyncItem[] = [];
    const candidates: {
      item: IDBCloudSyncItem;
      snapshot: ICloudPublicAccountSnapshot;
      rawKey: string;
    }[] = [];
    const tombstones: typeof candidates = [];
    let needsUpdate = 0;
    let rejected = 0;
    const issues = new Map<
      string,
      'needsUpdate' | 'pending' | 'conflicts' | 'rejected' | undefined
    >();
    const scanEach = async (item: IDBCloudSyncItem) => {
      if (
        (item.data?.length ?? 0) > 64 * 1024 ||
        (item.rawData?.length ?? 0) > 64 * 1024
      ) {
        rejected += 1;
        issues.set(item.id, 'rejected');
        return;
      }
      if (
        !cloudSyncItemBuilder.canLocalItemSyncToScene({
          item,
          syncCredential,
          forceSync,
        })
      )
        return;
      try {
        const decrypted = await cloudSyncItemBuilder.decryptSyncItem({
          item,
          syncCredential,
        });
        const payload = decrypted.rawDataJson?.payload;
        if (
          !decrypted.dbItem ||
          decrypted.rawDataJson?.dataType !== this.dataType ||
          !payload ||
          !('accountId' in payload)
        ) {
          rejected += 1;
          issues.set(item.id, 'rejected');
          return;
        }
        if (!payload.accountId.startsWith(PUBLIC_ACCOUNT_SNAPSHOT_PREFIX)) {
          legacy.push(item);
          return;
        }
        const { snapshot, rawKey } = normalizePublicAccountSnapshotRecord(
          decrypted.rawDataJson,
        );
        if (item.id !== this.rawKeyToHashKey(rawKey)) {
          rejected += 1;
          issues.set(item.id, 'rejected');
          return;
        }
        (item.isDeleted ? tombstones : candidates).push({
          item,
          snapshot,
          rawKey,
        });
      } catch (error) {
        if (error instanceof PublicAccountSnapshotUnsupportedError) {
          needsUpdate += 1;
          issues.set(item.id, 'needsUpdate');
        } else {
          rejected += 1;
          issues.set(item.id, 'rejected');
        }
      }
    };
    for (let index = 0; index < items.length; index += 1) {
      if (!isCurrent()) return;
      await scanEach(items[index]);
      if ((index + 1) % PUBLIC_ACCOUNT_IMPORT_BATCH_SIZE === 0)
        await timerUtils.wait(0);
    }
    await super.syncToScene({ syncCredential, items: legacy, forceSync });
    await keyless.runWithCloudAccountImportLock(async () => {
      if (!isCurrent()) return;
      const selected =
        await this.backgroundApi.servicePrimeCloudSync.getSyncCredentialSafe();
      if (
        cloudSyncItemBuilder.getPwdHash(selected) !==
        cloudSyncItemBuilder.getPwdHash(syncCredential)
      )
        return;
      let result: ICloudPublicAccountSnapshotResult = {
        appliedSnapshotIds: [],
        added: 0,
        unchanged: 0,
        pending: 0,
        conflicts: 0,
        rejected: 0,
        cancelled: false,
      };
      let deleted = 0;
      const applyCandidates = async (
        entries: typeof candidates,
        action: 'copy' | 'delete',
      ) => {
        if (!entries.length || !isCurrent()) return;
        const { importPublicAccountSnapshots } =
          await import('../publicAccountSnapshotImport');
        const applied = await importPublicAccountSnapshots({
          backgroundApi: this.backgroundApi,
          snapshots: entries.map((candidate) => candidate.snapshot),
          sourceItemsBySnapshotId: new Map(
            entries.map((candidate) => [
              getPublicAccountSnapshotId(candidate.snapshot),
              { ...candidate.item },
            ]),
          ),
          action,
          isCurrent,
        });
        result = {
          appliedSnapshotIds: [
            ...result.appliedSnapshotIds,
            ...applied.appliedSnapshotIds,
          ],
          added: result.added + applied.added,
          unchanged: result.unchanged + applied.unchanged,
          pending: result.pending + applied.pending,
          conflicts: result.conflicts + applied.conflicts,
          rejected: result.rejected + applied.rejected,
          cancelled: result.cancelled || applied.cancelled,
        };
        deleted += applied.deleted;
        const appliedIds = new Set(applied.appliedSnapshotIds);
        for (const candidate of entries) {
          const id = getPublicAccountSnapshotId(candidate.snapshot);
          issues.set(
            candidate.item.id,
            appliedIds.has(id)
              ? undefined
              : (applied.issuesBySnapshotId[id] ?? 'pending'),
          );
        }
      };
      if (candidates.length) {
        await applyCandidates(candidates, 'copy');
      }
      await applyCandidates(tombstones, 'delete');
      const applied = new Set(result.appliedSnapshotIds);
      const byKey = new Map(
        [...tombstones, ...candidates]
          .filter((candidate) =>
            applied.has(getPublicAccountSnapshotId(candidate.snapshot)),
          )
          .map((candidate) => [candidate.item.id, candidate]),
      );
      const keys = Array.from(byKey.keys());
      for (
        let offset = 0;
        offset < keys.length && isCurrent();
        offset += PUBLIC_ACCOUNT_IMPORT_BATCH_SIZE
      ) {
        await this.backgroundApi.localDb.updateSyncItem({
          ids: keys.slice(offset, offset + PUBLIC_ACCOUNT_IMPORT_BATCH_SIZE),
          updater: (record) => {
            const candidate = byKey.get(record.id);
            if (
              candidate &&
              record.isDeleted === candidate.item.isDeleted &&
              record.data === candidate.item.data &&
              record.dataTime === candidate.item.dataTime &&
              record.pwdHash === candidate.item.pwdHash &&
              isCurrent()
            ) {
              record.localSceneUpdated = true;
              record.rawData = '';
              record.rawKey = candidate.rawKey;
            }
            return record;
          },
        });
      }
      if (!isCurrent()) return;
      await this.backgroundApi.servicePrimeCloudSync.publishPublicAccountSnapshotStatus(
        {
          syncCredential,
          updates: Array.from(issues, ([id, issue]) => ({ id, issue })),
          counts: {
            needsUpdate,
            rejected: rejected + result.rejected,
            pending: result.pending,
            conflicts: result.conflicts,
            added: result.added,
            unchanged: result.unchanged,
            deleted,
          },
        },
      );
    });
  }

  override async syncToSceneEachItem(params: {
    target: ICloudSyncTargetAccount;
    payload: ICloudSyncPayloadAccount;
  }): Promise<boolean> {
    const { target, payload } = params;
    await this.backgroundApi.serviceAccount.setAccountName({
      accountId: target.account.id,
      name: payload.name,
      // avoid infinite loop sync
      skipSaveLocalSyncItem: true,
      skipEventEmit: true,
    });
    return true;
  }

  override async getDBRecordBySyncPayload(params: {
    payload: ICloudSyncPayloadAccount;
  }): Promise<IDBAccount | undefined> {
    const { payload } = params;
    const { accountId } = payload;
    const account = await this.backgroundApi.localDb.getAccountSafe({
      accountId,
    });
    return account;
  }

  override async buildSyncTargetByPayload(params: {
    payload: ICloudSyncPayloadAccount;
  }): Promise<ICloudSyncTargetAccount | undefined> {
    return this.baseBuildSyncTargetByPayload(params);
  }

  override async buildSyncTargetByDBQuery(params: {
    dbRecord: IDBAccount;
    allDevices?: IDBDevice[];
  }): Promise<ICloudSyncTargetAccount> {
    const { dbRecord: account } = params;
    return {
      targetId: account.id,
      dataType: EPrimeCloudSyncDataType.Account,
      account,
    };
  }
}
