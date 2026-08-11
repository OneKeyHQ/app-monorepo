import { debounce, uniq } from 'lodash';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  BluetoothUnavailableWhileUsbConnectedError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { isProtocolV2ProductType } from '@onekeyhq/shared/src/utils/hardwareDeviceTypes';
import { PORTFOLIO_ARCHIVE_MAX_BYTES } from '@onekeyhq/shared/src/utils/portfolioArchive';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import {
  EHardwareCallContext,
  EHardwareVendor,
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

export type IPortfolioSyncStatus =
  | 'cooldown'
  | 'disabled'
  | 'duplicate'
  | 'empty'
  | 'error'
  | 'hardware-busy'
  | 'identity-mismatch'
  | 'inactive'
  | 'disconnected'
  | 'ble-suspended'
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
const PORTFOLIO_SYNC_RESUME_AFTER_INTERACTION_MS = 5000;
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

  private pendingDisconnectedPayloadByTargetKey = new Map<
    string,
    IPortfolioSyncSettledPayload
  >();

  // 只缓存当前连接会话中已经在线确认过的设备身份。连接事件或 SDK
  // 上报身份冲突时会清空，避免 wipe/换种子后复用旧身份结论。
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

  private activeUploadByTargetKey = new Map<string, Promise<unknown>>();

  private targetKeyByConnectId = new Map<string, string>();

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
      accountUtils.isWalletDeprecatedOrMocked(wallet) ||
      !accountUtils.isHwWallet({ walletId: wallet.id })
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
    this.setLastResult({
      status: 'disabled',
      updatedAt: Date.now(),
      walletId: eventPayload.walletId,
    });
  }

  private setMobileBleSuspendedResult(
    eventPayload: IPortfolioSyncSettledPayload,
  ) {
    this.setLastResult({
      deviceConnectId: eventPayload.deviceConnectId,
      status: 'ble-suspended',
      totalTokenCount: eventPayload.tokens.length,
      updatedAt: Date.now(),
      walletId: eventPayload.walletId,
    });
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

  private async isMobileBleSilentSyncDisabled(targetKey: string) {
    if (!platformEnv.isNative) {
      return false;
    }
    if (this.mobileBleSilentSyncDisabledTargetKeys.has(targetKey)) {
      return true;
    }
    const state = await this.portfolioSyncDb.getTargetState(targetKey);
    if (state?.bleSilentSyncDisabled) {
      this.mobileBleSilentSyncDisabledTargetKeys.add(targetKey);
      return true;
    }
    return false;
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
  async notifyInteractiveHardwareOperationSucceeded({
    connectId,
    deviceDbId,
  }: {
    connectId?: string;
    deviceDbId?: string;
  }) {
    if (!platformEnv.isNative) {
      return false;
    }
    const targetKey =
      deviceDbId ||
      (connectId ? this.targetKeyByConnectId.get(connectId) : undefined);
    if (!targetKey) {
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

  private async isPreparedUploadDeviceIdentityVerified({
    deviceConnectId,
    eventPayload,
    targetKey,
  }: {
    deviceConnectId: string;
    eventPayload: IPortfolioSyncSettledPayload;
    targetKey: string;
  }) {
    const deviceDbId = eventPayload.deviceDbId;
    if (!deviceDbId) {
      return false;
    }
    const device = await localDb.getDeviceSafe(deviceDbId);
    const expectedDeviceId =
      device?.deviceStateInfo?.identity.deviceId || device?.deviceId;
    if (!expectedDeviceId) {
      this.mismatchedDeviceIdByTargetKey.set(targetKey, '');
      return false;
    }
    const mismatchedDeviceId =
      this.mismatchedDeviceIdByTargetKey.get(targetKey);
    if (mismatchedDeviceId === expectedDeviceId) {
      return false;
    }
    if (mismatchedDeviceId !== undefined) {
      this.mismatchedDeviceIdByTargetKey.delete(targetKey);
    }
    if (this.verifiedDeviceIdByTargetKey.get(targetKey) === expectedDeviceId) {
      return true;
    }

    const state = await this.backgroundApi.serviceHardware.getDeviceState({
      connectId: deviceConnectId,
      hardwareCallContext: EHardwareCallContext.BACKGROUND_NON_INTERACTIVE,
      params: { scope: 'firmware' },
      silentMode: true,
    });
    const liveDeviceId = state.identity?.deviceId;
    if (!liveDeviceId || liveDeviceId !== expectedDeviceId) {
      this.verifiedDeviceIdByTargetKey.delete(targetKey);
      this.mismatchedDeviceIdByTargetKey.set(targetKey, expectedDeviceId);
      return false;
    }
    this.mismatchedDeviceIdByTargetKey.delete(targetKey);
    this.verifiedDeviceIdByTargetKey.set(targetKey, expectedDeviceId);
    return true;
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

    const isConnected =
      await this.backgroundApi.serviceHardware.isHardwareDeviceConnected({
        connectId: eventPayload.deviceConnectId,
        deviceDbId: eventPayload.deviceDbId,
      });
    return isConnected ? 'eligible' : 'disconnected';
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
    this.setLastResult({
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
    this.setLastResult({
      deviceConnectId: eventPayload.deviceConnectId,
      status: 'identity-mismatch',
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
      const pendingPayload =
        this.pendingDisconnectedPayloadByTargetKey.get(targetKey);
      if (pendingPayload) {
        this.pendingDisconnectedPayloadByTargetKey.delete(targetKey);
        this.handleAllNetworksTokenListSettled(pendingPayload);
      }
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
    targetKey,
    now,
  }: {
    targetKey: string;
    now: number;
  }) {
    const state = await this.portfolioSyncDb.getTargetState(targetKey);
    return getPortfolioSyncCooldownRemainingMs({
      lastAttemptAt: state?.lastAttemptAt,
      lastTransferAt: state?.lastTransferAt,
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
    deviceConnectId,
    eventPayload,
    generation,
    serverPackageBase64,
    serverSubmit,
    targetKey,
    updatedAt,
  }: {
    artifacts: IPortfolioSyncArtifacts;
    deviceConnectId: string;
    eventPayload: IPortfolioSyncSettledPayload;
    generation: number;
    serverPackageBase64: string;
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
    const activeUpload = this.activeUploadByTargetKey.get(targetKey);
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
    const uploadPromise =
      this.backgroundApi.serviceHardwareUI.runExclusiveOneKeyOperation(
        async () => {
          if (!this.isCurrentSyncGeneration(targetKey, generation)) {
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
          if (!this.isCurrentSyncGeneration(targetKey, generation)) {
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
            this.setRejectedPayloadResult(eventPayload);
            return;
          }
          const eligibility =
            await this.getPortfolioSyncEligibility(eventPayload);
          if (!this.isCurrentSyncGeneration(targetKey, generation)) {
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
            this.handleIneligibleSync({
              eligibility,
              eventPayload,
              targetKey,
            });
            return;
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
              eventPayload,
              generation,
              retry: () =>
                this.uploadPreparedHardwarePortfolio({
                  artifacts,
                  deviceConnectId,
                  eventPayload,
                  generation,
                  serverPackageBase64,
                  serverSubmit,
                  targetKey,
                  updatedAt: Date.now(),
                }),
              targetKey,
            });
            return;
          }

          if (await this.isMobileBleSilentSyncDisabled(targetKey)) {
            this.releaseInFlightReservation({
              contentHash: artifacts.contentHash,
              generation,
              targetKey,
            });
            this.rememberPendingMobileBlePayload({ eventPayload, targetKey });
            this.setMobileBleSuspendedResult(eventPayload);
            return;
          }

          const isDeviceIdentityVerified =
            await this.isPreparedUploadDeviceIdentityVerified({
              deviceConnectId,
              eventPayload,
              targetKey,
            });
          if (!this.isCurrentSyncGeneration(targetKey, generation)) {
            this.releaseInFlightReservation({
              contentHash: artifacts.contentHash,
              generation,
              targetKey,
            });
            return;
          }
          if (!isDeviceIdentityVerified) {
            this.releaseInFlightReservation({
              contentHash: artifacts.contentHash,
              generation,
              targetKey,
            });
            this.handleDeviceIdentityMismatch({ eventPayload, targetKey });
            return;
          }

          await this.portfolioSyncDb.updateTargetState(targetKey, {
            lastAttemptAt: Date.now(),
          });
          if (!this.isCurrentSyncGeneration(targetKey, generation)) {
            this.releaseInFlightReservation({
              contentHash: artifacts.contentHash,
              generation,
              targetKey,
            });
            return;
          }

          const upload: { portfolioUpdated: boolean } =
            await this.backgroundApi.serviceHardware.uploadPortfolioPackage({
              connectId: deviceConnectId,
              packageBase64: serverPackageBase64,
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
            bytesLength: serverSubmit.serverPackageBytesLength,
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
        },
        { deviceKey: targetKey },
      );
    this.activeUploadByTargetKey.set(targetKey, uploadPromise);
    try {
      await uploadPromise;
    } finally {
      if (this.activeUploadByTargetKey.get(targetKey) === uploadPromise) {
        this.activeUploadByTargetKey.delete(targetKey);
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

      const eligibility = await this.getPortfolioSyncEligibility(eventPayload);
      if (!this.isCurrentSyncGeneration(targetKey, generation)) {
        return;
      }
      if (eligibility !== 'eligible') {
        this.handleIneligibleSync({
          eligibility,
          eventPayload,
          targetKey,
        });
        return;
      }
      this.pendingDisconnectedPayloadByTargetKey.delete(targetKey);

      if (
        await this.isDeviceIdentityMismatchPending({
          eventPayload,
          targetKey,
        })
      ) {
        if (!this.isCurrentSyncGeneration(targetKey, generation)) {
          return;
        }
        this.handleDeviceIdentityMismatch({ eventPayload, targetKey });
        return;
      }

      if (await this.isMobileBleSilentSyncDisabled(targetKey)) {
        this.rememberPendingMobileBlePayload({ eventPayload, targetKey });
        this.setMobileBleSuspendedResult(eventPayload);
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
          eventPayload,
          generation,
          retry: () => this.syncSettledPortfolio(eventPayload, generation),
          targetKey,
        });
        return;
      }

      const { serverPackageBase64, serverSubmit } =
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
        serverPackageBase64,
        serverSubmit,
        targetKey,
        updatedAt,
      });
    } catch (error) {
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
