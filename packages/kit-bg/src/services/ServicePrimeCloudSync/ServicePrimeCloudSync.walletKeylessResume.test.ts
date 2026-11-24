import { EDeviceType } from '@onekeyfe/hd-shared';
import axios from 'axios';
import 'fake-indexeddb/auto';

import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { endpointsMap } from '@onekeyhq/shared/src/config/endpointsMap';
import {
  HARDWARE_CLOUD_SYNC_KEK_VERSION,
  HARDWARE_CLOUD_SYNC_KEY_ENVELOPE_DATA_TYPE,
} from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import requestHelper from '@onekeyhq/shared/src/request/requestHelper';
import {
  EChangeHistoryContentType,
  EChangeHistoryEntityType,
} from '@onekeyhq/shared/src/types/changeHistory';
import systemTimeUtils from '@onekeyhq/shared/src/utils/systemTimeUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type {
  ICloudSyncCheckServerStatusPostData,
  ICloudSyncCredential,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

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
import {
  computeHardwareCloudSyncPwdHash,
  createHardwareCloudSyncDeviceKey,
} from '../ServiceKeylessCloudSync/hardwareCloudSyncSession';
import ServiceKeylessCloudSync from '../ServiceKeylessCloudSync/ServiceKeylessCloudSync';
import keylessSyncCredentialStorage from '../ServiceKeylessWallet/utils/keylessSyncCredentialStorage';

import cloudSyncItemBuilder from './cloudSyncItemBuilder';
import ServicePrimeCloudSync from './ServicePrimeCloudSync';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type {
  IDBCloudSyncItem,
  IDBDevice,
  IDBWallet,
} from '../../dbs/local/types';
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
const manualRecoveryFixtures: {
  key: string;
  wallet: string;
  device: string;
}[] = [];
afterEach(async () => {
  await runningPrime?.cancelPublicAccountSnapshotImport();
  runningPrime = undefined;
  for (const { key, wallet, device } of manualRecoveryFixtures.splice(0)) {
    await localDb.withTransaction(
      EIndexedDBBucketNames.account,
      async (tx) => {
        await localDb.txRemoveRecords({
          tx,
          name: ELocalDBStoreNames.CloudSyncItem,
          ids: [key],
        });
        await localDb.txRemoveRecords({
          tx,
          name: ELocalDBStoreNames.Wallet,
          ids: [wallet],
        });
        await localDb.txRemoveRecords({
          tx,
          name: ELocalDBStoreNames.Device,
          ids: [device],
        });
      },
      { skipCloudCredentialWarmup: true },
    );
  }
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
        const successorHistorySaved =
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
              return successorHistorySaved && primaryHistoryChecks > 1;
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
                localSceneUpdated: !writeSuperseded,
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
        const applied =
          !uploadOnly &&
          !scopeChanged &&
          !invalidEnvelope &&
          !unavailableScene &&
          !writeFailure;
        if (writeFailure) expect(failsOnWalletPut).toBe(1);
        if (writeFailure && !writeSuperseded)
          expect(await readWallet()).toMatchObject({
            name: wallet.name,
            avatar: wallet.avatar,
          });
        if (successorCase) {
          expect(pushedSuccessor).toMatchObject({
            serverUploaded: true,
            localSceneUpdated: !successorUnreadable,
            dataTime: baseTime + 300,
          });
          expect(await localDb.getSyncItem({ id: pending.id })).toMatchObject({
            ...pushedSuccessor,
          });
          expect(await readWallet()).toMatchObject({
            name: successorUnreadable ? remoteName : successorName,
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
          (applied && !shortReceipt && !nodeChanged && !nodeAba) ||
          uploadOnly ||
          successorCase ||
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
        let sourceChangedDuringHistory = false;
        if (!retained)
          jest
            .spyOn(SimpleDbEntityChangeHistory.prototype, 'retainWalletName')
            .mockImplementation(async () => {
              if (sourceChanged) {
                sourceChangedDuringHistory = true;
                config = {
                  ...config,
                  currentCloudSyncKeylessWalletId: 'hd-another-space',
                };
                await prime.cancelPublicAccountSnapshotImport();
              }
              return false;
            });
        const toPush = (item: IDBCloudSyncItem) => {
          const remote = prime.convertLocalItemToServerItem({
            localItem: item,
          });
          if (!remote)
            throw new OneKeyLocalError('Missing synthetic push item');
          return remote;
        };
        if (scenario.startsWith('push-name-history-parallel')) {
          const newerHistorySaved =
            scenario === 'push-name-history-parallel-applied';
          const presentation = jest.spyOn(
            prime.syncManagers.wallet,
            'buildSyncTargetByPayload',
          );
          const rawProof = jest.spyOn(
            prime.syncManagers.wallet,
            'findWalletSyncTargetReadOnly',
          );
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
              return newerHistorySaved;
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
            await Promise.all([olderWork, newerWork]);
          }
          expect(presentation).toHaveBeenCalledTimes(3);
          expect(rawProof).not.toHaveBeenCalled();
          expect(atHistory).toBe(2);
          expect(await readWallet()).toMatchObject({
            name: newerName,
          });
          expect(await localDb.getSyncItem({ id: pending.id })).toMatchObject({
            data: newer.data,
            serverUploaded: true,
            localSceneUpdated: true,
          });
          expect(
            await localDb.getSyncItem({ id: siblingPending.id }),
          ).toMatchObject({ localSceneUpdated: true });
          expect(config.lastSyncTimeKeyless).toEqual(expect.any(Number));
          return;
        }
        const push = prime.saveServerSyncItemsToLocal({
          serverItems: [toPush(pending), toPush(siblingPending)],
          shouldSyncToScene: true,
          syncCredential: credential,
          serverPwdHash: scope,
          deferPushBatchLastSyncTime: true,
        });
        if (sourceChanged) {
          await expect(push).rejects.toThrow('Cloud sync was cancelled');
        } else {
          await push;
        }
        expect(await readWallet()).toMatchObject({
          name: sourceChanged ? wallet.name : remoteName,
        });
        expect(await localDb.getSyncItem({ id: pending.id })).toMatchObject({
          data: pending.data,
          serverUploaded: true,
          localSceneUpdated: !sourceChanged,
        });
        expect(
          await localDb.getWallet({
            walletId: sibling.id,
            withoutRefill: true,
          }),
        ).toMatchObject({
          name: sibling.name,
          avatar: sourceChanged ? sibling.avatar : '{"img":"cat"}',
        });
        expect(
          await localDb.getSyncItem({ id: siblingPending.id }),
        ).toMatchObject({
          localSceneUpdated: !sourceChanged,
        });
        expect(sourceChangedDuringHistory).toBe(sourceChanged);
        if (sourceChanged) expect(config.lastSyncTimeKeyless).toBeUndefined();
        else expect(config.lastSyncTimeKeyless).toEqual(expect.any(Number));
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
      expect(
        check.mock.calls.filter(([options]) => options.isFullDBChecking),
      ).toHaveLength(1);
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
      isExplicitWalletMetadataEdit: true,
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
            'completed',
          );
          expect(await readWallet()).toMatchObject({
            name: 'Remote name awaiting history',
            avatar: '{"img":"cat"}',
            firstEvmAddress: remoteAddress.toLowerCase(),
          });
          expect(await localDb.getSyncItem({ id: key.key })).toMatchObject({
            data: (replacement ?? next).data,
            dataTime: (replacement ?? next).dataTime,
            localSceneUpdated: !replacement,
          });
          expect(recoveredHistoryCalls).toBe(0);
          expect(config.lastSyncTimeKeyless).toEqual(expect.any(Number));
          expect(config.cloudSyncReconciliation).toMatchObject({
            status: 'complete',
            unfinished: false,
            nextRetryAt: undefined,
          });
          expect(
            check.mock.calls.filter(([options]) => options.isFullDBChecking),
          ).toHaveLength(1);
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
        const appliedName = staleIncomingAvatar
          ? wallet.name
          : 'Remote name awaiting history';
        const appliedAvatar = staleIncomingAvatar
          ? '{"img":"bear"}'
          : '{"img":"cat"}';
        expect(await readWallet()).toMatchObject({
          name: cancelFreshAvatar ? offlineName : appliedName,
          avatar: cancelFreshAvatar ? localAvatar : appliedAvatar,
        });
        if (!cancelFreshAvatar)
          expect((await readWallet()).firstEvmAddress).toBe(
            remoteAddress.toLowerCase(),
          );
        const current = await localDb.getSyncItem({ id: key.key });
        expect(current).toMatchObject({
          data: staleIncomingAvatar ? acknowledged.data : next.data,
          dataTime: staleIncomingAvatar ? baseTime : nextTime,
          localSceneUpdated: !cancelFreshAvatar,
        });
        expect(
          check.mock.calls.filter(([options]) => options.isFullDBChecking),
        ).toHaveLength(1);
        expect(upload).not.toHaveBeenCalled();
        if (cancelFreshAvatar)
          expect(config.isCloudSyncEnabledKeyless).toBe(false);
        return;
      }
      await keyless.toggleCloudSyncKeyless({
        enabled: true,
        silentEnable: true,
      });
      const currentWallet = await readWallet();
      expect(currentWallet).toMatchObject({
        name: losesServerAck ? offlineName : wallet.name,
        avatar: losesServerAck ? '{"img":"cat"}' : '{"img":"bear"}',
      });
      expect(currentWallet.firstEvmAddress).toBe(
        losesServerAck ? undefined : remoteAddress.toLowerCase(),
      );
      expect(await localDb.getSyncItem({ id: key.key })).toMatchObject({
        data: acknowledged.data,
        dataTime: baseTime,
        localSceneUpdated: true,
        serverUploaded: !losesServerAck,
      });
      expect(config.cloudSyncReconciliation).toMatchObject({
        ...(restart ? {} : { status: 'complete' }),
        unfinished: false,
        nextRetryAt: undefined,
      });
      expect(config.lastSyncTimeKeyless).toEqual(expect.any(Number));
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
        expect(
          nextCheck.mock.calls.filter(([options]) => options.isFullDBChecking),
        ).toHaveLength(1);
        expect(
          nextCheck.mock.calls[0][0].localItems?.filter(
            ({ id }) => id === key.key,
          ),
        ).toEqual([
          expect.objectContaining({
            id: key.key,
            data: acknowledged.data,
            localSceneUpdated: true,
          }),
        ]);
        expect(replayAfterRestart).toHaveBeenCalledTimes(1);
        expect(restartRetain).not.toHaveBeenCalled();
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
        ).toEqual([]);
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

it.each([
  'foreign-cache-with-final-url',
  'foreign-cache-without-final-url',
  'current-cache-without-final-url',
  'automatic-login-with-foreign-cache',
] as const)(
  'ordinary hardware sync does not run a supplemental wallet check (%s)',
  async (scenario) => {
    const device: IDBDevice = {
      id: `manual-hw-device-${scenario}`,
      deviceId: `manual-hw-physical-${scenario}`,
      deviceType: EDeviceType.Pro,
      connectId: '',
      uuid: `synthetic-${scenario}`,
      name: 'Synthetic device',
      features: '{}',
      settingsRaw: '{}',
      createdAt: 1,
      updatedAt: 1,
    };
    const wallet: IDBWallet = {
      ...walletFixture,
      id: `hw-manual-wallet-${scenario}`,
      type: 'hw',
      hash: undefined,
      isKeyless: false,
      associatedDevice: device.id,
      name: 'Local canonical name',
    };
    const credentialId = 'synthetic-manual-hardware-source';
    const source = {
      type: 'hardware',
      credentialId,
      derivationVersion: 1,
      deviceName: 'Synthetic hardware',
      deviceType: EDeviceType.Pro,
    } as const;
    const dekId = 'a'.repeat(32);
    const oldDekId = 'b'.repeat(32);
    const currentHash = computeHardwareCloudSyncPwdHash(dekId);
    const oldHash = computeHardwareCloudSyncPwdHash(oldDekId);
    const baseURL = 'https://manual-cloud-fixture.example.test';
    jest.replaceProperty(
      endpointsMap.prod,
      EServiceEndpointEnum.Prime,
      baseURL,
    );
    jest
      .spyOn(devSettingsPersistAtom, 'get')
      .mockResolvedValue({ enabled: false });
    jest
      .spyOn(requestHelper, 'getDevSettingsPersistAtom')
      .mockResolvedValue({ enabled: false });
    const automaticLogin = scenario === 'automatic-login-with-foreign-cache';
    const alreadyCurrent = scenario === 'current-cache-without-final-url';
    const hardware = {
      keylessWalletId: credentialId,
      signingPrivateKey: '',
      signingPublicKey: '',
      source,
      encryptionKey: 'aa'.repeat(32),
      pwdHash: currentHash,
      hardwareSession: {
        deviceKeyJwk: createHardwareCloudSyncDeviceKey(),
        accessToken: 'synthetic',
        refreshToken: 'synthetic',
        accessTokenExpiresAt: Date.now() + 360_000,
        dekId,
        sessionId: 'fixture-session',
        environment: 'prod' as const,
        boundBaseURL: baseURL,
        boundBaseURLVerified: true,
      },
    };
    const credential: ICloudSyncCredential = {
      primeAccountSalt: '',
      securityPasswordR1: '',
      masterPasswordUUID: '',
      keylessCredential: hardware,
    };
    const oldCredential: ICloudSyncCredential = {
      ...credential,
      keylessCredential: {
        ...hardware,
        encryptionKey: 'bb'.repeat(32),
        pwdHash: oldHash,
      },
    };
    let config: IPrimeCloudSyncPersistAtomData = {
      isCloudSyncEnabled: false,
      isCloudSyncEnabledKeyless: true,
      hardwareCloudSyncKeySource: source,
      currentCloudSyncKeylessWalletId: credentialId,
      cloudSyncAccountApplyVersion: 2,
    };
    jest.replaceProperty(appLocale, 'isReady', Promise.resolve(true));
    jest
      .spyOn(primeCloudSyncPersistAtom, 'get')
      .mockImplementation(async () => config);
    jest
      .spyOn(primeCloudSyncPersistAtom, 'set')
      .mockImplementation(async (update) => {
        config = typeof update === 'function' ? update(config) : update;
      });
    jest
      .spyOn(systemTimeUtils, 'ensureFreshServerTime')
      .mockResolvedValue(true);
    jest
      .spyOn(keylessSyncCredentialStorage, 'getCredential')
      .mockResolvedValue(hardware);
    const backgroundApi = {
      localDb,
      simpleDb,
      serviceApp: { isAppLocked: async () => false },
      serviceDiscovery: {
        getBrowserBookmarksWithFillingSortIndex: async () => [],
      },
      serviceMarketV2: {
        getMarketWatchListWithFillingSortIndexV2: async () => ({ data: [] }),
      },
      serviceCustomRpc: {
        getAllCustomRpc: async () => [],
        getAllCustomNetworks: async () => [],
      },
      serviceAddressBook: { getItemsByNetwork: async () => [] },
      serviceCustomToken: {
        getAllCustomTokens: async () => [],
        getAllHiddenTokens: async () => [],
      },
    } as unknown as IBackgroundApi;
    const keyless = new ServiceKeylessCloudSync({ backgroundApi });
    const prime = new ServicePrimeCloudSync({ backgroundApi });
    const account = new ServiceAccount({ backgroundApi });
    runningPrime = prime;
    backgroundApi.serviceKeylessCloudSync = keyless;
    backgroundApi.servicePrimeCloudSync = prime;
    backgroundApi.serviceAccount = account;
    localDb.setBackgroundApi(backgroundApi);
    jest.replaceProperty(
      appGlobals,
      '$backgroundApiProxy',
      backgroundApi as unknown as typeof appGlobals.$backgroundApiProxy,
    );
    jest.spyOn(prime, 'getSyncCredentialSafe').mockResolvedValue(credential);
    if (automaticLogin) {
      jest
        .spyOn(prime, 'resolveInitLocalSyncItemsPassword')
        .mockResolvedValue('');
      jest.spyOn(prime, 'prepareLocalSyncWallets').mockResolvedValue();
    }
    jest.spyOn(prime, 'isCloudSyncIsAvailable').mockResolvedValue(true);
    jest
      .spyOn(prime, 'ensureCloudSyncIsAvailable')
      .mockResolvedValue(undefined);
    jest
      .spyOn(prime, 'resolvePasswordOnlyIfHdXfpMissing')
      .mockResolvedValue('');
    jest
      .spyOn(account, 'getAllWallets')
      .mockResolvedValue({ wallets: [wallet], allDevices: [device] });
    jest.spyOn(account, 'getAllAccounts').mockResolvedValue({
      accounts: [],
      accountsRemoved: undefined,
      allWallets: undefined,
      allDevices: undefined,
      allIndexedAccounts: [],
      indexedAccountsRemoved: [],
    });
    jest
      .spyOn(account, 'getAllIndexedAccounts')
      .mockResolvedValue({ indexedAccounts: [], indexedAccountsRemoved: [] });

    const manager = prime.syncManagers.wallet;
    const target = await manager.buildSyncTargetByDBQuery({
      dbRecord: wallet,
      allDevices: [device],
    });
    const { key, rawKey, dataType, payload } =
      await manager.buildSyncKeyAndPayload({ target });
    const baseTime = Date.now() - 3000;
    const make = (
      name: string,
      avatar: 'bear' | 'cat',
      dataTime: number,
      syncCredential: ICloudSyncCredential,
    ) =>
      cloudSyncItemBuilder.buildSyncItemFromRawDataJson({
        key,
        dataTime,
        syncCredential,
        rawDataJson: {
          rawKey,
          dataType,
          payload: { ...payload, name, avatar: { img: avatar } },
        },
      });
    const previous = {
      ...(await make(
        wallet.name,
        'bear',
        baseTime,
        alreadyCurrent ? credential : oldCredential,
      )),
      serverUploaded: true,
      localSceneUpdated: true,
    };
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
          name: ELocalDBStoreNames.Device,
          records: [device],
        });
        await localDb.txAddRecords({
          tx,
          name: ELocalDBStoreNames.CloudSyncItem,
          records: [previous],
        });
      },
      { skipCloudCredentialWarmup: true },
    );

    manualRecoveryFixtures.push({ key, wallet: wallet.id, device: device.id });
    const remoteTime = baseTime + 1000;
    const remote = await make(
      'Cloud canonical name',
      'cat',
      remoteTime,
      credential,
    );
    const incoming = prime.convertLocalItemToServerItem({ localItem: remote });
    if (!incoming)
      throw new OneKeyLocalError('Expected synthetic server record');
    const envelope = (id: string, generation: number) => ({
      key: `dek:${id}`,
      dataType: HARDWARE_CLOUD_SYNC_KEY_ENVELOPE_DATA_TYPE,
      isDeleted: false,
      data: JSON.stringify({
        dekId: id,
        generation,
        kekVersion: HARDWARE_CLOUD_SYNC_KEK_VERSION,
        kekSalt: 'c'.repeat(32),
        wrappedDek: 'synthetic-envelope-do-not-unwrap',
      }),
    });
    const checked = jest.fn(
      async (request: {
        url?: string;
        method?: string;
        data?: string;
        baseURL?: string;
      }) => {
        expect(request.url).toBe('/prime/v1/sync/check');
        expect(request.method).toBe('post');
        const postData = JSON.parse(
          request.data ?? '{}',
        ) as ICloudSyncCheckServerStatusPostData;
        expect(postData.pwdHash).toBe(currentHash);
        const hint = postData.localData.find((entry) => entry.key === key);
        expect(hint).toEqual(
          alreadyCurrent
            ? { key, dataType, dataTimestamp: baseTime }
            : undefined,
        );
        expect(await localDb.getSyncItem({ id: key })).toEqual(previous);
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          config: request,
          request:
            scenario === 'foreign-cache-with-final-url'
              ? { responseURL: `${baseURL}/prime/v1/sync/check` }
              : {},
          data: {
            code: 0,
            data: {
              pwdHash: currentHash,
              serverTime: Date.now(),
              updated: [incoming, envelope(dekId, 2), envelope(oldDekId, 1)],
              diff: [],
              deleted: [],
              obsoleted: [],
            },
          },
        };
      },
    );
    const downloadPath = '/prime/v1/sync/download';
    const downloaded = jest.fn(
      (request: { method?: string; data?: string }) => {
        expect(request.method).toBe('post');
        expect(JSON.parse(request.data ?? '{}')).toEqual({
          pwdHash: currentHash,
        });
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          request: { responseURL: `${baseURL}${downloadPath}` },
          data: {
            code: 0,
            data: {
              pwdHash: currentHash,
              serverData: [incoming, envelope(dekId, 2)],
            },
          },
        };
      },
    );
    const client = axios.create({
      baseURL,
      adapter: async (request) => ({
        ...(request.url === downloadPath
          ? downloaded(request)
          : await checked(request)),
        config: request,
      }),
    });
    jest.spyOn(keyless, 'getClient').mockResolvedValue(client);
    Object.assign(keyless, { hardwareCloudMigrationRecovered: true });
    const sent = jest
      .spyOn(prime, 'apiUploadItemsKeyless')
      .mockResolvedValue({ created: 0, updated: 0, nonce: 0 });
    const run = () =>
      prime.syncNowKeylessWithResult({
        callerName: 'Manual hardware Cloud sync',
        noDebounceUpload: true,
        forceSync: true,
        bypassRetryBackoff: true,
        askPasswordOnlyIfHdXfpMissing: true,
      });
    const result = await (async () => {
      if (automaticLogin) {
        return prime.syncNowKeyless({
          callerName: 'Keyless Wallet Login Success',
          noDebounceUpload: true,
          forceSync: true,
        });
      }
      return run();
    })();
    expect(checked).toHaveBeenCalledTimes(1);
    expect(downloaded).toHaveBeenCalledTimes(
      automaticLogin || alreadyCurrent ? 0 : 1,
    );
    const canonical = await localDb.getWallet({
      walletId: wallet.id,
      withoutRefill: true,
    });
    const retained = await localDb.getSyncItem({ id: key });
    if (alreadyCurrent) {
      expect(result).toBe('completed');
      expect(canonical).toMatchObject({
        name: 'Cloud canonical name',
        avatar: '{"img":"cat"}',
      });
      expect(retained).toMatchObject({
        data: remote.data,
        dataTime: remoteTime,
        localSceneUpdated: true,
        serverUploaded: true,
      });
      await expect(
        simpleDb.changeHistory.getChangeHistory({
          entityType: EChangeHistoryEntityType.Wallet,
          entityId: wallet.id,
          contentType: EChangeHistoryContentType.Name,
        }),
      ).resolves.toMatchObject([{ value: wallet.name }]);
      expect(sent).not.toHaveBeenCalled();
    } else {
      expect(canonical.name).toBe(wallet.name);
      expect(retained).toEqual(previous);
    }
    expect(sent).not.toHaveBeenCalled();
  },
  12_000,
);
