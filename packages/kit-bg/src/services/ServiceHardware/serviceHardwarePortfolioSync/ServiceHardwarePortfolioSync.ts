import { EDeviceType } from '@onekeyfe/hd-shared';
import { debounce, uniq } from 'lodash';

import {
  backgroundClass,
  backgroundMethod,
  backgroundMethodForDev,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { PORTFOLIO_ARCHIVE_MAX_BYTES } from '@onekeyhq/shared/src/utils/portfolioArchive';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import localDb from '../../../dbs/local/localDb';
import {
  currencyPersistAtom,
  settingsPersistAtom,
} from '../../../states/jotai/atoms';
import { devSettingsPersistAtom } from '../../../states/jotai/atoms/devSettings';
import ServiceBase from '../../ServiceBase';

import {
  buildPortfolioSyncArtifacts,
  getPortfolioDisplayTimestamp,
  getPortfolioSyncCooldownRemainingMs,
  isPortfolioSyncDevEnabled,
} from './serviceHardwarePortfolioSyncUtils';

import type {
  IPortfolioSyncArtifacts,
  IPortfolioSyncSettledPayload,
} from './serviceHardwarePortfolioSyncUtils';

export type IPortfolioSyncStatus =
  | 'cooldown'
  | 'disabled'
  | 'duplicate'
  | 'empty'
  | 'error'
  | 'hardware-busy'
  | 'uploaded';

export type IPortfolioSyncLastResult = {
  contentHash?: string;
  cooldownRemainingMs?: number;
  deviceConnectId?: string;
  errorMessage?: string;
  mockArchiveBytesLength?: number;
  upload?: { portfolioUpdated: boolean };
  portfolioJsonBytesLength?: number;
  serverSubmit?: {
    bytesLength: number;
    contentHash: string;
    serverPackageBase64Length: number;
    serverPackageBytesLength: number;
  };
  status: IPortfolioSyncStatus;
  tokenCount?: number;
  totalTokenCount?: number;
  updatedAt: number;
  walletId?: string;
};

type IPortfolioServerSubmitResult = NonNullable<
  IPortfolioSyncLastResult['serverSubmit']
>;

const LOG_PREFIX = '[PRO2-PORTFOLIO-SYNC]';
const PORTFOLIO_SYNC_HARDWARE_BUSY_RETRY_MS = 1000;
const PORTFOLIO_PACKAGE_MAX_BYTES = PORTFOLIO_ARCHIVE_MAX_BYTES * 2;
const PORTFOLIO_PACKAGE_MAX_BASE64_LENGTH =
  Math.ceil(PORTFOLIO_PACKAGE_MAX_BYTES / 3) * 4;

export function decodePortfolioPackageBase64(packageBase64: string) {
  if (packageBase64.length > PORTFOLIO_PACKAGE_MAX_BASE64_LENGTH) {
    throw new OneKeyLocalError('Portfolio pack response is too large');
  }
  if (
    packageBase64.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(packageBase64)
  ) {
    throw new OneKeyLocalError('Portfolio pack response is invalid');
  }

  const packageBuffer = bufferUtils.toBuffer(packageBase64, 'base64');
  if (packageBuffer.byteLength > PORTFOLIO_PACKAGE_MAX_BYTES) {
    throw new OneKeyLocalError('Portfolio pack response is too large');
  }

  const packageBytes = new ArrayBuffer(packageBuffer.byteLength);
  new Uint8Array(packageBytes).set(packageBuffer);
  return packageBytes;
}

function stringifyLogValue(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return JSON.stringify({
      stringifyError: error instanceof Error ? error.message : String(error),
    });
  }
}

function debugPortfolioSyncLog(label: string, value?: unknown) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const valueText = value === undefined ? '' : ` ${stringifyLogValue(value)}`;
  defaultLogger.hardware.sdkLog.log(`${LOG_PREFIX} ${label}`, valueText.trim());
}

@backgroundClass()
class ServiceHardwarePortfolioSync extends ServiceBase {
  private initialized = false;

  // Per-target dedup hash for a snapshot whose async submit/upload is still in
  // flight. Runtime-only: a stuck reservation must not survive a restart. The
  // durable last-synced hash + cooldown timestamp live in simpleDb
  // (hardwarePortfolioSync), keyed per device so multiple simultaneously
  // connected devices keep independent dedup/cooldown state.
  private inFlightReservationByTargetKey = new Map<
    string,
    { contentHash: string; generation: number }
  >();

  private syncGenerationByTargetKey = new Map<string, number>();

  private notificationSequence = 0;

  private latestNotificationSequenceByWalletId = new Map<string, number>();

  private lastArtifacts: IPortfolioSyncArtifacts | undefined;

  private lastResult: IPortfolioSyncLastResult | undefined;

  private pendingCooldownPayloadByConnectId = new Map<
    string,
    IPortfolioSyncSettledPayload
  >();

  private pendingCooldownTimerByConnectId = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  private pendingHardwareRetryTimerByConnectId = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  private activeUploadByConnectId = new Map<
    string,
    Promise<{ portfolioUpdated: boolean }>
  >();

  private syncDebouncedByTargetKey = new Map<
    string,
    ReturnType<typeof debounce>
  >();

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  init() {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    debugPortfolioSyncLog('service-init');
  }

  private async resolveAuthorizedPortfolioPayload(
    eventPayload: IPortfolioSyncSettledPayload,
  ): Promise<IPortfolioSyncSettledPayload | undefined> {
    const walletId = eventPayload.walletId;
    if (!walletId) {
      return undefined;
    }
    const wallet = await localDb.getWalletSafe({ walletId });
    if (
      !wallet ||
      wallet.id !== walletId ||
      !accountUtils.isHwWallet({ walletId: wallet.id }) ||
      accountUtils.isHwHiddenWallet({ wallet })
    ) {
      return undefined;
    }

    const device = await localDb.getWalletDeviceSafe({
      dbWallet: wallet,
      walletId: wallet.id,
    });
    const vendor = device?.vendor ?? device?.settings?.vendor;
    const isProtocolV2 =
      device?.connectProtocol === 'V2' ||
      device?.deviceStateInfo?.protocol === 'V2';
    if (
      !device ||
      device.deviceType !== EDeviceType.Pro2 ||
      !isProtocolV2 ||
      vendor !== EHardwareVendor.onekey
    ) {
      return undefined;
    }

    const authorizedConnectIds = uniq(
      [device.connectId, device.usbConnectId, device.bleConnectId].filter(
        Boolean,
      ),
    ) as string[];
    if (
      !device.connectId ||
      (eventPayload.deviceDbId && eventPayload.deviceDbId !== device.id) ||
      (eventPayload.deviceConnectId &&
        !authorizedConnectIds.includes(eventPayload.deviceConnectId))
    ) {
      return undefined;
    }

    const accountId = eventPayload.accountId;
    if (!accountId) {
      return undefined;
    }
    const primaryAccount = await localDb.getAccountSafe({ accountId });
    const indexedAccountId = primaryAccount?.indexedAccountId;
    if (
      !primaryAccount ||
      !indexedAccountId ||
      (eventPayload.indexedAccountId &&
        eventPayload.indexedAccountId !== indexedAccountId)
    ) {
      return undefined;
    }
    const indexedAccount = await localDb.getIndexedAccountSafe({
      id: indexedAccountId,
    });
    if (!indexedAccount || indexedAccount.walletId !== wallet.id) {
      return undefined;
    }

    const ownerAccount = eventPayload.ownerAccountId
      ? await localDb.getAccountSafe({
          accountId: eventPayload.ownerAccountId,
        })
      : undefined;
    if (
      eventPayload.ownerAccountId &&
      (!ownerAccount || ownerAccount.indexedAccountId !== indexedAccount.id)
    ) {
      return undefined;
    }

    return {
      ...eventPayload,
      accountAddress: primaryAccount.address,
      accountName: primaryAccount.name,
      deviceConnectId: device.connectId,
      deviceDbId: device.id,
      indexedAccountId: indexedAccount.id,
      indexedAccountIndex: indexedAccount.index,
      indexedAccountName: indexedAccount.name,
      walletId: wallet.id,
      walletType: wallet.type,
    };
  }

  private setRejectedPayloadResult(eventPayload: IPortfolioSyncSettledPayload) {
    this.setLastResult({
      status: 'disabled',
      updatedAt: Date.now(),
      walletId: eventPayload.walletId,
    });
  }

  @backgroundMethod()
  async notifyAllNetworksTokenListSettled(
    eventPayload: IPortfolioSyncSettledPayload,
  ) {
    const walletId = eventPayload.walletId ?? '';
    this.notificationSequence += 1;
    const sequence = this.notificationSequence;
    this.latestNotificationSequenceByWalletId.set(walletId, sequence);
    const authorizedPayload =
      await this.resolveAuthorizedPortfolioPayload(eventPayload);
    if (this.latestNotificationSequenceByWalletId.get(walletId) !== sequence) {
      return;
    }
    this.latestNotificationSequenceByWalletId.delete(walletId);
    if (!authorizedPayload) {
      this.setRejectedPayloadResult(eventPayload);
      return;
    }
    this.handleAllNetworksTokenListSettled(authorizedPayload);
  }

  private handleAllNetworksTokenListSettled = (
    eventPayload: IPortfolioSyncSettledPayload,
  ) => {
    if (eventPayload.deviceConnectId) {
      this.cancelHardwareBusyRetry(eventPayload.deviceConnectId);
    }
    debugPortfolioSyncLog('settled-event', {
      hasDeviceConnectId: Boolean(eventPayload.deviceConnectId),
      isHardwareWallet: accountUtils.isHwWallet({
        walletId: eventPayload.walletId,
      }),
      totalTokenCount: eventPayload.tokens.length,
    });
    const targetKey = this.getSyncTargetKey(eventPayload);
    this.advanceSyncGeneration(targetKey);
    let syncDebounced = this.syncDebouncedByTargetKey.get(targetKey);
    if (!syncDebounced) {
      syncDebounced = debounce((payload: IPortfolioSyncSettledPayload) => {
        this.syncDebouncedByTargetKey.delete(targetKey);
        const generation = this.syncGenerationByTargetKey.get(targetKey);
        if (generation !== undefined) {
          void this.syncSettledPortfolio(payload, generation);
        }
      }, 1000);
      this.syncDebouncedByTargetKey.set(targetKey, syncDebounced);
    }
    syncDebounced(eventPayload);
  };

  private setLastResult(result: IPortfolioSyncLastResult) {
    this.lastResult = result;
  }

  private get portfolioSyncDb() {
    return this.backgroundApi.simpleDb.hardwarePortfolioSync;
  }

  // Prefer the persisted device record so USB/BLE transports and hidden-wallet
  // views of the same physical device share one ordering domain.
  private getSyncTargetKey(eventPayload: IPortfolioSyncSettledPayload): string {
    return (
      eventPayload.deviceDbId ||
      eventPayload.deviceConnectId ||
      eventPayload.walletId ||
      ''
    );
  }

  private advanceSyncGeneration(targetKey: string) {
    const generation = (this.syncGenerationByTargetKey.get(targetKey) ?? 0) + 1;
    this.syncGenerationByTargetKey.set(targetKey, generation);
    this.inFlightReservationByTargetKey.delete(targetKey);
    return generation;
  }

  private isCurrentSyncGeneration(targetKey: string, generation: number) {
    return this.syncGenerationByTargetKey.get(targetKey) === generation;
  }

  private releaseInFlightReservation({
    contentHash,
    generation,
    targetKey,
  }: {
    contentHash: string;
    generation: number;
    targetKey: string;
  }) {
    const reservation = this.inFlightReservationByTargetKey.get(targetKey);
    if (
      reservation?.contentHash === contentHash &&
      reservation.generation === generation
    ) {
      this.inFlightReservationByTargetKey.delete(targetKey);
    }
  }

  private handleSyncError({
    contentHash,
    error,
    generation,
    targetKey,
  }: {
    contentHash?: string;
    error: unknown;
    generation: number;
    targetKey: string;
  }) {
    if (contentHash) {
      this.releaseInFlightReservation({ contentHash, generation, targetKey });
    }
    if (!this.isCurrentSyncGeneration(targetKey, generation)) {
      return;
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    debugPortfolioSyncLog('error', { message: errorMessage });
    this.setLastResult({
      errorMessage,
      status: 'error',
      updatedAt: Date.now(),
    });
  }

  private async commitProcessedArtifacts({
    artifacts,
    generation,
    targetKey,
    transferAt,
    walletId,
  }: {
    artifacts: IPortfolioSyncArtifacts;
    generation: number;
    targetKey: string;
    transferAt?: number;
    walletId: string;
  }) {
    // Persist only the latest generation after a successful device upload.
    // Compare-and-delete keeps stale cleanup from clearing a newer reservation.
    if (!this.isCurrentSyncGeneration(targetKey, generation)) {
      this.releaseInFlightReservation({
        contentHash: artifacts.contentHash,
        generation,
        targetKey,
      });
      return;
    }
    await this.portfolioSyncDb.updateTargetState(targetKey, {
      lastContentHash: artifacts.contentHash,
      ...(transferAt !== undefined ? { lastTransferAt: transferAt } : {}),
      lastWalletId: walletId,
    });
    if (this.isCurrentSyncGeneration(targetKey, generation)) {
      this.lastArtifacts = artifacts;
    }
    this.releaseInFlightReservation({
      contentHash: artifacts.contentHash,
      generation,
      targetKey,
    });
  }

  private scheduleSyncAfterCooldown({
    deviceConnectId,
    eventPayload,
    generation,
    remainingMs,
    targetKey,
  }: {
    deviceConnectId: string;
    eventPayload: IPortfolioSyncSettledPayload;
    generation: number;
    remainingMs: number;
    targetKey: string;
  }) {
    this.pendingCooldownPayloadByConnectId.set(deviceConnectId, eventPayload);

    const existingTimer =
      this.pendingCooldownTimerByConnectId.get(deviceConnectId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.pendingCooldownTimerByConnectId.delete(deviceConnectId);
      const pendingPayload =
        this.pendingCooldownPayloadByConnectId.get(deviceConnectId);
      this.pendingCooldownPayloadByConnectId.delete(deviceConnectId);
      if (
        pendingPayload &&
        this.isCurrentSyncGeneration(targetKey, generation)
      ) {
        void this.syncSettledPortfolio(pendingPayload, generation);
      }
    }, remainingMs);

    this.pendingCooldownTimerByConnectId.set(deviceConnectId, timer);
  }

  private cancelHardwareBusyRetry(deviceConnectId: string) {
    const timer =
      this.pendingHardwareRetryTimerByConnectId.get(deviceConnectId);
    if (timer) {
      clearTimeout(timer);
      this.pendingHardwareRetryTimerByConnectId.delete(deviceConnectId);
    }
  }

  private scheduleHardwareBusyRetry({
    contentHash,
    deviceConnectId,
    generation,
    retry,
    targetKey,
  }: {
    contentHash: string;
    deviceConnectId: string;
    generation: number;
    retry: () => Promise<void>;
    targetKey: string;
  }) {
    this.cancelHardwareBusyRetry(deviceConnectId);
    const timer = setTimeout(() => {
      this.pendingHardwareRetryTimerByConnectId.delete(deviceConnectId);
      if (!this.isCurrentSyncGeneration(targetKey, generation)) {
        this.releaseInFlightReservation({
          contentHash,
          generation,
          targetKey,
        });
        return;
      }
      void retry().catch((error) => {
        this.handleSyncError({
          contentHash,
          error,
          generation,
          targetKey,
        });
      });
    }, PORTFOLIO_SYNC_HARDWARE_BUSY_RETRY_MS);
    this.pendingHardwareRetryTimerByConnectId.set(deviceConnectId, timer);
  }

  private async getHardwareCooldownRemainingMs({
    targetKey,
    now,
  }: {
    targetKey: string;
    now: number;
  }) {
    const state = await this.portfolioSyncDb.getTargetState(targetKey);
    return getPortfolioSyncCooldownRemainingMs({
      lastTransferAt: state?.lastTransferAt,
      now,
    });
  }

  private async shouldRunDevFlow(): Promise<boolean> {
    const devSettings = await devSettingsPersistAtom.get();
    return isPortfolioSyncDevEnabled({
      devSettings,
    });
  }

  private async getCurrencyMapForBuild() {
    let { currencyMap } = await currencyPersistAtom.get();
    const settings = await settingsPersistAtom.get();
    if (!currencyMap[settings.currencyInfo.id]) {
      try {
        await this.backgroundApi.serviceSetting.fetchCurrencyList();
        currencyMap = (await currencyPersistAtom.get()).currencyMap;
      } catch {
        // Strict conversion will emit null values if the rate is still absent.
      }
    }
    return {
      currencyMap,
      displayCurrency: settings.currencyInfo,
    };
  }

  private buildResultBase({
    artifacts,
    eventPayload,
    serverSubmit,
    status,
    updatedAt,
  }: {
    artifacts: IPortfolioSyncArtifacts;
    eventPayload: IPortfolioSyncSettledPayload;
    serverSubmit?: IPortfolioServerSubmitResult;
    status: IPortfolioSyncStatus;
    updatedAt: number;
  }): IPortfolioSyncLastResult {
    return {
      contentHash: artifacts.contentHash,
      deviceConnectId: eventPayload.deviceConnectId,
      mockArchiveBytesLength: artifacts.mockArchiveBytes.byteLength,
      portfolioJsonBytesLength: artifacts.portfolioJsonBytes.byteLength,
      serverSubmit,
      status,
      tokenCount: artifacts.portfolio.tokens.length,
      totalTokenCount: eventPayload.tokens.length,
      updatedAt,
      walletId: eventPayload.walletId,
    };
  }

  private async submitPortfolioJsonToServer({
    artifacts,
  }: {
    artifacts: IPortfolioSyncArtifacts;
  }): Promise<{
    serverPackageBytes: ArrayBuffer;
    serverSubmit: IPortfolioServerSubmitResult;
  }> {
    const { contentHash, portfolio, portfolioJsonBytes } = artifacts;

    debugPortfolioSyncLog('server-submit-ready', {
      bytesLength: portfolioJsonBytes.byteLength,
      contentHash,
      tokenCount: artifacts.portfolio.tokens.length,
      totalTokenCount:
        artifacts.portfolio.tokenCount + artifacts.portfolio.otherTokens.count,
    });

    // The App only submits portfolio.json. The server validates, normalizes,
    // resolves trusted token metadata such as iconName and color, packs and
    // signs the production portfolio package, and returns it as base64.
    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    const resp = await client.post<{
      data: { packageBase64: string };
    }>('/wallet/v1/hardware/portfolio/pack', portfolio);

    const packageBase64 = resp.data?.data?.packageBase64;
    if (!packageBase64) {
      throw new OneKeyLocalError(
        'Portfolio pack response missing packageBase64',
      );
    }
    const serverPackageBytes = decodePortfolioPackageBase64(packageBase64);

    debugPortfolioSyncLog('server-submit-packed', {
      bytesLength: portfolioJsonBytes.byteLength,
      contentHash,
      serverPackageBase64Length: packageBase64.length,
      serverPackageBytesLength: serverPackageBytes.byteLength,
    });

    return {
      serverPackageBytes,
      serverSubmit: {
        bytesLength: portfolioJsonBytes.byteLength,
        contentHash,
        serverPackageBase64Length: packageBase64.length,
        serverPackageBytesLength: serverPackageBytes.byteLength,
      },
    };
  }

  private async uploadPreparedHardwarePortfolio({
    artifacts,
    deviceConnectId,
    eventPayload,
    generation,
    serverPackageBytes,
    serverSubmit,
    targetKey,
    updatedAt,
  }: {
    artifacts: IPortfolioSyncArtifacts;
    deviceConnectId: string;
    eventPayload: IPortfolioSyncSettledPayload;
    generation: number;
    serverPackageBytes: ArrayBuffer;
    serverSubmit: IPortfolioServerSubmitResult;
    targetKey: string;
    updatedAt: number;
  }) {
    if (!this.isCurrentSyncGeneration(targetKey, generation)) {
      this.releaseInFlightReservation({
        contentHash: artifacts.contentHash,
        generation,
        targetKey,
      });
      return;
    }
    this.inFlightReservationByTargetKey.set(targetKey, {
      contentHash: artifacts.contentHash,
      generation,
    });
    const activeUpload = this.activeUploadByConnectId.get(deviceConnectId);
    if (activeUpload) {
      await activeUpload.catch(() => undefined);
      if (!this.isCurrentSyncGeneration(targetKey, generation)) {
        this.releaseInFlightReservation({
          contentHash: artifacts.contentHash,
          generation,
          targetKey,
        });
        return;
      }
    }
    const hardwareBusy =
      await this.backgroundApi.serviceHardwareUI.isHardwareChannelBusy({
        connectId: deviceConnectId,
      });
    if (!this.isCurrentSyncGeneration(targetKey, generation)) {
      this.releaseInFlightReservation({
        contentHash: artifacts.contentHash,
        generation,
        targetKey,
      });
      return;
    }
    if (hardwareBusy) {
      this.releaseInFlightReservation({
        contentHash: artifacts.contentHash,
        generation,
        targetKey,
      });
      this.setLastResult(
        this.buildResultBase({
          artifacts,
          eventPayload,
          serverSubmit,
          status: 'hardware-busy',
          updatedAt,
        }),
      );
      debugPortfolioSyncLog('skip-hardware-busy', {
        contentHash: artifacts.contentHash,
      });
      this.scheduleHardwareBusyRetry({
        contentHash: artifacts.contentHash,
        deviceConnectId,
        generation,
        retry: () =>
          this.uploadPreparedHardwarePortfolio({
            artifacts,
            deviceConnectId,
            eventPayload,
            generation,
            serverPackageBytes,
            serverSubmit,
            targetKey,
            updatedAt: Date.now(),
          }),
        targetKey,
      });
      return;
    }

    const uploadPromise = (async () => {
      const upload: { portfolioUpdated: boolean } =
        await this.backgroundApi.serviceHardware.uploadPortfolioPackage({
          connectId: deviceConnectId,
          packageBytes: serverPackageBytes,
        });
      if (!this.isCurrentSyncGeneration(targetKey, generation)) {
        this.releaseInFlightReservation({
          contentHash: artifacts.contentHash,
          generation,
          targetKey,
        });
        return upload;
      }
      this.setLastResult({
        ...this.buildResultBase({
          artifacts,
          eventPayload,
          serverSubmit,
          status: 'uploaded',
          updatedAt,
        }),
        upload,
      });
      debugPortfolioSyncLog('uploaded', {
        bytesLength: serverPackageBytes.byteLength,
        contentHash: artifacts.contentHash,
      });
      if (!eventPayload.walletId) {
        throw new OneKeyLocalError(
          'Authorized portfolio payload is missing walletId',
        );
      }
      await this.commitProcessedArtifacts({
        artifacts,
        generation,
        targetKey,
        transferAt: Date.now(),
        walletId: eventPayload.walletId,
      });
      return upload;
    })();
    this.activeUploadByConnectId.set(deviceConnectId, uploadPromise);
    try {
      await uploadPromise;
    } finally {
      if (this.activeUploadByConnectId.get(deviceConnectId) === uploadPromise) {
        this.activeUploadByConnectId.delete(deviceConnectId);
      }
    }
  }

  private async syncSettledPortfolio(
    incomingPayload: IPortfolioSyncSettledPayload,
    requestedGeneration?: number,
  ) {
    const updatedAt = Date.now();
    const eventPayload =
      await this.resolveAuthorizedPortfolioPayload(incomingPayload);
    if (!eventPayload) {
      this.setRejectedPayloadResult(incomingPayload);
      return;
    }
    const targetKey = this.getSyncTargetKey(eventPayload);
    const generation =
      requestedGeneration ?? this.advanceSyncGeneration(targetKey);
    if (!this.isCurrentSyncGeneration(targetKey, generation)) {
      return;
    }
    const pendingDeviceConnectId = eventPayload.deviceConnectId;
    let reservedContentHash: string | undefined;
    if (pendingDeviceConnectId) {
      this.cancelHardwareBusyRetry(pendingDeviceConnectId);
    }
    try {
      if (!(await this.shouldRunDevFlow())) {
        if (!this.isCurrentSyncGeneration(targetKey, generation)) {
          return;
        }
        debugPortfolioSyncLog('skip-disabled');
        this.setLastResult({ status: 'disabled', updatedAt });
        return;
      }

      const isHardwareWallet = accountUtils.isHwWallet({
        walletId: eventPayload.walletId,
      });
      const deviceConnectId = eventPayload.deviceConnectId;

      if (!isHardwareWallet || !deviceConnectId) {
        debugPortfolioSyncLog('skip-non-hardware');
        this.setLastResult({
          status: 'disabled',
          updatedAt,
          walletId: eventPayload.walletId,
        });
        return;
      }

      // Empty standard-wallet snapshots intentionally continue through the
      // signed package flow so the device atomically overwrites stale data.
      const cooldownRemainingMs = await this.getHardwareCooldownRemainingMs({
        targetKey,
        now: updatedAt,
      });
      if (!this.isCurrentSyncGeneration(targetKey, generation)) {
        return;
      }
      if (cooldownRemainingMs > 0) {
        this.scheduleSyncAfterCooldown({
          deviceConnectId,
          eventPayload,
          generation,
          remainingMs: cooldownRemainingMs,
          targetKey,
        });
        debugPortfolioSyncLog('skip-cooldown', {
          cooldownRemainingMs,
          deviceConnectId,
          totalTokenCount: eventPayload.tokens.length,
        });
        this.setLastResult({
          cooldownRemainingMs,
          deviceConnectId,
          status: 'cooldown',
          totalTokenCount: eventPayload.tokens.length,
          updatedAt,
          walletId: eventPayload.walletId,
        });
        return;
      }

      const { currencyMap, displayCurrency } =
        await this.getCurrencyMapForBuild();
      if (!this.isCurrentSyncGeneration(targetKey, generation)) {
        return;
      }
      const artifacts = buildPortfolioSyncArtifacts({
        currencyMap,
        displayCurrency,
        eventPayload,
        timestamp: getPortfolioDisplayTimestamp({ timestamp: updatedAt }),
      });
      debugPortfolioSyncLog('portfolio-built', {
        contentHash: artifacts.contentHash,
        portfolioJsonBytesLength: artifacts.portfolioJsonBytes.byteLength,
        tokenCount: artifacts.portfolio.tokens.length,
      });

      // Read the persisted last-synced hash for this target (await) BEFORE the
      // synchronous check-and-reserve below. The in-flight read + duplicate
      // check + reserve run with NO await between them, so two concurrent
      // invocations for the same target either see it already reserved (and are
      // deduped) or one reserves first — never both upload the same snapshot.
      // The hardware path further down awaits isHardwareChannelBusy, which is
      // exactly why the reservation must be taken here, not after that await.
      const persistedTargetState =
        await this.portfolioSyncDb.getTargetState(targetKey);
      if (!this.isCurrentSyncGeneration(targetKey, generation)) {
        return;
      }
      const isDuplicate =
        (eventPayload.walletId === persistedTargetState?.lastWalletId &&
          artifacts.contentHash === persistedTargetState?.lastContentHash) ||
        artifacts.contentHash ===
          this.inFlightReservationByTargetKey.get(targetKey)?.contentHash;
      if (isDuplicate) {
        debugPortfolioSyncLog('skip-duplicate', {
          contentHash: artifacts.contentHash,
          tokenCount: artifacts.portfolio.tokens.length,
          totalTokenCount: eventPayload.tokens.length,
        });
        this.setLastResult(
          this.buildResultBase({
            artifacts,
            eventPayload,
            status: 'duplicate',
            updatedAt,
          }),
        );
        return;
      }

      this.inFlightReservationByTargetKey.set(targetKey, {
        contentHash: artifacts.contentHash,
        generation,
      });
      reservedContentHash = artifacts.contentHash;

      const hardwareBusy =
        await this.backgroundApi.serviceHardwareUI.isHardwareChannelBusy({
          connectId: deviceConnectId,
        });
      if (!this.isCurrentSyncGeneration(targetKey, generation)) {
        this.releaseInFlightReservation({
          contentHash: artifacts.contentHash,
          generation,
          targetKey,
        });
        return;
      }
      if (hardwareBusy) {
        // Release the reservation and do not persist dedup state: this
        // snapshot was never uploaded, so an identical settled event must be
        // allowed to retry once the hardware channel frees up.
        this.releaseInFlightReservation({
          contentHash: artifacts.contentHash,
          generation,
          targetKey,
        });
        debugPortfolioSyncLog('skip-hardware-busy', {
          contentHash: artifacts.contentHash,
        });
        this.setLastResult(
          this.buildResultBase({
            artifacts,
            eventPayload,
            status: 'hardware-busy',
            updatedAt,
          }),
        );
        this.scheduleHardwareBusyRetry({
          contentHash: artifacts.contentHash,
          deviceConnectId,
          generation,
          retry: () => this.syncSettledPortfolio(eventPayload, generation),
          targetKey,
        });
        return;
      }

      const { serverPackageBytes, serverSubmit } =
        await this.submitPortfolioJsonToServer({
          artifacts,
        });
      if (!this.isCurrentSyncGeneration(targetKey, generation)) {
        this.releaseInFlightReservation({
          contentHash: artifacts.contentHash,
          generation,
          targetKey,
        });
        return;
      }

      await this.uploadPreparedHardwarePortfolio({
        artifacts,
        deviceConnectId,
        eventPayload,
        generation,
        serverPackageBytes,
        serverSubmit,
        targetKey,
        updatedAt,
      });
    } catch (error) {
      this.handleSyncError({
        contentHash: reservedContentHash,
        error,
        generation,
        targetKey,
      });
    }
  }

  @backgroundMethod()
  async waitForActivePortfolioSync({ connectId }: { connectId: string }) {
    const activeUpload = this.activeUploadByConnectId.get(connectId);
    if (!activeUpload) {
      return false;
    }
    await activeUpload.catch(() => undefined);
    return true;
  }

  @backgroundMethodForDev()
  async getLastPortfolioSyncResultForDev() {
    return this.lastResult;
  }

  @backgroundMethodForDev()
  async getLastPortfolioSyncArtifactSummaryForDev() {
    if (!this.lastArtifacts) {
      return undefined;
    }
    return {
      contentHash: this.lastArtifacts.contentHash,
      mockArchiveBytesLength: this.lastArtifacts.mockArchiveBytes.byteLength,
      portfolioJsonBytesLength:
        this.lastArtifacts.portfolioJsonBytes.byteLength,
    };
  }
}

export default ServiceHardwarePortfolioSync;
