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

import { primeCloudSyncPersistAtom } from '../../../states/jotai/atoms';
import cloudSyncItemBuilder from '../cloudSyncItemBuilder';
import {
  PUBLIC_ACCOUNT_IMPORT_BATCH_SIZE,
  PUBLIC_ACCOUNT_SNAPSHOT_PREFIX,
  PublicAccountSnapshotUnsupportedError,
  buildPublicAccountSnapshot,
  getPublicAccountSnapshotId,
  normalizePublicAccountSnapshotRecord,
} from '../publicAccountSnapshot';
import { rememberPublicAccountSnapshotWrite } from '../publicAccountSnapshotWriteGuard';

import { CloudSyncFlowManagerBase } from './CloudSyncFlowManagerBase';

import type {
  IDBAccount,
  IDBCloudSyncItem,
  IDBDevice,
} from '../../../dbs/local/types';

export class CloudSyncFlowManagerAccount extends CloudSyncFlowManagerBase<
  EPrimeCloudSyncDataType.Account,
  IDBAccount
> {
  override dataType = EPrimeCloudSyncDataType.Account as any;

  // Account deletion is non-destructive on other devices. Retain its tombstone
  // so replay, legacy clients, or a later initialization cannot resurrect it.
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
  }: {
    syncCredential: ICloudSyncCredential | undefined;
    items: IDBCloudSyncItem[];
    forceSync?: boolean;
  }) {
    if (!syncCredential || !items.length) return;
    const keyless = this.backgroundApi.serviceKeylessCloudSync;
    const generation = keyless.getCloudAccountImportGeneration();
    const importGeneration =
      this.backgroundApi.servicePrimeCloudSync.getPublicAccountSnapshotImportGeneration();
    const isCurrent = () =>
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
    const scanEach = async (item: IDBCloudSyncItem) => {
      if (
        (item.data?.length ?? 0) > 64 * 1024 ||
        (item.rawData?.length ?? 0) > 64 * 1024
      ) {
        rejected += 1;
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
          return;
        }
        (item.isDeleted ? tombstones : candidates).push({
          item,
          snapshot,
          rawKey,
        });
      } catch (error) {
        if (error instanceof PublicAccountSnapshotUnsupportedError)
          needsUpdate += 1;
        else rejected += 1;
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
      if (candidates.length) {
        const { importPublicAccountSnapshots } =
          await import('../publicAccountSnapshotImport');
        result = await importPublicAccountSnapshots({
          backgroundApi: this.backgroundApi,
          snapshots: candidates.map((candidate) => candidate.snapshot),
          isCurrent,
        });
      }
      const applied = new Set(result.appliedSnapshotIds);
      const byKey = new Map(
        [
          ...tombstones,
          ...candidates.filter((candidate) =>
            applied.has(getPublicAccountSnapshotId(candidate.snapshot)),
          ),
        ].map((candidate) => [candidate.item.id, candidate]),
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
      await primeCloudSyncPersistAtom.set((value) => ({
        ...value,
        publicAccountSnapshotStatus: {
          needsUpdate,
          rejected: rejected + result.rejected,
          pending: result.pending,
          conflicts: result.conflicts,
          added: result.added,
          unchanged: result.unchanged,
        },
      }));
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
