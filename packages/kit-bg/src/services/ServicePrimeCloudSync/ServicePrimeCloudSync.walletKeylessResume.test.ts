import 'fake-indexeddb/auto';

import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
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
import { primeCloudSyncPersistAtom } from '../../states/jotai/atoms';
import ServiceAccount from '../ServiceAccount/ServiceAccount';
import ServiceKeylessCloudSync from '../ServiceKeylessCloudSync/ServiceKeylessCloudSync';
import keylessSyncCredentialStorage from '../ServiceKeylessWallet/utils/keylessSyncCredentialStorage';

import cloudSyncItemBuilder from './cloudSyncItemBuilder';
import ServicePrimeCloudSync from './ServicePrimeCloudSync';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IDBWallet } from '../../dbs/local/types';
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
] as const)(
  'replays only the still-current authenticated software Keyless scene (%s)',
  async (scenario) => {
    const historyFails = scenario.startsWith('history-failure');
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
