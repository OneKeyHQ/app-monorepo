import 'fake-indexeddb/auto';

import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import requestHelper from '@onekeyhq/shared/src/request/requestHelper';
import {
  EChangeHistoryContentType,
  EChangeHistoryEntityType,
} from '@onekeyhq/shared/src/types/changeHistory';
import systemTimeUtils from '@onekeyhq/shared/src/utils/systemTimeUtils';
import type { ICloudSyncCredential } from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import localDb from '../../dbs/local/localDb';
import { ELocalDBStoreNames } from '../../dbs/local/localDBStoreNames';
import { EIndexedDBBucketNames } from '../../dbs/local/types';
import { SimpleDbEntityChangeHistory } from '../../dbs/simple/entity/SimpleDbEntityChangeHistory';
import simpleDb from '../../dbs/simple/simpleDb';
import {
  devSettingsPersistAtom,
  primeCloudSyncPersistAtom,
} from '../../states/jotai/atoms';
import ServiceAccount from '../ServiceAccount/ServiceAccount';
import ServiceKeylessCloudSync from '../ServiceKeylessCloudSync/ServiceKeylessCloudSync';
import keylessSyncCredentialStorage from '../ServiceKeylessWallet/utils/keylessSyncCredentialStorage';

import cloudSyncItemBuilder from './cloudSyncItemBuilder';
import ServicePrimeCloudSync from './ServicePrimeCloudSync';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IDBCloudSyncItem, IDBWallet } from '../../dbs/local/types';
import type { IPrimeCloudSyncPersistAtomData } from '../../states/jotai/atoms/prime';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => {
  const passthrough =
    () =>
    (...args: unknown[]) =>
      args.length === 1 ? args[0] : args[2];
  return {
    backgroundClass: passthrough,
    backgroundMethod: passthrough,
    backgroundMethodForDev: passthrough,
    toastIfError: passthrough,
  };
});

const walletFixture: IDBWallet = {
  id: 'hd-keyless-off-to-on-synthetic',
  type: 'hd',
  name: 'Initial same-space name',
  avatar: '{"img":"bear"}',
  hash: 'synthetic-wallet-scene-identity',
  isKeyless: true,
  backuped: true,
  accounts: [],
  nextIds: {},
  walletNo: 771,
};
let runningPrime: ServicePrimeCloudSync | undefined;
afterEach(async () => {
  await runningPrime?.cancelPublicAccountSnapshotImport();
  runningPrime = undefined;
  jest.restoreAllMocks();
});

it.each([
  'same-space',
  'changed-source',
  'disabled-in-transaction',
  'history-failure',
  'history-failure-missing-avatar',
  'history-failure-restart',
  'history-failure-flag-change',
  'history-failure-fresh-avatar',
  'history-failure-fresh-avatar-local-diverged',
  'history-failure-fresh-avatar-pending',
  'history-failure-fresh-avatar-cancelled',
  'history-failure-fresh-avatar-stale',
  'history-failure-fresh-avatar-foreign',
  'history-failure-final-read-skipped',
  'history-failure-final-inspection-unavailable',
  'history-failure-final-recovered',
  'history-failure-final-superseded',
  'canonical-scene-read-reject',
  'canonical-scene-read-timeout',
  'canonical-scene-read-immediate-recovers',
  'canonical-scene-read-cancelled',
  'canonical-scene-read-missing',
  'incremental-history-deferred',
  'incremental-history-retained',
  'incremental-history-mixed',
  'incremental-history-short-receipt',
  'incremental-history-cancelled',
  'incremental-history-node-changed',
  'incremental-history-upload-only',
  'incremental-history-healthy-mixed',
  'incremental-history-invalid-envelope',
  'incremental-history-unavailable-scene',
  'incremental-history-node-aba',
  'incremental-history-successor-deferred',
  'incremental-history-successor-applied',
  'incremental-history-successor-unreadable',
  'incremental-history-import-failure',
  'incremental-history-import-cancelled',
  'incremental-history-write-abort',
  'incremental-history-write-avatar-abort',
  'incremental-history-write-invalid',
  'incremental-history-write-superseded',
  'incremental-history-write-cancelled',
  'push-name-history-deferred',
  'push-name-history-retained',
  'push-name-history-source-changed',
  'push-name-history-parallel-deferred',
  'push-name-history-parallel-applied',
  'push-name-history-parallel-unverified',
] as const)(
  'replays only the still-current authenticated software Keyless scene (%s)',
  async (scenario) => {
    const historyFails = scenario.startsWith('history-failure');
    const canonicalSceneRead = scenario.startsWith('canonical-scene-read');
    const pushNameHistory = scenario.startsWith('push-name-history');
    const incrementalNameHistory = scenario.startsWith('incremental-history');
    const restart = scenario === 'history-failure-restart';
    const finalReadSkipped = scenario === 'history-failure-final-read-skipped';
    const finalInspectionUnavailable =
      scenario === 'history-failure-final-inspection-unavailable';
    const finalRecovered = scenario === 'history-failure-final-recovered';
    const finalSuperseded = scenario === 'history-failure-final-superseded';
    const manualHistory =
      finalReadSkipped ||
      finalInspectionUnavailable ||
      finalRecovered ||
      finalSuperseded;
    if (restart || manualHistory)
      jest
        .spyOn(systemTimeUtils, 'ensureFreshServerTime')
        .mockResolvedValue(true);
    const noLocalAvatar =
      scenario === 'history-failure-missing-avatar' || restart;
    const losesServerAck = scenario === 'history-failure-flag-change';
    const freshAvatar =
      manualHistory || scenario.startsWith('history-failure-fresh-avatar');
    const avatarDiverged =
      scenario === 'history-failure-fresh-avatar-local-diverged';
    const priorPending = scenario === 'history-failure-fresh-avatar-pending';
    const cancelFreshAvatar =
      scenario === 'history-failure-fresh-avatar-cancelled';
    const staleIncomingAvatar =
      scenario === 'history-failure-fresh-avatar-stale';
    const foreignPriorAvatar =
      scenario === 'history-failure-fresh-avatar-foreign';
    const wallet: IDBWallet = {
      ...walletFixture,
      ...(noLocalAvatar ? { avatar: undefined } : {}),
      id: `${walletFixture.id}-${scenario}`,
      hash: `${walletFixture.hash}-${scenario}`,
    };
    const credential: ICloudSyncCredential = {
      primeAccountSalt: '',
      securityPasswordR1: '',
      masterPasswordUUID: '',
      keylessCredential: {
        keylessWalletId: wallet.id,
        signingPrivateKey: '',
        signingPublicKey: 'synthetic-keyless-signing-key',
        encryptionKey: 'ab'.repeat(32),
        pwdHash: `keyless-synthetic-current-${scenario}`,
      },
    };
    const scope = credential.keylessCredential?.pwdHash ?? '';
    const nameFilter = {
      entityType: EChangeHistoryEntityType.Wallet,
      entityId: wallet.id,
      contentType: EChangeHistoryContentType.Name,
    };
    jest.replaceProperty(appLocale, 'isReady', Promise.resolve(true));
    let config: IPrimeCloudSyncPersistAtomData = {
      isCloudSyncEnabled: false,
      isCloudSyncEnabledKeyless: true,
      hasEverEnabledKeylessSync: true,
      currentCloudSyncKeylessWalletId: wallet.id,
      cloudSyncAccountApplyVersion: 2,
    };
    jest
      .spyOn(primeCloudSyncPersistAtom, 'get')
      .mockImplementation(async () => config);
    jest
      .spyOn(primeCloudSyncPersistAtom, 'set')
      .mockImplementation(async (updater) => {
        config = typeof updater === 'function' ? updater(config) : updater;
      });
    const remove = jest
      .spyOn(keylessSyncCredentialStorage, 'removeAllCredentials')
      .mockResolvedValue(undefined);
    jest
      .spyOn(keylessSyncCredentialStorage, 'getCredential')
      .mockResolvedValue(credential.keylessCredential ?? null);
    const backgroundApi = {
      localDb,
      simpleDb,
      serviceApp: { isAppLocked: async () => false },
      servicePrime: { apiFetchPrimeUserInfo: async () => undefined },
    } as unknown as IBackgroundApi;
    const keyless = new ServiceKeylessCloudSync({ backgroundApi });
    const prime = new ServicePrimeCloudSync({ backgroundApi });
    runningPrime = prime;
    const account = new ServiceAccount({ backgroundApi });
    backgroundApi.serviceKeylessCloudSync = keyless;
    backgroundApi.servicePrimeCloudSync = prime;
    backgroundApi.serviceAccount = account;
    localDb.setBackgroundApi(backgroundApi);
    jest.replaceProperty(
      appGlobals,
      '$backgroundApiProxy',
      backgroundApi as unknown as typeof appGlobals.$backgroundApiProxy,
    );
    jest.spyOn(account, 'getKeylessWallet').mockResolvedValue(wallet);
    jest
      .spyOn(keyless, 'prepareCloudSyncKeyless')
      .mockResolvedValue({ success: true });
    jest
      .spyOn(keyless, 'hydrateKeylessSyncCredentialFromStorageIfNeeded')
      .mockResolvedValue(undefined);
    const getSyncCredentialSafe = jest
      .spyOn(prime, 'getSyncCredentialSafe')
      .mockImplementation(async () =>
        config.isCloudSyncEnabledKeyless ? credential : undefined,
      );
    jest
      .spyOn(prime, 'isCloudSyncIsAvailable')
      .mockImplementation(
        async () => config.isCloudSyncEnabledKeyless === true,
      );
    // The test substitutes network/account availability, not local scene or DB.
    jest
      .spyOn(prime, 'ensureCloudSyncIsAvailable')
      .mockResolvedValue(undefined);

    const target = await prime.syncManagers.wallet.buildSyncTargetByDBQuery({
      dbRecord: wallet,
    });
    const key = await prime.syncManagers.wallet.buildSyncKeyInfo({ target });
    if (!key) throw new OneKeyLocalError('Missing synthetic wallet identity');
    const baseTime = Date.now() - 1000;
    const remoteAddress = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const makeItem = async (
      name: string,
      img: 'bear' | 'cat',
      dataTime: number,
    ) =>
      cloudSyncItemBuilder.buildSyncItemFromRawDataJson({
        key: key.key,
        dataTime,
        syncCredential: credential,
        rawDataJson: {
          rawKey: key.rawKey,
          dataType: EPrimeCloudSyncDataType.Wallet,
          payload: {
            name,
            avatar: { img },
            ...(scenario === 'disabled-in-transaction' || historyFails
              ? { firstEvmAddress: remoteAddress }
              : {}),
            walletHash: wallet.hash,
            walletType: wallet.type,
            passphraseState: '',
            hwDeviceId: undefined,
          },
        },
      });

    const acknowledged = {
      ...(await makeItem(wallet.name, 'bear', baseTime)),
      localSceneUpdated: scenario === 'same-space' || historyFails,
      serverUploaded: !priorPending,
      ...(foreignPriorAvatar ? { pwdHash: 'keyless-unrelated-source' } : {}),
    };
    expect(acknowledged.data).toBeTruthy();
    await localDb.withTransaction(
      EIndexedDBBucketNames.account,
      async (tx) => {
        await localDb.txAddRecords({
          tx,
          name: ELocalDBStoreNames.Wallet,
          records: [wallet],
        });
        await localDb.txAddRecords({
          tx,
          name: ELocalDBStoreNames.CloudSyncItem,
          records: [acknowledged],
        });
      },
      { skipCloudCredentialWarmup: true },
    );
    const readWallet = () =>
      localDb.getWallet({ walletId: wallet.id, withoutRefill: true });
    const check = jest
      .spyOn(prime, 'checkServerStatusWithRequestOptions')
      .mockResolvedValue({
        diff: [],
        updated: [],
        deleted: [],
        obsoleted: [],
        pwdHash: scope,
        serverTime: Date.now(),
      });
    const upload = jest
      .spyOn(prime, 'apiUploadItems')
      .mockResolvedValue(undefined);
    const replay = jest.spyOn(prime, 'syncPendingItemsToScene');

    if (canonicalSceneRead || pushNameHistory || incrementalNameHistory) {
      const remoteName =
        scenario === 'incremental-history-write-avatar-abort'
          ? wallet.name
          : 'Cloud Wallet name';
      const pending = {
        ...(await makeItem(remoteName, 'cat', baseTime + 100)),
        serverUploaded: true,
        localSceneUpdated: false,
      };
      const sibling: IDBWallet = {
        ...wallet,
        id: `${wallet.id}-sibling`,
        hash: `${wallet.hash}-sibling`,
        name: 'Unaffected sibling',
        walletNo: wallet.walletNo + 1,
      };
      const siblingTarget =
        await prime.syncManagers.wallet.buildSyncTargetByDBQuery({
          dbRecord: sibling,
        });
      const siblingKey = await prime.syncManagers.wallet.buildSyncKeyInfo({
        target: siblingTarget,
      });
      if (!siblingKey)
        throw new OneKeyLocalError('Missing synthetic sibling identity');
      const siblingPending = {
        ...(await cloudSyncItemBuilder.buildSyncItemFromRawDataJson({
          key: siblingKey.key,
          dataTime: baseTime + 200,
          syncCredential: credential,
          rawDataJson: {
            rawKey: siblingKey.rawKey,
            dataType: EPrimeCloudSyncDataType.Wallet,
            payload: { ...siblingKey.payload, avatar: { img: 'cat' } },
          },
        })),
        serverUploaded: true,
        localSceneUpdated: false,
      };
      const immediateRecovers =
        scenario === 'canonical-scene-read-immediate-recovers';
      await localDb.withTransaction(
        EIndexedDBBucketNames.account,
        async (tx) => {
          await localDb.txAddRecords({
            tx,
            name: ELocalDBStoreNames.Wallet,
            records: [sibling],
          });
          if (!immediateRecovers && !incrementalNameHistory)
            await localDb.txUpdateRecords({
              tx,
              name: ELocalDBStoreNames.CloudSyncItem,
              ids: [pending.id],
              updater: (row) => Object.assign(row, pending),
            });
          await localDb.txAddRecords({
            tx,
            name: ELocalDBStoreNames.CloudSyncItem,
            records: [siblingPending],
          });
        },
        { skipCloudCredentialWarmup: true },
      );
      if (incrementalNameHistory) {
        const importFailure = scenario === 'incremental-history-import-failure';
        const importCancelled =
          scenario === 'incremental-history-import-cancelled';
        const writeFailure = scenario.startsWith('incremental-history-write-');
        const nonrecoverableWriteFailure =
          scenario === 'incremental-history-write-invalid';
        const writeSuperseded =
          scenario === 'incremental-history-write-superseded';
        const writeCancelled =
          scenario === 'incremental-history-write-cancelled';
        const retained =
          importFailure ||
          importCancelled ||
          scenario === 'incremental-history-retained' ||
          scenario === 'incremental-history-healthy-mixed';
        const successorCase =
          writeSuperseded ||
          scenario.startsWith('incremental-history-successor');
        const successorApplies =
          writeSuperseded ||
          scenario === 'incremental-history-successor-applied';
        const successorUnreadable =
          scenario === 'incremental-history-successor-unreadable';
        const successorName = 'Newer pushed Wallet name';
        const sameBatchWriteFailure =
          scenario === 'incremental-history-write-abort';
        const avatarUploadWriteFailure =
          scenario === 'incremental-history-write-avatar-abort';
        const hasSibling =
          scenario === 'incremental-history-mixed' ||
          scenario === 'incremental-history-healthy-mixed' ||
          successorCase ||
          (writeFailure && !avatarUploadWriteFailure);
        const uploadOnly = scenario === 'incremental-history-upload-only';
        const shortReceipt = scenario === 'incremental-history-short-receipt';
        const scopeChanged = scenario === 'incremental-history-cancelled';
        const nodeChanged = scenario === 'incremental-history-node-changed';
        const nodeAba = scenario === 'incremental-history-node-aba';
        const invalidEnvelope =
          scenario === 'incremental-history-invalid-envelope';
        const unavailableScene =
          scenario === 'incremental-history-unavailable-scene';
        let devSettingsChanged = () => {};
        const unsubscribe = jest.fn();
        jest
          .spyOn(devSettingsPersistAtom, 'sub')
          .mockImplementation((notify) => {
            devSettingsChanged = notify;
            return unsubscribe;
          });
        jest
          .spyOn(devSettingsPersistAtom, 'get')
          .mockResolvedValue({ enabled: false });
        const pickedEndpoint = jest
          .spyOn(requestHelper, 'getDevSettingsPersistAtom')
          .mockResolvedValue({ enabled: false, settings: {} });
        let primaryHistoryChecks = 0;
        jest
          .spyOn(SimpleDbEntityChangeHistory.prototype, 'retainWalletName')
          .mockImplementation(async ({ walletId }) => {
            if (scopeChanged) await prime.cancelPublicAccountSnapshotImport();
            if (nodeChanged || nodeAba) {
              pickedEndpoint.mockResolvedValue({
                enabled: true,
                settings: { enableTestEndpoint: true },
              });
              devSettingsChanged();
              if (nodeAba) {
                pickedEndpoint.mockResolvedValue({
                  enabled: false,
                  settings: {},
                });
                devSettingsChanged();
              }
            }
            if (writeFailure) return true;
            if (successorCase) {
              if (walletId !== wallet.id) return true;
              primaryHistoryChecks += 1;
              return successorApplies && primaryHistoryChecks > 1;
            }
            return retained || shortReceipt || nodeChanged || nodeAba;
          });
        const pack = (item: IDBCloudSyncItem) => {
          const value = prime.convertLocalItemToServerItem({ localItem: item });
          if (!value)
            throw new OneKeyLocalError('Missing incremental response fixture');
          return value;
        };
        const outgoing: IDBCloudSyncItem = {
          ...pending,
          id: 'synthetic-unrelated-outgoing',
          dataType: EPrimeCloudSyncDataType.Account,
          serverUploaded: false,
          localSceneUpdated: true,
        };
        jest
          .spyOn(prime, 'getCloudSyncDataTime')
          .mockResolvedValue(baseTime + 500);
        const sent = jest
          .spyOn(prime, 'apiUploadItemsKeyless')
          .mockResolvedValue({
            created: shortReceipt ? 0 : 1,
            updated: 0,
            nonce: 1,
          });
        const expectsUpload =
          (hasSibling && !sameBatchWriteFailure) ||
          shortReceipt ||
          uploadOnly ||
          avatarUploadWriteFailure;
        const downloaded = invalidEnvelope
          ? { ...pending, data: 'unreadable-legacy-ciphertext' }
          : pending;
        if (unavailableScene)
          jest
            .spyOn(prime, 'syncToSceneWithLocalSyncItems')
            .mockResolvedValue(undefined);
        let failsOnWalletPut = 0;
        let blockWalletPut = writeFailure;
        let pushedSuccessor: IDBCloudSyncItem | undefined;
        if (successorCase) {
          const newer = await makeItem(successorName, 'cat', baseTime + 300);
          const successor = successorUnreadable
            ? { ...newer, data: 'unreadable-newer-wallet-ciphertext' }
            : newer;
          const save = prime.saveServerSyncItemsToLocal.bind(prime);
          jest
            .spyOn(prime, 'saveServerSyncItemsToLocal')
            .mockImplementationOnce(async (options) => {
              const result = await save(options);
              expect(
                await localDb.getSyncItem({ id: pending.id }),
              ).toMatchObject({
                data: pending.data,
                localSceneUpdated: false,
              });
              if (writeSuperseded) blockWalletPut = false;
              await save({
                serverItems: [pack(successor)],
                shouldSyncToScene: true,
                syncCredential: credential,
                serverPwdHash: scope,
                deferPushBatchLastSyncTime: true,
              });
              pushedSuccessor = await localDb.getSyncItem({ id: pending.id });
              // Isolate the still-running incremental operation's timestamp.
              config = { ...config, lastSyncTimeKeyless: undefined };
              return result;
            });
        }
        check.mockResolvedValueOnce({
          diff: uploadOnly
            ? []
            : [
                pack(downloaded),
                ...(sameBatchWriteFailure ? [pack(siblingPending)] : []),
              ],
          updated:
            hasSibling && !sameBatchWriteFailure ? [pack(siblingPending)] : [],
          deleted: [],
          obsoleted: expectsUpload ? [outgoing.id] : [],
          pwdHash: scope,
          serverTime: Date.now(),
        });
        const nativePut: typeof IDBObjectStore.prototype.put = Reflect.get(
          IDBObjectStore.prototype,
          'put',
        );
        if (writeFailure)
          jest
            .spyOn(IDBObjectStore.prototype, 'put')
            .mockImplementation(function (
              this: IDBObjectStore,
              value: unknown,
              storeKey?: IDBValidKey,
            ) {
              if (
                blockWalletPut &&
                this.name === ELocalDBStoreNames.Wallet &&
                value &&
                typeof value === 'object' &&
                'id' in value &&
                value.id === wallet.id
              ) {
                failsOnWalletPut += 1;
                if (writeCancelled)
                  void prime.cancelPublicAccountSnapshotImport();
                if (nonrecoverableWriteFailure)
                  throw new TypeError('invalid write');
                if (avatarUploadWriteFailure)
                  throw new DOMException(
                    'synthetic quota failure',
                    'QuotaExceededError',
                  );
                // Let the IDB request succeed, then abort the actual transaction.
                const request = nativePut.call(this, value);
                request.addEventListener(
                  'success',
                  () => this.transaction.abort(),
                  { once: true },
                );
                return request;
              }
              return storeKey === undefined
                ? nativePut.call(this, value)
                : nativePut.call(this, value, storeKey);
            });
        const startIncremental = () =>
          prime.startServerSyncFlowForItems({
            localItems: expectsUpload ? [outgoing] : [],
            noDebounceUpload: true,
            expectedSyncCredential: credential,
          });
        if (importFailure || importCancelled) {
          const unavailable = new OneKeyLocalError(
            'incremental segment unavailable',
          );
          let cancellation: Promise<void> | undefined;
          const load = jest.fn(() => {
            if (importFailure) throw unavailable;
            cancellation = prime.cancelPublicAccountSnapshotImport();
            return jest.requireActual<typeof import('./incrementalCloudSync')>(
              './incrementalCloudSync',
            );
          });
          jest.doMock('./incrementalCloudSync', load);
          try {
            if (importFailure)
              await expect(startIncremental()).rejects.toBe(unavailable);
            else
              await expect(startIncremental()).rejects.toThrow(
                'Cloud sync was cancelled',
              );
            await cancellation;
            expect(load).toHaveBeenCalledTimes(1);
            expect(check).not.toHaveBeenCalled();
            expect(sent).not.toHaveBeenCalled();
            expect(config.lastSyncTimeKeyless).toBeUndefined();
            expect(await localDb.getSyncItem({ id: pending.id })).toMatchObject(
              {
                data: acknowledged.data,
              },
            );
          } finally {
            jest.dontMock('./incrementalCloudSync');
          }
        }
        // A later ordinary run still works after an unavailable or cancelled load.
        const work = startIncremental();
        if (scopeChanged || writeCancelled)
          await expect(work).rejects.toThrow('Cloud sync was cancelled');
        else if (shortReceipt)
          await expect(work).rejects.toThrow('only partially acknowledged');
        else await work;
        expect(check).toHaveBeenCalledTimes(1);
        expect(unsubscribe).toHaveBeenCalledTimes(1);
        expect(sent).toHaveBeenCalledTimes(expectsUpload ? 1 : 0);
        const applied = retained || shortReceipt || nodeChanged || nodeAba;
        if (writeFailure) expect(failsOnWalletPut).toBe(1);
        if (writeFailure && !writeSuperseded)
          expect(await readWallet()).toMatchObject({
            name: wallet.name,
            avatar: wallet.avatar,
          });
        if (successorCase) {
          expect(pushedSuccessor).toMatchObject({
            serverUploaded: true,
            localSceneUpdated: successorApplies,
            dataTime: baseTime + 300,
          });
          expect(await localDb.getSyncItem({ id: pending.id })).toMatchObject({
            ...pushedSuccessor,
          });
          expect(await readWallet()).toMatchObject({
            name: successorApplies ? successorName : wallet.name,
          });
        } else {
          expect(await readWallet()).toMatchObject({
            name: applied ? remoteName : wallet.name,
          });
          expect(await localDb.getSyncItem({ id: pending.id })).toMatchObject({
            data: uploadOnly ? acknowledged.data : downloaded.data,
            localSceneUpdated: applied,
          });
        }
        if (hasSibling && !writeCancelled) {
          expect(
            await localDb.getWallet({
              walletId: sibling.id,
              withoutRefill: true,
            }),
          ).toMatchObject({
            avatar: '{"img":"cat"}',
          });
          expect(
            await localDb.getSyncItem({ id: siblingPending.id }),
          ).toMatchObject({
            localSceneUpdated: true,
          });
        }
        if (
          retained ||
          uploadOnly ||
          successorApplies ||
          successorUnreadable ||
          nonrecoverableWriteFailure
        )
          expect(config.lastSyncTimeKeyless).toEqual(expect.any(Number));
        else expect(config.lastSyncTimeKeyless).toBeUndefined();
        if (
          writeFailure &&
          !nonrecoverableWriteFailure &&
          !writeCancelled &&
          !writeSuperseded
        ) {
          blockWalletPut = false;
          check.mockResolvedValueOnce({
            diff: [pack(downloaded)],
            updated: [],
            deleted: [],
            obsoleted: [],
            pwdHash: scope,
            serverTime: Date.now(),
          });
          await startIncremental();
          expect(check).toHaveBeenCalledTimes(2);
          expect(sent).toHaveBeenCalledTimes(expectsUpload ? 1 : 0);
          expect(await readWallet()).toMatchObject({
            name: remoteName,
            avatar: '{"img":"cat"}',
          });
          expect(await localDb.getSyncItem({ id: pending.id })).toMatchObject({
            data: pending.data,
            localSceneUpdated: true,
          });
          expect(config.lastSyncTimeKeyless).toEqual(expect.any(Number));
        }
        return;
      }
      if (pushNameHistory) {
        const retained = scenario === 'push-name-history-retained';
        const sourceChanged = scenario === 'push-name-history-source-changed';
        let rereadReached = false;
        if (!retained)
          jest
            .spyOn(SimpleDbEntityChangeHistory.prototype, 'retainWalletName')
            .mockResolvedValue(false);
        const toPush = (item: IDBCloudSyncItem) => {
          const remote = prime.convertLocalItemToServerItem({
            localItem: item,
          });
          if (!remote)
            throw new OneKeyLocalError('Missing synthetic push item');
          return remote;
        };
        if (scenario.startsWith('push-name-history-parallel')) {
          const newerApplies =
            scenario === 'push-name-history-parallel-applied';
          const successorUnverified =
            scenario === 'push-name-history-parallel-unverified';
          const presentation = jest.spyOn(
            prime.syncManagers.wallet,
            'buildSyncTargetByPayload',
          );
          const rawProof = jest.spyOn(
            prime.syncManagers.wallet,
            'findWalletSyncTargetReadOnly',
          );
          let proofReached = () => {};
          const rawProofReached = new Promise<void>((resolve) => {
            proofReached = resolve;
          });
          if (successorUnverified) {
            rawProof.mockImplementationOnce(async () => {
              proofReached();
              return new Promise<undefined>(() => {});
            });
            jest.useFakeTimers();
          }
          const newerName = 'Newer pushed Wallet name';
          const newer = await makeItem(newerName, 'cat', baseTime + 300);
          let reachedHistory = () => {};
          const olderHistoryReached = new Promise<void>((resolve) => {
            reachedHistory = resolve;
          });
          let releaseOlder = () => {};
          const olderHistoryRelease = new Promise<void>((resolve) => {
            releaseOlder = resolve;
          });
          let atHistory = 0;
          jest
            .spyOn(SimpleDbEntityChangeHistory.prototype, 'retainWalletName')
            .mockImplementation(async () => {
              atHistory += 1;
              if (atHistory === 1) {
                reachedHistory();
                await olderHistoryRelease;
                return false;
              }
              return newerApplies;
            });
          const getRecordsByIds = localDb.getRecordsByIds.bind(localDb);
          let reachedNewerScene = () => {};
          const newerSceneReached = new Promise<void>((resolve) => {
            reachedNewerScene = resolve;
          });
          let singleWalletReads = 0;
          let newerWork: ReturnType<typeof push> | undefined;
          jest
            .spyOn(localDb, 'getRecordsByIds')
            .mockImplementation(async (options) => {
              if (
                options.name === ELocalDBStoreNames.CloudSyncItem &&
                options.ids.length === 1 &&
                options.ids[0] === pending.id
              ) {
                singleWalletReads += 1;
                if (singleWalletReads === 1) reachedNewerScene();
                else if (singleWalletReads === 2 && newerApplies)
                  await newerWork;
              }
              return getRecordsByIds(options);
            });
          const push = (items: IDBCloudSyncItem[]) =>
            prime.saveServerSyncItemsToLocal({
              serverItems: items.map(toPush),
              shouldSyncToScene: true,
              syncCredential: credential,
              serverPwdHash: scope,
              deferPushBatchLastSyncTime: true,
            });
          const olderWork = push([pending, siblingPending]);
          try {
            await olderHistoryReached;
            newerWork = push([newer]);
            await newerSceneReached;
            expect(await localDb.getSyncItem({ id: pending.id })).toMatchObject(
              {
                data: newer.data,
                serverUploaded: true,
                localSceneUpdated: false,
              },
            );
          } finally {
            releaseOlder();
            if (successorUnverified) {
              await rawProofReached;
              await jest.advanceTimersByTimeAsync(1500);
            }
            try {
              await Promise.all([olderWork, newerWork]);
            } finally {
              if (successorUnverified) jest.useRealTimers();
            }
          }
          expect(presentation).toHaveBeenCalledTimes(3);
          expect(rawProof).toHaveBeenCalledTimes(newerApplies ? 0 : 1);
          expect(atHistory).toBe(2);
          expect(await readWallet()).toMatchObject({
            name: newerApplies ? newerName : wallet.name,
          });
          expect(await localDb.getSyncItem({ id: pending.id })).toMatchObject({
            data: newer.data,
            serverUploaded: true,
            localSceneUpdated: newerApplies,
          });
          expect(
            await localDb.getSyncItem({ id: siblingPending.id }),
          ).toMatchObject({ localSceneUpdated: true });
          if (newerApplies || successorUnverified)
            expect(config.lastSyncTimeKeyless).toEqual(expect.any(Number));
          else expect(config.lastSyncTimeKeyless).toBeUndefined();
          return;
        }
        if (sourceChanged) {
          const getRecordsByIds = localDb.getRecordsByIds.bind(localDb);
          jest
            .spyOn(localDb, 'getRecordsByIds')
            .mockImplementation(async (options) => {
              const result = await getRecordsByIds(options);
              if (
                options.name === ELocalDBStoreNames.CloudSyncItem &&
                options.ids.length === 1 &&
                options.ids[0] === pending.id &&
                !rereadReached
              ) {
                rereadReached = true;
                config = {
                  ...config,
                  currentCloudSyncKeylessWalletId: 'hd-another-space',
                };
                await prime.cancelPublicAccountSnapshotImport();
                // Simulate the old exact row settling while the read was in
                // flight. Success must not be credited to the new source.
                return {
                  ...result,
                  records: result.records.map((row) =>
                    row ? { ...row, localSceneUpdated: true } : row,
                  ),
                };
              }
              return result;
            });
        }
        await prime.saveServerSyncItemsToLocal({
          serverItems: [toPush(pending), toPush(siblingPending)],
          shouldSyncToScene: true,
          syncCredential: credential,
          serverPwdHash: scope,
          deferPushBatchLastSyncTime: true,
        });
        expect(await readWallet()).toMatchObject({
          name: retained ? remoteName : wallet.name,
        });
        expect(await localDb.getSyncItem({ id: pending.id })).toMatchObject({
          data: pending.data,
          serverUploaded: true,
          localSceneUpdated: retained,
        });
        expect(
          await localDb.getWallet({
            walletId: sibling.id,
            withoutRefill: true,
          }),
        ).toMatchObject({ name: sibling.name, avatar: '{"img":"cat"}' });
        expect(
          await localDb.getSyncItem({ id: siblingPending.id }),
        ).toMatchObject({
          localSceneUpdated: true,
        });
        expect(rereadReached).toBe(sourceChanged);
        if (retained)
          expect(config.lastSyncTimeKeyless).toEqual(expect.any(Number));
        else expect(config.lastSyncTimeKeyless).toBeUndefined();
        expect(check).not.toHaveBeenCalled();
        expect(upload).not.toHaveBeenCalled();
        return;
      }
      if (immediateRecovers) {
        // Keep the stored predecessor and deliver the qualified newer row
        // in /check; initial read rejects, final replay may recover.
        const reply = prime.convertLocalItemToServerItem({
          localItem: pending,
        });
        if (!reply)
          throw new OneKeyLocalError('Missing synthetic check result');
        check.mockResolvedValueOnce({
          diff: [reply],
          updated: [],
          deleted: [],
          obsoleted: [],
          pwdHash: scope,
          serverTime: Date.now(),
        });
      }
      const actualScene = prime.syncManagers.wallet.syncToSceneEachItem.bind(
        prime.syncManagers.wallet,
      );
      const protectedRead = localDb.getRecordById.bind(localDb);
      let activeTarget = false;
      let interrupted = 0;
      let reachedCanonicalRead = () => {};
      const canonicalReadReached = new Promise<void>((resolve) => {
        reachedCanonicalRead = resolve;
      });
      let finishLateRead = () => {};
      const deferredRead = new Promise<void>((resolve) => {
        finishLateRead = resolve;
      });
      const timed = scenario === 'canonical-scene-read-timeout';
      const cancelled = scenario === 'canonical-scene-read-cancelled';
      const missing = scenario === 'canonical-scene-read-missing';
      jest
        .spyOn(localDb, 'getRecordById')
        .mockImplementation(async (options) => {
          if (
            activeTarget &&
            interrupted === 0 &&
            options.name === ELocalDBStoreNames.Wallet &&
            options.id === wallet.id
          ) {
            interrupted += 1;
            reachedCanonicalRead();
            if (timed || cancelled) await deferredRead;
            else if (missing) return undefined;
            else
              throw new DOMException(
                'Synthetic Wallet read interrupted',
                'AbortError',
              );
          }
          return protectedRead(options);
        });
      jest
        .spyOn(prime.syncManagers.wallet, 'syncToSceneEachItem')
        .mockImplementation(async (options) => {
          activeTarget = options.target.wallet.id === wallet.id;
          try {
            return await actualScene(options);
          } finally {
            activeTarget = false;
          }
        });
      jest
        .spyOn(prime, 'resolveInitLocalSyncItemsPassword')
        .mockResolvedValue('');
      jest.spyOn(prime, 'prepareLocalSyncWallets').mockResolvedValue();
      jest.spyOn(prime, 'initLocalSyncItemsDB').mockResolvedValue({
        allWallets: [],
        allDevices: [],
        allAccounts: [],
        allIndexedAccounts: [],
      });
      if (timed) jest.useFakeTimers();
      try {
        const outcome = prime.syncNowKeylessWithResult().then(
          (value) => ({ value }),
          (error: unknown) => ({ error }),
        );
        await canonicalReadReached;
        if (timed) await jest.advanceTimersByTimeAsync(1500);
        if (cancelled) {
          await prime.cancelPublicAccountSnapshotImport();
          finishLateRead();
          expect(await outcome).toMatchObject({
            error: expect.objectContaining({
              message: 'Cloud sync was cancelled',
            }),
          });
        } else {
          expect(await outcome).toEqual({
            value:
              immediateRecovers || missing ? 'completed' : 'local-deferred',
          });
        }
      } finally {
        finishLateRead();
        if (timed) jest.useRealTimers();
      }
      expect(interrupted).toBe(1);
      expect(check).toHaveBeenCalledTimes(1);
      expect(upload).not.toHaveBeenCalled();
      expect(await readWallet()).toMatchObject({
        name: immediateRecovers ? remoteName : wallet.name,
      });
      expect(await localDb.getSyncItem({ id: pending.id })).toMatchObject({
        data: pending.data,
        serverUploaded: true,
        localSceneUpdated: immediateRecovers,
      });
      if (!cancelled) {
        expect(
          await localDb.getWallet({
            walletId: sibling.id,
            withoutRefill: true,
          }),
        ).toMatchObject({ name: sibling.name, avatar: '{"img":"cat"}' });
        expect(
          await localDb.getSyncItem({ id: siblingPending.id }),
        ).toMatchObject({
          localSceneUpdated: true,
        });
      }
      if (immediateRecovers || missing)
        expect(config.lastSyncTimeKeyless).toEqual(expect.any(Number));
      else expect(config.lastSyncTimeKeyless).toBeUndefined();
      return;
    }

    await keyless.toggleCloudSyncKeyless({
      enabled: false,
      silentEnable: true,
    });
    expect(config.isCloudSyncEnabledKeyless).toBe(false);
    expect(remove).toHaveBeenCalledTimes(1);

    // Use the real out-of-sync local Wallet edit path; do not manufacture a
    // Wallet sync timestamp from ordinary display metadata.
    const offlineName = 'Local offline name to restore manually';
    await account.setWalletNameAndAvatar({
      walletId: wallet.id,
      name: offlineName,
      ...(noLocalAvatar || (freshAvatar && !avatarDiverged)
        ? {}
        : {
            avatar: {
              img: avatarDiverged ? ('dog' as const) : ('cat' as const),
            },
          }),
      allowDesktopLocalMetadata: true,
      skipEmitEvent: true,
    });
    let localAvatar = noLocalAvatar ? undefined : '{"img":"cat"}';
    if (freshAvatar)
      localAvatar = avatarDiverged ? '{"img":"dog"}' : '{"img":"bear"}';
    expect(await readWallet()).toMatchObject({
      name: offlineName,
      avatar: localAvatar,
    });
    expect(await localDb.getSyncItem({ id: key.key })).toMatchObject({
      data: acknowledged.data,
      dataTime: baseTime,
    });
    expect(upload).not.toHaveBeenCalled();

    // Exercise archival fallback even when ordinary post-commit history had
    // failed previously: no previously retained offline alias is available.
    await simpleDb.changeHistory.clearRawData();
    expect(await simpleDb.changeHistory.getChangeHistory(nameFilter)).toEqual(
      [],
    );

    if (scenario === 'disabled-in-transaction') {
      const updateWallet = localDb.txUpdateWallet.bind(localDb);
      let disableCalls = 0;
      // The real fake-IDB put completes, but its enclosing transaction has
      // not returned. Disable without changing either source or preimage.
      const insideTransaction = jest
        .spyOn(localDb, 'txUpdateWallet')
        .mockImplementation(async (options) => {
          await updateWallet(options);
          disableCalls += 1;
          await keyless.toggleCloudSyncKeyless({
            enabled: false,
            silentEnable: true,
          });
        });
      try {
        await keyless
          .toggleCloudSyncKeyless({ enabled: true, silentEnable: true })
          .catch(() => undefined);
      } finally {
        insideTransaction.mockRestore();
      }
      expect(disableCalls).toBe(1);
      expect(config.isCloudSyncEnabledKeyless).toBe(false);
      expect(config.currentCloudSyncKeylessWalletId).toBe(wallet.id);
      const current = await readWallet();
      expect(current).toMatchObject({
        name: offlineName,
        avatar: '{"img":"cat"}',
      });
      expect(current.firstEvmAddress).toBeUndefined();
      expect(await localDb.getSyncItem({ id: key.key })).toMatchObject({
        data: acknowledged.data,
        dataTime: baseTime,
        localSceneUpdated: false,
      });
      expect(upload).not.toHaveBeenCalled();
      return;
    }

    if (scenario === 'changed-source') {
      // oxlint-disable-next-line typescript/unbound-method -- called with the original entity as this
      const retain = SimpleDbEntityChangeHistory.prototype.retainWalletName;
      jest
        .spyOn(SimpleDbEntityChangeHistory.prototype, 'retainWalletName')
        .mockImplementation(
          async function retainThenChangeSource(
            this: SimpleDbEntityChangeHistory,
            options,
          ) {
            const stored = await retain.call(this, options);
            await keyless.setPersistedCurrentCloudSyncKeylessWalletId(
              'hd-another-space',
            );
            return stored;
          },
        );
      await keyless
        .toggleCloudSyncKeyless({ enabled: true, silentEnable: true })
        .catch(() => undefined);
      expect(replay).toHaveBeenCalledWith(
        expect.objectContaining({ forceSync: true }),
      );
      expect(config.currentCloudSyncKeylessWalletId).toBe('hd-another-space');
      expect(await readWallet()).toMatchObject({
        name: offlineName,
        avatar: '{"img":"cat"}',
      });
      expect(await localDb.getSyncItem({ id: key.key })).toMatchObject({
        data: acknowledged.data,
        dataTime: baseTime,
        localSceneUpdated: false,
      });
      return;
    }
    if (historyFails) {
      const failedHistory = jest
        .spyOn(SimpleDbEntityChangeHistory.prototype, 'retainWalletName')
        .mockImplementation(async () => {
          if (losesServerAck) {
            await localDb.updateSyncItem({
              ids: [key.key],
              updater: (row) => {
                row.serverUploaded = false;
                return row;
              },
            });
          }
          return false;
        });
      if (freshAvatar) {
        const nextTime = baseTime + (staleIncomingAvatar ? -100 : 100);
        const next = await makeItem(
          'Remote name awaiting history',
          'cat',
          nextTime,
        );
        const remote = prime.convertLocalItemToServerItem({ localItem: next });
        if (!remote)
          throw new OneKeyLocalError('Missing remote Wallet fixture');
        check.mockResolvedValueOnce({
          diff: [remote],
          updated: [],
          deleted: [],
          obsoleted: [],
          pwdHash: scope,
          serverTime: Date.now(),
        });
        if (manualHistory) {
          const replacement = finalSuperseded
            ? await makeItem('Later cloud name', 'bear', nextTime + 100)
            : undefined;
          let recoveredHistoryCalls = 0;
          const actualReplay =
            ServicePrimeCloudSync.prototype.syncPendingItemsToScene.bind(prime);
          replay.mockImplementationOnce(async (options) => {
            // The exact freshly downloaded Wallet must already have tried to
            // preserve its name before this final replay is reached.
            expect(failedHistory).toHaveBeenCalledTimes(1);
            if (replacement) {
              const remoteReplacement = prime.convertLocalItemToServerItem({
                localItem: replacement,
              });
              if (!remoteReplacement)
                throw new OneKeyLocalError(
                  'Missing superseding Wallet fixture',
                );
              await prime.saveServerSyncItemsToLocal({
                serverItems: [remoteReplacement],
                shouldSyncToScene: false,
                syncCredential: credential,
                serverPwdHash: scope,
              });
            }
            if (!finalRecovered)
              getSyncCredentialSafe.mockResolvedValueOnce(undefined);
            if (finalRecovered) {
              failedHistory.mockRestore();
              const recoveredHistory = jest.spyOn(
                SimpleDbEntityChangeHistory.prototype,
                'retainWalletName',
              );
              await actualReplay(options);
              recoveredHistoryCalls = recoveredHistory.mock.calls.length;
              return;
            }
            await actualReplay(options);
            if (finalInspectionUnavailable)
              jest
                .spyOn(localDb, 'getRecordsByIds')
                .mockRejectedValueOnce(
                  new OneKeyLocalError(
                    'Synthetic final Wallet DAO unavailable',
                  ),
                );
          });
          jest
            .spyOn(prime, 'resolveInitLocalSyncItemsPassword')
            .mockResolvedValue('');
          jest.spyOn(prime, 'prepareLocalSyncWallets').mockResolvedValue();
          jest.spyOn(prime, 'initLocalSyncItemsDB').mockResolvedValue({
            allWallets: [],
            allDevices: [],
            allAccounts: [],
            allIndexedAccounts: [],
          });
          config = { ...config, isCloudSyncEnabledKeyless: true };
          await expect(prime.syncNowKeylessWithResult()).resolves.toBe(
            finalRecovered || finalSuperseded ? 'completed' : 'local-deferred',
          );
          expect(await readWallet()).toMatchObject({
            name: finalRecovered ? 'Remote name awaiting history' : offlineName,
            avatar: '{"img":"cat"}',
            firstEvmAddress: remoteAddress.toLowerCase(),
          });
          expect(await localDb.getSyncItem({ id: key.key })).toMatchObject({
            data: (replacement ?? next).data,
            dataTime: (replacement ?? next).dataTime,
            localSceneUpdated: finalRecovered,
          });
          expect(recoveredHistoryCalls).toBe(finalRecovered ? 1 : 0);
          if (finalRecovered || finalSuperseded)
            expect(config.lastSyncTimeKeyless).toEqual(expect.any(Number));
          else expect(config.lastSyncTimeKeyless).toBeUndefined();
          expect(config.cloudSyncReconciliation).toMatchObject({
            status: 'complete',
            unfinished: false,
            nextRetryAt: undefined,
          });
          expect(check).toHaveBeenCalledTimes(1);
          expect(upload).not.toHaveBeenCalled();
          return;
        }
        const updateWallet = localDb.txUpdateWallet.bind(localDb);
        const stop = cancelFreshAvatar
          ? jest
              .spyOn(localDb, 'txUpdateWallet')
              .mockImplementation(async (options) => {
                await updateWallet(options);
                await keyless.toggleCloudSyncKeyless({
                  enabled: false,
                  silentEnable: true,
                });
              })
          : undefined;
        try {
          await keyless
            .toggleCloudSyncKeyless({ enabled: true, silentEnable: true })
            .catch((error) => {
              if (!cancelFreshAvatar) throw error;
            });
        } finally {
          stop?.mockRestore();
        }
        expect(await readWallet()).toMatchObject({
          name: offlineName,
          avatar:
            avatarDiverged ||
            priorPending ||
            cancelFreshAvatar ||
            staleIncomingAvatar ||
            foreignPriorAvatar
              ? localAvatar
              : '{"img":"cat"}',
        });
        if (!cancelFreshAvatar)
          expect((await readWallet()).firstEvmAddress).toBe(
            remoteAddress.toLowerCase(),
          );
        const current = await localDb.getSyncItem({ id: key.key });
        expect(current).toMatchObject({
          data: staleIncomingAvatar ? acknowledged.data : next.data,
          dataTime: staleIncomingAvatar ? baseTime : nextTime,
          localSceneUpdated: false,
        });
        expect(check).toHaveBeenCalledTimes(1);
        expect(upload).not.toHaveBeenCalled();
        if (cancelFreshAvatar)
          expect(config.isCloudSyncEnabledKeyless).toBe(false);
        return;
      }
      await keyless.toggleCloudSyncKeyless({
        enabled: true,
        silentEnable: true,
      });
      expect(await readWallet()).toMatchObject({
        name: offlineName,
        avatar: noLocalAvatar ? '{"img":"bear"}' : '{"img":"cat"}',
        firstEvmAddress: remoteAddress.toLowerCase(),
      });
      expect(await localDb.getSyncItem({ id: key.key })).toMatchObject({
        data: acknowledged.data,
        dataTime: baseTime,
        localSceneUpdated: losesServerAck,
        serverUploaded: !losesServerAck,
      });
      // Existing completed network comparison leaves the exact Wallet scene
      // pending separately and does not publish a new successful sync time.
      expect(config.cloudSyncReconciliation).toMatchObject({
        ...(restart ? {} : { status: 'complete' }),
        unfinished: false,
        nextRetryAt: undefined,
      });
      expect(config.lastSyncTimeKeyless).toBeUndefined();
      const checks = check.mock.calls.length;
      await prime.resumeCloudSyncReconciliation({ reason: 'timer' });
      expect(check.mock.calls).toHaveLength(checks);

      if (restart) {
        // Re-create the reconciliation service, keeping only the stored config,
        // actual IndexedDB pool row, and selected credential.
        failedHistory.mockRestore();
        const restartRetain = jest.spyOn(
          SimpleDbEntityChangeHistory.prototype,
          'retainWalletName',
        );
        const nextPrime = new ServicePrimeCloudSync({ backgroundApi });
        runningPrime = nextPrime;
        backgroundApi.servicePrimeCloudSync = nextPrime;
        jest
          .spyOn(nextPrime, 'getSyncCredentialSafe')
          .mockResolvedValue(credential);
        jest.spyOn(nextPrime, 'isCloudSyncIsAvailable').mockResolvedValue(true);
        jest
          .spyOn(nextPrime, 'ensureCloudSyncIsAvailable')
          .mockResolvedValue(undefined);
        const nextCheck = jest
          .spyOn(nextPrime, 'checkServerStatusWithRequestOptions')
          .mockResolvedValue({
            diff: [],
            updated: [],
            deleted: [],
            obsoleted: [],
            pwdHash: scope,
            serverTime: Date.now(),
          });
        const replayAfterRestart = jest.spyOn(
          nextPrime,
          'syncPendingItemsToScene',
        );
        await nextPrime.resumeCloudSyncReconciliation({ reason: 'timer' });
        expect(nextCheck).not.toHaveBeenCalled();
        expect(replayAfterRestart).not.toHaveBeenCalled();

        await expect(
          nextPrime.resumeCloudSyncReconciliation({
            reason: 'startup',
          }),
        ).resolves.toBe(true);
        expect(nextCheck).toHaveBeenCalledTimes(1);
        expect(
          nextCheck.mock.calls[0][0].localItems?.filter(
            ({ id }) => id === key.key,
          ),
        ).toEqual([
          expect.objectContaining({
            id: key.key,
            data: acknowledged.data,
            localSceneUpdated: false,
          }),
        ]);
        expect(replayAfterRestart).toHaveBeenCalledTimes(1);
        expect(restartRetain).toHaveBeenCalledTimes(1);
        expect(nextCheck.mock.invocationCallOrder[0]).toBeLessThan(
          restartRetain.mock.invocationCallOrder[0],
        );
        expect(await readWallet()).toMatchObject({
          name: wallet.name,
          avatar: '{"img":"bear"}',
          firstEvmAddress: remoteAddress.toLowerCase(),
        });
        expect(await localDb.getSyncItem({ id: key.key })).toMatchObject({
          data: acknowledged.data,
          dataTime: baseTime,
          localSceneUpdated: true,
          serverUploaded: true,
        });
        expect(config.cloudSyncReconciliation).toMatchObject({
          status: 'complete',
          reason: 'finished',
          unfinished: false,
        });
        expect(config.lastSyncTimeKeyless).toEqual(expect.any(Number));
        const reopenedHistory = new SimpleDbEntityChangeHistory();
        expect(
          (await reopenedHistory.getChangeHistory(nameFilter)).map(
            ({ value }) => value,
          ),
        ).toEqual([offlineName]);
      }
      return;
    }
    await keyless.toggleCloudSyncKeyless({ enabled: true, silentEnable: true });
    expect(config.isCloudSyncEnabledKeyless).toBe(true);
    expect(check).toHaveBeenCalled();
    expect(replay).toHaveBeenCalledWith(
      expect.objectContaining({ forceSync: true }),
    );
    expect((await readWallet()).name).toBe(wallet.name);
    expect((await readWallet()).avatar).toBe('{"img":"bear"}');
    expect(config.lastSyncTimeKeyless).toEqual(expect.any(Number));
    const reopenedHistory = new SimpleDbEntityChangeHistory();
    const previous = await reopenedHistory.getChangeHistory(nameFilter);
    expect(previous.map(({ value }) => value)).toEqual([offlineName]);
    expect(await localDb.getSyncItem({ id: key.key })).toMatchObject({
      data: acknowledged.data,
      dataTime: baseTime,
    });

    // Manual chooser uses this value; exercise the ordinary save entry again.
    await account.setWalletNameAndAvatar({
      walletId: wallet.id,
      name: previous[0].value,
      skipEmitEvent: true,
    });
    expect((await readWallet()).name).toBe(offlineName);
    const newestLocal = await localDb.getSyncItem({ id: key.key });
    expect(newestLocal.dataTime).toBeGreaterThan(baseTime);
    const olderRemote = prime.convertLocalItemToServerItem({
      localItem: acknowledged,
    });
    if (!olderRemote)
      throw new OneKeyLocalError('Missing synthetic server payload');
    await prime.saveServerSyncItemsToLocal({
      serverItems: [olderRemote],
      shouldSyncToScene: true,
      syncCredential: credential,
      serverPwdHash: scope,
    });
    expect((await readWallet()).name).toBe(offlineName);
    expect(await localDb.getSyncItem({ id: key.key })).toMatchObject({
      data: newestLocal.data,
      dataTime: newestLocal.dataTime,
    });
  },
  12_000,
);
