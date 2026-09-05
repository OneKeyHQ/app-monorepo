import { EDeviceType, HardwareErrorCode } from '@onekeyfe/hd-shared';
import { DeviceSessionPinType } from '@onekeyfe/hd-transport';
import { debounce, uniq } from 'lodash';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  BluetoothUnavailableWhileUsbConnectedError,
  DeviceNotSame,
  OneKeyLocalError,
  UserCancelFromOutside,
} from '@onekeyhq/shared/src/errors';
import { isHardwareErrorByCode } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { isProtocolV2ProductType } from '@onekeyhq/shared/src/utils/hardwareDeviceTypes';
import { PORTFOLIO_ARCHIVE_MAX_BYTES } from '@onekeyhq/shared/src/utils/portfolioArchive';
import {
  EAccountSelectorSceneName,
  EHardwareTransportType,
} from '@onekeyhq/shared/types';
import {
  EHardwareCallContext,
  EHardwareVendor,
  EOneKeyDeviceMode,
} from '@onekeyhq/shared/types/device';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import localDb from '../../../dbs/local/localDb';
import {
  currencyPersistAtom,
  settingsPersistAtom,
} from '../../../states/jotai/atoms';
import ServiceBase from '../../ServiceBase';

import {
  buildPortfolioSyncArtifacts,
  getPortfolioDisplayTimestamp,
  getPortfolioSyncCooldownRemainingMs,
} from './serviceHardwarePortfolioSyncUtils';

import type {
  IPortfolioSyncArtifacts,
  IPortfolioSyncSettledPayload,
} from './serviceHardwarePortfolioSyncUtils';
import type { IOneKeyHardwareOperationLease } from '../../ServiceHardwareUI/HardwareProcessingManager';

export type IPortfolioSyncStatus =
  | 'cooldown'
  | 'disabled'
  | 'duplicate'
  | 'empty'
  | 'error'
  | 'hardware-busy'
  | 'identity-unavailable'
  | 'identity-mismatch'
  | 'inactive'
  | 'disconnected'
  | 'desktop-suspended'
  | 'ble-suspended'
  | 'device-locked'
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

export type IPortfolioSyncMode = 'interactive' | 'silent';

type IPortfolioSyncExecutionOptions = {
  desktopBleExecution?: IDesktopBleSyncExecution;
  oneKeyOperationLease?: IOneKeyHardwareOperationLease;
  syncStartedAt?: number;
  syncMode?: IPortfolioSyncMode;
  telemetry?: IPortfolioSyncTelemetry;
};

type IPortfolioSyncFailureStage = 'unlock' | 'prepare' | 'pack' | 'device-sync';

type IPortfolioSyncTelemetry = {
  syncId?: string;
  cancelled?: boolean;
  failureStage?: IPortfolioSyncFailureStage;
  queueDurationMs?: number;
  unlockDurationMs?: number;
  hardwareDurationMs?: number;
  packDurationMs?: number;
  packageBytes?: number;
  portfolioJsonBytes?: number;
  resultReported?: boolean;
  syncMode: IPortfolioSyncMode;
  syncStartedAt: number;
  tokenCount?: number;
  totalTokenCount?: number;
  transportType?: EHardwareTransportType;
};

type IDesktopBleIdleLease = {
  bleConnectId: string;
  expiresAt: number;
  generation: number;
  lastInteractionAt: number;
};

type IDesktopBleSyncExecution = Pick<
  IDesktopBleIdleLease,
  'bleConnectId' | 'generation'
>;

const LOG_PREFIX = '[PRO2-PORTFOLIO-SYNC]';
const PORTFOLIO_SYNC_HARDWARE_BUSY_RETRY_MS = 1000;
const PORTFOLIO_SYNC_RESUME_AFTER_INTERACTION_MS = 5000;
const DESKTOP_BLE_IDLE_DELAY_MS = 30_000;
const DESKTOP_BLE_REUSE_WINDOW_MS = 150_000;
const DESKTOP_BLE_TRANSFER_COOLDOWN_MS = 5 * 60_000;
const PORTFOLIO_PACKAGE_MAX_BYTES = PORTFOLIO_ARCHIVE_MAX_BYTES * 2;
const PORTFOLIO_PACKAGE_MAX_BASE64_LENGTH =
  Math.ceil(PORTFOLIO_PACKAGE_MAX_BYTES / 3) * 4;

export function validatePortfolioPackageBase64(packageBase64: string) {
  if (packageBase64.length > PORTFOLIO_PACKAGE_MAX_BASE64_LENGTH) {
    throw new OneKeyLocalError('Portfolio pack response is too large');
  }
  if (
    packageBase64.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(packageBase64)
  ) {
    throw new OneKeyLocalError('Portfolio pack response is invalid');
  }

  let paddingLength = 0;
  if (packageBase64.endsWith('==')) {
    paddingLength = 2;
  } else if (packageBase64.endsWith('=')) {
    paddingLength = 1;
  }
  const packageBytesLength = (packageBase64.length / 4) * 3 - paddingLength;
  if (packageBytesLength > PORTFOLIO_PACKAGE_MAX_BYTES) {
    throw new OneKeyLocalError('Portfolio pack response is too large');
  }
  return { packageBase64, packageBytesLength };
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

const DEVICE_LOCKED_MESSAGE = /device(?: is)? locked/i;
const DEVICE_RESETTING_MESSAGE = /device is resetting/i;

function collectErrorText(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return typeof error === 'string' ? error : '';
  }
  const record = error as {
    message?: unknown;
    payload?: { message?: unknown; firmwareMessage?: unknown };
  };
  return [
    record.message,
    record.payload?.message,
    record.payload?.firmwareMessage,
  ]
    .filter((value): value is string => typeof value === 'string')
    .join('\n');
}

function getPortfolioSyncErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }
  const record = error as {
    code?: unknown;
    errorCode?: unknown;
    payload?: { code?: unknown; errorCode?: unknown };
  };
  const code =
    record.code ??
    record.errorCode ??
    record.payload?.code ??
    record.payload?.errorCode;
  return typeof code === 'string' || typeof code === 'number'
    ? String(code)
    : undefined;
}

function isSilentUploadBlockedByDevice(error: unknown): boolean {
  if (
    isHardwareErrorByCode({
      error: error as never,
      code: HardwareErrorCode.DeviceLocked,
    })
  ) {
    return true;
  }
  const text = collectErrorText(error);
  return (
    DEVICE_LOCKED_MESSAGE.test(text) || DEVICE_RESETTING_MESSAGE.test(text)
  );
}

function isDeviceStateLocked(state: {
  status?: { unlocked?: boolean | null };
}): boolean {
  return state.status?.unlocked !== true;
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

  private syncSequence = 0;

  private logSyncLifecycle(
    phase: string,
    telemetry: IPortfolioSyncTelemetry,
    details: Record<string, string | number | boolean | null | undefined> = {},
  ) {
    defaultLogger.hardware.sdkLog.log(
      `${LOG_PREFIX} ${phase}`,
      JSON.stringify({
        syncId: telemetry.syncId,
        syncMode: telemetry.syncMode,
        transportType: telemetry.transportType,
        elapsedMs: Math.max(Date.now() - telemetry.syncStartedAt, 0),
        queueDurationMs: telemetry.queueDurationMs,
        unlockDurationMs: telemetry.unlockDurationMs,
        packDurationMs: telemetry.packDurationMs,
        hardwareDurationMs: telemetry.hardwareDurationMs,
        packageBytes: telemetry.packageBytes,
        tokenCount: telemetry.tokenCount,
        totalTokenCount: telemetry.totalTokenCount,
        cancelled: telemetry.cancelled,
        ...details,
      }),
    );
  }

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

  private pendingDisconnectedPayloadByTargetKey = new Map<
    string,
    IPortfolioSyncSettledPayload
  >();

  private pendingLockedPayloadByTargetKey = new Map<
    string,
    IPortfolioSyncSettledPayload
  >();

  // Only cache identities for transports with reliable connection-session
  // events. WebUSB always performs a live identity check before each upload.
  private verifiedDeviceIdByTargetKey = new Map<string, string>();

  private mismatchedDeviceIdByTargetKey = new Map<string, string>();

  private mobileBleSilentSyncDisabledTargetKeys = new Set<string>();

  private pendingMobileBlePayloadByTargetKey = new Map<
    string,
    IPortfolioSyncSettledPayload
  >();

  private pendingMobileBleResumeTimerByTargetKey = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  private mobileBleResumeInProgressTargetKeys = new Set<string>();

  private pendingDesktopBlePayloadByTargetKey = new Map<
    string,
    IPortfolioSyncSettledPayload
  >();

  private desktopBleIdleLeaseByTargetKey = new Map<
    string,
    IDesktopBleIdleLease
  >();

  private desktopBleIdleTimerByTargetKey = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  private desktopBleLeaseGenerationByTargetKey = new Map<string, number>();

  private desktopBleHardwareAttemptGenerationByTargetKey = new Map<
    string,
    number
  >();

  private desktopInteractiveGenerationByTargetKey = new Map<string, number>();

  private activeUploadByTargetKey = new Map<string, Promise<unknown>>();

  private targetKeyByConnectId = new Map<string, string>();

  private syncDebouncedByTargetKey = new Map<
    string,
    ReturnType<typeof debounce>
  >();

  private interactiveSyncGenerationByTargetKey = new Map<string, number>();

  private pendingInteractivePayloadByTargetKey = new Map<
    string,
    IPortfolioSyncSettledPayload
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
      accountUtils.isWalletDeprecatedOrMocked(wallet) ||
      !accountUtils.isHwWallet({ walletId: wallet.id }) ||
      accountUtils.isQrWallet({ walletId: wallet.id })
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
      !isProtocolV2ProductType(device.deviceType) ||
      !isProtocolV2 ||
      vendor !== EHardwareVendor.onekey
    ) {
      return undefined;
    }

    const authorizedConnectIds = uniq(
      [
        device.connectId,
        device.usbConnectId,
        device.bleConnectId,
        device.deviceId,
        device.uuid,
      ].filter(Boolean),
    );
    if (
      !device.connectId ||
      (eventPayload.deviceDbId && eventPayload.deviceDbId !== device.id) ||
      (eventPayload.deviceConnectId &&
        !authorizedConnectIds.includes(eventPayload.deviceConnectId))
    ) {
      return undefined;
    }

    for (const authorizedConnectId of authorizedConnectIds) {
      this.targetKeyByConnectId.set(authorizedConnectId, device.id);
    }

    // All Networks account IDs are runtime-only aggregate accounts. Validate
    // ownership with the stable indexed account and rebuild display fields.
    const indexedAccountId = eventPayload.indexedAccountId;
    if (!indexedAccountId) {
      return undefined;
    }
    const indexedAccount = await localDb.getIndexedAccountSafe({
      id: indexedAccountId,
    });
    if (!indexedAccount || indexedAccount.walletId !== wallet.id) {
      return undefined;
    }

    return {
      ...eventPayload,
      accountAddress: undefined,
      accountName: indexedAccount.name,
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
    return this.setLastResult({
      status: 'disabled',
      updatedAt: Date.now(),
      walletId: eventPayload.walletId,
    });
  }

  private setMobileBleSuspendedResult(
    eventPayload: IPortfolioSyncSettledPayload,
  ) {
    return this.setLastResult({
      deviceConnectId: eventPayload.deviceConnectId,
      status: 'ble-suspended',
      totalTokenCount: eventPayload.tokens.length,
      updatedAt: Date.now(),
      walletId: eventPayload.walletId,
    });
  }

  private setDesktopSuspendedResult(
    eventPayload: IPortfolioSyncSettledPayload,
  ) {
    return this.setLastResult({
      deviceConnectId: eventPayload.deviceConnectId,
      status: 'desktop-suspended',
      totalTokenCount: eventPayload.tokens.length,
      updatedAt: Date.now(),
      walletId: eventPayload.walletId,
    });
  }

  private rememberPendingDesktopBlePayload({
    eventPayload,
    targetKey,
  }: {
    eventPayload: IPortfolioSyncSettledPayload;
    targetKey: string;
  }) {
    this.pendingDesktopBlePayloadByTargetKey.set(targetKey, eventPayload);
  }

  private scheduleDesktopBleBusyRetry({
    eventPayload,
    targetKey,
  }: {
    eventPayload: IPortfolioSyncSettledPayload;
    targetKey: string;
  }) {
    this.rememberPendingDesktopBlePayload({ eventPayload, targetKey });
    this.scheduleDesktopBleIdleSync({
      minimumDelayMs: PORTFOLIO_SYNC_HARDWARE_BUSY_RETRY_MS,
      targetKey,
    });
  }

  private cancelDesktopBleIdleTimer(targetKey: string) {
    const timer = this.desktopBleIdleTimerByTargetKey.get(targetKey);
    if (timer) {
      clearTimeout(timer);
      this.desktopBleIdleTimerByTargetKey.delete(targetKey);
    }
  }

  private getActiveDesktopBleIdleLease({
    generation,
    targetKey,
  }: {
    generation?: number;
    targetKey: string;
  }) {
    const lease = this.desktopBleIdleLeaseByTargetKey.get(targetKey);
    if (
      !lease ||
      (generation !== undefined && lease.generation !== generation) ||
      lease.expiresAt <= Date.now()
    ) {
      if (lease?.expiresAt && lease.expiresAt <= Date.now()) {
        this.desktopBleIdleLeaseByTargetKey.delete(targetKey);
        this.cancelDesktopBleIdleTimer(targetKey);
      }
      return undefined;
    }
    return lease;
  }

  private invalidateDesktopBleIdleLease({
    generation,
    reason,
    targetKey,
  }: {
    generation?: number;
    reason: string;
    targetKey: string;
  }) {
    const lease = this.desktopBleIdleLeaseByTargetKey.get(targetKey);
    if (generation !== undefined && lease?.generation !== generation) {
      return;
    }
    this.desktopBleIdleLeaseByTargetKey.delete(targetKey);
    this.cancelDesktopBleIdleTimer(targetKey);
    debugPortfolioSyncLog('desktop-ble-idle-lease-invalidated', {
      reason,
      targetKey,
    });
  }

  private isDesktopBleSyncExecutionCurrent({
    execution,
    targetKey,
  }: {
    execution: IDesktopBleSyncExecution | undefined;
    targetKey: string;
  }) {
    if (!execution) {
      return false;
    }
    const lease = this.getActiveDesktopBleIdleLease({
      generation: execution.generation,
      targetKey,
    });
    return Boolean(lease && lease.bleConnectId === execution.bleConnectId);
  }

  private scheduleDesktopBleIdleSync({
    minimumDelayMs = 0,
    targetKey,
  }: {
    minimumDelayMs?: number;
    targetKey: string;
  }) {
    this.cancelDesktopBleIdleTimer(targetKey);
    const lease = this.getActiveDesktopBleIdleLease({ targetKey });
    if (!lease || !this.pendingDesktopBlePayloadByTargetKey.has(targetKey)) {
      return;
    }
    const now = Date.now();
    const idleRemainingMs = Math.max(
      lease.lastInteractionAt + DESKTOP_BLE_IDLE_DELAY_MS - now,
      0,
    );
    const delayMs = Math.max(idleRemainingMs, minimumDelayMs);
    if (now + delayMs >= lease.expiresAt) {
      this.invalidateDesktopBleIdleLease({
        generation: lease.generation,
        reason: 'reuse-window-expired-before-next-attempt',
        targetKey,
      });
      return;
    }

    const timer = setTimeout(() => {
      if (this.desktopBleIdleTimerByTargetKey.get(targetKey) === timer) {
        this.desktopBleIdleTimerByTargetKey.delete(targetKey);
      }
      void this.tryRunDesktopBleIdleSync({
        generation: lease.generation,
        targetKey,
      }).catch((error) => {
        debugPortfolioSyncLog('desktop-ble-idle-attempt-error', {
          message: error instanceof Error ? error.message : String(error),
          targetKey,
        });
      });
    }, delayMs);
    this.desktopBleIdleTimerByTargetKey.set(targetKey, timer);
  }

  private async tryRunDesktopBleIdleSync({
    generation,
    targetKey,
  }: {
    generation: number;
    targetKey: string;
  }) {
    const lease = this.getActiveDesktopBleIdleLease({
      generation,
      targetKey,
    });
    const eventPayload =
      this.pendingDesktopBlePayloadByTargetKey.get(targetKey);
    if (!lease || !eventPayload) {
      return;
    }

    const transportType =
      await this.backgroundApi.serviceHardware.getCurrentTransportType();
    if (transportType !== EHardwareTransportType.DesktopWebBle) {
      this.invalidateDesktopBleIdleLease({
        generation,
        reason: 'transport-changed',
        targetKey,
      });
      return;
    }

    const cooldownRemainingMs = await this.getHardwareCooldownRemainingMs({
      cooldownMs: DESKTOP_BLE_TRANSFER_COOLDOWN_MS,
      now: Date.now(),
      targetKey,
    });
    if (cooldownRemainingMs > 0) {
      this.setLastResult({
        cooldownRemainingMs,
        deviceConnectId: lease.bleConnectId,
        status: 'cooldown',
        totalTokenCount: eventPayload.tokens.length,
        updatedAt: Date.now(),
        walletId: eventPayload.walletId,
      });
      this.scheduleDesktopBleIdleSync({
        minimumDelayMs: cooldownRemainingMs,
        targetKey,
      });
      return;
    }

    const syncGeneration = this.syncGenerationByTargetKey.get(targetKey);
    if (syncGeneration === undefined) {
      this.invalidateDesktopBleIdleLease({
        generation,
        reason: 'missing-sync-generation',
        targetKey,
      });
      return;
    }

    try {
      await this.syncSettledPortfolio(eventPayload, syncGeneration, {
        desktopBleExecution: {
          bleConnectId: lease.bleConnectId,
          generation: lease.generation,
        },
      });
    } finally {
      if (
        this.desktopBleHardwareAttemptGenerationByTargetKey.get(targetKey) ===
        generation
      ) {
        this.desktopBleHardwareAttemptGenerationByTargetKey.delete(targetKey);
        this.invalidateDesktopBleIdleLease({
          generation,
          reason: 'hardware-attempt-finished',
          targetKey,
        });
      }
    }
  }

  private rememberPendingMobileBlePayload({
    eventPayload,
    targetKey,
  }: {
    eventPayload: IPortfolioSyncSettledPayload;
    targetKey: string;
  }) {
    this.pendingMobileBlePayloadByTargetKey.set(targetKey, eventPayload);
  }

  private async suspendMobileBleSilentSync({
    eventPayload,
    targetKey,
  }: {
    eventPayload: IPortfolioSyncSettledPayload;
    targetKey: string;
  }) {
    if (!platformEnv.isNative) {
      return;
    }
    this.mobileBleSilentSyncDisabledTargetKeys.add(targetKey);
    this.rememberPendingMobileBlePayload({ eventPayload, targetKey });
    const resumeTimer =
      this.pendingMobileBleResumeTimerByTargetKey.get(targetKey);
    if (resumeTimer) {
      clearTimeout(resumeTimer);
      this.pendingMobileBleResumeTimerByTargetKey.delete(targetKey);
    }
    await this.portfolioSyncDb.updateTargetState(targetKey, {
      bleSilentSyncDisabled: true,
      bleSilentSyncDisabledAt: Date.now(),
      bleSilentSyncDisabledReason: 'link-disabled',
    });
    debugPortfolioSyncLog('suspend-mobile-ble-link-disabled', { targetKey });
    this.setMobileBleSuspendedResult(eventPayload);
  }

  @backgroundMethod()
  async notifyInteractiveHardwareOperationStarted({
    connectId,
    deviceDbId,
  }: {
    connectId?: string;
    deviceDbId?: string;
  }) {
    if (!platformEnv.isDesktop) {
      return undefined;
    }
    const targetKey =
      deviceDbId ||
      (connectId ? this.targetKeyByConnectId.get(connectId) : undefined);
    if (!targetKey) {
      return undefined;
    }
    const interactionGeneration =
      (this.desktopInteractiveGenerationByTargetKey.get(targetKey) ?? 0) + 1;
    this.desktopInteractiveGenerationByTargetKey.set(
      targetKey,
      interactionGeneration,
    );
    this.invalidateDesktopBleIdleLease({
      reason: 'interactive-operation-started',
      targetKey,
    });
    return interactionGeneration;
  }

  @backgroundMethod()
  async notifyInteractiveHardwareOperationSucceeded({
    connectId,
    deviceDbId,
    interactionGeneration,
    transportType,
  }: {
    connectId?: string;
    deviceDbId?: string;
    interactionGeneration?: number;
    transportType?: EHardwareTransportType;
  }) {
    const targetKey =
      deviceDbId ||
      (connectId ? this.targetKeyByConnectId.get(connectId) : undefined);
    if (!targetKey) {
      return false;
    }
    if (platformEnv.isDesktop) {
      if (
        interactionGeneration === undefined ||
        this.desktopInteractiveGenerationByTargetKey.get(targetKey) !==
          interactionGeneration
      ) {
        return false;
      }
      if (transportType !== EHardwareTransportType.DesktopWebBle) {
        this.invalidateDesktopBleIdleLease({
          reason: 'interactive-operation-used-non-ble-transport',
          targetKey,
        });
        return false;
      }
      const device = await localDb.getDeviceSafe(targetKey);
      if (
        this.desktopInteractiveGenerationByTargetKey.get(targetKey) !==
        interactionGeneration
      ) {
        return false;
      }
      const bleConnectId = device?.bleConnectId;
      if (!bleConnectId) {
        return false;
      }
      this.targetKeyByConnectId.set(bleConnectId, targetKey);
      const generation =
        (this.desktopBleLeaseGenerationByTargetKey.get(targetKey) ?? 0) + 1;
      this.desktopBleLeaseGenerationByTargetKey.set(targetKey, generation);
      const now = Date.now();
      this.desktopBleIdleLeaseByTargetKey.set(targetKey, {
        bleConnectId,
        expiresAt: now + DESKTOP_BLE_REUSE_WINDOW_MS,
        generation,
        lastInteractionAt: now,
      });
      debugPortfolioSyncLog('desktop-ble-idle-lease-created', {
        generation,
        targetKey,
      });
      this.scheduleDesktopBleIdleSync({ targetKey });
      this.replayLockedPortfolioSnapshot(targetKey);
      return true;
    }
    if (!platformEnv.isNative) {
      return false;
    }
    const state = await this.portfolioSyncDb.getTargetState(targetKey);
    if (
      !state?.bleSilentSyncDisabled &&
      !this.mobileBleSilentSyncDisabledTargetKeys.has(targetKey)
    ) {
      return false;
    }

    this.mobileBleResumeInProgressTargetKeys.add(targetKey);
    try {
      await this.portfolioSyncDb.updateTargetState(targetKey, {
        bleSilentSyncDisabled: false,
        bleSilentSyncDisabledAt: undefined,
        bleSilentSyncDisabledReason: undefined,
      });
      this.mobileBleSilentSyncDisabledTargetKeys.delete(targetKey);
      debugPortfolioSyncLog('resume-mobile-ble-after-interaction', {
        targetKey,
      });

      this.replayLockedPortfolioSnapshot(targetKey);
      const pendingPayload =
        this.pendingMobileBlePayloadByTargetKey.get(targetKey);
      if (!pendingPayload) {
        return true;
      }
      const existingTimer =
        this.pendingMobileBleResumeTimerByTargetKey.get(targetKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      const timer = setTimeout(() => {
        this.pendingMobileBleResumeTimerByTargetKey.delete(targetKey);
        const latestPendingPayload =
          this.pendingMobileBlePayloadByTargetKey.get(targetKey);
        this.pendingMobileBlePayloadByTargetKey.delete(targetKey);
        if (latestPendingPayload) {
          this.handleAllNetworksTokenListSettled(latestPendingPayload);
        }
      }, PORTFOLIO_SYNC_RESUME_AFTER_INTERACTION_MS);
      this.pendingMobileBleResumeTimerByTargetKey.set(targetKey, timer);
      return true;
    } finally {
      this.mobileBleResumeInProgressTargetKeys.delete(targetKey);
    }
  }

  private async isPreparedUploadStillAuthorized({
    deviceConnectId,
    eventPayload,
    targetKey,
  }: {
    deviceConnectId: string;
    eventPayload: IPortfolioSyncSettledPayload;
    targetKey: string;
  }) {
    const authorizedPayload =
      await this.resolveAuthorizedPortfolioPayload(eventPayload);
    return Boolean(
      authorizedPayload &&
      this.getSyncTargetKey(authorizedPayload) === targetKey &&
      authorizedPayload.deviceConnectId === deviceConnectId,
    );
  }

  private async getPreparedUploadDeviceIdentityStatus({
    desktopBleExecution,
    deviceConnectId,
    eventPayload,
    hardwareTransportType,
    syncMode,
    targetKey,
  }: {
    desktopBleExecution?: IDesktopBleSyncExecution;
    deviceConnectId: string;
    eventPayload: IPortfolioSyncSettledPayload;
    hardwareTransportType?: EHardwareTransportType;
    syncMode: IPortfolioSyncMode;
    targetKey: string;
  }): Promise<'verified' | 'unavailable' | 'mismatch' | 'locked'> {
    const deviceDbId = eventPayload.deviceDbId;
    if (!deviceDbId) {
      return 'mismatch';
    }
    const device = await localDb.getDeviceSafe(deviceDbId);
    const expectedDeviceId =
      device?.deviceStateInfo?.identity.deviceId || device?.deviceId;
    if (!expectedDeviceId) {
      this.mismatchedDeviceIdByTargetKey.set(targetKey, '');
      return 'mismatch';
    }
    const mismatchedDeviceId =
      this.mismatchedDeviceIdByTargetKey.get(targetKey);
    if (mismatchedDeviceId === expectedDeviceId && syncMode === 'silent') {
      return 'mismatch';
    }
    if (mismatchedDeviceId !== undefined) {
      this.mismatchedDeviceIdByTargetKey.delete(targetKey);
    }
    const currentTransportType =
      hardwareTransportType ??
      (desktopBleExecution
        ? EHardwareTransportType.DesktopWebBle
        : await this.backgroundApi.serviceHardware.getCurrentTransportType());
    const canCacheVerifiedDeviceId =
      currentTransportType !== EHardwareTransportType.WEBUSB;
    if (!canCacheVerifiedDeviceId) {
      this.verifiedDeviceIdByTargetKey.delete(targetKey);
    } else if (
      this.verifiedDeviceIdByTargetKey.get(targetKey) === expectedDeviceId
    ) {
      return this.getSilentUploadLockStatus({
        desktopBleExecution,
        deviceConnectId,
        hardwareTransportType,
        syncMode,
      });
    }

    let state;
    try {
      state = await this.backgroundApi.serviceHardware.getDeviceState({
        connectId: deviceConnectId,
        hardwareCallContext:
          syncMode === 'interactive'
            ? EHardwareCallContext.USER_INTERACTION
            : EHardwareCallContext.BACKGROUND_NON_INTERACTIVE,
        ...(desktopBleExecution
          ? {
              desktopBleReuseConnectedOnly: true,
            }
          : {}),
        ...(hardwareTransportType ? { hardwareTransportType } : {}),
        ...(syncMode === 'silent' ? { persistTransportType: false } : {}),
        params: { scope: 'firmware' },
        silentMode: syncMode === 'silent',
      });
    } catch (error) {
      if (syncMode === 'silent' && isSilentUploadBlockedByDevice(error)) {
        return 'locked';
      }
      throw error;
    }
    const liveDeviceId = state.identity?.deviceId;
    const isPro2LoaderIdentityUnavailable =
      device?.deviceType === EDeviceType.Pro2 &&
      !liveDeviceId &&
      (state.status?.mode === EOneKeyDeviceMode.bootloader ||
        state.status?.mode === EOneKeyDeviceMode.romloader);
    if (isPro2LoaderIdentityUnavailable) {
      // Pro2 bootloader mode does not expose DeviceStatus.device_id. An empty
      // value means the identity is unavailable in this mode and must not
      // override or invalidate the persisted identity confirmed in firmware.
      this.verifiedDeviceIdByTargetKey.delete(targetKey);
      this.mismatchedDeviceIdByTargetKey.delete(targetKey);
      return 'unavailable';
    }
    if (!liveDeviceId || liveDeviceId !== expectedDeviceId) {
      this.verifiedDeviceIdByTargetKey.delete(targetKey);
      this.mismatchedDeviceIdByTargetKey.set(targetKey, expectedDeviceId);
      return 'mismatch';
    }
    this.mismatchedDeviceIdByTargetKey.delete(targetKey);
    if (canCacheVerifiedDeviceId) {
      this.verifiedDeviceIdByTargetKey.set(targetKey, expectedDeviceId);
    }
    return syncMode === 'silent' && isDeviceStateLocked(state)
      ? 'locked'
      : 'verified';
  }

  private async getSilentUploadLockStatus({
    desktopBleExecution,
    deviceConnectId,
    hardwareTransportType,
    syncMode,
  }: {
    desktopBleExecution?: IDesktopBleSyncExecution;
    deviceConnectId: string;
    hardwareTransportType?: EHardwareTransportType;
    syncMode: IPortfolioSyncMode;
  }): Promise<'verified' | 'locked'> {
    try {
      const state = await this.backgroundApi.serviceHardware.getDeviceState({
        connectId: deviceConnectId,
        hardwareCallContext:
          syncMode === 'interactive'
            ? EHardwareCallContext.USER_INTERACTION
            : EHardwareCallContext.BACKGROUND_NON_INTERACTIVE,
        ...(desktopBleExecution
          ? {
              desktopBleReuseConnectedOnly: true,
            }
          : {}),
        ...(hardwareTransportType ? { hardwareTransportType } : {}),
        ...(syncMode === 'silent' ? { persistTransportType: false } : {}),
        params: { scope: 'runtime' },
        silentMode: syncMode === 'silent',
      });
      return syncMode === 'silent' && isDeviceStateLocked(state)
        ? 'locked'
        : 'verified';
    } catch (error) {
      if (syncMode === 'silent' && isSilentUploadBlockedByDevice(error)) {
        return 'locked';
      }
      throw error;
    }
  }

  private handleDeviceLockedSkip({
    eventPayload,
    targetKey,
  }: {
    eventPayload: IPortfolioSyncSettledPayload;
    targetKey: string;
  }) {
    if (eventPayload.deviceConnectId) {
      this.cancelHardwareBusyRetry(eventPayload.deviceConnectId);
    }
    this.pendingLockedPayloadByTargetKey.set(targetKey, eventPayload);
    debugPortfolioSyncLog('skip-device-locked', {
      deviceConnectId: eventPayload.deviceConnectId,
      targetKey,
      walletId: eventPayload.walletId,
    });
    return this.setLastResult({
      deviceConnectId: eventPayload.deviceConnectId,
      status: 'device-locked',
      totalTokenCount: eventPayload.tokens.length,
      updatedAt: Date.now(),
      walletId: eventPayload.walletId,
    });
  }

  private replayLockedPortfolioSnapshot(targetKey: string) {
    const pendingPayload = this.pendingLockedPayloadByTargetKey.get(targetKey);
    if (!pendingPayload) {
      return;
    }
    this.pendingLockedPayloadByTargetKey.delete(targetKey);
    this.handleAllNetworksTokenListSettled(pendingPayload);
  }

  private async isDeviceIdentityMismatchPending({
    eventPayload,
    targetKey,
  }: {
    eventPayload: IPortfolioSyncSettledPayload;
    targetKey: string;
  }) {
    const mismatchedDeviceId =
      this.mismatchedDeviceIdByTargetKey.get(targetKey);
    if (mismatchedDeviceId === undefined) {
      return false;
    }
    const device = eventPayload.deviceDbId
      ? await localDb.getDeviceSafe(eventPayload.deviceDbId)
      : undefined;
    const expectedDeviceId =
      device?.deviceStateInfo?.identity.deviceId || device?.deviceId || '';
    if (expectedDeviceId !== mismatchedDeviceId) {
      this.mismatchedDeviceIdByTargetKey.delete(targetKey);
      return false;
    }
    return true;
  }

  private async getPortfolioSyncEligibility(
    eventPayload: IPortfolioSyncSettledPayload,
    { requireConnected = true }: { requireConnected?: boolean } = {},
  ): Promise<'eligible' | 'inactive' | 'disconnected'> {
    const selectedAccount =
      await this.backgroundApi.simpleDb.accountSelector.getSelectedAccount({
        sceneName: EAccountSelectorSceneName.home,
        num: 0,
      });
    if (
      !eventPayload.walletId ||
      selectedAccount?.walletId !== eventPayload.walletId ||
      selectedAccount.indexedAccountId !== eventPayload.indexedAccountId
    ) {
      return 'inactive';
    }

    if (!requireConnected) {
      return 'eligible';
    }

    const isConnected =
      await this.backgroundApi.serviceHardware.isHardwareDeviceConnected({
        connectId: eventPayload.deviceConnectId,
        deviceDbId: eventPayload.deviceDbId,
      });
    return isConnected ? 'eligible' : 'disconnected';
  }

  private async isTargetWebUsbConnected(
    eventPayload: IPortfolioSyncSettledPayload,
  ) {
    if (!platformEnv.isSupportWebUSB) {
      return false;
    }
    try {
      const device = eventPayload.deviceDbId
        ? await localDb.getDeviceSafe(eventPayload.deviceDbId)
        : undefined;
      const targetIdentityKeys = new Set(
        uniq(
          [
            eventPayload.deviceConnectId,
            device?.connectId,
            device?.usbConnectId,
            device?.deviceId,
            device?.uuid,
          ].filter((value): value is string => Boolean(value)),
        ),
      );
      const usb = globalThis?.navigator?.usb;
      if (!targetIdentityKeys.size || typeof usb?.getDevices !== 'function') {
        return false;
      }
      const devices = await usb.getDevices();
      return devices.some(
        (usbDevice) =>
          typeof usbDevice.serialNumber === 'string' &&
          targetIdentityKeys.has(usbDevice.serialNumber),
      );
    } catch {
      return false;
    }
  }

  private handleIneligibleSync({
    eligibility,
    eventPayload,
    targetKey,
  }: {
    eligibility: 'inactive' | 'disconnected';
    eventPayload: IPortfolioSyncSettledPayload;
    targetKey: string;
  }) {
    if (eligibility === 'disconnected') {
      this.pendingDisconnectedPayloadByTargetKey.set(targetKey, eventPayload);
    } else {
      this.pendingDisconnectedPayloadByTargetKey.delete(targetKey);
    }
    if (eventPayload.deviceConnectId) {
      this.cancelHardwareBusyRetry(eventPayload.deviceConnectId);
    }
    debugPortfolioSyncLog(`skip-${eligibility}`, {
      deviceConnectId: eventPayload.deviceConnectId,
      targetKey,
      walletId: eventPayload.walletId,
    });
    return this.setLastResult({
      deviceConnectId: eventPayload.deviceConnectId,
      status: eligibility,
      totalTokenCount: eventPayload.tokens.length,
      updatedAt: Date.now(),
      walletId: eventPayload.walletId,
    });
  }

  private handleDeviceIdentityMismatch({
    eventPayload,
    targetKey,
  }: {
    eventPayload: IPortfolioSyncSettledPayload;
    targetKey: string;
  }) {
    this.verifiedDeviceIdByTargetKey.delete(targetKey);
    this.pendingDisconnectedPayloadByTargetKey.set(targetKey, eventPayload);
    if (eventPayload.deviceConnectId) {
      this.cancelHardwareBusyRetry(eventPayload.deviceConnectId);
    }
    debugPortfolioSyncLog('skip-identity-mismatch', {
      deviceConnectId: eventPayload.deviceConnectId,
      targetKey,
      walletId: eventPayload.walletId,
    });
    return this.setLastResult({
      deviceConnectId: eventPayload.deviceConnectId,
      status: 'identity-mismatch',
      totalTokenCount: eventPayload.tokens.length,
      updatedAt: Date.now(),
      walletId: eventPayload.walletId,
    });
  }

  private handleDeviceIdentityUnavailable({
    eventPayload,
    targetKey,
  }: {
    eventPayload: IPortfolioSyncSettledPayload;
    targetKey: string;
  }) {
    this.verifiedDeviceIdByTargetKey.delete(targetKey);
    this.mismatchedDeviceIdByTargetKey.delete(targetKey);
    // Keep the latest snapshot until the device exits bootloader mode and
    // reconnects with its full identity available.
    this.pendingDisconnectedPayloadByTargetKey.set(targetKey, eventPayload);
    if (eventPayload.deviceConnectId) {
      this.cancelHardwareBusyRetry(eventPayload.deviceConnectId);
    }
    debugPortfolioSyncLog('skip-identity-unavailable', {
      deviceConnectId: eventPayload.deviceConnectId,
      targetKey,
      walletId: eventPayload.walletId,
    });
    return this.setLastResult({
      deviceConnectId: eventPayload.deviceConnectId,
      status: 'identity-unavailable',
      totalTokenCount: eventPayload.tokens.length,
      updatedAt: Date.now(),
      walletId: eventPayload.walletId,
    });
  }

  @backgroundMethod()
  async notifyHardwareDeviceConnected({
    identityKeys,
  }: {
    identityKeys: string[];
  }) {
    const targetKeys = uniq(
      identityKeys
        .map((identityKey) => this.targetKeyByConnectId.get(identityKey))
        .filter((targetKey): targetKey is string => Boolean(targetKey)),
    );
    for (const targetKey of targetKeys) {
      this.verifiedDeviceIdByTargetKey.delete(targetKey);
      this.mismatchedDeviceIdByTargetKey.delete(targetKey);
      if (!this.interactiveSyncGenerationByTargetKey.has(targetKey)) {
        const pendingPayload =
          this.pendingDisconnectedPayloadByTargetKey.get(targetKey);
        if (pendingPayload) {
          this.pendingDisconnectedPayloadByTargetKey.delete(targetKey);
          this.handleAllNetworksTokenListSettled(pendingPayload);
        }
        const pendingBlePayload = pendingPayload
          ? undefined
          : (this.pendingDesktopBlePayloadByTargetKey.get(targetKey) ??
            this.pendingMobileBlePayloadByTargetKey.get(targetKey));
        this.pendingDesktopBlePayloadByTargetKey.delete(targetKey);
        this.pendingMobileBlePayloadByTargetKey.delete(targetKey);
        if (pendingBlePayload) {
          this.handleAllNetworksTokenListSettled(pendingBlePayload);
        }
        this.replayLockedPortfolioSnapshot(targetKey);
      }
    }
  }

  @backgroundMethod()
  async notifyHardwareDeviceDisconnected({
    identityKeys,
  }: {
    identityKeys: string[];
  }) {
    const targetKeys = uniq(
      identityKeys
        .map((identityKey) => this.targetKeyByConnectId.get(identityKey))
        .filter((targetKey): targetKey is string => Boolean(targetKey)),
    );
    for (const targetKey of targetKeys) {
      this.verifiedDeviceIdByTargetKey.delete(targetKey);
      this.invalidateDesktopBleIdleLease({
        reason: 'hardware-disconnected',
        targetKey,
      });
    }
  }

  @backgroundMethod()
  async notifyHardwareDeviceIdentityMismatch({
    deviceDbId,
    expectedDeviceId,
  }: {
    deviceDbId: string;
    expectedDeviceId: string;
  }) {
    this.verifiedDeviceIdByTargetKey.delete(deviceDbId);
    this.mismatchedDeviceIdByTargetKey.set(deviceDbId, expectedDeviceId);
    this.advanceSyncGeneration(deviceDbId);
    debugPortfolioSyncLog('device-identity-mismatch', { deviceDbId });
    this.setLastResult({
      status: 'identity-mismatch',
      updatedAt: Date.now(),
    });
  }

  @backgroundMethod()
  async notifyAllNetworksTokenListSettled(
    eventPayload: IPortfolioSyncSettledPayload,
  ) {
    return this.syncPortfolio({ eventPayload, syncMode: 'silent' });
  }

  @backgroundMethod()
  async syncPortfolio({
    eventPayload,
    syncMode,
  }: {
    eventPayload: IPortfolioSyncSettledPayload;
    syncMode: IPortfolioSyncMode;
  }): Promise<boolean | undefined> {
    if (syncMode === 'interactive') {
      const syncStartedAt = Date.now();
      this.syncSequence += 1;
      const telemetry: IPortfolioSyncTelemetry = {
        syncId: `${syncStartedAt}-${this.syncSequence}`,
        syncMode,
        syncStartedAt,
        totalTokenCount: eventPayload.tokens.length,
      };
      const authorizedPayload =
        await this.resolveAuthorizedPortfolioPayload(eventPayload);
      const device = authorizedPayload?.deviceDbId
        ? await localDb.getDeviceSafe(authorizedPayload.deviceDbId)
        : undefined;
      if (!authorizedPayload || !device) {
        return this.resolveInteractivePortfolioSyncResult(
          this.setRejectedPayloadResult(eventPayload),
        );
      }
      const targetKey = this.getSyncTargetKey(authorizedPayload);
      const eligibility = await this.getPortfolioSyncEligibility(
        authorizedPayload,
        { requireConnected: false },
      );
      if (eligibility !== 'eligible') {
        const result = this.handleIneligibleSync({
          eligibility,
          eventPayload: authorizedPayload,
          targetKey,
        });
        await this.reportPortfolioSyncResult({
          errorCode: `PORTFOLIO_SYNC_${eligibility
            .toUpperCase()
            .replace(/-/g, '_')}`,
          eventPayload: authorizedPayload,
          failureStage: 'prepare',
          status: 'failed',
          telemetry,
        });
        return this.resolveInteractivePortfolioSyncResult(result);
      }
      telemetry.transportType = await this.backgroundApi.serviceHardware
        .getCurrentTransportType()
        .catch(() => undefined);
      if (this.interactiveSyncGenerationByTargetKey.has(targetKey)) {
        this.logSyncLifecycle('duplicate-interactive', telemetry, {
          deviceType: device.deviceType,
        });
        return false;
      }
      const pendingDebouncedSync = this.syncDebouncedByTargetKey.get(targetKey);
      pendingDebouncedSync?.cancel();
      this.syncDebouncedByTargetKey.delete(targetKey);
      const generation = this.advanceSyncGeneration(targetKey);
      this.interactiveSyncGenerationByTargetKey.set(targetKey, generation);
      const onUserClose = () => {
        if (telemetry.cancelled) {
          return;
        }
        telemetry.cancelled = true;
        this.advanceSyncGeneration(targetKey);
        this.logSyncLifecycle('cancel-requested', telemetry, {
          deviceType: device.deviceType,
          reason: 'user-close',
        });
      };
      appEventBus.on(
        EAppEventBusNames.CloseHardwareUiStateDialogManually,
        onUserClose,
      );
      this.logSyncLifecycle('queued', telemetry, {
        deviceType: device.deviceType,
        protocol: device.deviceStateInfo?.protocol ?? device.connectProtocol,
        firmwareVersion: device.deviceStateInfo?.versions?.firmware,
        bleVersion: device.deviceStateInfo?.versions?.ble,
        connectIdSuffix: device.connectId?.slice(-8),
      });
      try {
        return await this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
          async (oneKeyOperationLease?: IOneKeyHardwareOperationLease) => {
            if (telemetry.cancelled) {
              throw new UserCancelFromOutside();
            }
            telemetry.queueDurationMs = Date.now() - syncStartedAt;
            const unlockStartedAt = Date.now();
            this.logSyncLifecycle('unlock-started', telemetry);
            try {
              await this.backgroundApi.serviceHardware.getDeviceStateWithUnlock(
                {
                  connectId: device.connectId,
                  oneKeyOperationLease,
                  params: { scope: 'runtime' },
                  pinType: DeviceSessionPinType.Any,
                },
              );
            } finally {
              telemetry.unlockDurationMs = Date.now() - unlockStartedAt;
            }
            if (telemetry.cancelled) {
              throw new UserCancelFromOutside();
            }
            this.logSyncLifecycle('unlock-completed', telemetry);
            const result = await this.syncSettledPortfolio(
              authorizedPayload,
              generation,
              {
                oneKeyOperationLease,
                syncStartedAt,
                syncMode,
                telemetry,
              },
            );
            if (telemetry.cancelled) {
              throw new UserCancelFromOutside();
            }
            return this.resolveInteractivePortfolioSyncResult(result);
          },
          {
            debugMethodName: 'portfolio.syncPortfolio',
            deviceParams: { dbDevice: device },
          },
        );
      } catch (error) {
        await this.reportPortfolioSyncResult({
          error,
          eventPayload: authorizedPayload,
          failureStage: telemetry.failureStage ?? 'unlock',
          status: 'failed',
          telemetry,
        });
        throw error;
      } finally {
        appEventBus.off(
          EAppEventBusNames.CloseHardwareUiStateDialogManually,
          onUserClose,
        );
        if (
          this.interactiveSyncGenerationByTargetKey.get(targetKey) ===
          generation
        ) {
          this.interactiveSyncGenerationByTargetKey.delete(targetKey);
          const pendingInteractivePayload =
            this.pendingInteractivePayloadByTargetKey.get(targetKey);
          this.pendingInteractivePayloadByTargetKey.delete(targetKey);
          if (telemetry.cancelled) {
            this.pendingDisconnectedPayloadByTargetKey.delete(targetKey);
            this.pendingLockedPayloadByTargetKey.delete(targetKey);
            this.pendingMobileBlePayloadByTargetKey.delete(targetKey);
            this.pendingDesktopBlePayloadByTargetKey.delete(targetKey);
          } else if (pendingInteractivePayload) {
            this.pendingDisconnectedPayloadByTargetKey.delete(targetKey);
            this.pendingLockedPayloadByTargetKey.delete(targetKey);
            this.handleAllNetworksTokenListSettled(pendingInteractivePayload);
          } else {
            const pendingDisconnectedPayload =
              this.pendingDisconnectedPayloadByTargetKey.get(targetKey);
            if (pendingDisconnectedPayload) {
              this.pendingDisconnectedPayloadByTargetKey.delete(targetKey);
              this.handleAllNetworksTokenListSettled(
                pendingDisconnectedPayload,
              );
            }
            this.replayLockedPortfolioSnapshot(targetKey);
          }
        }
      }
    }

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
    if (this.interactiveSyncGenerationByTargetKey.has(targetKey)) {
      this.pendingInteractivePayloadByTargetKey.set(targetKey, eventPayload);
      return;
    }
    if (this.pendingDesktopBlePayloadByTargetKey.has(targetKey)) {
      this.rememberPendingDesktopBlePayload({ eventPayload, targetKey });
    }
    if (this.mobileBleResumeInProgressTargetKeys.has(targetKey)) {
      this.rememberPendingMobileBlePayload({ eventPayload, targetKey });
      this.advanceSyncGeneration(targetKey);
      return;
    }
    const pendingResumeTimer =
      this.pendingMobileBleResumeTimerByTargetKey.get(targetKey);
    if (pendingResumeTimer) {
      clearTimeout(pendingResumeTimer);
      this.pendingMobileBleResumeTimerByTargetKey.delete(targetKey);
      this.pendingMobileBlePayloadByTargetKey.delete(targetKey);
    }
    const generation = this.advanceSyncGeneration(targetKey);
    let syncDebounced = this.syncDebouncedByTargetKey.get(targetKey);
    if (!syncDebounced) {
      syncDebounced = debounce(
        (
          payload: IPortfolioSyncSettledPayload,
          scheduledGeneration: number,
        ) => {
          this.syncDebouncedByTargetKey.delete(targetKey);
          void this.syncSettledPortfolio(payload, scheduledGeneration);
        },
        1000,
      );
      this.syncDebouncedByTargetKey.set(targetKey, syncDebounced);
    }
    syncDebounced(eventPayload, generation);
  };

  private setLastResult(result: IPortfolioSyncLastResult) {
    this.lastResult = result;
    return result;
  }

  private resolveInteractivePortfolioSyncResult(
    result: IPortfolioSyncLastResult | undefined,
  ): boolean {
    if (result?.status === 'uploaded' && result.upload?.portfolioUpdated) {
      return true;
    }
    const status = result?.status;
    if (status === 'identity-mismatch') {
      throw new DeviceNotSame();
    }
    if (
      status === 'disabled' ||
      status === 'device-locked' ||
      status === 'error' ||
      status === 'identity-unavailable' ||
      (status === 'uploaded' && result?.upload?.portfolioUpdated === false)
    ) {
      throw new OneKeyLocalError({
        autoToast: true,
        key: ETranslations.global_sync_error,
        message: 'Portfolio sync did not complete',
      });
    }
    return false;
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

  private async handleSyncError({
    contentHash,
    error,
    eventPayload,
    generation,
    targetKey,
  }: {
    contentHash?: string;
    error: unknown;
    eventPayload?: IPortfolioSyncSettledPayload;
    generation: number;
    targetKey: string;
  }) {
    if (contentHash) {
      this.releaseInFlightReservation({ contentHash, generation, targetKey });
    }
    if (
      eventPayload &&
      error instanceof BluetoothUnavailableWhileUsbConnectedError &&
      platformEnv.isNative
    ) {
      await this.suspendMobileBleSilentSync({ eventPayload, targetKey });
      return;
    }
    if (eventPayload && isSilentUploadBlockedByDevice(error)) {
      this.handleDeviceLockedSkip({ eventPayload, targetKey });
      return;
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
    attemptAt,
    generation,
    targetKey,
    transferAt,
    walletId,
  }: {
    artifacts: IPortfolioSyncArtifacts;
    attemptAt: number;
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
      lastAttemptAt: attemptAt,
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

  private async reportPortfolioSyncResult({
    error,
    errorCode,
    eventPayload,
    failureStage,
    status,
    telemetry,
  }: {
    error?: unknown;
    errorCode?: string;
    eventPayload: IPortfolioSyncSettledPayload;
    failureStage?: IPortfolioSyncFailureStage;
    status: 'success' | 'failed';
    telemetry: IPortfolioSyncTelemetry;
  }) {
    if (telemetry.resultReported) {
      return;
    }
    telemetry.resultReported = true;
    const syncDurationMs = Math.max(Date.now() - telemetry.syncStartedAt, 0);
    try {
      const device = eventPayload.deviceDbId
        ? await localDb.getDeviceSafe(eventPayload.deviceDbId)
        : undefined;
      this.logSyncLifecycle('result', telemetry, {
        deviceType: device?.deviceType,
        protocol: device?.deviceStateInfo?.protocol ?? device?.connectProtocol,
        firmwareVersion: device?.deviceStateInfo?.versions?.firmware,
        bleVersion: device?.deviceStateInfo?.versions?.ble,
        status: telemetry.cancelled ? 'cancelled' : status,
        failureStage,
        errorCode: errorCode ?? getPortfolioSyncErrorCode(error),
      });
      const deviceId =
        device?.deviceStateInfo?.identity.deviceId || device?.deviceId;
      if (deviceId && device?.deviceType) {
        const normalizedErrorCode =
          errorCode ?? getPortfolioSyncErrorCode(error);
        const effectiveTransferRateBytesPerSecond =
          status === 'success' &&
          telemetry.packageBytes !== undefined &&
          telemetry.hardwareDurationMs !== undefined &&
          telemetry.hardwareDurationMs > 0
            ? Math.round(
                (telemetry.packageBytes / telemetry.hardwareDurationMs) * 1000,
              )
            : undefined;
        defaultLogger.hardware.connection.portfolioSyncResult({
          deviceId,
          deviceType: device.deviceType,
          ...(telemetry.transportType
            ? { transportType: telemetry.transportType }
            : {}),
          syncMode: telemetry.syncMode,
          status,
          ...(failureStage ? { failureStage } : {}),
          ...(normalizedErrorCode ? { errorCode: normalizedErrorCode } : {}),
          syncDurationMs,
          ...(telemetry.packDurationMs !== undefined
            ? { packDurationMs: telemetry.packDurationMs }
            : {}),
          ...(telemetry.hardwareDurationMs !== undefined
            ? { hardwareDurationMs: telemetry.hardwareDurationMs }
            : {}),
          ...(telemetry.portfolioJsonBytes !== undefined
            ? { portfolioJsonBytes: telemetry.portfolioJsonBytes }
            : {}),
          ...(telemetry.packageBytes !== undefined
            ? { packageBytes: telemetry.packageBytes }
            : {}),
          ...(effectiveTransferRateBytesPerSecond !== undefined
            ? { effectiveTransferRateBytesPerSecond }
            : {}),
          ...(telemetry.tokenCount !== undefined
            ? { tokenCount: telemetry.tokenCount }
            : {}),
          ...(telemetry.totalTokenCount !== undefined
            ? { totalTokenCount: telemetry.totalTokenCount }
            : {}),
        });
        if (status === 'success') {
          defaultLogger.hardware.connection.portfolioSynced({
            deviceId,
            deviceType: device.deviceType,
          });
        }
      }
    } catch {
      // Analytics must never affect device sync.
    }
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
    eventPayload,
    generation,
    retry,
    targetKey,
  }: {
    contentHash: string;
    deviceConnectId: string;
    eventPayload?: IPortfolioSyncSettledPayload;
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
        void this.handleSyncError({
          contentHash,
          error,
          eventPayload,
          generation,
          targetKey,
        });
      });
    }, PORTFOLIO_SYNC_HARDWARE_BUSY_RETRY_MS);
    this.pendingHardwareRetryTimerByConnectId.set(deviceConnectId, timer);
  }

  private async getHardwareCooldownRemainingMs({
    cooldownMs,
    targetKey,
    now,
  }: {
    cooldownMs?: number;
    targetKey: string;
    now: number;
  }) {
    const state = await this.portfolioSyncDb.getTargetState(targetKey);
    return getPortfolioSyncCooldownRemainingMs({
      lastAttemptAt: state?.lastAttemptAt,
      lastTransferAt: state?.lastTransferAt,
      cooldownMs,
      now,
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
    serverPackageBase64: string;
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
    const validatedPackage = validatePortfolioPackageBase64(packageBase64);

    debugPortfolioSyncLog('server-submit-packed', {
      bytesLength: portfolioJsonBytes.byteLength,
      contentHash,
      serverPackageBase64Length: packageBase64.length,
      serverPackageBytesLength: validatedPackage.packageBytesLength,
    });

    return {
      serverPackageBase64: validatedPackage.packageBase64,
      serverSubmit: {
        bytesLength: portfolioJsonBytes.byteLength,
        contentHash,
        serverPackageBase64Length: packageBase64.length,
        serverPackageBytesLength: validatedPackage.packageBytesLength,
      },
    };
  }

  private async uploadPreparedHardwarePortfolio({
    artifacts,
    desktopBleExecution,
    deviceConnectId,
    eventPayload,
    generation,
    hardwareTransportType: preparedHardwareTransportType,
    oneKeyOperationLease,
    serverPackageBase64,
    serverSubmit,
    syncMode = 'silent',
    targetKey,
    telemetry,
    updatedAt,
  }: {
    artifacts: IPortfolioSyncArtifacts;
    desktopBleExecution?: IDesktopBleSyncExecution;
    deviceConnectId: string;
    eventPayload: IPortfolioSyncSettledPayload;
    generation: number;
    hardwareTransportType?: EHardwareTransportType;
    oneKeyOperationLease?: IOneKeyHardwareOperationLease;
    serverPackageBase64: string;
    serverSubmit: IPortfolioServerSubmitResult;
    syncMode?: IPortfolioSyncMode;
    targetKey: string;
    telemetry: IPortfolioSyncTelemetry;
    updatedAt: number;
  }): Promise<IPortfolioSyncLastResult | undefined> {
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
    const hardwareConnectId =
      desktopBleExecution?.bleConnectId ?? deviceConnectId;
    const activeUpload = this.activeUploadByTargetKey.get(targetKey);
    if (activeUpload) {
      if (desktopBleExecution) {
        this.releaseInFlightReservation({
          contentHash: artifacts.contentHash,
          generation,
          targetKey,
        });
        this.scheduleDesktopBleBusyRetry({ eventPayload, targetKey });
        return this.setLastResult(
          this.buildResultBase({
            artifacts,
            eventPayload,
            serverSubmit,
            status: 'hardware-busy',
            updatedAt,
          }),
        );
      }
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
    const runUpload = async () => {
      const isExecutionCurrent = () =>
        this.isCurrentSyncGeneration(targetKey, generation) &&
        (!desktopBleExecution ||
          this.isDesktopBleSyncExecutionCurrent({
            execution: desktopBleExecution,
            targetKey,
          }));
      if (!isExecutionCurrent()) {
        this.releaseInFlightReservation({
          contentHash: artifacts.contentHash,
          generation,
          targetKey,
        });
        return;
      }
      const isStillAuthorized = await this.isPreparedUploadStillAuthorized({
        deviceConnectId,
        eventPayload,
        targetKey,
      });
      if (!isExecutionCurrent()) {
        this.releaseInFlightReservation({
          contentHash: artifacts.contentHash,
          generation,
          targetKey,
        });
        return;
      }
      if (!isStillAuthorized) {
        this.releaseInFlightReservation({
          contentHash: artifacts.contentHash,
          generation,
          targetKey,
        });
        this.cancelHardwareBusyRetry(deviceConnectId);
        return this.setRejectedPayloadResult(eventPayload);
      }
      const eligibility = await this.getPortfolioSyncEligibility(eventPayload, {
        requireConnected: syncMode === 'silent',
      });
      if (!isExecutionCurrent()) {
        this.releaseInFlightReservation({
          contentHash: artifacts.contentHash,
          generation,
          targetKey,
        });
        return;
      }
      if (eligibility !== 'eligible') {
        this.releaseInFlightReservation({
          contentHash: artifacts.contentHash,
          generation,
          targetKey,
        });
        return this.handleIneligibleSync({
          eligibility,
          eventPayload,
          targetKey,
        });
      }
      const hardwareTransportType = desktopBleExecution
        ? EHardwareTransportType.DesktopWebBle
        : (preparedHardwareTransportType ??
          (await this.backgroundApi.serviceHardware.getCurrentTransportType()));
      telemetry.transportType = hardwareTransportType;
      if (!isExecutionCurrent()) {
        this.releaseInFlightReservation({
          contentHash: artifacts.contentHash,
          generation,
          targetKey,
        });
        return;
      }
      if (
        syncMode === 'silent' &&
        hardwareTransportType === EHardwareTransportType.DesktopWebBle
      ) {
        this.releaseInFlightReservation({
          contentHash: artifacts.contentHash,
          generation,
          targetKey,
        });
        this.rememberPendingDesktopBlePayload({ eventPayload, targetKey });
        return this.setDesktopSuspendedResult(eventPayload);
      }
      if (
        syncMode === 'silent' &&
        hardwareTransportType === EHardwareTransportType.BLE
      ) {
        this.releaseInFlightReservation({
          contentHash: artifacts.contentHash,
          generation,
          targetKey,
        });
        this.rememberPendingMobileBlePayload({ eventPayload, targetKey });
        return this.setMobileBleSuspendedResult(eventPayload);
      }
      const hardwareBusy =
        syncMode === 'silent'
          ? await this.backgroundApi.serviceHardwareUI.isHardwareChannelBusy({
              connectId: hardwareConnectId,
            })
          : false;
      if (!isExecutionCurrent()) {
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
        const result = this.setLastResult(
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
        if (desktopBleExecution) {
          this.scheduleDesktopBleBusyRetry({ eventPayload, targetKey });
        } else {
          this.scheduleHardwareBusyRetry({
            contentHash: artifacts.contentHash,
            deviceConnectId,
            eventPayload,
            generation,
            retry: async () => {
              await this.uploadPreparedHardwarePortfolio({
                artifacts,
                deviceConnectId,
                eventPayload,
                generation,
                hardwareTransportType: preparedHardwareTransportType,
                serverPackageBase64,
                serverSubmit,
                targetKey,
                telemetry,
                updatedAt: Date.now(),
              });
            },
            targetKey,
          });
        }
        return result;
      }

      if (desktopBleExecution) {
        this.desktopBleHardwareAttemptGenerationByTargetKey.set(
          targetKey,
          desktopBleExecution.generation,
        );
      }
      const deviceIdentityStatus =
        await this.getPreparedUploadDeviceIdentityStatus({
          desktopBleExecution,
          deviceConnectId: hardwareConnectId,
          eventPayload,
          hardwareTransportType,
          syncMode,
          targetKey,
        });
      if (!isExecutionCurrent()) {
        this.releaseInFlightReservation({
          contentHash: artifacts.contentHash,
          generation,
          targetKey,
        });
        return;
      }
      if (deviceIdentityStatus !== 'verified') {
        this.releaseInFlightReservation({
          contentHash: artifacts.contentHash,
          generation,
          targetKey,
        });
        if (deviceIdentityStatus === 'unavailable') {
          return this.handleDeviceIdentityUnavailable({
            eventPayload,
            targetKey,
          });
        } else if (deviceIdentityStatus === 'locked') {
          return this.handleDeviceLockedSkip({ eventPayload, targetKey });
        }
        return this.handleDeviceIdentityMismatch({ eventPayload, targetKey });
      }

      const lastAttemptAt = Date.now();
      // Start both operations in the same event loop turn so lastAttemptAt
      // always corresponds to a hardware upload that has actually started.
      this.logSyncLifecycle('upload-started', telemetry);
      const hardwareUploadPromise =
        this.backgroundApi.serviceHardware.uploadPortfolioPackage({
          connectId: hardwareConnectId,
          ...(desktopBleExecution
            ? {
                desktopBleReuseConnectedOnly: true,
              }
            : {}),
          ...(hardwareTransportType ? { hardwareTransportType } : {}),
          packageBase64: serverPackageBase64,
          ...(syncMode === 'interactive'
            ? { uiMode: 'progress' as const }
            : {}),
        });
      const [uploadResult, attemptStateResult] = await Promise.allSettled([
        hardwareUploadPromise.finally(() => {
          telemetry.hardwareDurationMs = Math.max(
            Date.now() - lastAttemptAt,
            0,
          );
        }),
        this.portfolioSyncDb.updateTargetState(targetKey, {
          lastAttemptAt,
        }),
      ]);
      // Keep the global hardware lock until the device call settles, even if
      // persisting the attempt state fails first.
      if (uploadResult.status === 'rejected') {
        await this.reportPortfolioSyncResult({
          error: uploadResult.reason,
          eventPayload,
          failureStage: 'device-sync',
          status: 'failed',
          telemetry,
        });
        throw uploadResult.reason;
      }
      if (attemptStateResult.status === 'rejected') {
        debugPortfolioSyncLog('persist-last-attempt-failed', {
          message:
            attemptStateResult.reason instanceof Error
              ? attemptStateResult.reason.message
              : String(attemptStateResult.reason),
          targetKey,
        });
      }
      const upload: { portfolioUpdated: boolean } = uploadResult.value;
      if (upload.portfolioUpdated) {
        await this.reportPortfolioSyncResult({
          eventPayload,
          status: 'success',
          telemetry,
        });
      } else {
        await this.reportPortfolioSyncResult({
          errorCode: 'PORTFOLIO_NOT_UPDATED',
          eventPayload,
          failureStage: 'device-sync',
          status: 'failed',
          telemetry,
        });
      }
      if (!this.isCurrentSyncGeneration(targetKey, generation)) {
        this.releaseInFlightReservation({
          contentHash: artifacts.contentHash,
          generation,
          targetKey,
        });
        return;
      }
      const result = this.setLastResult({
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
        bytesLength: serverSubmit.serverPackageBytesLength,
        contentHash: artifacts.contentHash,
      });
      if (!upload.portfolioUpdated) {
        this.releaseInFlightReservation({
          contentHash: artifacts.contentHash,
          generation,
          targetKey,
        });
        return result;
      }
      if (!eventPayload.walletId) {
        throw new OneKeyLocalError(
          'Authorized portfolio payload is missing walletId',
        );
      }
      try {
        await this.commitProcessedArtifacts({
          artifacts,
          attemptAt: lastAttemptAt,
          generation,
          targetKey,
          transferAt: Date.now(),
          walletId: eventPayload.walletId,
        });
      } catch (error) {
        this.releaseInFlightReservation({
          contentHash: artifacts.contentHash,
          generation,
          targetKey,
        });
        debugPortfolioSyncLog('persist-upload-metadata-failed', {
          message: error instanceof Error ? error.message : String(error),
          targetKey,
        });
      }
      if (syncMode === 'interactive') {
        this.pendingDesktopBlePayloadByTargetKey.delete(targetKey);
        this.pendingMobileBlePayloadByTargetKey.delete(targetKey);
        this.pendingDisconnectedPayloadByTargetKey.delete(targetKey);
        this.pendingLockedPayloadByTargetKey.delete(targetKey);
      }
      if (
        desktopBleExecution &&
        this.isCurrentSyncGeneration(targetKey, generation)
      ) {
        this.pendingDesktopBlePayloadByTargetKey.delete(targetKey);
      }
      return result;
    };
    const uploadPromise = desktopBleExecution
      ? (async () => {
          const attempt =
            await this.backgroundApi.serviceHardwareUI.tryRunExclusiveOneKeyOperation(
              runUpload,
              { deviceKey: targetKey },
            );
          if (!attempt.acquired) {
            this.releaseInFlightReservation({
              contentHash: artifacts.contentHash,
              generation,
              targetKey,
            });
            const result = this.setLastResult(
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
            this.scheduleDesktopBleBusyRetry({ eventPayload, targetKey });
            return result;
          }
          return attempt.result;
        })()
      : this.backgroundApi.serviceHardwareUI.runExclusiveOneKeyOperation(
          runUpload,
          { deviceKey: targetKey, lease: oneKeyOperationLease },
        );
    this.activeUploadByTargetKey.set(targetKey, uploadPromise);
    try {
      return await uploadPromise;
    } finally {
      if (this.activeUploadByTargetKey.get(targetKey) === uploadPromise) {
        this.activeUploadByTargetKey.delete(targetKey);
      }
    }
  }

  private async syncSettledPortfolio(
    incomingPayload: IPortfolioSyncSettledPayload,
    requestedGeneration?: number,
    options?: IPortfolioSyncExecutionOptions,
  ): Promise<IPortfolioSyncLastResult | undefined> {
    const updatedAt = Date.now();
    const syncMode = options?.syncMode ?? 'silent';
    const telemetry: IPortfolioSyncTelemetry = options?.telemetry ?? {
      syncId: `${updatedAt}-${(this.syncSequence += 1)}`,
      syncMode,
      syncStartedAt: options?.syncStartedAt ?? updatedAt,
    };
    telemetry.failureStage = 'prepare';
    let failureStage: IPortfolioSyncFailureStage = 'prepare';
    const eventPayload =
      await this.resolveAuthorizedPortfolioPayload(incomingPayload);
    if (!eventPayload) {
      return this.setRejectedPayloadResult(incomingPayload);
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
      const isHardwareWallet = accountUtils.isHwWallet({
        walletId: eventPayload.walletId,
      });
      const deviceConnectId = eventPayload.deviceConnectId;

      if (!isHardwareWallet || !deviceConnectId) {
        debugPortfolioSyncLog('skip-non-hardware');
        return this.setLastResult({
          status: 'disabled',
          updatedAt,
          walletId: eventPayload.walletId,
        });
      }

      const eligibility = await this.getPortfolioSyncEligibility(eventPayload, {
        requireConnected: syncMode === 'silent',
      });
      if (!this.isCurrentSyncGeneration(targetKey, generation)) {
        return;
      }
      if (eligibility !== 'eligible') {
        return this.handleIneligibleSync({
          eligibility,
          eventPayload,
          targetKey,
        });
      }
      this.pendingDisconnectedPayloadByTargetKey.delete(targetKey);

      if (
        syncMode === 'silent' &&
        (await this.isDeviceIdentityMismatchPending({
          eventPayload,
          targetKey,
        }))
      ) {
        if (!this.isCurrentSyncGeneration(targetKey, generation)) {
          return;
        }
        return this.handleDeviceIdentityMismatch({ eventPayload, targetKey });
      }

      const desktopBleExecution = options?.desktopBleExecution;
      let currentTransportType: EHardwareTransportType;
      let pinnedHardwareTransportType: EHardwareTransportType | undefined;
      if (desktopBleExecution) {
        currentTransportType = EHardwareTransportType.DesktopWebBle;
      } else if (syncMode === 'interactive') {
        currentTransportType =
          await this.backgroundApi.serviceHardware.getCurrentTransportType();
      } else {
        const targetWebUsbConnected =
          await this.isTargetWebUsbConnected(eventPayload);
        if (!this.isCurrentSyncGeneration(targetKey, generation)) {
          return;
        }
        currentTransportType =
          await this.backgroundApi.serviceHardware.prepareHardwareTransport({
            connectId: deviceConnectId,
            hardwareCallContext:
              EHardwareCallContext.BACKGROUND_NON_INTERACTIVE,
            persistTransportType: false,
            ...(targetWebUsbConnected
              ? { requestedTransportType: 'usb' as const }
              : {}),
          });
        pinnedHardwareTransportType = currentTransportType;
      }
      if (!this.isCurrentSyncGeneration(targetKey, generation)) {
        return;
      }
      telemetry.transportType = currentTransportType;
      if (
        syncMode === 'silent' &&
        currentTransportType === EHardwareTransportType.DesktopWebBle
      ) {
        this.cancelHardwareBusyRetry(deviceConnectId);
        this.rememberPendingDesktopBlePayload({ eventPayload, targetKey });
        return this.setDesktopSuspendedResult(eventPayload);
      }
      if (
        syncMode === 'silent' &&
        currentTransportType === EHardwareTransportType.BLE
      ) {
        this.cancelHardwareBusyRetry(deviceConnectId);
        this.rememberPendingMobileBlePayload({ eventPayload, targetKey });
        return this.setMobileBleSuspendedResult(eventPayload);
      }
      if (!desktopBleExecution) {
        this.pendingDesktopBlePayloadByTargetKey.delete(targetKey);
        this.invalidateDesktopBleIdleLease({
          reason: 'non-ble-transport-active',
          targetKey,
        });
      }

      // Empty standard-wallet snapshots intentionally continue through the
      // signed package flow so the device atomically overwrites stale data.
      const cooldownRemainingMs =
        syncMode === 'silent'
          ? await this.getHardwareCooldownRemainingMs({
              cooldownMs: desktopBleExecution
                ? DESKTOP_BLE_TRANSFER_COOLDOWN_MS
                : undefined,
              targetKey,
              now: updatedAt,
            })
          : 0;
      if (!this.isCurrentSyncGeneration(targetKey, generation)) {
        return;
      }
      if (cooldownRemainingMs > 0) {
        if (desktopBleExecution) {
          this.rememberPendingDesktopBlePayload({ eventPayload, targetKey });
          this.scheduleDesktopBleIdleSync({
            minimumDelayMs: cooldownRemainingMs,
            targetKey,
          });
        } else {
          this.scheduleSyncAfterCooldown({
            deviceConnectId,
            eventPayload,
            generation,
            remainingMs: cooldownRemainingMs,
            targetKey,
          });
        }
        debugPortfolioSyncLog('skip-cooldown', {
          cooldownRemainingMs,
          deviceConnectId,
          totalTokenCount: eventPayload.tokens.length,
        });
        return this.setLastResult({
          cooldownRemainingMs,
          deviceConnectId,
          status: 'cooldown',
          totalTokenCount: eventPayload.tokens.length,
          updatedAt,
          walletId: eventPayload.walletId,
        });
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
      telemetry.portfolioJsonBytes = artifacts.portfolioJsonBytes.byteLength;
      telemetry.tokenCount = artifacts.portfolio.tokens.length;
      telemetry.totalTokenCount = eventPayload.tokens.length;
      debugPortfolioSyncLog('portfolio-built', {
        contentHash: artifacts.contentHash,
        portfolioJsonBytesLength: artifacts.portfolioJsonBytes.byteLength,
        tokenCount: artifacts.portfolio.tokens.length,
      });

      // Read the persisted last-synced hash for this target (await) BEFORE the
      // synchronous check-and-reserve below. Silent syncs honor the persisted
      // hash, while explicit syncs only dedupe work already in flight. The
      // in-flight check + reserve run with NO await between them, so concurrent
      // invocations cannot both reserve the same snapshot.
      // The hardware path further down awaits isHardwareChannelBusy, which is
      // exactly why the reservation must be taken here, not after that await.
      const persistedTargetState =
        await this.portfolioSyncDb.getTargetState(targetKey);
      if (!this.isCurrentSyncGeneration(targetKey, generation)) {
        return;
      }
      const isPersistedDuplicate =
        eventPayload.walletId === persistedTargetState?.lastWalletId &&
        artifacts.contentHash === persistedTargetState?.lastContentHash;
      const isInFlightDuplicate =
        artifacts.contentHash ===
        this.inFlightReservationByTargetKey.get(targetKey)?.contentHash;
      const isDuplicate =
        isInFlightDuplicate || (syncMode === 'silent' && isPersistedDuplicate);
      if (isDuplicate) {
        if (desktopBleExecution) {
          this.pendingDesktopBlePayloadByTargetKey.delete(targetKey);
        }
        debugPortfolioSyncLog('skip-duplicate', {
          contentHash: artifacts.contentHash,
          tokenCount: artifacts.portfolio.tokens.length,
          totalTokenCount: eventPayload.tokens.length,
        });
        return this.setLastResult(
          this.buildResultBase({
            artifacts,
            eventPayload,
            status: 'duplicate',
            updatedAt,
          }),
        );
      }

      this.inFlightReservationByTargetKey.set(targetKey, {
        contentHash: artifacts.contentHash,
        generation,
      });
      reservedContentHash = artifacts.contentHash;

      const hardwareBusy =
        syncMode === 'silent'
          ? await this.backgroundApi.serviceHardwareUI.isHardwareChannelBusy({
              connectId: deviceConnectId,
            })
          : false;
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
        const result = this.setLastResult(
          this.buildResultBase({
            artifacts,
            eventPayload,
            status: 'hardware-busy',
            updatedAt,
          }),
        );
        if (desktopBleExecution) {
          this.scheduleDesktopBleBusyRetry({ eventPayload, targetKey });
        } else {
          this.scheduleHardwareBusyRetry({
            contentHash: artifacts.contentHash,
            deviceConnectId,
            eventPayload,
            generation,
            retry: async () => {
              await this.syncSettledPortfolio(eventPayload, generation);
            },
            targetKey,
          });
        }
        return result;
      }

      failureStage = 'pack';
      telemetry.failureStage = failureStage;
      this.logSyncLifecycle('pack-started', telemetry);
      const packStartedAt = Date.now();
      let serverPackageBase64: string;
      let serverSubmit: IPortfolioServerSubmitResult;
      try {
        ({ serverPackageBase64, serverSubmit } =
          await this.submitPortfolioJsonToServer({
            artifacts,
          }));
      } finally {
        telemetry.packDurationMs = Math.max(Date.now() - packStartedAt, 0);
      }
      telemetry.packageBytes = serverSubmit.serverPackageBytesLength;
      if (!this.isCurrentSyncGeneration(targetKey, generation)) {
        this.releaseInFlightReservation({
          contentHash: artifacts.contentHash,
          generation,
          targetKey,
        });
        return;
      }

      failureStage = 'device-sync';
      telemetry.failureStage = failureStage;
      return await this.uploadPreparedHardwarePortfolio({
        artifacts,
        desktopBleExecution,
        deviceConnectId,
        eventPayload,
        generation,
        hardwareTransportType: pinnedHardwareTransportType,
        oneKeyOperationLease: options?.oneKeyOperationLease,
        serverPackageBase64,
        serverSubmit,
        syncMode,
        targetKey,
        telemetry,
        updatedAt,
      });
    } catch (error) {
      await this.reportPortfolioSyncResult({
        error,
        eventPayload,
        failureStage,
        status: 'failed',
        telemetry,
      });
      if (syncMode === 'interactive') {
        if (reservedContentHash) {
          this.releaseInFlightReservation({
            contentHash: reservedContentHash,
            generation,
            targetKey,
          });
        }
        throw error;
      }
      await this.handleSyncError({
        contentHash: reservedContentHash,
        error,
        eventPayload,
        generation,
        targetKey,
      });
    }
  }

  @backgroundMethod()
  async waitForActivePortfolioSync({ connectId }: { connectId: string }) {
    const targetKey = this.targetKeyByConnectId.get(connectId) ?? connectId;
    const activeUpload = this.activeUploadByTargetKey.get(targetKey);
    if (!activeUpload) {
      return false;
    }
    await activeUpload.catch(() => undefined);
    return true;
  }
}

export default ServiceHardwarePortfolioSync;
