import { Semaphore } from 'async-mutex';

import appGlobals from '@onekeyhq/shared/src/appGlobals';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  isAvailable,
  logoutFromGoogleDrive,
} from '@onekeyhq/shared/src/cloudfs';
import { PRIME_WEB_PURCHASE_LINK_PRODUCTION } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
import { appRestart } from '@onekeyhq/shared/src/modules3rdParty/appRestart';
import { EAppRestartMode } from '@onekeyhq/shared/src/modules3rdParty/appRestart/types';
import { resetIntercomVisitorStorage } from '@onekeyhq/shared/src/modules3rdParty/intercom/visitorStorage';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { flushAvailabilitySnapshotOnHidden } from '@onekeyhq/shared/src/request/availabilityAggregator';
import {
  ERootRoutes,
  ETabHomeRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import appStorage, {
  storageHub,
} from '@onekeyhq/shared/src/storage/appStorage';
import secureStorageInstance from '@onekeyhq/shared/src/storage/instance/secureStorageInstance';
import type { IOpenUrlRouteInfo } from '@onekeyhq/shared/src/utils/extUtils';
import extUtils from '@onekeyhq/shared/src/utils/extUtils';
import { storeExtensionTokenPreview } from '@onekeyhq/shared/src/utils/marketTokenPreviewRoute';
import resetUtils from '@onekeyhq/shared/src/utils/resetUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { IMarketTokenDetailPreview } from '@onekeyhq/shared/types/marketV2';
import type {
  IPrimeWebCheckoutExtensionContext,
  IPrimeWebCheckoutOpenOptions,
  IPrimeWebCheckoutPendingSession,
} from '@onekeyhq/shared/types/prime/primeTypes';

import localDb from '../dbs/local/localDb';
import {
  DEFAULT_SECURE_STORAGE_LSE_GLOBAL_KEY_REF,
  deleteMmkvProfileKeyForLocalSecretEnvelope,
  localSecretEnvelopeService,
} from '../dbs/local/localSecretEnvelope';
import simpleDb from '../dbs/simple/simpleDb';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { v4appStorage } from '../migrations/v4ToV5Migration/v4appStorage';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import v4dbHubs from '../migrations/v4ToV5Migration/v4dbHubs';
import { appIsLocked } from '../states/jotai/atoms';
import { devSettingsPersistAtom } from '../states/jotai/atoms/devSettings';

import {
  APP_RESET_CONTROL_NAME,
  broadcastAppReset,
  listenForAppReset,
  readAppResetMarker,
  runWithAppResetLock,
  writeAppResetMarker,
} from './appResetState';
import { takeRecoveryTestFault } from './recoveryTestFaults';
import ServiceBase from './ServiceBase';
import { RecoveryCacheErasureError } from './ServiceCloudBackupV2/RecoveryCacheErasureError';
import { markIdentityRecoveryFailed } from './ServiceIdentityExit/identityLifecycleMutex';
import { biologyAuthUtils } from './ServicePassword/biologyAuthUtils';
import { beginSupabaseAuthAppReset } from './ServicePrime/primeAuthSessionAccess';

import type { IAppResetMarker } from './appResetState';
import type { ISimpleDBAppStatus } from '../dbs/simple/entity/SimpleDbEntityAppStatus';

const RESET_REMOTE_DEADLINE_MS = 10_000;
const RESET_LOCAL_STAGE_DEADLINE_MS = 15_000;
const RESET_RECOVERY_STAGE_DEADLINE_MS = 30_000;

type IResetStageLogger = (
  stage: string,
  event: string,
  details?: { elapsedMs?: number; deadlineMs?: number },
) => void;

type IExtensionPrimeWebCheckoutParams = Pick<
  IPrimeWebCheckoutPendingSession,
  'onekeyUserId' | 'checkoutId'
> &
  IPrimeWebCheckoutOpenOptions & {
    initiator: Pick<
      IPrimeWebCheckoutExtensionContext,
      'initiatorKind' | 'initiatorTabId' | 'initiatorWindowId'
    >;
  };

type IExtensionPrimeWebCheckoutContext = {
  params: IExtensionPrimeWebCheckoutParams;
  session: IPrimeWebCheckoutPendingSession;
  browserSessionId: string;
  extension: IPrimeWebCheckoutExtensionContext | undefined;
};

// Only the background owns this critical section; extension UIs have separate
// heaps. Persist the chosen tab before letting another surface look it up.
const extensionPrimeWebCheckoutTabMutex = new Semaphore(1);

function getExtensionCheckoutTab(tabId: number) {
  return new Promise<chrome.tabs.Tab | undefined>((resolve) => {
    chrome.tabs.get(tabId, (tab) => {
      void chrome.runtime.lastError;
      resolve(tab);
    });
  });
}

function isMatchingCheckoutPageUrl(
  url: string | undefined,
  checkoutUrl: string,
) {
  if (!url) {
    return false;
  }
  try {
    const current = new URL(url);
    const expected = new URL(checkoutUrl);
    // Keep all payment parameters, including duplicate values. Prefill and
    // attribution may differ without changing the identity of the payment.
    for (const candidate of [current, expected]) {
      for (const key of Array.from(candidate.searchParams.keys())) {
        if (key === 'email' || key.startsWith('utm_')) {
          candidate.searchParams.delete(key);
        }
      }
      candidate.searchParams.sort();
    }
    return (
      !current.username &&
      !current.password &&
      current.origin ===
        new URL(PRIME_WEB_PURCHASE_LINK_PRODUCTION.baseUrl).origin &&
      current.origin === expected.origin &&
      current.pathname === expected.pathname &&
      current.searchParams.toString() === expected.searchParams.toString()
    );
  } catch {
    return false;
  }
}

@backgroundClass()
class ServiceApp extends ServiceBase {
  unlockJobIds: string[] = [];

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async getEndpointInfo({ name }: { name: EServiceEndpointEnum }) {
    return this.getClientEndpointInfo(name);
  }

  /** Relayed by the main runtime: the native bg runtime gets no AppState events. */
  @backgroundMethod()
  async flushAvailabilitySnapshotOnHidden() {
    flushAvailabilitySnapshotOnHidden();
  }

  @backgroundMethod()
  async restartApp(opts: { mode?: EAppRestartMode; reason?: string } = {}) {
    // restartApp() MUST be called from background in Ext, UI reload will close
    // whole Browser. The platform-specific routing (desktopApi reload,
    // chrome.runtime.reload, location.reload, BackgroundThread.restart for
    // native) lives inside `appRestart` so this method stays uniform.
    await appRestart({
      mode: opts.mode ?? EAppRestartMode.All,
      reason: opts.reason ?? 'serviceApp.restartApp',
    });
  }

  private async resetNativeLocalSecretEnvelopeKeys() {
    if (!platformEnv.isNative) return;

    const results = await Promise.allSettled([
      deleteMmkvProfileKeyForLocalSecretEnvelope(),
      secureStorageInstance.removeSecureItem(
        DEFAULT_SECURE_STORAGE_LSE_GLOBAL_KEY_REF,
      ),
    ]);
    localSecretEnvelopeService.clearCapabilityCache();
    if (results.some((result) => result.status === 'rejected')) {
      throw new OneKeyLocalError('Native wallet encryption key erasure failed');
    }
  }

  private async resetData(log: IResetStageLogger = () => {}) {
    await this.runResetStage(log, 'logPersistence', () =>
      this.backgroundApi.serviceLogger.stopPersistenceForReset(),
    );

    // Client-scanned chains keep state in their own databases, outside every store cleared below; failures
    // come back as networks to retry and must not take App Reset down.
    const failedStages: unknown[] = [];
    const runCleanup = async (stage: string, task: () => unknown) => {
      try {
        await this.runResetStage(log, stage, task);
      } catch (error) {
        failedStages.push(error);
      }
    };
    let privacyChainDropFailed: string[] = [];
    try {
      privacyChainDropFailed = await this.runResetStage(
        log,
        'privacyChain',
        () => this.backgroundApi.servicePrivacyChain.dropAllLocalWalletData(),
      );
    } catch {
      console.error('servicePrivacyChain.dropAllLocalWalletData() error');
    }
    defaultLogger.setting.page.clearDataStep('privacyChain-dropLocalData');

    if (platformEnv.isNative) {
      try {
        await this.runResetStage(
          log,
          'supportVisitor',
          resetIntercomVisitorStorage,
        );
      } catch {
        // The general app-storage clear below also revokes a visitor reference
        // if secure-store cleanup fails. Wallet erasure must still continue.
        defaultLogger.app.error.log('Support visitor storage reset failed');
      }
    }

    await runCleanup('appStorage', () => appStorage.clear());
    await runCleanup('biometricStorage', () =>
      biologyAuthUtils.deletePassword(),
    );
    await runCleanup('syncStorage', () => appStorage.syncStorage.clearAll());

    if (platformEnv.isNative) {
      await runCleanup('jotaiStorage', async () => {
        const { clearNativeJotaiStorageForReset } =
          await import('../states/jotai/jotaiStorage');
        await clearNativeJotaiStorageForReset();
      });
    }
    await runCleanup('snapshotCaches', async () => {
      const { clearAllSnapshotCaches } =
        await import('@onekeyhq/shared/src/storage/SnapshotCache');
      await clearAllSnapshotCaches();
    });
    await runCleanup('legacyAppStorage', () => v4appStorage.clear());
    await runCleanup('walletEncryptionKeys', () =>
      this.resetNativeLocalSecretEnvelopeKeys(),
    );

    // Android Realm deletion may briefly block the JS thread.
    await runCleanup('walletDatabase', () =>
      localDb.reset((bucket) => log('walletDatabase', `blocked:${bucket}`)),
    );

    if (failedStages.length > 0) {
      await this.markPrivacyResetFailures(log, privacyChainDropFailed);
      throw failedStages[0];
    }
    await this.runResetStage(log, 'legacyWalletDatabase', async () => {
      if (await this.backgroundApi.serviceV4Migration?.checkIfV4DbExist()) {
        await v4dbHubs.v4localDb.reset();
      }
    });

    if (!platformEnv.isNative) {
      if (platformEnv.isRuntimeBrowser || platformEnv.isExtensionBackground) {
        await this.runResetStage(log, 'storageBuckets', async () => {
          const buckets = (globalThis.navigator as INavigator)?.storageBuckets;
          for (const name of (await buckets?.keys()) ?? []) {
            await buckets?.delete(name);
          }
        });
        if (!platformEnv.isDesktop) await this.deleteOtherIndexedDBs(log);
      }
      if (platformEnv.isRuntimeBrowser) {
        await this.runResetStage(log, 'browserStorage', () => {
          globalThis.localStorage.clear();
          globalThis.sessionStorage.clear();
        });
      } else if (platformEnv.isExtensionBackground) {
        appEventBus.emit(EAppEventBusNames.ClearStorageOnExtension, undefined);
        await timerUtils.wait(1200);
      }
      if (platformEnv.isExtension) {
        await this.runResetStage(log, 'extensionStorage', async () => {
          await globalThis.chrome.storage.local.clear();
          await globalThis.chrome.storage.session.clear();
        });
      }
      if (platformEnv.isDesktop) {
        await this.runResetStage(log, 'desktopConfiguration', () =>
          globalThis.desktopApiProxy?.storage.resetAppConfiguration(),
        );
      }
    }
    await this.markPrivacyResetFailures(log, privacyChainDropFailed);
  }

  private async deleteOtherIndexedDBs(log: IResetStageLogger) {
    await this.runResetStage(log, 'otherIndexedDBs', async () => {
      const indexedDB = globalThis.indexedDB;
      for (const { name } of (await indexedDB?.databases?.()) ?? []) {
        if (name && name !== APP_RESET_CONTROL_NAME) {
          await new Promise<void>((resolve, reject) => {
            const request = indexedDB.deleteDatabase(name);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
            request.onblocked = () => log('otherIndexedDBs', 'blocked');
          });
        }
      }
    });
  }

  private async markPrivacyResetFailures(
    log: IResetStageLogger,
    networkIds: string[],
  ) {
    // Scan databases survive the host storage clear, so retain their retry marker.
    if (networkIds.length) {
      await this.runResetStage(log, 'privacyChainRetry', () =>
        this.backgroundApi.servicePrivacyChain.markLocalDataDropPending({
          networkIds,
        }),
      );
    }
  }

  private resetRequest?: Promise<void>;

  private resetMarker?: IAppResetMarker;

  private readonly runningResetStages = new Map<string, Promise<unknown>>();

  private async runResetStage<T>(
    log: IResetStageLogger,
    stage: string,
    task: () => T | Promise<T>,
    deadlineMs = RESET_LOCAL_STAGE_DEADLINE_MS,
  ): Promise<T> {
    const start = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    log(stage, 'start', { deadlineMs });
    try {
      // Rejoin a native or database operation after its deadline.
      // Starting another delete could leave it queued behind a successful retry.
      const pending =
        (this.runningResetStages.get(stage) as Promise<T> | undefined) ??
        Promise.resolve().then(task);
      this.runningResetStages.set(stage, pending);
      const clearPending = () => {
        if (this.runningResetStages.get(stage) === pending) {
          this.runningResetStages.delete(stage);
        }
      };
      void pending.then(clearPending, clearPending);
      const result = await Promise.race([
        pending,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => {
            log(stage, 'timeout', {
              elapsedMs: Date.now() - start,
              deadlineMs,
            });
            reject(
              new OneKeyLocalError(
                `App reset timed out at ${stage}. Retry Reset App.`,
              ),
            );
          }, deadlineMs);
        }),
      ]);
      log(stage, 'completed', { elapsedMs: Date.now() - start });
      return result;
    } catch (error) {
      log(stage, 'failed', { elapsedMs: Date.now() - start, deadlineMs });
      if (error instanceof RecoveryCacheErasureError) throw error;
      throw new OneKeyLocalError(
        `App reset could not complete ${stage}. Retry Reset App.`,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private runResetRemoteJobs(
    log: IResetStageLogger,
    revokeAuth: (signal: AbortSignal) => Promise<string>,
  ) {
    const controller = new AbortController();
    const start = Date.now();
    const deadline = setTimeout(
      () => controller.abort(),
      RESET_REMOTE_DEADLINE_MS,
    );
    const run = async (stage: string, task: () => Promise<unknown>) => {
      log(stage, 'start', { deadlineMs: RESET_REMOTE_DEADLINE_MS });
      try {
        const result = await task();
        if (!controller.signal.aborted) {
          log(stage, result === 'skipped' ? 'skipped' : 'completed', {
            elapsedMs: Date.now() - start,
          });
        }
      } catch {
        if (!controller.signal.aborted)
          log(stage, 'failed', { elapsedMs: Date.now() - start });
      }
    };
    controller.signal.addEventListener(
      'abort',
      () => {
        log('remote', 'timeout', { elapsedMs: Date.now() - start });
      },
      { once: true },
    );
    void Promise.all([
      run('remoteAuth', () => revokeAuth(controller.signal)),
      run('remoteNotification', () =>
        this.backgroundApi.serviceNotification.unregisterClient({
          signal: controller.signal,
        }),
      ),
      run('remoteGoogle', async () => {
        if (
          !platformEnv.isNativeAndroid ||
          !(await isAvailable()) ||
          controller.signal.aborted
        ) {
          return 'skipped';
        }
        await logoutFromGoogleDrive(true, { signal: controller.signal });
        return 'completed';
      }),
    ]).finally(() => clearTimeout(deadline));
  }

  @backgroundMethod()
  async resetApp({
    preserveBackupRecovery = false,
  }: { preserveBackupRecovery?: boolean } = {}) {
    if (this.resetRequest) return this.resetRequest;
    return this.startAppReset(
      this.resetMarker ?? {
        operationId: stringUtils.generateUUID(),
        preserveBackupRecovery,
      },
      !this.resetMarker,
    );
  }

  async resumeInterruptedAppReset(): Promise<boolean> {
    listenForAppReset(() => {
      resetUtils.startResetting();
      markIdentityRecoveryFailed('appReset:otherWindow');
      beginSupabaseAuthAppReset();
      this.backgroundApi.serviceCloudBackupV2.beginLocalRecoveryReset();
    });
    const marker = await readAppResetMarker();
    if (!marker) return false;
    if (marker.desktopIndexedDBCleanup && platformEnv.isDesktop) {
      await runWithAppResetLock(async () => {
        resetUtils.startResetting();
        const log = this.buildResetLogger(marker);
        await this.deleteOtherIndexedDBs(log);
        await this.finishAppReset(log);
        resetUtils.endResetting();
      });
      return false;
    }
    await this.startAppReset(marker, false);
    return true;
  }

  private async startAppReset(marker: IAppResetMarker, tryRemote: boolean) {
    this.backgroundApi.serviceCloudBackupV2?.beginLocalRecoveryReset?.();
    const request = runWithAppResetLock(async () => {
      const pendingMarker = await readAppResetMarker().catch(() => undefined);
      if (!tryRemote && !this.resetMarker && !pendingMarker) return;
      const currentMarker = pendingMarker ?? marker;
      this.resetMarker = currentMarker;
      await this.resetAppInternal(currentMarker, tryRemote && !pendingMarker);
    });
    this.resetRequest = request;
    try {
      await request;
    } finally {
      this.resetRequest = undefined;
    }
  }

  private buildResetLogger(marker: IAppResetMarker): IResetStageLogger {
    return (stage, event, details) =>
      defaultLogger.setting.page.appResetStage({
        operationId: marker.operationId,
        stage,
        event,
        ...details,
      });
  }

  private async finishAppReset(log: IResetStageLogger) {
    await this.runResetStage(log, 'clearResetMarker', () =>
      writeAppResetMarker(),
    );
    log('localCleanup', 'reset_completed');
    broadcastAppReset('completed');
  }

  private async resetAppInternal(marker: IAppResetMarker, tryRemote: boolean) {
    const log = this.buildResetLogger(marker);
    if (marker.desktopIndexedDBCleanup && platformEnv.isDesktop) {
      await this.restartAfterAppReset(log);
      return;
    }

    resetUtils.startResetting();
    void this.backgroundApi.servicePrimeCloudSync
      ?.clearCachedSyncCredential()
      .catch(() => {
        log('cloudSync', 'cancel_failed');
      });
    markIdentityRecoveryFailed(marker.operationId);
    appEventBus.emit(EAppEventBusNames.AppResetIsolating, undefined);
    broadcastAppReset('isolating');
    const auth = beginSupabaseAuthAppReset();
    await this.runResetStage(log, 'resetMarker', () =>
      writeAppResetMarker(marker),
    );
    if (tryRemote) {
      this.runResetRemoteJobs(log, async (signal) => {
        const simulateTimeout =
          await takeRecoveryTestFault('resetRemoteTimeout');
        if (signal.aborted) return 'skipped';
        if (simulateTimeout) {
          log('remoteAuth', 'developer_fault_injected');
          appEventBus.emit(EAppEventBusNames.ShowToast, {
            method: 'error',
            title: '开发者模拟：远程撤销请求挂起',
            message: '本地重置继续，远程请求最多等待 10 秒。',
          });
          return auth.revoke(signal, { simulateTimeout: true });
        }
        return auth.revoke(signal);
      });
    }

    let recoveryErasureFailed = false;
    try {
      await this.runResetStage(
        log,
        'recoveryDrain',
        () =>
          this.backgroundApi.serviceCloudBackupV2.prepareLocalRecoveryForReset({
            preserve: marker.preserveBackupRecovery,
          }),
        RESET_RECOVERY_STAGE_DEADLINE_MS,
      );
    } catch (error) {
      if (!(error instanceof RecoveryCacheErasureError)) {
        throw new OneKeyLocalError(
          'App reset could not drain recovery tasks. Retry Reset App.',
        );
      }
      recoveryErasureFailed = true;
    }
    await this.runResetStage(log, 'identityStorage', () => auth.erase());
    await this.runResetStage(log, 'keylessStorage', () =>
      this.backgroundApi.serviceKeylessWallet?.eraseKeylessStorageForAppReset(),
    );
    await this.resetData(log);
    if (recoveryErasureFailed) throw new RecoveryCacheErasureError();
    if (platformEnv.isDesktop) {
      // WalletConnect and other renderer-owned connections can keep origin
      // database deletes blocked until Electron reloads this renderer.
      const nextMarker: IAppResetMarker = {
        ...marker,
        desktopIndexedDBCleanup: true,
      };
      await this.runResetStage(log, 'resetMarker', () =>
        writeAppResetMarker(nextMarker),
      );
      this.resetMarker = nextMarker;
    } else {
      await this.finishAppReset(log);
    }

    await this.restartAfterAppReset(log);
  }

  private async restartAfterAppReset(log: IResetStageLogger) {
    if (!platformEnv.isNative && (platformEnv.isWeb || platformEnv.isDesktop)) {
      // reset route/href
      try {
        appGlobals.$navigationRef.current?.navigate(ERootRoutes.Main, {
          screen: ETabRoutes.Home,
          params: {
            screen: ETabHomeRoutes.TabHome,
          },
        });
      } catch {
        console.error('reset route error');
      }
      defaultLogger.setting.page.clearData({ action: 'ResetApp' });
      await timerUtils.wait(600);
    }

    // resetData wipes localDb / appStorage / v4 db — the background runtime
    // is now holding stale state and bundle moduleIds may have re-keyed via
    // OTA. mode=All forces both runtimes cold so nothing reads from the
    // dead state.
    await this.runResetStage(log, 'restart', () =>
      this.restartApp({
        mode: EAppRestartMode.All,
        reason: 'auth.resetData',
      }),
    );
  }

  @backgroundMethod()
  async isAppLocked() {
    return appIsLocked.get();
  }

  @backgroundMethod()
  async dispatchUnlockJob() {
    defaultLogger.app.page.dispatchUnlockJob();
    appEventBus.emit(EAppEventBusNames.UnlockApp, undefined);
  }

  @backgroundMethod()
  async openExtensionExpandTab(routeInfo: IOpenUrlRouteInfo) {
    return extUtils.openExpandTab(routeInfo);
  }

  @backgroundMethod()
  async getExtensionBrowserSessionId() {
    return extUtils.getBrowserSessionId();
  }

  private async getCurrentExtensionPrimeWebCheckout({
    onekeyUserId,
    checkoutId,
  }: Pick<IPrimeWebCheckoutPendingSession, 'onekeyUserId' | 'checkoutId'>) {
    const session =
      await this.backgroundApi.simpleDb.prime.getWebCheckoutPendingSession({
        onekeyUserId,
      });
    const user = await this.backgroundApi.servicePrime.getLocalUserInfo();
    if (
      !session ||
      session.checkoutId !== checkoutId ||
      session.onekeyUserId !== onekeyUserId ||
      session.platform !== 'extension' ||
      !user.isLoggedIn ||
      user.onekeyUserId !== onekeyUserId
    ) {
      throw new OneKeyLocalError('Prime web checkout session changed');
    }
    return session;
  }

  private async getExtensionPrimeWebCheckoutContext(
    params: IExtensionPrimeWebCheckoutParams,
  ): Promise<IExtensionPrimeWebCheckoutContext> {
    const browserSessionId = await extUtils.getBrowserSessionId();
    if (!browserSessionId) {
      throw new OneKeyLocalError('Prime checkout browser session unavailable');
    }
    // Never use the caller's stale session snapshot to decide tab ownership.
    const session = await this.getCurrentExtensionPrimeWebCheckout(params);
    if (!isMatchingCheckoutPageUrl(session.checkoutUrl, session.checkoutUrl)) {
      throw new OneKeyLocalError('Invalid Prime checkout URL');
    }
    return {
      params,
      session,
      browserSessionId,
      extension:
        session.extension?.browserSessionId === browserSessionId
          ? session.extension
          : undefined,
    };
  }

  private async focusExtensionPrimeWebCheckoutTab({
    params,
    session,
    extension,
  }: IExtensionPrimeWebCheckoutContext): Promise<number | undefined> {
    const currentTabId = extension?.checkoutTabId;
    if (currentTabId === undefined) return undefined;
    const currentTab = await getExtensionCheckoutTab(currentTabId);
    const currentUrl = currentTab?.pendingUrl || currentTab?.url;
    await this.getCurrentExtensionPrimeWebCheckout(params);
    // Without tabs/host permission URL fields may be hidden. Focus only
    // our recorded tab; never rewrite a hidden URL or reset an active form.
    if (
      currentTab &&
      (!currentUrl ||
        isMatchingCheckoutPageUrl(currentUrl, session.checkoutUrl)) &&
      (await extUtils.focusTab(currentTabId))
    ) {
      await this.getCurrentExtensionPrimeWebCheckout(params);
      return currentTabId;
    }
    return undefined;
  }

  private async findReplacedExtensionPrimeWebCheckoutTab({
    params,
    session,
    browserSessionId,
  }: IExtensionPrimeWebCheckoutContext): Promise<number | undefined> {
    const replacedSession = params.replacedSession;
    if (
      !replacedSession ||
      replacedSession.onekeyUserId !== session.onekeyUserId ||
      replacedSession.extension?.browserSessionId !== browserSessionId
    ) {
      return undefined;
    }
    const replacedTabId = replacedSession.extension?.checkoutTabId;
    if (replacedTabId === undefined) return undefined;
    const replacedTab = await getExtensionCheckoutTab(replacedTabId);
    return isMatchingCheckoutPageUrl(
      replacedTab?.pendingUrl || replacedTab?.url,
      replacedSession.checkoutUrl,
    )
      ? replacedTabId
      : undefined;
  }

  private async createExtensionPrimeWebCheckoutTab(
    context: IExtensionPrimeWebCheckoutContext,
  ): Promise<number> {
    const { params, session } = context;
    const reusableTabId =
      await this.findReplacedExtensionPrimeWebCheckoutTab(context);
    await this.getCurrentExtensionPrimeWebCheckout(params);
    const url = params.email
      ? `${session.checkoutUrl}${session.checkoutUrl.includes('?') ? '&' : '?'}email=${encodeURIComponent(params.email)}`
      : session.checkoutUrl;
    const checkoutTab = await extUtils.openUrlInTab(url, {
      tabId: reusableTabId,
    });
    if (checkoutTab?.id === undefined) {
      throw new OneKeyLocalError('Failed to open the checkout tab');
    }
    return checkoutTab.id;
  }

  private async saveExtensionPrimeWebCheckoutTabContext(
    {
      params,
      session,
      extension,
      browserSessionId,
    }: IExtensionPrimeWebCheckoutContext,
    checkoutTabId: number,
  ): Promise<void> {
    await this.getCurrentExtensionPrimeWebCheckout(params);
    const didUpdate =
      await this.backgroundApi.simpleDb.prime.updateWebCheckoutPendingSessionExtensionContext(
        {
          onekeyUserId: session.onekeyUserId,
          checkoutId: session.checkoutId,
          extension: {
            ...(extension ?? params.initiator),
            checkoutTabId,
            browserSessionId,
          },
        },
      );
    if (!didUpdate) {
      throw new OneKeyLocalError('Prime web checkout session changed');
    }
    await this.getCurrentExtensionPrimeWebCheckout(params);
  }

  @backgroundMethod()
  async openExtensionPrimeWebCheckout(
    params: IExtensionPrimeWebCheckoutParams,
  ): Promise<number> {
    if (!platformEnv.isExtensionBackground) {
      throw new OneKeyLocalError(
        'Prime checkout tabs must be opened by the extension background',
      );
    }
    return extensionPrimeWebCheckoutTabMutex.runExclusive(async () => {
      const context = await this.getExtensionPrimeWebCheckoutContext(params);
      const currentTabId =
        await this.focusExtensionPrimeWebCheckoutTab(context);
      if (currentTabId !== undefined) return currentTabId;
      const checkoutTabId =
        await this.createExtensionPrimeWebCheckoutTab(context);
      try {
        await this.saveExtensionPrimeWebCheckoutTabContext(
          context,
          checkoutTabId,
        );
        return checkoutTabId;
      } catch (error) {
        // A failed context write or account/session change must not leave a
        // payable tab that cannot be authenticated by the return handler.
        await extUtils.removeTab(checkoutTabId);
        throw error;
      }
    });
  }

  @backgroundMethod()
  async openExtensionMarketTokenDetail(params: {
    tokenAddress: string;
    network: string;
    marketTokenId?: string;
    marketVariantId?: string;
    skipMarketDataFetch?: boolean;
    disableTrade?: boolean;
    isNative?: boolean;
    from?: EEnterWay;
    showFavoriteButton?: boolean;
    marketTokenCategory?: string;
    tokenDetailPreview?: IMarketTokenDetailPreview;
  }) {
    const {
      tokenAddress,
      network,
      marketTokenId,
      marketVariantId,
      skipMarketDataFetch,
      disableTrade,
      isNative,
      from,
      showFavoriteButton,
      marketTokenCategory,
      tokenDetailPreview,
    } = params;
    const routeParams: IOpenUrlRouteInfo['params'] = {};

    if (
      typeof tokenAddress !== 'string' ||
      typeof network !== 'string' ||
      !network ||
      (!tokenAddress && isNative === false)
    ) {
      throw new OneKeyLocalError('Invalid market token identity');
    }
    const routeIsNative = isNative ?? tokenAddress.length === 0;
    routeParams.isNative = routeIsNative;
    if (from) {
      routeParams.from = from;
    }
    if (typeof showFavoriteButton === 'boolean') {
      routeParams.showFavoriteButton = showFavoriteButton;
    }
    if (marketTokenCategory) {
      routeParams.marketTokenCategory = marketTokenCategory;
    }
    if (marketTokenId) {
      routeParams.marketTokenId = marketTokenId;
    }
    if (marketVariantId) {
      routeParams.marketVariantId = marketVariantId;
    }
    if (skipMarketDataFetch) {
      routeParams.skipMarketDataFetch = true;
    }
    if (typeof disableTrade === 'boolean') {
      routeParams.disableTrade = disableTrade;
    }
    if (tokenDetailPreview) {
      const previewId = await storeExtensionTokenPreview(
        { network, tokenAddress, isNative: routeIsNative },
        tokenDetailPreview,
      );
      if (previewId) routeParams.marketTokenPreviewId = previewId;
    }
    if (skipMarketDataFetch && !routeParams.marketTokenPreviewId) {
      throw new OneKeyLocalError('Unable to transfer market token preview');
    }

    return extUtils.openExpandTab({
      path: `/market/token/${encodeURIComponent(network)}/${encodeURIComponent(tokenAddress)}`,
      params: routeParams,
    });
  }

  @backgroundMethod()
  async openExtensionMarketStockDetail(params: {
    stockId: string;
    stockPreviewLogoUrl?: string;
    stockPreviewName?: string;
    stockPreviewSymbol?: string;
    tokenAddress?: string;
    network?: string;
    isNative?: boolean;
    from?: EEnterWay;
    disableTrade?: boolean;
    showFavoriteButton?: boolean;
  }) {
    const {
      stockId,
      stockPreviewLogoUrl,
      stockPreviewName,
      stockPreviewSymbol,
      tokenAddress,
      network,
      isNative,
      from,
      disableTrade,
      showFavoriteButton,
    } = params;
    const routeParams: IOpenUrlRouteInfo['params'] = {};

    if (stockPreviewSymbol) {
      routeParams.stockPreviewSymbol = stockPreviewSymbol;
    }
    if (stockPreviewName) {
      routeParams.stockPreviewName = stockPreviewName;
    }
    if (stockPreviewLogoUrl) {
      routeParams.stockPreviewLogoUrl = stockPreviewLogoUrl;
    }
    if (tokenAddress) {
      routeParams.tokenAddress = tokenAddress;
    }
    if (network) {
      routeParams.network = network;
    }
    if (typeof isNative === 'boolean') {
      routeParams.isNative = isNative;
    }
    if (from) {
      routeParams.from = from;
    }
    if (typeof disableTrade === 'boolean') {
      routeParams.disableTrade = disableTrade;
    }
    if (typeof showFavoriteButton === 'boolean') {
      routeParams.showFavoriteButton = showFavoriteButton;
    }

    return extUtils.openExpandTab({
      path: `/market/stock/${encodeURIComponent(stockId)}`,
      params: routeParams,
    });
  }

  @backgroundMethod()
  async updateLaunchTimes() {
    await simpleDb.appStatus.setRawData(
      (v): ISimpleDBAppStatus => ({
        ...v,
        launchTimes: (v?.launchTimes ?? 0) + 1,
        launchTimesLastReset: (v?.launchTimesLastReset ?? 0) + 1,
      }),
    );
  }

  @backgroundMethod()
  async resetLaunchTimesAfterUpdate() {
    await simpleDb.appStatus.setRawData(
      (v): ISimpleDBAppStatus => ({
        ...v,
        launchTimesLastReset: 0,
      }),
    );
  }

  @backgroundMethod()
  async getLaunchTimesLastReset() {
    const v = await simpleDb.appStatus.getRawData();
    return v?.launchTimesLastReset ?? 0;
  }

  @backgroundMethod()
  async clearAppStorage() {
    const devSettings = await devSettingsPersistAtom.get();
    if (!devSettings.enabled) {
      throw new OneKeyLocalError(
        'clearAppStorage is only available when devSettings is enabled',
      );
    }

    try {
      // Clear appStorage (works for both web and native)
      await appStorage.clear();
      defaultLogger.setting.page.clearDataStep('appStorage-clear');
      return { success: true };
    } catch (error) {
      console.error('clearAppStorage error', error);
      throw error;
    }
  }

  @backgroundMethod()
  async clearSimpleDB() {
    const devSettings = await devSettingsPersistAtom.get();
    if (!devSettings.enabled) {
      throw new OneKeyLocalError(
        'clearSimpleDB is only available when devSettings is enabled',
      );
    }

    try {
      let clearedKeysCount = 0;

      if (platformEnv.isWeb || platformEnv.isDesktop) {
        // Web/Desktop: Clear the dedicated SimpleDB IndexedDB database
        const simpleDbStorage = storageHub.$webStorageSimpleDB;
        if (simpleDbStorage) {
          const allKeys = await simpleDbStorage.getAllKeys();
          clearedKeysCount = allKeys.length;
          await simpleDbStorage.clear();
        }
      } else {
        // Native: Filter and remove keys with simple_db_v5 prefix from appStorage
        const SIMPLE_DB_KEY_PREFIX = 'simple_db_v5';
        const allKeys = await appStorage.getAllKeys();
        const simpleDbKeys = allKeys.filter((key) =>
          key.startsWith(SIMPLE_DB_KEY_PREFIX),
        );

        if (simpleDbKeys.length > 0) {
          await appStorage.multiRemove(simpleDbKeys);
        }
        clearedKeysCount = simpleDbKeys.length;
      }

      defaultLogger.setting.page.clearDataStep('simpleDB-clear');
      return {
        success: true,
        clearedKeysCount,
      };
    } catch (error) {
      console.error('clearSimpleDB error', error);
      throw error;
    }
  }

  @backgroundMethod()
  async clearGlobalStatus() {
    const devSettings = await devSettingsPersistAtom.get();
    if (!devSettings.enabled) {
      throw new OneKeyLocalError(
        'clearGlobalStatus is only available when devSettings is enabled',
      );
    }

    try {
      let clearedKeysCount = 0;

      if (platformEnv.isWeb || platformEnv.isDesktop) {
        // Web/Desktop: Clear the dedicated GlobalStates IndexedDB database
        const globalStatesStorage = storageHub.$webStorageGlobalStates;
        if (globalStatesStorage) {
          const allKeys = await globalStatesStorage.getAllKeys();
          clearedKeysCount = allKeys.length;
          await globalStatesStorage.clear();
        }
      } else {
        const { clearNativeJotaiStorageForReset } =
          await import('../states/jotai/jotaiStorage');
        clearedKeysCount = await clearNativeJotaiStorageForReset();
      }

      defaultLogger.setting.page.clearDataStep('globalStatus-clear');
      return {
        success: true,
        clearedKeysCount,
      };
    } catch (error) {
      console.error('clearGlobalStatus error', error);
      throw error;
    }
  }

  @backgroundMethod()
  async getAppStorageFirstItem() {
    const devSettings = await devSettingsPersistAtom.get();
    if (!devSettings.enabled) {
      throw new OneKeyLocalError(
        'getAppStorageFirstItem is only available when devSettings is enabled',
      );
    }

    try {
      const allKeys = await appStorage.getAllKeys();
      if (allKeys.length === 0) {
        return {
          isEmpty: true,
          key: null,
          value: null,
          totalKeys: 0,
        };
      }

      const firstKey = allKeys[0];
      const firstValue = await appStorage.getItem(firstKey);

      return {
        isEmpty: false,
        key: firstKey,
        value: firstValue,
        totalKeys: allKeys.length,
      };
    } catch (error) {
      console.error('getAppStorageFirstItem error', error);
      throw error;
    }
  }

  @backgroundMethod()
  async getSimpleDBFirstItem() {
    const devSettings = await devSettingsPersistAtom.get();
    if (!devSettings.enabled) {
      throw new OneKeyLocalError(
        'getSimpleDBFirstItem is only available when devSettings is enabled',
      );
    }

    try {
      let allKeys: readonly string[] = [];
      let storage: typeof appStorage | null = null;

      if (platformEnv.isWeb || platformEnv.isDesktop) {
        // Web/Desktop: Query from dedicated SimpleDB IndexedDB database
        const simpleDbStorage = storageHub.$webStorageSimpleDB;
        if (simpleDbStorage) {
          storage = simpleDbStorage;
          allKeys = await simpleDbStorage.getAllKeys();
        }
      } else {
        // Native: Filter keys with simple_db_v5 prefix from appStorage
        const SIMPLE_DB_KEY_PREFIX = 'simple_db_v5';
        const allAppStorageKeys = await appStorage.getAllKeys();
        allKeys = allAppStorageKeys.filter((key) =>
          key.startsWith(SIMPLE_DB_KEY_PREFIX),
        );
        storage = appStorage;
      }

      if (allKeys.length === 0 || !storage) {
        return {
          isEmpty: true,
          key: null,
          value: null,
          totalKeys: 0,
        };
      }

      const firstKey = allKeys[0];
      const firstValue = await storage.getItem(firstKey);

      return {
        isEmpty: false,
        key: firstKey,
        value: firstValue,
        totalKeys: allKeys.length,
      };
    } catch (error) {
      console.error('getSimpleDBFirstItem error', error);
      throw error;
    }
  }

  @backgroundMethod()
  async getGlobalStatusFirstItem() {
    const devSettings = await devSettingsPersistAtom.get();
    if (!devSettings.enabled) {
      throw new OneKeyLocalError(
        'getGlobalStatusFirstItem is only available when devSettings is enabled',
      );
    }

    try {
      let allKeys: readonly string[] = [];
      let storage: typeof appStorage | null = null;

      if (platformEnv.isWeb || platformEnv.isDesktop) {
        // Web/Desktop: Query from dedicated GlobalStates IndexedDB database
        const globalStatesStorage = storageHub.$webStorageGlobalStates;
        if (globalStatesStorage) {
          storage = globalStatesStorage;
          allKeys = await globalStatesStorage.getAllKeys();
        }
      } else {
        const { getNativeJotaiStorageEntries } =
          await import('../states/jotai/jotaiStorage');
        const entries = await getNativeJotaiStorageEntries();
        if (!entries || entries.size === 0) {
          return {
            isEmpty: true,
            key: null,
            value: null,
            totalKeys: 0,
          };
        }
        const firstEntry = entries.entries().next();
        if (firstEntry.done) {
          return {
            isEmpty: true,
            key: null,
            value: null,
            totalKeys: 0,
          };
        }
        return {
          isEmpty: false,
          key: firstEntry.value[0],
          value: firstEntry.value[1],
          totalKeys: entries.size,
        };
      }

      if (allKeys.length === 0 || !storage) {
        return {
          isEmpty: true,
          key: null,
          value: null,
          totalKeys: 0,
        };
      }

      const firstKey = allKeys[0];
      const firstValue = await storage.getItem(firstKey);

      return {
        isEmpty: false,
        key: firstKey,
        value: firstValue,
        totalKeys: allKeys.length,
      };
    } catch (error) {
      console.error('getGlobalStatusFirstItem error', error);
      throw error;
    }
  }
}

export default ServiceApp;
