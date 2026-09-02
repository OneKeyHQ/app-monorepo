import {
  EDeviceType,
  EFirmwareType,
  isSameOnekeyBleName,
} from '@onekeyfe/hd-shared';
import { Semaphore } from 'async-mutex';
import { uniq } from 'lodash';
import semver from 'semver';

import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { makeTimeoutPromise } from '@onekeyhq/shared/src/background/backgroundUtils';
import { HARDWARE_SDK_VERSION } from '@onekeyhq/shared/src/config/appConfig';
import { BTC_FIRST_TAPROOT_PATH } from '@onekeyhq/shared/src/consts/chainConsts';
import { WALLET_TYPE_HW } from '@onekeyhq/shared/src/consts/dbConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import * as deviceErrors from '@onekeyhq/shared/src/errors/errors/hardwareErrors';
import { convertDeviceResponse } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import type {
  IAppEventBusPayload,
  ILinuxUdevGuideReason,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  checkBLEPermissions,
  checkBLEState,
} from '@onekeyhq/shared/src/hardware/blePermissions';
import {
  DESKTOP_BLE_FIRMWARE_CONNECTION_TIMEOUT_MS,
  DESKTOP_BLE_SILENT_BIND_CONNECTION_TIMEOUT_MS,
} from '@onekeyhq/shared/src/hardware/connectionTimeouts';
import {
  getValidDeviceStateVersionKeys,
  projectLegacyDeviceFeaturesFromState,
} from '@onekeyhq/shared/src/hardware/deviceStateUtils';
import {
  CoreSDKLoader,
  getHardwareSDKInstance,
  resetHardwareSDKInstance,
} from '@onekeyhq/shared/src/hardware/instance';
import { getVendorProfile } from '@onekeyhq/shared/src/hardware/vendorProfile';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  LogLevel,
  NativeLogger,
} from '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import cacheUtils, { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import deviceHomeScreenUtils, {
  DEFAULT_T1_HOME_SCREEN_INFORMATION,
  T1_HOME_SCREEN_DEFAULT_IMAGES,
} from '@onekeyhq/shared/src/utils/deviceHomeScreenUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { devOnlyData } from '@onekeyhq/shared/src/utils/devModeUtils';
import { NEO_DEVICE_TYPE } from '@onekeyhq/shared/src/utils/hardwareDeviceTypes';
import numberUtils from '@onekeyhq/shared/src/utils/numberUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EHardwareTransportType } from '@onekeyhq/shared/types';
import type {
  IBleFirmwareReleasePayload,
  IDeviceHomeScreen,
  IDeviceVerifyVersionCompareResult,
  IDeviceVersionCacheInfo,
  IFirmwareReleasePayload,
  IHardwareCallContext,
  IOneKeyDeviceFeatures,
  IOneKeyDeviceState,
} from '@onekeyhq/shared/types/device';
import {
  EHardwareCallContext,
  EHardwareVendor,
  EOneKeyDeviceMode,
} from '@onekeyhq/shared/types/device';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import localDb from '../../dbs/local/localDb';
import { ELocalDBStoreNames } from '../../dbs/local/localDBStoreNames';
import simpleDb from '../../dbs/simple/simpleDb';
import { dispatchOffscreenEvent } from '../../offscreens/offscreenEventBus';
import {
  EHardwareUiStateAction,
  hardwareForceTransportAtom,
  hardwareUiStateAtom,
  hardwareUiStateCompletedAtom,
  settingsPersistAtom,
} from '../../states/jotai/atoms';
import ServiceBase from '../ServiceBase';
import { getFirmwareManifestSnapshot } from '../ServiceFirmwareUpdate/FirmwareManifestProvider';

import { DeviceSettingsManager } from './DeviceSettingsManager';
import { HardwareConnectionManager } from './HardwareConnectionManager';
import {
  HardwareUiEventQueue,
  createHardwareUiEventState,
  reduceHardwareUiEventState,
} from './hardwareUiEventStateMachine';
import { copyWalletSessionUiMetadata } from './hardwareUiPayloadUtils';
import { HardwareVerifyManager } from './HardwareVerifyManager';
import serviceHardwareUtils from './serviceHardwareUtils';

import type {
  IAdapterUiResponse,
  IThirdPartyHardwareAdapter,
} from './adapters/types';
import type {
  IChangePinParams,
  IDeviceHomeScreenConfig,
  IGetDeviceAdvanceSettingsParams,
  IGetDeviceLabelParams,
  IHardwareHomeScreenData,
  ISetAutoLockDelayMsParams,
  ISetAutoShutDownDelayMsParams,
  ISetBrightnessParams,
  ISetDeviceHomeScreenParams,
  ISetDeviceLabelParams,
  ISetHapticFeedbackParams,
  ISetInputPinOnSoftwareParams,
  ISetLanguageParams,
  ISetPassphraseEnabledParams,
  IWipeDeviceParams,
} from './DeviceSettingsManager';
import type {
  IFirmwareAuthenticateParams,
  IShouldAuthenticateFirmwareParams,
} from './HardwareVerifyManager';
import type { IHardwareHomeScreenResponse } from './ServerType';
import type { IDBDevice } from '../../dbs/local/types';
import type { ISimpleDBAppStatus } from '../../dbs/simple/entity/SimpleDbEntityAppStatus';
import type {
  IOffscreenEventMap,
  IOffscreenEventType,
} from '../../offscreens/offscreenEventBus';
import type {
  IHardwareUiPayload,
  IHardwareUiState,
} from '../../states/jotai/atoms';
import type { IServiceBaseProps } from '../ServiceBase';
import type { IUpdateFirmwareWorkflowParams } from '../ServiceFirmwareUpdate/ServiceFirmwareUpdate';
import type { IOneKeyHardwareOperationLease } from '../ServiceHardwareUI/HardwareProcessingManager';
import type {
  CommonParams,
  CoreApi,
  CoreMessage,
  DeviceStateEvent,
  DeviceSupportFeaturesPayload,
  DeviceUploadResourceParams,
  Features,
  GetDeviceStateParams,
  Response as HardwareResponse,
  IDeviceType,
  KnownDevice,
  OnekeyFeatures,
  SearchDevice,
  UiEvent,
  UiResponseEvent,
} from '@onekeyfe/hd-core';
import type { HardwareConnectProtocol } from '@onekeyfe/hd-shared';
import type { DeviceSessionPinType } from '@onekeyfe/hd-transport';

const DEVICE_PIN_ON_DEVICE_TYPES = new Set<IDeviceType>([
  EDeviceType.Touch,
  EDeviceType.Pro,
  EDeviceType.Pro2,
  NEO_DEVICE_TYPE,
]);
const SKIP_APP_FIRMWARE_UPDATE_EVENT = true;
const MAX_PERSISTED_DEVICE_PROTOCOL_ENTRIES = 128;
const HARDWARE_CONNECT_PROTOCOL_MIGRATION_VERSION = 1;
const HARDWARE_SDK_DEBUG_LOG_PREFIX = '[HardwareSDK][bg]';
const HARDWARE_CONNECT_PROTOCOL_UNAVAILABLE_MESSAGE =
  'Hardware connect protocol is unavailable. Reconnect the device through onboarding.';

function writeHardwareSdkDebugLog(message: string) {
  if (!platformEnv.isDev) {
    return;
  }

  const formattedMessage = `${HARDWARE_SDK_DEBUG_LOG_PREFIX} ${message}`;
  if (platformEnv.isNative) {
    NativeLogger.write(LogLevel.Info, formattedMessage);
    return;
  }

  if (platformEnv.isDesktop) {
    // eslint-disable-next-line no-console
    console.log(formattedMessage);
  }
}

type IProtocolAwareCoreApi = CoreApi & {
  setDeviceConnectProtocol?: (
    connectId: string,
    connectProtocol: HardwareConnectProtocol | undefined,
  ) => void;
};

type IProtocolV2NftCoreApi = CoreApi & {
  deviceUploadNft?: (
    connectId: string,
    params: {
      imageJpegBase64: string;
      thumbnailJpegBase64: string;
      title: string;
      subtitle: string;
      timestampMs?: number;
    },
  ) => ReturnType<CoreApi['deviceUploadResource']>;
};

type IGetSDKInstanceOptions = {
  connectId: string | undefined;
  connectProtocol?: HardwareConnectProtocol;
  forceProtocolDetection?: boolean;
  hardwareCallContext?: EHardwareCallContext;
  hardwareTransportType?: EHardwareTransportType;
  persistTransportType?: boolean;
  forceFirmwareManifestRefresh?: boolean;
};

function isHardwareConnectProtocol(
  protocol: unknown,
): protocol is HardwareConnectProtocol {
  return protocol === 'V1' || protocol === 'V2';
}

/**
 * @deprecated New code should use IDeviceGetStateOptions; retained for legacy Features compatibility.
 */
export type IDeviceGetFeaturesOptions = {
  connectId: string | undefined;
  vendor?: EHardwareVendor;
  withHardwareProcessing?: boolean;
  silentMode?: boolean;
  /** 与 connectId 同一次解析出的传输类型；传入后不得再次自动选路。 */
  hardwareTransportType?: EHardwareTransportType;
  params?: CommonParams & {
    allowEmptyConnectId?: boolean;
    forceProtocolDetection?: boolean;
  };
  hardwareCallContext?: IHardwareCallContext;
};

export type IDeviceGetStateOptions = Omit<
  IDeviceGetFeaturesOptions,
  'params'
> & {
  /** Reuse an existing desktop BLE link without scanning or reconnecting. */
  desktopBleReuseConnectedOnly?: boolean;
  /** Avoid changing the user's preferred transport for background probes. */
  persistTransportType?: boolean;
  params?: GetDeviceStateParams & {
    allowEmptyConnectId?: boolean;
  };
};

export type IDeviceManagementSnapshot = {
  state: IOneKeyDeviceState;
};

export type IUploadPro2NftParams = {
  connectId: string;
  imageJpegBase64: string;
  thumbnailJpegBase64: string;
  title: string;
  subtitle: string;
  timestampMs?: number;
};

const nullableToUndefined = (value?: string | null) => value ?? undefined;

function getPersistedDesktopBleConnectId(
  device:
    | {
        connectId?: string | null;
        usbConnectId?: string | null;
        bleConnectId?: string | null;
      }
    | undefined,
): string | undefined {
  const bleConnectId = device?.bleConnectId?.trim();
  if (!bleConnectId) {
    return undefined;
  }
  const normalizedBleConnectId = bleConnectId.toLowerCase();
  const aliasesUsbConnectId = [device?.connectId, device?.usbConnectId].some(
    (candidate) => candidate?.trim().toLowerCase() === normalizedBleConnectId,
  );
  return aliasesUsbConnectId ? undefined : bleConnectId;
}

// Evidence window for treating a caller-held connectId as a live session.
// Receiving device traffic implies the OS pairing already exists, so only
// connectIds stamped this recently may be probed by
// silentlyBindLiveDesktopBleConnectId; probing anything else could summon
// the OS pairing prompt without any app guidance UI.
const LIVE_CONNECT_ID_EVIDENCE_WINDOW_MS = 60_000;

const isOneKeyLoaderMode = (mode?: string | null) =>
  mode === EOneKeyDeviceMode.bootloader || mode === EOneKeyDeviceMode.romloader;

const supportsDedicatedFirmwareFeatures = (deviceType: IDeviceType) =>
  deviceType === EDeviceType.Touch ||
  deviceType === EDeviceType.Pro ||
  deviceType === EDeviceType.Pro2 ||
  deviceType === NEO_DEVICE_TYPE;

function buildOnekeyFeaturesFromState(
  state: IOneKeyDeviceState,
): OnekeyFeatures {
  const { verification: verify, versions } = state;

  return {
    onekey_serial_no: state.identity.serialNo,
    onekey_ble_name: state.identity.bleName || '',
    onekey_firmware_version: nullableToUndefined(versions.firmware),
    onekey_boot_version: nullableToUndefined(versions.bootloader),
    onekey_board_version: nullableToUndefined(versions.board),
    onekey_ble_version: nullableToUndefined(versions.ble),
    onekey_firmware_hash: verify?.firmwareHash,
    onekey_boot_hash: verify?.bootloaderHash,
    onekey_board_hash: verify?.boardHash,
    onekey_ble_hash: verify?.bleHash,
    onekey_firmware_build_id: verify?.firmwareBuildId,
    onekey_boot_build_id: verify?.bootloaderBuildId,
    onekey_board_build_id: verify?.boardBuildId,
    onekey_ble_build_id: verify?.bleBuildId,
    onekey_se01_version: nullableToUndefined(versions.se01 ?? versions.se),
    onekey_se02_version: nullableToUndefined(versions.se02),
    onekey_se03_version: nullableToUndefined(versions.se03),
    onekey_se04_version: nullableToUndefined(versions.se04),
    onekey_se01_hash: verify?.se01Hash,
    onekey_se02_hash: verify?.se02Hash,
    onekey_se03_hash: verify?.se03Hash,
    onekey_se04_hash: verify?.se04Hash,
    onekey_se01_build_id: verify?.se01BuildId,
    onekey_se02_build_id: verify?.se02BuildId,
    onekey_se03_build_id: verify?.se03BuildId,
    onekey_se04_build_id: verify?.se04BuildId,
    onekey_se01_boot_version: nullableToUndefined(versions.se01Boot),
    onekey_se02_boot_version: nullableToUndefined(versions.se02Boot),
    onekey_se03_boot_version: nullableToUndefined(versions.se03Boot),
    onekey_se04_boot_version: nullableToUndefined(versions.se04Boot),
    onekey_se01_boot_hash: verify?.se01BootHash,
    onekey_se02_boot_hash: verify?.se02BootHash,
    onekey_se03_boot_hash: verify?.se03BootHash,
    onekey_se04_boot_hash: verify?.se04BootHash,
    onekey_se01_boot_build_id: verify?.se01BootBuildId,
    onekey_se02_boot_build_id: verify?.se02BootBuildId,
    onekey_se03_boot_build_id: verify?.se03BootBuildId,
    onekey_se04_boot_build_id: verify?.se04BootBuildId,
  };
}

type IHandleLinuxWebUsbAccessDeniedErrorParams = {
  error?: unknown;
};

// skip events
const SKIPPED_EVENTS = new Set([
  EHardwareUiStateAction.CLOSE_UI_WINDOW,
  EHardwareUiStateAction.CLOSE_UI_PIN_WINDOW,
  EHardwareUiStateAction.PREVIOUS_ADDRESS,
  EHardwareUiStateAction.BLUETOOTH_UNSUPPORTED,
  EHardwareUiStateAction.BLUETOOTH_POWERED_OFF,
]);

const NEW_DIALOG_EVENTS = new Set([
  EHardwareUiStateAction.BLUETOOTH_PERMISSION,
  EHardwareUiStateAction.BLUETOOTH_CHARACTERISTIC_NOTIFY_CHANGE_FAILURE,
  EHardwareUiStateAction.WEB_DEVICE_PROMPT_ACCESS_PERMISSION,
]);

const LINUX_UDEV_RULES_INSTALL_RETRY_DELAY_MS = 5000;
const LINUX_UDEV_RULES_INSTALL_MAX_ATTEMPTS = 2;

@backgroundClass()
class ServiceHardware extends ServiceBase {
  private deviceStateSyncQueues = new Map<string, Promise<void>>();

  private getDeviceStateSyncKeys(values: Array<string | null | undefined>) {
    const keys = values
      .map((value) => value?.trim().toLowerCase())
      .filter((value): value is string => Boolean(value));
    return [...new Set(keys)];
  }

  async waitForDeviceStateSync({
    connectIds,
  }: {
    connectIds: Array<string | null | undefined>;
  }): Promise<void> {
    // SDK events are emitted before the corresponding call resolves. Yield once
    // so split background runtimes can register the event persistence task.
    await Promise.resolve();
    const queueKeys = this.getDeviceStateSyncKeys(connectIds);
    let tasks = queueKeys
      .map((key) => this.deviceStateSyncQueues.get(key))
      .filter((task): task is Promise<void> => Boolean(task));
    while (tasks.length > 0) {
      await Promise.all(new Set(tasks));
      tasks = queueKeys
        .map((key) => this.deviceStateSyncQueues.get(key))
        .filter((task): task is Promise<void> => Boolean(task));
    }
  }

  private async persistFirmwareSnapshot({
    connectId,
    state,
  }: {
    connectId: string | undefined;
    state: IOneKeyDeviceState;
  }) {
    const changedKeys = getValidDeviceStateVersionKeys(state);
    if (!connectId || changedKeys.length === 0) {
      return;
    }
    const syncConnectIds = [
      connectId,
      state.identity.serialNo,
      state.identity.deviceId,
    ];
    await this.waitForDeviceStateSync({ connectIds: syncConnectIds });
    const event: DeviceStateEvent = {
      changedKeys,
      connectId,
      revision: state.revision,
      source: 'device-info',
      state,
    };
    try {
      const persistResult = await localDb.updateDeviceState(event);
      await this.waitForDeviceStateSync({ connectIds: syncConnectIds });
      serviceHardwareUtils.hardwareLog('firmware read-back', {
        kind: persistResult.kind,
        protocol: state.protocol,
        revision: state.revision,
        firmwareVersion: state.versions.firmware,
      });
      if (persistResult.kind === 'updated') {
        appEventBus.emit(EAppEventBusNames.HardwareDeviceStateUpdate, event);
      }
    } catch (error) {
      serviceHardwareUtils.hardwareLog(
        'firmware read-back failed',
        devOnlyData(error instanceof Error ? error.message : error),
      );
    }
  }

  private deviceProtocolByConnectId = new Map<string, 'V1' | 'V2'>();

  private connectProtocolMigrationPromise: Promise<void> | undefined;

  private activeHardwareSDKInstance: IProtocolAwareCoreApi | undefined;

  private activeHardwareTransportType: EHardwareTransportType | undefined;

  private sdkInstanceMutex = new Semaphore(1);

  private async runInDesktopBleConnectedOnlyScope<T>({
    connectId,
    enabled,
    task,
  }: {
    connectId?: string;
    enabled?: boolean;
    task: () => Promise<T>;
  }): Promise<T> {
    if (!enabled) {
      return task();
    }
    const nobleBle = globalThis.desktopApi?.nobleBle;
    if (
      !connectId ||
      !nobleBle?.beginConnectedOnlyScope ||
      !nobleBle.endConnectedOnlyScope
    ) {
      throw new OneKeyLocalError(
        'Desktop BLE connected-only scope is unavailable',
      );
    }
    const scopeId = nobleBle.beginConnectedOnlyScope(connectId);
    try {
      return await task();
    } finally {
      nobleBle.endConnectedOnlyScope(connectId, scopeId);
    }
  }

  private bindDeviceProtocolToSDK({
    connectId,
    protocol,
    instance = this.activeHardwareSDKInstance,
  }: {
    connectId?: string | null;
    protocol?: string | null;
    instance?: IProtocolAwareCoreApi;
  }) {
    if (!connectId || (protocol !== 'V1' && protocol !== 'V2')) {
      return;
    }
    instance?.setDeviceConnectProtocol?.(connectId, protocol);
  }

  private bindRememberedDeviceProtocols(instance: IProtocolAwareCoreApi) {
    for (const [connectId, protocol] of this.deviceProtocolByConnectId) {
      this.bindDeviceProtocolToSDK({ connectId, protocol, instance });
    }
  }

  private async persistDeviceProtocols({
    connectIds,
    protocol,
  }: {
    connectIds: string[];
    protocol: 'V1' | 'V2';
  }) {
    const normalizedConnectIds = [
      ...new Set(
        connectIds
          .map((connectId) => connectId.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    if (normalizedConnectIds.length === 0) {
      return;
    }
    const updatedAt = Date.now();
    await simpleDb.appStatus.setRawData((value): ISimpleDBAppStatus => {
      const protocolByConnectId = {
        ...value?.hardwareConnectProtocolByConnectId,
      };
      for (const connectId of normalizedConnectIds) {
        protocolByConnectId[connectId] = { protocol, updatedAt };
      }
      const boundedProtocolByConnectId = Object.fromEntries(
        Object.entries(protocolByConnectId)
          .toSorted(([, left], [, right]) => right.updatedAt - left.updatedAt)
          .slice(0, MAX_PERSISTED_DEVICE_PROTOCOL_ENTRIES),
      );
      return {
        ...value,
        hardwareConnectProtocolByConnectId: boundedProtocolByConnectId,
      };
    });
  }

  private async getPersistedDeviceProtocol(connectId: string) {
    try {
      const appStatus = await simpleDb.appStatus.getRawData();
      return appStatus?.hardwareConnectProtocolByConnectId?.[
        connectId.trim().toLowerCase()
      ]?.protocol;
    } catch (error) {
      serviceHardwareUtils.hardwareLog(
        'restore device protocol from simple db failed',
        error,
      );
      return undefined;
    }
  }

  private async runExistingDeviceConnectProtocolMigration(): Promise<void> {
    const appStatus = await simpleDb.appStatus.getRawData();
    if (
      (appStatus?.hardwareConnectProtocolMigrationVersion ?? 0) >=
      HARDWARE_CONNECT_PROTOCOL_MIGRATION_VERSION
    ) {
      return;
    }

    const [{ devices }, { wallets }] = await Promise.all([
      localDb.getAllDevices(),
      localDb.getAllWallets(),
    ]);
    const hardwareDeviceIds = new Set(
      wallets
        .filter((wallet) => wallet.type === WALLET_TYPE_HW)
        .map((wallet) => wallet.associatedDevice)
        .filter((deviceId): deviceId is string => Boolean(deviceId)),
    );
    const migrations = devices.flatMap((device) => {
      if (
        !hardwareDeviceIds.has(device.id) ||
        (device.vendor ?? EHardwareVendor.onekey) !== EHardwareVendor.onekey ||
        isHardwareConnectProtocol(device.connectProtocol)
      ) {
        return [];
      }
      const observedProtocol = [
        device.deviceStateInfo?.protocol,
        device.featuresInfo?.protocol,
      ].find(isHardwareConnectProtocol);
      return [
        {
          dbDeviceId: device.id,
          // All devices from the released app use V1. Keep explicit protocol
          // evidence for internal builds without overwriting it during upgrade.
          connectProtocol: observedProtocol ?? ('V1' as const),
        },
      ];
    });

    for (const migration of migrations) {
      await localDb.updateDeviceConnectProtocol(migration);
    }
    await simpleDb.appStatus.setRawData(
      (value): ISimpleDBAppStatus => ({
        ...value,
        hardwareConnectProtocolMigrationVersion: Math.max(
          value?.hardwareConnectProtocolMigrationVersion ?? 0,
          HARDWARE_CONNECT_PROTOCOL_MIGRATION_VERSION,
        ),
      }),
    );
    serviceHardwareUtils.hardwareLog(
      'migrated existing device connect protocols',
      {
        migratedCount: migrations.length,
      },
    );
  }

  private ensureExistingDeviceConnectProtocolMigration(): Promise<void> {
    if (!this.connectProtocolMigrationPromise) {
      this.connectProtocolMigrationPromise =
        this.runExistingDeviceConnectProtocolMigration().catch((error) => {
          this.connectProtocolMigrationPromise = undefined;
          throw error;
        });
    }
    return this.connectProtocolMigrationPromise;
  }

  @backgroundMethod()
  async migrateExistingDeviceConnectProtocols(): Promise<void> {
    await this.ensureExistingDeviceConnectProtocolMigration();
  }

  /** Coalesce concurrent device-management reads for the same connection. */
  private deviceManagementSnapshotInFlight = new Map<
    string,
    Promise<IDeviceManagementSnapshot>
  >();

  private linuxUdevRulesReadyPromise: Promise<boolean> | undefined;

  private linuxUdevRulesInstallMutedUntil = 0;

  private linuxUdevRulesInstallFailedCount = 0;

  // Third-party (Trezor / Ledger) hardware adapter lifecycle + methods now live
  // in ServiceThirdPartyHardware. ServiceHardware delegates via
  // `this.backgroundApi.serviceThirdPartyHardware.*`.

  constructor(props: IServiceBaseProps) {
    super(props);
    appEventBus.on(
      EAppEventBusNames.SyncDeviceLabelToWalletName,
      this.handleHardwareLabelChanged,
    );
    appEventBus.on(
      EAppEventBusNames.UpdateWalletAvatarByDeviceSerialNo,
      this.handleHardwareAvatarChanged,
    );
  }

  private async rememberDeviceProtocol({
    connectIds,
    protocol,
  }: {
    connectIds: Array<string | null | undefined>;
    protocol?: string | null;
  }) {
    if (protocol !== 'V1' && protocol !== 'V2') {
      return;
    }
    const changedConnectIds: string[] = [];
    for (const connectId of connectIds) {
      if (connectId) {
        const previousProtocol =
          this.deviceProtocolByConnectId.get(connectId) ??
          this.deviceProtocolByConnectId.get(connectId.trim().toLowerCase());
        this.deviceProtocolByConnectId.set(connectId, protocol);
        const normalizedConnectId = connectId.trim().toLowerCase();
        if (normalizedConnectId && normalizedConnectId !== connectId) {
          this.deviceProtocolByConnectId.set(normalizedConnectId, protocol);
        }
        this.bindDeviceProtocolToSDK({ connectId, protocol });
        if (previousProtocol !== protocol) {
          changedConnectIds.push(connectId);
        }
      }
    }
    if (changedConnectIds.length > 0) {
      try {
        await this.persistDeviceProtocols({
          connectIds: changedConnectIds,
          protocol,
        });
      } catch (error) {
        serviceHardwareUtils.hardwareLog(
          'persist device protocol to simple db failed',
          error,
        );
      }
    }
  }

  private async getKnownDeviceProtocol(connectId?: string) {
    if (!connectId) {
      return undefined;
    }
    try {
      await this.ensureExistingDeviceConnectProtocolMigration();
    } catch (error) {
      serviceHardwareUtils.hardwareLog(
        'migrate existing device connect protocols failed',
        error,
      );
    }
    const cachedProtocol =
      this.deviceProtocolByConnectId.get(connectId) ??
      this.deviceProtocolByConnectId.get(connectId.trim().toLowerCase());
    if (cachedProtocol) {
      return cachedProtocol;
    }
    try {
      const device = await localDb.getDeviceByQuery({ connectId });
      let protocol =
        device?.connectProtocol ?? device?.deviceStateInfo?.protocol;
      if (protocol !== 'V1' && protocol !== 'V2') {
        protocol = await this.getPersistedDeviceProtocol(connectId);
      }
      if (
        device?.id &&
        !device.connectProtocol &&
        (protocol === 'V1' || protocol === 'V2')
      ) {
        try {
          await localDb.updateDeviceConnectProtocol?.({
            dbDeviceId: device.id,
            connectProtocol: protocol,
          });
        } catch (error) {
          serviceHardwareUtils.hardwareLog(
            'backfill device connect protocol failed',
            error,
          );
        }
      }
      await this.rememberDeviceProtocol({
        connectIds: [
          connectId,
          device?.connectId,
          device?.usbConnectId,
          device?.bleConnectId,
        ],
        protocol,
      });
      return protocol === 'V1' || protocol === 'V2' ? protocol : undefined;
    } catch (error) {
      serviceHardwareUtils.hardwareLog(
        'restore device protocol from persistence failed',
        error,
      );
      const protocol = await this.getPersistedDeviceProtocol(connectId);
      if (protocol === 'V1' || protocol === 'V2') {
        await this.rememberDeviceProtocol({
          connectIds: [connectId],
          protocol,
        });
        return protocol;
      }
      return undefined;
    }
  }

  private async waitForLegacyHardwareCallBoundary(connectId: string) {
    if ((await this.getKnownDeviceProtocol(connectId)) !== 'V2') {
      await timerUtils.wait(600);
    }
  }

  handleHardwareLabelChanged = cacheUtils.memoizee(
    async ({
      walletId,
      label,
      walletName,
    }: IAppEventBusPayload[EAppEventBusNames.SyncDeviceLabelToWalletName]) => {
      const isHw =
        accountUtils.isHwWallet({ walletId }) &&
        !accountUtils.isQrWallet({ walletId });
      if (!isHw) {
        return;
      }
      console.log('handleHardwareLabelChanged');
      // Desktop 5.0.0 hw wallet name is not synced with device label, so we need to backup it
      if (platformEnv.isDesktop && walletId && walletName && isHw) {
        const wallet = await this.backgroundApi.serviceAccount.getWalletSafe({
          walletId,
        });
        if (wallet && !accountUtils.isHwHiddenWallet({ wallet })) {
          if (walletName !== label) {
            try {
              await simpleDb.legacyWalletNames.setRawData((rawData) => {
                if (rawData?.[walletId]) {
                  return rawData;
                }
                return {
                  ...rawData,
                  [walletId]: walletName,
                };
              });
            } catch (_error) {
              //
            }
          }
        }
      }
      await this.backgroundApi.serviceAccount.setWalletNameAndAvatar({
        walletId,
        name: label,
        shouldCheckDuplicate: false,
      });
    },
    {
      maxAge: 600,
    },
  );

  private async writeBackProtocolV2DeviceLabel({
    dbDeviceId,
    label,
  }: {
    dbDeviceId: string;
    label: string;
  }) {
    try {
      const device = await localDb.getDeviceSafe(dbDeviceId);
      const currentState = device?.deviceStateInfo;
      if (
        !device ||
        currentState?.protocol !== 'V2' ||
        currentState.identity.label === label
      ) {
        return;
      }
      const revision = currentState.revision + 1;
      const updatedAt = Math.max(Date.now(), currentState.updatedAt + 1);
      const event: DeviceStateEvent = {
        connectId:
          device.connectId ||
          device.usbConnectId ||
          device.bleConnectId ||
          null,
        changedKeys: ['identity.label'],
        revision,
        source: 'settings-write',
        state: {
          ...currentState,
          identity: {
            ...currentState.identity,
            label,
          },
          revision,
          updatedAt,
        },
      };
      const persistResult = await localDb.updateDeviceState(event);
      if (persistResult.kind === 'updated') {
        appEventBus.emit(EAppEventBusNames.HardwareDeviceStateUpdate, event);
      }
    } catch (error) {
      serviceHardwareUtils.hardwareLog(
        'device label app write-back failed',
        devOnlyData(error instanceof Error ? error.message : error),
      );
    }
  }

  handleHardwareAvatarChanged = cacheUtils.memoizee(
    async ({
      walletId,
      avatarInfo,
    }: IAppEventBusPayload[EAppEventBusNames.UpdateWalletAvatarByDeviceSerialNo]) => {
      const isHw =
        accountUtils.isHwWallet({ walletId }) ||
        accountUtils.isQrWallet({ walletId });
      if (!isHw) {
        return;
      }
      console.log('handleHardwareAvatarChanged');
      await this.backgroundApi.serviceAccount.setWalletNameAndAvatar({
        walletId,
        avatar: avatarInfo,
        shouldCheckDuplicate: false,
      });
    },
    {
      maxAge: 600,
    },
  );

  hardwareVerifyManager: HardwareVerifyManager = new HardwareVerifyManager({
    backgroundApi: this.backgroundApi,
  });

  deviceSettingsManager: DeviceSettingsManager = new DeviceSettingsManager({
    backgroundApi: this.backgroundApi,
  });

  connectionManager: HardwareConnectionManager =
    HardwareConnectionManager.getInstance({
      backgroundApi: this.backgroundApi,
    });

  private registeredEvents = false;

  private registeredSdkEventsInstance: CoreApi | undefined;

  private registeredSdkDebugLogging = false;

  private sdkInstanceEpoch = 0;

  private hardwareUiEventQueue = new HardwareUiEventQueue<UiEvent>();

  private hardwareUiEventState = createHardwareUiEventState();

  private firmwareProgressConnectIdsSinceDisconnect = new Set<string>();

  private connectedDeviceTracked = new Set<string>();

  private connectedDeviceIdentityKeysByConnection = new Map<
    string,
    Set<string>
  >();

  private deviceSearchInProgressCount = 0;

  private getConnectedDeviceIdentityKeys(device: KnownDevice | undefined) {
    if (!device) {
      return [];
    }
    const deviceWithSerial = device as KnownDevice & { serialNo?: string };
    let deviceId: string | undefined;
    if (device.features) {
      try {
        deviceId = deviceUtils.getRawDeviceId({
          device: device as any,
          features: device.features,
        });
      } catch {
        // Connect events can arrive before features are complete, so fall back
        // to connectId, uuid, or serialNo.
      }
    }
    return uniq(
      [
        device.connectId,
        device.uuid,
        deviceWithSerial.serialNo,
        deviceId,
      ].filter((value): value is string => Boolean(value)),
    );
  }

  private trackConnectedDevice(device: KnownDevice | undefined): {
    identityKeys: string[];
    identityKeysChanged: boolean;
  } {
    const identityKeys = this.getConnectedDeviceIdentityKeys(device);
    const connectionKey = device?.connectId || identityKeys[0];
    if (!connectionKey || identityKeys.length === 0) {
      return { identityKeys, identityKeysChanged: false };
    }
    const existingIdentityKeys =
      this.connectedDeviceIdentityKeysByConnection.get(connectionKey);
    const identityKeysChanged =
      !existingIdentityKeys ||
      existingIdentityKeys.size !== identityKeys.length ||
      identityKeys.some((key) => !existingIdentityKeys.has(key));
    if (identityKeysChanged) {
      this.connectedDeviceIdentityKeysByConnection.set(
        connectionKey,
        new Set(identityKeys),
      );
    }
    return { identityKeys, identityKeysChanged };
  }

  private clearTrackedConnectedDevices() {
    if (this.connectedDeviceIdentityKeysByConnection.size === 0) {
      return;
    }
    // The identity map is a bg-runtime JS copy; UI runtimes cache their own
    // snapshot, so every clear must broadcast or the green indicator goes
    // stale after an SDK reset or transport switch.
    this.connectedDeviceIdentityKeysByConnection.clear();
    serviceHardwareUtils.hardwareLog('cleared all tracked connected devices');
    appEventBus.emit(
      EAppEventBusNames.HardwareConnectionStateUpdate,
      undefined,
    );
  }

  private untrackConnectedDevice(device: KnownDevice | undefined) {
    const disconnectedKeys = new Set(
      this.getConnectedDeviceIdentityKeys(device),
    );
    const removedIdentityKeys = new Set(disconnectedKeys);
    for (const [connectionKey, identityKeys] of this
      .connectedDeviceIdentityKeysByConnection) {
      if (
        disconnectedKeys.has(connectionKey) ||
        [...disconnectedKeys].some((key) => identityKeys.has(key))
      ) {
        removedIdentityKeys.add(connectionKey);
        for (const identityKey of identityKeys) {
          removedIdentityKeys.add(identityKey);
        }
        this.connectedDeviceIdentityKeysByConnection.delete(connectionKey);
      }
    }
    return [...removedIdentityKeys];
  }

  private resetHardwareUiEventQueue() {
    this.hardwareUiEventQueue.reset();
    this.hardwareUiEventState = createHardwareUiEventState();
    this.firmwareProgressConnectIdsSinceDisconnect.clear();
  }

  private firmwareManifestRefreshMutex = new Semaphore(1);

  private loadedFirmwareManifestKey: string | undefined;

  checkSdkVersionValid() {
    if (process.env.NODE_ENV !== 'production') {
      const {
        version: version1,
      } = require('@onekeyfe/hd-ble-sdk/package.json');
      const { version: version2 } = require('@onekeyfe/hd-core/package.json');
      const { version: version3 } = require('@onekeyfe/hd-shared/package.json');
      const {
        version: version4,
      } = require('@onekeyfe/hd-transport/package.json');
      const {
        version: version5,
      } = require('@onekeyfe/hd-web-sdk/package.json');
      const allVersions = {
        HARDWARE_SDK_VERSION,
        version1,
        version2,
        version3,
        version4,
        version5,
      };
      const versions = uniq(Object.values(allVersions));
      if (versions.length > 1 || !HARDWARE_SDK_VERSION) {
        throw new OneKeyLocalError(
          `Hardware SDK versions not equal: ${JSON.stringify(allVersions)}`,
        );
      }
    }
  }

  async getSDKInstance(options: IGetSDKInstanceOptions) {
    return this.sdkInstanceMutex.runExclusive(() =>
      this.getSDKInstanceWithLifecycleLock(options),
    );
  }

  private async getSDKInstanceWithLifecycleLock(
    options: IGetSDKInstanceOptions,
  ) {
    if (
      options.forceFirmwareManifestRefresh &&
      (platformEnv.isNative || platformEnv.isDesktop)
    ) {
      return this.firmwareManifestRefreshMutex.runExclusive(() =>
        this.getSDKInstanceInternal(options),
      );
    }
    return this.getSDKInstanceInternal(options);
  }

  private async getSDKInstanceInternal(options: IGetSDKInstanceOptions) {
    const { hardwareCallContext = EHardwareCallContext.USER_INTERACTION } =
      options || {};
    this.checkSdkVersionValid();
    await this.assertOneKeySdkConnectId(options?.connectId);

    // 只有搜索/onboarding 可以显式重新探测；普通业务调用必须恢复已确认协议。
    const resolvedConnectProtocol = options.forceProtocolDetection
      ? undefined
      : (options.connectProtocol ??
        (await this.getKnownDeviceProtocol(options.connectId)));
    if (
      options.connectId &&
      !resolvedConnectProtocol &&
      options.forceProtocolDetection !== true
    ) {
      throw new OneKeyLocalError(HARDWARE_CONNECT_PROTOCOL_UNAVAILABLE_MESSAGE);
    }

    const { hardwareConnectSrc } = await settingsPersistAtom.get();
    const isPreRelease =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'usePreReleaseConfig',
      );
    const debugMode =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'showDeviceDebugLogs',
      );
    const showSdkDebugLogs =
      platformEnv.isDev === true &&
      (platformEnv.isNative === true || platformEnv.isDesktop === true) &&
      debugMode === true;
    const isAppManagedManifest = Boolean(
      platformEnv.isNative || platformEnv.isDesktop,
    );
    const refreshedFirmwareManifest =
      options.forceFirmwareManifestRefresh && isAppManagedManifest
        ? await getFirmwareManifestSnapshot({
            preRelease: isPreRelease === true,
            forceRefresh: true,
          })
        : undefined;
    const refreshedFirmwareManifestKey = refreshedFirmwareManifest
      ? stringUtils.stableStringify({
          preRelease: isPreRelease === true,
          config: refreshedFirmwareManifest,
        })
      : undefined;
    if (
      refreshedFirmwareManifestKey &&
      this.loadedFirmwareManifestKey &&
      refreshedFirmwareManifestKey !== this.loadedFirmwareManifestKey
    ) {
      await resetHardwareSDKInstance();
      this.clearTrackedConnectedDevices();
      this.registeredEvents = false;
    }

    if (
      this.registeredEvents &&
      this.registeredSdkDebugLogging !== showSdkDebugLogs
    ) {
      this.resetHardwareUiEventQueue();
      this.registeredEvents = false;
    }
    this.registeredSdkDebugLogging = showSdkDebugLogs;

    const currentTransportType =
      await this.connectionManager.getCurrentTransportType();
    const { forceTransportType } = await hardwareForceTransportAtom.get();
    const isDesktopBackgroundCall =
      platformEnv.isSupportDesktopBle &&
      (hardwareCallContext === EHardwareCallContext.BACKGROUND_TASK ||
        hardwareCallContext ===
          EHardwareCallContext.BACKGROUND_NON_INTERACTIVE);
    const normalizedForceTransportType = forceTransportType
      ? deviceUtils.normalizeHardwareTransportTypeForPlatform({
          transportType: forceTransportType,
          connectProtocol: resolvedConnectProtocol,
        })
      : undefined;
    const effectiveForceTransportType =
      isDesktopBackgroundCall && options.hardwareTransportType
        ? undefined
        : normalizedForceTransportType;
    let hardwareTransportType =
      effectiveForceTransportType ??
      options.hardwareTransportType ??
      currentTransportType;
    let shouldSwitch = false;

    // Desktop Auto switch transport type
    if (
      platformEnv.isSupportDesktopBle &&
      effectiveForceTransportType === undefined &&
      options.hardwareTransportType === undefined
    ) {
      // Check if we should switch transport type based on optimal connection strategy
      const result = await this.connectionManager.shouldSwitchTransportType({
        connectId: options?.connectId,
        connectProtocol: resolvedConnectProtocol,
        hardwareCallContext,
      });
      shouldSwitch = result.shouldSwitch;
      hardwareTransportType = result.targetType;
    }

    // connectionManager 会在 UI 展示前提交选路结果，因此不能再用它的
    // currentTransportType 判断 SDK 是否需要重建。单独记录实际 SDK transport，
    // 保证显式传入的 transport + connectId 不会复用上一个 transport 实例。
    const sdkTransportChanged =
      this.activeHardwareTransportType !== undefined &&
      this.activeHardwareTransportType !== hardwareTransportType;
    if (shouldSwitch || sdkTransportChanged) {
      console.log(
        `🔄 TRANSPORT SWITCH: ${
          this.activeHardwareTransportType ?? currentTransportType ?? 'null'
        } → ${hardwareTransportType}`,
      );
      this.resetHardwareUiEventQueue();
      await resetHardwareSDKInstance();
      this.clearTrackedConnectedDevices();
      this.registeredEvents = false;
      this.activeHardwareSDKInstance = undefined;
      console.log('✅ TRANSPORT SWITCH: SDK reset completed');
    }

    // Update the connection manager's current transport type AFTER switch logic
    if (options.persistTransportType !== false) {
      await this.connectionManager.setCurrentTransportType(
        hardwareTransportType,
      );
    }

    try {
      const instance = await getHardwareSDKInstance({
        hardwareTransportType,
        // https://data.onekey.so/pre-config.json?noCache=1714090312200
        // https://data.onekey.so/config.json?nocache=0.8336416330053136
        isPreRelease: isPreRelease === true,
        hardwareConnectSrc,
        debugMode,
        loadFirmwareConfig: async () => {
          let config = refreshedFirmwareManifest;
          if (!config) {
            try {
              config = await getFirmwareManifestSnapshot({
                preRelease: isPreRelease === true,
              });
            } catch {
              this.loadedFirmwareManifestKey = stringUtils.stableStringify({
                preRelease: isPreRelease === true,
                config: null,
              });
              defaultLogger.hardware.sdkLog.log(
                'firmware_manifest_unavailable',
                isPreRelease === true ? 'pre-release' : 'stable',
              );
              return undefined;
            }
          }
          this.loadedFirmwareManifestKey = stringUtils.stableStringify({
            preRelease: isPreRelease === true,
            config,
          });
          return config;
        },
      });

      this.activeHardwareTransportType = hardwareTransportType;

      // TODO re-register events when hardwareConnectSrc or isPreRelease changed
      await this.registerSdkEvents(instance, { showSdkDebugLogs });

      const protocolAwareInstance = instance as IProtocolAwareCoreApi;
      this.activeHardwareSDKInstance = protocolAwareInstance;
      this.bindRememberedDeviceProtocols(protocolAwareInstance);
      this.bindDeviceProtocolToSDK({
        connectId: options.connectId,
        protocol: resolvedConnectProtocol,
        instance: protocolAwareInstance,
      });

      return instance;
    } catch (error) {
      if (
        hardwareCallContext !== EHardwareCallContext.BACKGROUND_NON_INTERACTIVE
      ) {
        void this.backgroundApi.serviceApp.showToast({
          method: 'error',
          title: (error as Error)?.message || 'Hardware SDK init failed',
        });
      }
      throw error;
    }
  }

  @backgroundMethod()
  async sendUiResponseToActiveSdk(response: UiResponseEvent): Promise<void> {
    // UI 回包属于当前硬件调用的延续，不能重新执行传输探测或重建 SDK。
    const instance = this.activeHardwareSDKInstance;
    if (!instance) {
      throw new OneKeyLocalError(
        'Hardware SDK active instance is unavailable for UI response.',
      );
    }
    instance.uiResponse(response);
  }

  private async assertOneKeySdkConnectId(connectId: string | undefined) {
    if (!connectId) {
      return;
    }
    const dbDevice = await localDb.getDeviceByQuery({ connectId });
    const vendor = dbDevice?.vendor;
    const vendorProfile = vendor ? getVendorProfile(vendor) : undefined;
    if (vendor && vendorProfile?.isThirdParty) {
      throw new OneKeyLocalError(
        `ServiceHardware SDK is OneKey-only; connectId "${connectId}" belongs to third-party vendor "${vendor}". Use ServiceThirdPartyHardware instead.`,
      );
    }
  }

  private async specialProcessingEvent({
    originEvent,
    usedPayload,
    isCurrent,
  }: {
    originEvent: UiEvent;
    usedPayload: IHardwareUiPayload;
    isCurrent: () => boolean;
  }): Promise<{
    uiRequestType: EHardwareUiStateAction;
    payload: IHardwareUiPayload;
  }> {
    const { supportInputPinOnSoftware: supportInputPinOnSoftwareSdk } =
      await CoreSDKLoader();

    let newUiRequestType = originEvent.type as EHardwareUiStateAction;
    const newPayload = usedPayload;

    // Handler Request Pin
    // If the user set is to enter pin on the device, change the event to enter pin on the hardware
    if (originEvent.type === EHardwareUiStateAction.REQUEST_PIN) {
      const { device, type } = originEvent.payload || {};
      const { features } = device || {};
      const dbDevice = await localDb.getDeviceByQuery({
        connectId: newPayload.connectId,
      });
      const payloadDeviceType = features
        ? await deviceUtils.getDeviceTypeFromFeatures({ features })
        : undefined;
      const requestDeviceType = dbDevice?.deviceType || payloadDeviceType;

      if (
        requestDeviceType &&
        DEVICE_PIN_ON_DEVICE_TYPES.has(requestDeviceType)
      ) {
        newUiRequestType = EHardwareUiStateAction.EnterPinOnDevice;
        if (
          originEvent.payload.type ===
          EHardwareUiStateAction.REQUEST_PIN_TYPE_PIN_ENTRY
        ) {
          newPayload.requestPinType = 'PinEntry';
        } else if (
          originEvent.payload.type ===
          EHardwareUiStateAction.REQUEST_PIN_TYPE_ATTACH_PIN
        ) {
          newPayload.requestPinType = 'AttachPin';
        }
      } else {
        const inputPinOnSoftware = features
          ? supportInputPinOnSoftwareSdk(features)
          : { support: false };
        // On-device entry is the default (OK-61489): only an explicit
        // opt-in (`true`, via the stage's switch entry or device
        // settings) routes PIN input to the app keyboard.
        const supportInputPinOnSoftware =
          dbDevice?.settings?.inputPinOnSoftware === true &&
          inputPinOnSoftware.support;

        const isAttachPin = type === 'PinMatrixRequestType_AttachToPin';
        newPayload.requestPinType = isAttachPin ? 'AttachPin' : undefined;

        if (!supportInputPinOnSoftware && isCurrent()) {
          // Offer the stage's switch-to-app entry (OK-61489) only when
          // the opt-in would actually take: a stored device record to
          // write (first-connect has none yet), a button device whose
          // firmware supports app entry, and a plain PIN request. The
          // app-pad hop reuses the REQUEST_PIN payload, so it never
          // carries this flag.
          newPayload.pinSwitchToAppAvailable =
            Boolean(dbDevice) &&
            !isAttachPin &&
            Boolean(
              requestDeviceType &&
              deviceUtils.checkInputPinOnSoftwareSupport(requestDeviceType),
            ) &&
            inputPinOnSoftware.support;
          await this.backgroundApi.serviceHardwareUI.showEnterPinOnDevice({
            responseCorrelation: newPayload.uiResponseCorrelation,
          });
          newUiRequestType = EHardwareUiStateAction.EnterPinOnDevice;
        }
      }
    }

    if (originEvent.type === EHardwareUiStateAction.FIRMWARE_TIP) {
      newPayload.firmwareTipData = originEvent.payload.data;
    }

    if (originEvent.type === EHardwareUiStateAction.FIRMWARE_PROGRESS) {
      const firmwareProgressPayload =
        originEvent.payload as typeof originEvent.payload & {
          installTargetId?: number;
          installPhase?: 'prepare' | 'install' | 'verify';
          installPhaseProgress?: number;
          transferredBytes?: number;
          totalBytes?: number;
          rateBytesPerSecond?: number;
          elapsedMs?: number;
        };
      newPayload.firmwareProgress = firmwareProgressPayload.progress;
      newPayload.firmwareProgressType = firmwareProgressPayload.progressType;
      newPayload.firmwareInstallTargetId =
        firmwareProgressPayload.installTargetId;
      newPayload.firmwareInstallPhase = firmwareProgressPayload.installPhase;
      newPayload.firmwareInstallPhaseProgress =
        firmwareProgressPayload.installPhaseProgress;
      if (
        [
          firmwareProgressPayload.transferredBytes,
          firmwareProgressPayload.totalBytes,
          firmwareProgressPayload.rateBytesPerSecond,
          firmwareProgressPayload.elapsedMs,
        ].some((value) => typeof value === 'number')
      ) {
        newPayload.firmwareTransferMetrics = {
          transferredBytes: firmwareProgressPayload.transferredBytes,
          totalBytes: firmwareProgressPayload.totalBytes,
          rateBytesPerSecond: firmwareProgressPayload.rateBytesPerSecond,
          elapsedMs: firmwareProgressPayload.elapsedMs,
        };
      }
    }

    if (originEvent.type === EHardwareUiStateAction.DEVICE_PROGRESS) {
      const {
        progress,
        transferredBytes,
        totalBytes,
        rateBytesPerSecond,
        elapsedMs,
      } = originEvent.payload;
      newPayload.deviceProgress = {
        progress,
        transferredBytes,
        totalBytes,
        rateBytesPerSecond,
        elapsedMs,
      };
    }

    if (originEvent.type === EHardwareUiStateAction.REQUEST_PASSPHRASE) {
      copyWalletSessionUiMetadata(newPayload, originEvent.payload);
    }

    return {
      uiRequestType: newUiRequestType,
      payload: newPayload,
    };
  }

  async registerSdkEvents(
    instance: CoreApi,
    {
      showSdkDebugLogs = false,
    }: {
      showSdkDebugLogs?: boolean;
    } = {},
  ) {
    if (this.registeredSdkEventsInstance !== instance) {
      this.resetHardwareUiEventQueue();
      this.clearTrackedConnectedDevices();
      this.registeredEvents = false;
    }

    if (!this.registeredEvents) {
      this.resetHardwareUiEventQueue();
      this.registeredEvents = true;
      this.registeredSdkEventsInstance = instance;
      this.registeredSdkDebugLogging = showSdkDebugLogs;
      this.sdkInstanceEpoch += 1;
      const sdkInstanceEpoch = this.sdkInstanceEpoch;
      let deviceStateEventSequence = 0;
      const {
        UI_EVENT,
        DEVICE,
        LOG_EVENT,
        FIRMWARE,
        FIRMWARE_EVENT,
        // UI_REQUEST,
      } = await CoreSDKLoader();
      instance.on(UI_EVENT, (e) => {
        if (e.type === EHardwareUiStateAction.FIRMWARE_PROGRESS) {
          const connectId = e.payload?.device?.connectId;
          if (connectId) {
            this.firmwareProgressConnectIdsSinceDisconnect.add(connectId);
          }
        }
        return this.hardwareUiEventQueue
          .enqueue(e as UiEvent, async (queuedEvent, { isCurrent }) => {
            const originEvent = queuedEvent;
            const { type: uiRequestType, payload } = queuedEvent;
            // console.log('=>>>> UI_EVENT: ', uiRequestType, payload);
            defaultLogger.hardware.sdkLog.uiEvent(uiRequestType, payload);

            const eventPayload =
              payload && typeof payload === 'object'
                ? (payload as {
                    device?: {
                      deviceType?: IDeviceType | null;
                      connectId?: string | null;
                      deviceId?: string | null;
                      features?: IOneKeyDeviceFeatures;
                    };
                    type?: string;
                    passphraseState?: string;
                    responseCorrelation?: {
                      interactionId?: unknown;
                      deviceId?: unknown;
                    };
                  })
                : undefined;
            const {
              device,
              type: eventType,
              passphraseState,
              responseCorrelation,
            } = eventPayload || {};
            const { deviceType, connectId, deviceId, features } = device || {};
            const deviceMode = features
              ? await this.getDeviceModeFromFeatures({ features })
              : EOneKeyDeviceMode.normal;
            if (!isCurrent()) {
              return;
            }
            const isBootloaderMode = isOneKeyLoaderMode(deviceMode);

            const usedPayload: IHardwareUiPayload = {
              uiRequestType,
              eventType: eventType ?? '',
              deviceType: deviceType ?? EDeviceType.Unknown,
              deviceId: deviceId ?? '',
              connectId: connectId ?? '',
              deviceMode,
              isBootloaderMode: Boolean(isBootloaderMode),
              passphraseState,
              uiResponseCorrelation:
                typeof responseCorrelation?.interactionId === 'string' &&
                typeof responseCorrelation.deviceId === 'string'
                  ? {
                      interactionId: responseCorrelation.interactionId,
                      deviceId: responseCorrelation.deviceId,
                    }
                  : undefined,
              rawPayload: payload,
            };

            const { uiRequestType: newUiRequestType, payload: newPayload } =
              await this.specialProcessingEvent({
                originEvent,
                usedPayload,
                isCurrent,
              });
            if (!isCurrent()) {
              return;
            }

            const reduction = reduceHardwareUiEventState(
              this.hardwareUiEventState,
              {
                type: uiRequestType as EHardwareUiStateAction,
                renderAction: newUiRequestType,
                connectId: connectId ?? undefined,
                payload,
              },
            );
            this.hardwareUiEventState = reduction.state;
            if (!reduction.applied || !reduction.action) {
              return;
            }
            const appliedUiRequestType = reduction.action;
            const appliedConnectId =
              reduction.connectId ?? connectId ?? newPayload.connectId;
            const appliedPayload: IHardwareUiPayload =
              appliedUiRequestType === EHardwareUiStateAction.ProcessLoading
                ? {
                    ...newPayload,
                    uiRequestType: appliedUiRequestType,
                    connectId: appliedConnectId,
                  }
                : newPayload;

            // >>> mock hardware forceInputOnDevice
            // if (usedPayload) {
            //   usedPayload.supportInputPinOnSoftware = false;
            // }

            // Matching Protocol V2 closes clear the active state directly.
            // Legacy metadata-less closes remain skipped to avoid the old
            // close -> cancel -> close loop.
            if (reduction.shouldClearUiState) {
              await hardwareUiStateAtom.set(undefined);
            } else if (!SKIPPED_EVENTS.has(appliedUiRequestType)) {
              defaultLogger.hardware.sdkLog.updateHardwareUiStateAtom({
                action: appliedUiRequestType,
                connectId: appliedConnectId,
                payload: appliedPayload,
              });

              if (NEW_DIALOG_EVENTS.has(appliedUiRequestType)) {
                appEventBus.emit(EAppEventBusNames.RequestHardwareUIDialog, {
                  uiRequestType: appliedUiRequestType,
                });
              } else if (
                appliedUiRequestType ===
                EHardwareUiStateAction.REQUEST_DEVICE_IN_BOOTLOADER_FOR_WEB_DEVICE
              ) {
                appEventBus.emit(
                  EAppEventBusNames.RequestDeviceInBootloaderForWebDevice,
                  undefined,
                );
              } else if (
                appliedUiRequestType ===
                EHardwareUiStateAction.REQUEST_DEVICE_FOR_SWITCH_FIRMWARE_WEB_DEVICE
              ) {
                appEventBus.emit(
                  EAppEventBusNames.RequestDeviceForSwitchFirmwareWebDevice,
                  undefined,
                );
              } else {
                // show hardware ui dialog
                await hardwareUiStateAtom.set(
                  (previousState): IHardwareUiState => {
                    const isSameFirmwareDevice =
                      previousState?.connectId === appliedConnectId;
                    let firmwarePayload = appliedPayload;
                    if (
                      isSameFirmwareDevice &&
                      appliedUiRequestType ===
                        EHardwareUiStateAction.FIRMWARE_PROGRESS
                    ) {
                      firmwarePayload = {
                        ...appliedPayload,
                        firmwareTipData:
                          previousState?.payload?.firmwareTipData,
                        firmwareTransferMetrics:
                          appliedPayload.firmwareTransferMetrics ??
                          previousState?.payload?.firmwareTransferMetrics,
                      };
                    } else if (
                      isSameFirmwareDevice &&
                      appliedUiRequestType ===
                        EHardwareUiStateAction.FIRMWARE_TIP
                    ) {
                      firmwarePayload = {
                        ...appliedPayload,
                        firmwareProgress:
                          previousState?.payload?.firmwareProgress,
                        firmwareProgressType:
                          previousState?.payload?.firmwareProgressType,
                        firmwareInstallTargetId:
                          previousState?.payload?.firmwareInstallTargetId,
                        firmwareInstallPhase:
                          previousState?.payload?.firmwareInstallPhase,
                        firmwareInstallPhaseProgress:
                          previousState?.payload?.firmwareInstallPhaseProgress,
                        firmwareTransferMetrics:
                          previousState?.payload?.firmwareTransferMetrics,
                      };
                    }
                    return {
                      action: appliedUiRequestType,
                      connectId: appliedConnectId,
                      payload: firmwarePayload,
                    };
                  },
                );
                if (!isCurrent()) {
                  return;
                }
              }
            }
            if (!isCurrent()) {
              return;
            }
            await hardwareUiStateCompletedAtom.set((previousState) => ({
              action: appliedUiRequestType,
              connectId: appliedConnectId,
              payload: {
                ...appliedPayload,
                firmwareTransferMetrics:
                  appliedPayload.firmwareTransferMetrics ??
                  (previousState?.connectId === appliedConnectId
                    ? previousState.payload?.firmwareTransferMetrics
                    : undefined),
              },
            }));
            // OK-59934: feed the DeviceStage burst scope. It ignores events
            // while disabled; call-end closes morph to processing inside a
            // burst instead of exiting the stage.
            void this.backgroundApi.serviceHardwareUI.deviceStageBurst.onHardwareUiEvent(
              {
                action: appliedUiRequestType,
                connectId: appliedConnectId,
                payload: appliedPayload,
                shouldClearUiState: Boolean(reduction.shouldClearUiState),
                askCompleted: Boolean(reduction.askCompleted),
              },
            );
          })
          .catch((error: unknown) => {
            defaultLogger.hardware.sdkLog.log(
              'hardware-ui-event-queue',
              error instanceof Error ? error.message : 'Unknown event error',
            );
          });
      });

      instance.on(DEVICE.STATE, async (event: DeviceStateEvent) => {
        this.recordLiveConnectIdEvidence(event.connectId);
        deviceStateEventSequence += 1;
        const sdkEventSequence = deviceStateEventSequence;
        serviceHardwareUtils.hardwareLog('device state update', {
          revision: event.revision,
          source: event.source,
          changedKeys: event.changedKeys,
          // Device identifiers must stay masked in persisted logs (see the
          // PRO2_SERIAL contract in ServiceHardware.pro2DeviceManagement
          // tests); the suffix is enough to correlate multi-device sessions.
          connectId: serviceHardwareUtils.maskLogIdentifier(event.connectId),
          serialNo: serviceHardwareUtils.maskLogIdentifier(
            event.state?.identity?.serialNo,
          ),
          // The device-reported language is the key evidence for language
          // sync issues (OK-60121); keep it visible in persisted logs.
          language: event.state?.settings?.language,
          updatedAt: event.state?.updatedAt,
        });
        const queueKeys = this.getDeviceStateSyncKeys([
          event.state.identity.serialNo,
          event.state.identity.deviceId,
          event.connectId,
        ]);
        const previousTasks = queueKeys
          .map((key) => this.deviceStateSyncQueues.get(key))
          .filter((task): task is Promise<void> => Boolean(task));
        const task = Promise.all(new Set(previousTasks))
          .catch(() => undefined)
          .then(async () => {
            let persistenceResult:
              | Awaited<ReturnType<typeof localDb.updateDeviceState>>
              | undefined;
            try {
              persistenceResult = await localDb.updateDeviceState({
                ...event,
                sdkEventSequence,
                sdkInstanceEpoch,
              });
            } catch (error) {
              serviceHardwareUtils.hardwareLog(
                'device state persistence failed',
                devOnlyData(error instanceof Error ? error.message : error),
              );
            }
            serviceHardwareUtils.hardwareLog('device state persist result', {
              kind: persistenceResult?.kind ?? 'unknown',
              reason:
                persistenceResult?.kind === 'ignored'
                  ? persistenceResult.reason
                  : undefined,
              revision: event.revision,
              source: event.source,
              eventLanguage: event.state?.settings?.language,
              persistedLanguage:
                persistenceResult?.kind === 'updated'
                  ? persistenceResult.state.settings?.language
                  : undefined,
            });
            if (persistenceResult?.kind === 'identity-mismatch') {
              await this.backgroundApi.serviceHardwarePortfolioSync
                ?.notifyHardwareDeviceIdentityMismatch({
                  deviceDbId: persistenceResult.deviceDbId,
                  expectedDeviceId: persistenceResult.currentDeviceId,
                })
                .catch(() => undefined);
              return;
            }
            if (
              persistenceResult?.kind === 'ignored' &&
              persistenceResult.reason === 'stale'
            ) {
              return;
            }
            await this.rememberDeviceProtocol({
              connectIds: [event.connectId, event.state.identity.serialNo],
              protocol: event.state.protocol,
            });
            try {
              appEventBus.emit(
                EAppEventBusNames.HardwareDeviceStateUpdate,
                event,
              );
            } catch (error) {
              serviceHardwareUtils.hardwareLog(
                'device state subscriber failed',
                devOnlyData(error instanceof Error ? error.message : error),
              );
            }
          });
        for (const queueKey of queueKeys) {
          this.deviceStateSyncQueues.set(queueKey, task);
        }
        try {
          await task;
        } finally {
          for (const queueKey of queueKeys) {
            if (this.deviceStateSyncQueues.get(queueKey) === task) {
              this.deviceStateSyncQueues.delete(queueKey);
            }
          }
        }
      });

      instance.on(
        DEVICE.SUPPORT_FEATURES,
        (message: DeviceSupportFeaturesPayload) => {
          const { features } = message.device || {};
          if (
            !features ||
            !deviceUtils.getRawDeviceId({
              device: message.device as any,
              features,
            })
          ) {
            return;
          }

          // DEVICE.CONNECT can fire before features are complete, so the
          // tracked identity may miss the raw deviceId; re-track once features
          // arrive so deviceId-based consumers see the device as connected.
          const { identityKeysChanged } = this.trackConnectedDevice(
            message.device ?? undefined,
          );
          if (identityKeysChanged) {
            appEventBus.emit(
              EAppEventBusNames.HardwareConnectionStateUpdate,
              undefined,
            );
          }

          // TODO: save features to dbDevice
          // Full features dumps are dev-only; production logs keep the event
          // name without the device blob.
          serviceHardwareUtils.hardwareLog(
            'features update',
            devOnlyData(features),
          );

          void localDb.updateDevice({
            features,
          });
        },
      );

      instance.on(DEVICE.CONNECT, (message: { device: KnownDevice }) => {
        this.recordLiveConnectIdEvidence(message.device?.connectId);
        const { identityKeys: connectedIdentityKeys } =
          this.trackConnectedDevice(message.device);
        if (connectedIdentityKeys.length > 0) {
          appEventBus.emit(
            EAppEventBusNames.HardwareConnectionStateUpdate,
            undefined,
          );
          void this.backgroundApi.serviceHardwarePortfolioSync
            ?.notifyHardwareDeviceConnected({
              identityKeys: connectedIdentityKeys,
            })
            .catch(() => undefined);
        }
        const activeConnectId = message.device?.connectId;
        const serialNo = (
          message.device as KnownDevice & {
            serialNo?: string;
          }
        )?.serialNo;
        const { features } = message.device || {};
        void this.rememberDeviceProtocol({
          connectIds: [activeConnectId, serialNo || message.device?.uuid],
          protocol: message.device?.state?.protocol ?? features?.protocol,
        });
        const deviceId = features
          ? deviceUtils.getRawDeviceId({
              device: message.device as any,
              features,
            })
          : '';
        if (!features || !deviceId) return;

        void (async () => {
          try {
            // Short-circuit for devices already fully processed
            if (this.connectedDeviceTracked.has(deviceId)) return;

            const deviceType = await deviceUtils.getDeviceTypeFromFeatures({
              features,
            });
            if (
              deviceType !== EDeviceType.Pro &&
              deviceType !== EDeviceType.Classic1s &&
              deviceType !== EDeviceType.ClassicPure
            ) {
              // Mark ineligible devices to avoid repeated async checks on reconnect
              this.connectedDeviceTracked.add(deviceId);
              return;
            }
            const firmwareType = await deviceUtils.getFirmwareType({
              features,
            });
            const firmwareTypeStr =
              firmwareType === EFirmwareType.BitcoinOnly
                ? 'btconly'
                : 'universal';
            const trackingKey = `${deviceId}_${firmwareTypeStr}`;
            if (this.connectedDeviceTracked.has(trackingKey)) return;
            defaultLogger.hardware.connection.hwDeviceConnected({
              deviceType,
              firmwareType: firmwareTypeStr,
              deviceId,
            });
            this.connectedDeviceTracked.add(trackingKey);
          } catch (_e) {
            // ignore tracking errors — device not marked, so retry is possible
          }
        })();
      });

      instance.on(DEVICE.DISCONNECT, (message: { device: KnownDevice }) => {
        // A disconnect ends the "connected and OS-paired right now" proof:
        // factory reset and OS-level unpair both surface as a disconnect
        // first, so the silent BLE bind probe must not trust this endpoint
        // again until new traffic re-stamps it.
        this.clearLiveConnectIdEvidence(message.device?.connectId);
        const disconnectedIdentityKeys = this.untrackConnectedDevice(
          message.device,
        );
        // The whole eviction path used to be silent, so a disconnect that
        // never arrived and one that simply left no trace looked identical in
        // collected logs (OK-60486).
        serviceHardwareUtils.hardwareLog('device disconnected, untracked', {
          // Persisted logs ship with user feedback, so the identifier stays
          // masked; the suffix is enough to correlate a multi-device session.
          connectId: serviceHardwareUtils.maskLogIdentifier(
            message.device?.connectId,
          ),
          removedIdentityKeyCount: disconnectedIdentityKeys.length,
        });
        if (disconnectedIdentityKeys.length > 0) {
          appEventBus.emit(
            EAppEventBusNames.HardwareConnectionStateUpdate,
            undefined,
          );
          void this.backgroundApi.serviceHardwarePortfolioSync
            ?.notifyHardwareDeviceDisconnected({
              identityKeys: disconnectedIdentityKeys,
            })
            .catch(() => undefined);
        }
        const activeConnectId = message.device?.connectId;
        if (activeConnectId) {
          if (this.hardwareUiEventState.connectId === activeConnectId) {
            if (
              !this.firmwareProgressConnectIdsSinceDisconnect.delete(
                activeConnectId,
              )
            ) {
              this.resetHardwareUiEventQueue();
            }
          }
        }
      });

      // TODO how to emit this event?
      // call getFeatures() or checkFirmwareRelease();
      instance.on(FIRMWARE_EVENT, (messages: CoreMessage) => {
        if (SKIP_APP_FIRMWARE_UPDATE_EVENT) {
          return;
        }

        if (messages.type === FIRMWARE.RELEASE_INFO) {
          const payload: IFirmwareReleasePayload = {
            ...messages.payload,
            features: messages?.payload?.device?.features,
            connectId: messages?.payload?.device?.connectId ?? undefined,
          };
          serviceHardwareUtils.hardwareLog(
            'FIRMWARE_EVENT>RELEASE_INFO: ',
            payload,
          );
          void this.backgroundApi.serviceFirmwareUpdate.setFirmwareUpdateInfo(
            payload,
          );
        }
        if (messages.type === FIRMWARE.BLE_RELEASE_INFO) {
          const payload: IBleFirmwareReleasePayload = {
            ...messages.payload,
            features: messages?.payload?.device?.features,
            connectId: messages?.payload?.device?.connectId ?? undefined,
          };
          serviceHardwareUtils.hardwareLog(
            'FIRMWARE_EVENT>BLE_RELEASE_INFO: ',
            payload,
          );
          void this.backgroundApi.serviceFirmwareUpdate.setBleFirmwareUpdateInfo(
            payload,
          );
        }
      });

      instance.on(
        LOG_EVENT,
        (messages: { event: string; type: string; payload: string[] }) => {
          const messageType =
            messages.payload.length > 0 ? messages.payload[0] : '';
          const message = messages.payload.join(' ');

          if (showSdkDebugLogs) {
            try {
              writeHardwareSdkDebugLog(message);
            } catch {
              // Debug logging must never interrupt hardware communication.
            }
          }

          if (
            messageType.includes('@onekey/hd-core') ||
            messageType.includes('@onekey/hd-transport') ||
            messageType.includes('@onekey/hd-ble-transport')
          ) {
            defaultLogger.hardware.sdkLog.log(messages.event, message);
          }
        },
      );
    }
  }

  @backgroundMethod()
  async init() {
    await this.getSDKInstance({
      hardwareCallContext: EHardwareCallContext.SDK_INITIALIZATION,
      connectId: undefined,
    });
  }

  @backgroundMethod()
  async resetHardwareSDK() {
    await this.backgroundApi.serviceHardwareUI.runExclusiveOneKeyOperation(() =>
      this.sdkInstanceMutex.runExclusive(async () => {
        this.resetHardwareUiEventQueue();
        this.clearTrackedConnectedDevices();
        this.registeredEvents = false;
        await resetHardwareSDKInstance();
        this.activeHardwareSDKInstance = undefined;
        this.activeHardwareTransportType = undefined;
      }),
    );
  }

  @backgroundMethod()
  async passHardwareEventsFromOffscreenToBackground(eventMessage: CoreMessage) {
    const sdk = await this.getSDKInstance({
      connectId: undefined,
    });
    sdk.emit(eventMessage.event, eventMessage);
  }

  /**
   * Receiver for the typed offscreen → SW event channel.
   * `offscreenEventBus.emitOffscreenEventToBackground` on the offscreen side
   * routes all event types through this single method; we just hand them off
   * to the bus dispatcher, which fans out to per-type subscribers registered
   * elsewhere in SW (e.g. in ServiceHardware constructors or jotai atoms).
   */
  @backgroundMethod()
  async passThirdPartyHardwareEventsFromOffscreenToBackground<
    K extends IOffscreenEventType,
  >(message: { type: K; payload: IOffscreenEventMap[K] }) {
    dispatchOffscreenEvent(message.type, message.payload);
  }

  @backgroundMethod()
  async getDeviceByConnectId({ connectId }: { connectId: string }) {
    return localDb.getDeviceByQuery({
      connectId,
    });
  }

  // Pre-warm the device before signing. Fire-and-forget signal; the SDK handles
  // all concurrency (dedup + hang-up so the real Sign waits, not interrupts).
  // Resolve the SAME connectId/passphraseState the Sign uses so the pre-init
  // meta matches and Sign can skip Initialize. Hardware-only; failures swallowed.
  @backgroundMethod()
  async preInitializeDeviceForSign({
    walletId,
  }: {
    walletId: string | undefined;
  }): Promise<void> {
    if (!walletId || !accountUtils.isHwWallet({ walletId })) {
      return;
    }
    try {
      const deviceParams =
        await this.backgroundApi.serviceAccount.getWalletDeviceParams({
          walletId,
          hardwareCallContext: EHardwareCallContext.SILENT_CALL,
        });
      if (
        getVendorProfile(
          deviceParams?.dbDevice?.vendor ?? EHardwareVendor.onekey,
        ).isThirdParty
      ) {
        return;
      }
      const connectId = deviceParams?.dbDevice?.connectId;
      if (!connectId) {
        return;
      }
      const sdk = await this.getSDKInstance({
        connectId,
        hardwareCallContext: EHardwareCallContext.SILENT_CALL,
      });
      await sdk.preInitialize(connectId, {
        ...deviceParams?.deviceCommonParams,
      });
    } catch (error) {
      // Pre-warm is best-effort; a failure must never block the real Sign.
      // Use the hardware scope (LogToLocal) so it lands in collected/exported logs.
      defaultLogger.hardware.sdkLog.log(
        'preInitializeDeviceForSign error',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  // startDeviceScan
  // TODO use convertDeviceResponse()
  @backgroundMethod()
  async stopDeviceScan() {
    if (!platformEnv.isSupportDesktopBle) {
      return;
    }
    await globalThis.desktopApi?.nobleBle?.stopScan();
  }

  @backgroundMethod()
  async isDeviceSearchInProgress() {
    return this.deviceSearchInProgressCount > 0;
  }

  @backgroundMethod()
  async getConnectedHardwareDeviceIdentityKeys() {
    return [
      ...new Set(
        [...this.connectedDeviceIdentityKeysByConnection.values()].flatMap(
          (identityKeys) => [...identityKeys],
        ),
      ),
    ];
  }

  @backgroundMethod()
  async isHardwareDeviceConnected({
    deviceDbId,
    connectId,
  }: {
    deviceDbId?: string;
    connectId?: string;
  }) {
    const dbDevice = deviceDbId
      ? await localDb.getDeviceSafe(deviceDbId)
      : undefined;
    const targetIdentityKeys = new Set(
      uniq(
        [
          connectId,
          dbDevice?.connectId,
          dbDevice?.usbConnectId,
          dbDevice?.bleConnectId,
          dbDevice?.deviceId,
          dbDevice?.uuid,
        ].filter((value): value is string => Boolean(value)),
      ),
    );
    if (targetIdentityKeys.size === 0) {
      return false;
    }

    const isTrackedAsConnected = [
      ...this.connectedDeviceIdentityKeysByConnection.values(),
    ].some((connectedIdentityKeys) =>
      [...targetIdentityKeys].some((key) => connectedIdentityKeys.has(key)),
    );
    if (isTrackedAsConnected) {
      return true;
    }

    // Match the wallet-list connection dot: WebUSB must enumerate the target
    // device itself, not just "any OneKey device", otherwise connecting device
    // B would wrongly authorize device A.
    if (platformEnv.isSupportWebUSB) {
      try {
        const usb = globalThis?.navigator?.usb;
        if (usb && typeof usb.getDevices === 'function') {
          const devices = await usb.getDevices();
          return devices.some(
            (device) =>
              Boolean(device.serialNumber) &&
              targetIdentityKeys.has(device.serialNumber as string),
          );
        }
      } catch {
        return false;
      }
    }

    return false;
  }

  @backgroundMethod()
  async searchDevices(params?: {
    connectProtocol?: HardwareConnectProtocol;
    vendor?: EHardwareVendor;
    resetSession?: boolean;
    waitForAllTransports?: boolean;
    transportType?: 'usb' | 'ble';
  }) {
    this.deviceSearchInProgressCount += 1;
    try {
      const vendorProfile = params?.vendor
        ? getVendorProfile(params.vendor)
        : undefined;
      if (params?.vendor && vendorProfile?.isThirdParty) {
        // Third-party (Trezor / Ledger) discovery lives in ServiceThirdPartyHardware.
        return await this.backgroundApi.serviceThirdPartyHardware.searchDevices(
          {
            vendor: params.vendor,
            resetSession: params.resetSession,
            waitForAllTransports: params.waitForAllTransports,
            transportType: params.transportType,
          },
        );
      }

      // OneKey device discovery must also resolve the transport through the
      // unified connection manager. searchDevices enumerates only the current
      // SDK transport and does not switch from USB to BLE, so probe USB first
      // and fall back to BLE before creating the SDK instance.
      const hardwareTransportType = await this.prepareHardwareTransport({
        connectProtocol: params?.connectProtocol,
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
        ...(params?.transportType
          ? { requestedTransportType: params.transportType }
          : {}),
      });
      const hardwareSDK = await this.getSDKInstance({
        connectId: undefined,
        connectProtocol: params?.connectProtocol,
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
        hardwareTransportType,
      });
      const response = await hardwareSDK?.searchDevices();
      defaultLogger.hardware.sdkLog.log(
        'searchDevices response: ',
        JSON.stringify(response),
      );

      // Linux may surface missing udev rules either through libusb or Chromium
      // WebUSB errors, depending on the active transport path.
      if (response?.success === false) {
        // Normal Linux desktop (AppImage/.deb): install the rules via PolicyKit
        // and retry once, so the user doesn't have to restart the app.
        if (await this.recoverLinuxWebUsbAccessDeniedError(response.payload)) {
          const retryResponse = await hardwareSDK?.searchDevices();
          defaultLogger.hardware.sdkLog.log(
            'searchDevices response after udev rules: ',
            JSON.stringify(retryResponse),
          );
          return retryResponse;
        }
      }
      return response;
    } finally {
      this.deviceSearchInProgressCount = Math.max(
        this.deviceSearchInProgressCount - 1,
        0,
      );
    }
  }

  private async ensureLinuxUdevRules() {
    if (!this.isDesktopLinuxRuntime()) {
      return false;
    }
    // Sandboxed builds cannot reach the host PolicyKit/udev to auto-install the
    // rules; the missing-rules case is surfaced to the user via
    // notifyLinuxUdevManualInstallIfNeeded() instead.
    if (
      this.isDesktopLinuxSnapRuntime() ||
      this.isDesktopLinuxFlatpakRuntime()
    ) {
      return false;
    }

    if (
      this.linuxUdevRulesInstallFailedCount >=
      LINUX_UDEV_RULES_INSTALL_MAX_ATTEMPTS
    ) {
      this.notifyLinuxUdevManualInstallIfNeeded({
        force: true,
        reason: 'webusb-access-denied',
      });
      return false;
    }

    if (Date.now() < this.linuxUdevRulesInstallMutedUntil) {
      return false;
    }

    if (!this.linuxUdevRulesReadyPromise) {
      this.linuxUdevRulesReadyPromise = this.installLinuxUdevRules().then(
        (ready) => {
          if (!ready) {
            this.linuxUdevRulesReadyPromise = undefined;
          }
          return ready;
        },
      );
    }

    return this.linuxUdevRulesReadyPromise;
  }

  private async recoverLinuxWebUsbAccessDeniedError(error: unknown) {
    if (!this.isDesktopLinuxRuntime()) {
      return false;
    }
    if (!this.isLinuxWebUsbAccessDeniedError(error)) {
      return false;
    }

    if (await this.ensureLinuxUdevRules()) {
      return true;
    }

    this.notifyLinuxUdevManualInstallIfNeeded();
    return false;
  }

  @backgroundMethod()
  async handleLinuxWebUsbAccessDeniedError(
    params?: IHandleLinuxWebUsbAccessDeniedErrorParams,
  ) {
    if (await this.recoverLinuxWebUsbAccessDeniedError(params?.error)) {
      defaultLogger.hardware.sdkLog.log(
        '[LinuxWebUSB] OneKey udev rules installed after WebUSB access denied',
      );
      return true;
    }
    return false;
  }

  private isDesktopLinuxRuntime() {
    return (
      platformEnv.isDesktopLinux || globalThis.desktopApi?.platform === 'linux'
    );
  }

  private getDesktopLinuxRuntimeChannel() {
    return globalThis.desktopApi?.channel || '';
  }

  private isDesktopLinuxSnapRuntime() {
    return (
      platformEnv.isDesktopLinuxSnap ||
      (this.isDesktopLinuxRuntime() &&
        this.getDesktopLinuxRuntimeChannel() === 'snap')
    );
  }

  private isDesktopLinuxFlatpakRuntime() {
    return (
      platformEnv.isDesktopLinuxFlatpak ||
      (this.isDesktopLinuxRuntime() &&
        this.getDesktopLinuxRuntimeChannel() === 'flatpak')
    );
  }

  private getLinuxUdevManualInstallReason(): ILinuxUdevGuideReason {
    if (this.isDesktopLinuxFlatpakRuntime()) {
      return 'flatpak';
    }
    if (this.isDesktopLinuxSnapRuntime()) {
      return 'snap';
    }
    return 'webusb-access-denied';
  }

  private getErrorText(error: unknown) {
    const parts: string[] = [];
    const append = (value: unknown) => {
      if (typeof value === 'string') {
        parts.push(value);
      } else if (value instanceof Error) {
        parts.push(value.message);
      }
    };

    append(error);
    if (error && typeof error === 'object') {
      const errorRecord = error as Record<string, unknown>;
      append(errorRecord.message);
      append(errorRecord.error);

      const payload = errorRecord.payload;
      if (payload && typeof payload === 'object') {
        const payloadRecord = payload as Record<string, unknown>;
        append(payloadRecord.message);
        append(payloadRecord.error);
      }
    }

    return parts.join(' ');
  }

  private isLinuxWebUsbAccessDeniedError(error: unknown) {
    const message = this.getErrorText(error);
    const lowerMessage = message.toLowerCase();
    return (
      lowerMessage.includes('libusb_error_access') ||
      (lowerMessage.includes('access denied') &&
        (lowerMessage.includes('usbdevice') ||
          lowerMessage.includes('acquire error') ||
          (lowerMessage.includes('failed to execute') &&
            lowerMessage.includes('open'))))
    );
  }

  private async installLinuxUdevRules() {
    try {
      const result =
        await globalThis.desktopApiProxy?.system?.installOneKeyUdevRules?.();
      if (result?.installed) {
        this.linuxUdevRulesInstallFailedCount = 0;
        this.linuxUdevRulesInstallMutedUntil = 0;
        defaultLogger.hardware.sdkLog.log(
          '[LinuxWebUSB] OneKey udev rules ready',
          JSON.stringify(result),
        );
        return true;
      }
      if (result) {
        defaultLogger.hardware.sdkLog.log(
          '[LinuxWebUSB] OneKey udev rules not installed',
          JSON.stringify(result),
        );
        if (result.skippedReason === 'cancelled') {
          this.linuxUdevRulesInstallMutedUntil =
            Date.now() + LINUX_UDEV_RULES_INSTALL_RETRY_DELAY_MS;
          return false;
        }
        const shouldShowManualGuide =
          this.markLinuxUdevRulesInstallFailed() ||
          result.needsManualInstall ||
          result.skippedReason === 'missing-pkexec';
        if (shouldShowManualGuide) {
          this.notifyLinuxUdevManualInstallIfNeeded({
            force: true,
            reason:
              result.needsManualInstall ||
              result.skippedReason === 'missing-pkexec'
                ? result.skippedReason
                : 'webusb-access-denied',
          });
        }
      } else if (this.markLinuxUdevRulesInstallFailed()) {
        this.notifyLinuxUdevManualInstallIfNeeded({
          force: true,
          reason: 'webusb-access-denied',
        });
      }
    } catch (error) {
      defaultLogger.hardware.sdkLog.log(
        '[LinuxWebUSB] Failed to install OneKey udev rules',
        error instanceof Error ? error.message : String(error),
      );
      if (this.markLinuxUdevRulesInstallFailed()) {
        this.notifyLinuxUdevManualInstallIfNeeded({
          force: true,
          reason: 'failed',
        });
      }
    }
    return false;
  }

  private markLinuxUdevRulesInstallFailed() {
    this.linuxUdevRulesInstallFailedCount += 1;
    this.linuxUdevRulesInstallMutedUntil =
      Date.now() + LINUX_UDEV_RULES_INSTALL_RETRY_DELAY_MS;
    return (
      this.linuxUdevRulesInstallFailedCount >=
      LINUX_UDEV_RULES_INSTALL_MAX_ATTEMPTS
    );
  }

  // Emit at most once per session so repeated device scans don't spam the
  // guide dialog.
  private linuxUdevGuideShown = false;

  private notifyLinuxUdevManualInstallIfNeeded(options?: {
    force?: boolean;
    reason?: ILinuxUdevGuideReason;
  }) {
    if (this.linuxUdevGuideShown) {
      return;
    }
    // Only sandboxed builds need the manual-install guide; normal Linux desktop
    // installs the rules automatically via PolicyKit unless PolicyKit helpers
    // are unavailable on the host.
    if (
      !options?.force &&
      !this.isDesktopLinuxFlatpakRuntime() &&
      !this.isDesktopLinuxSnapRuntime()
    ) {
      return;
    }
    this.linuxUdevGuideShown = true;
    let reason: ILinuxUdevGuideReason = options?.reason ?? 'unknown';
    if (!options?.reason) {
      if (this.isDesktopLinuxFlatpakRuntime()) {
        reason = 'flatpak';
      } else if (this.isDesktopLinuxSnapRuntime()) {
        reason = 'snap';
      }
    }
    defaultLogger.hardware.sdkLog.log(
      `[LinuxWebUSB] host udev rules need manual install (${reason}); showing manual install guide`,
    );
    appEventBus.emit(EAppEventBusNames.ShowLinuxBundleUdevGuide, { reason });
  }

  @backgroundMethod()
  async connectDevice(params: IDeviceGetFeaturesOptions) {
    if (params.vendor && params.vendor !== EHardwareVendor.onekey) {
      throw new OneKeyLocalError(
        `serviceHardware.connectDevice is OneKey-only; got vendor "${params.vendor}". ` +
          `Third-party vendors have their own flow: ` +
          `UI layer should use the dedicated hook (e.g. useDeviceConnect for ledger), ` +
          `background/vault layer should call serviceHardware.getAdapterForVendor(vendor) and use the adapter directly.`,
      );
    }
    return this.getFeaturesWithoutCache(params);
  }

  @backgroundMethod()
  async getPro2OnboardingStatus({ connectId }: { connectId: string }) {
    const hardwareCallContext =
      EHardwareCallContext.USER_INTERACTION_NO_BLE_DIALOG;
    const compatibleConnectId = await this.getCompatibleConnectId({
      connectId,
      hardwareCallContext,
    });
    const hardwareSDK = await this.getSDKInstance({
      connectId: compatibleConnectId,
      connectProtocol: 'V2',
      hardwareCallContext,
    });
    return convertDeviceResponse(() =>
      hardwareSDK.deviceGetOnboardingStatus(compatibleConnectId, {
        connectProtocol: 'V2',
      }),
    );
  }

  @backgroundMethod()
  async getDeviceManagementSnapshot({
    connectId,
    refreshInfo = false,
  }: {
    connectId: string;
    refreshInfo?: boolean;
  }): Promise<IDeviceManagementSnapshot> {
    const hardwareCallContext =
      EHardwareCallContext.USER_INTERACTION_NO_BLE_DIALOG;
    const compatibleConnectId = await this.getCompatibleConnectId({
      connectId,
      hardwareCallContext,
    });
    const snapshotKey = `${compatibleConnectId}:${
      refreshInfo ? 'firmware-and-settings' : 'settings'
    }`;
    const existingRequest =
      this.deviceManagementSnapshotInFlight.get(snapshotKey);
    if (existingRequest) {
      return existingRequest;
    }

    const request = (async () => {
      let state: IOneKeyDeviceState;
      try {
        state = await this.getDeviceState({
          connectId: compatibleConnectId,
          params: { scope: refreshInfo ? 'firmware' : 'settings' },
          hardwareCallContext,
          silentMode: true,
        });
        if (refreshInfo) {
          state = await this.getDeviceState({
            connectId: compatibleConnectId,
            params: { scope: 'settings' },
            hardwareCallContext,
            silentMode: true,
          });
        }
      } catch (error) {
        serviceHardwareUtils.hardwareLog(
          'device settings snapshot unavailable',
          error,
        );
        state = await this.getDeviceState({
          connectId: compatibleConnectId,
          hardwareCallContext,
          silentMode: true,
        });
      }
      return { state };
    })();
    this.deviceManagementSnapshotInFlight.set(snapshotKey, request);

    try {
      return await request;
    } finally {
      if (this.deviceManagementSnapshotInFlight.get(snapshotKey) === request) {
        this.deviceManagementSnapshotInFlight.delete(snapshotKey);
      }
    }
  }

  private handlerConnectError = (e: any) => {
    const error: deviceErrors.OneKeyHardwareError | undefined =
      e as deviceErrors.OneKeyHardwareError;

    if (
      error instanceof deviceErrors.OneKeyHardwareError &&
      !error?.reconnect
    ) {
      throw error;
    }
    // TODO handle reconnect?
  };

  @backgroundMethod()
  async connect({
    device,
    hardwareCallContext,
    connectProtocol,
    forceProtocolDetection,
    forceFeaturesRefresh,
    hardwareTransportType,
  }: {
    device: SearchDevice;
    hardwareCallContext?: EHardwareCallContext;
    connectProtocol?: HardwareConnectProtocol;
    forceProtocolDetection?: boolean;
    /** Bypass SearchDevice.features after a firmware reboot and read the live device state. */
    forceFeaturesRefresh?: boolean;
    hardwareTransportType?: EHardwareTransportType;
  }): Promise<Features | undefined> {
    const vendor = (device as SearchDevice & { vendor?: string }).vendor;
    if (vendor && vendor !== EHardwareVendor.onekey) {
      throw new OneKeyLocalError(
        `serviceHardware.connect is OneKey-only; got vendor "${vendor}". ` +
          `Third-party vendors have their own flow: ` +
          `UI layer should use the dedicated hook (e.g. useDeviceConnect for ledger), ` +
          `background/vault layer should call serviceHardware.getAdapterForVendor(vendor) and use the adapter directly.`,
      );
    }

    const { connectId } = device;
    if (
      !connectId &&
      hardwareCallContext !== EHardwareCallContext.UPDATE_FIRMWARE
    ) {
      throw new OneKeyLocalError(
        'hardware connect ERROR: connectId is undefined',
      );
    }

    // Electron BLE discovery returns the Noble peripheral ID as the canonical
    // connection identifier. Replacing it with the Pro USB serial number would
    // make Noble run a targeted scan for PRB... and never find the peripheral.
    // Keep the existing compatibility lookup for native transports only.
    const isDesktopBleSearchDevice =
      platformEnv.isSupportDesktopBle &&
      deviceUtils.isBluetoothSearchDevice(device);
    let resolvedHardwareTransportType = hardwareTransportType;
    if (!resolvedHardwareTransportType && isDesktopBleSearchDevice) {
      resolvedHardwareTransportType = EHardwareTransportType.DesktopWebBle;
    } else if (
      !resolvedHardwareTransportType &&
      deviceUtils.isBluetoothSearchDevice(device)
    ) {
      resolvedHardwareTransportType = EHardwareTransportType.BLE;
    }
    const compatibleConnectId = isDesktopBleSearchDevice
      ? connectId || undefined
      : await this.getCompatibleConnectId({
          connectId: connectId || undefined,
          featuresDeviceId: device.deviceId,
          hardwareCallContext:
            hardwareCallContext || EHardwareCallContext.USER_INTERACTION,
          hardwareTransportType: resolvedHardwareTransportType,
        });
    const protocolAwareDevice = device as SearchDevice & {
      connectProtocol?: HardwareConnectProtocol;
      state?: { protocol?: HardwareConnectProtocol | null };
    };
    const resolvedConnectProtocol = forceProtocolDetection
      ? undefined
      : (connectProtocol ??
        protocolAwareDevice.connectProtocol ??
        protocolAwareDevice.state?.protocol ??
        (await this.getKnownDeviceProtocol(compatibleConnectId)));

    const knownFeatures = (device as KnownDevice).features;
    if (
      !forceFeaturesRefresh &&
      !platformEnv.isNative &&
      knownFeatures &&
      !isDesktopBleSearchDevice
    ) {
      // WebUSB 搜索已完成真实通讯；复用结果，并在成功后保存已确认协议。
      await this.rememberDeviceProtocol({
        connectIds: [
          connectId,
          compatibleConnectId,
          (device as SearchDevice & { serialNo?: string }).serialNo,
          device.uuid,
        ],
        protocol:
          protocolAwareDevice.state?.protocol ??
          protocolAwareDevice.connectProtocol ??
          knownFeatures.protocol,
      });
      return knownFeatures;
    }

    const params = {
      ...(forceProtocolDetection ? { forceProtocolDetection: true } : {}),
      ...(resolvedConnectProtocol
        ? { connectProtocol: resolvedConnectProtocol }
        : {}),
      ...(hardwareCallContext === EHardwareCallContext.UPDATE_FIRMWARE
        ? { allowEmptyConnectId: true }
        : {}),
    } as IDeviceGetFeaturesOptions['params'];

    if (platformEnv.isNative) {
      try {
        return await this.connectDevice({
          connectId: compatibleConnectId,
          params,
          hardwareTransportType: resolvedHardwareTransportType,
        });
      } catch (e: any) {
        this.handlerConnectError(e);
      }
    } else {
      return this.connectDevice({
        connectId: compatibleConnectId,
        params,
        hardwareTransportType: resolvedHardwareTransportType,
      });
    }
  }

  @backgroundMethod()
  @toastIfError()
  async unlockDevice({
    connectId,
    pinType,
  }: {
    connectId: string;
    pinType?: DeviceSessionPinType;
  }) {
    const hardwareSDK = await this.getSDKInstance({
      connectId,
    });
    const compatibleConnectId = await this.getCompatibleConnectId({
      connectId,
      hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
    });
    const unlockParams: CommonParams & {
      pinType?: DeviceSessionPinType;
    } = pinType === undefined ? {} : { pinType };
    return convertDeviceResponse(() =>
      hardwareSDK?.deviceUnlock(compatibleConnectId, unlockParams),
    );
  }

  cancelTimer: ReturnType<typeof setTimeout> | undefined;

  lastCancelAt: Record<string, number> = {};

  isLastCancelLessThanMsAgo(connectId: string | undefined, ms: number) {
    return (
      connectId &&
      this.lastCancelAt[connectId] &&
      Date.now() - this.lastCancelAt[connectId] < ms
    );
  }

  // TODO convert to lazy cancel
  @backgroundMethod()
  async cancel({
    connectId,
    walletId,
    immediate,
  }: {
    connectId?: string;
    walletId?: string;
    forceDeviceResetToHome?: boolean;
    immediate?: boolean;
    deviceType?: string;
  }) {
    // TODO skip cancel if device is canceling, save last cancel time

    try {
      if (!connectId && walletId && accountUtils.isHwWallet({ walletId })) {
        const device =
          await this.backgroundApi.serviceAccount.getWalletDeviceSafe({
            walletId,
          });
        if (device?.connectId) {
          // eslint-disable-next-line no-param-reassign
          connectId = device.connectId;
        }
      }
    } catch (_error) {
      //
    }

    const fn = async () => {
      // For cancel operations, skip transport detection to avoid unnecessary /enumerate calls
      const sdk = await this.getSDKInstance({
        connectId,
        hardwareCallContext: EHardwareCallContext.SILENT_CALL,
      });
      // sdk.cancel() always cause device re-emit UI_EVENT:  ui-close_window

      // cancel the hardware process
      // (cancel not working on enter pin on device mode, use getFeatures() later)
      try {
        // For cancel operations, use getCompatibleConnectId but skip transport detection
        // to avoid unnecessary /enumerate calls while still getting the correct connectId
        const compatibleConnectId = connectId
          ? await this.getCompatibleConnectId({
              connectId,
              hardwareCallContext: EHardwareCallContext.SILENT_CALL,
            })
          : undefined;
        sdk.cancel(compatibleConnectId);
      } catch (e: any) {
        const { message } = e || {};
        console.log('sdk.cancel error: ', message);
      }

      console.log('sdk.cancel device: ', connectId);
    };

    clearTimeout(this.cancelTimer);
    if (immediate) {
      await fn();
      return;
    }
    this.cancelTimer = setTimeout(fn, 100);
  }

  // TODO run firmwareAuthenticate() check bootloader mode by features
  async getDeviceModeFromFeatures({
    features,
  }: {
    features: IOneKeyDeviceFeatures;
  }): Promise<EOneKeyDeviceMode> {
    return deviceUtils.getDeviceModeFromFeatures({ features });
  }

  async getConnectIdFromFeatures({
    features,
  }: {
    features: IOneKeyDeviceFeatures;
  }): Promise<string | undefined> {
    if (features) {
      const dbDevice = await localDb.getDeviceByQuery({
        features,
      });
      if (dbDevice?.connectId) {
        return dbDevice?.connectId;
      }
    }

    // TODO get connectId from SDK: USB connectId should use the standard device identity helper.
    // For App-side compatibility use deviceUtils.buildDeviceUSBConnectId({ features }).
    // TODO uuid is equal to connectId in ble sdk?
    // const connectId = await deviceUtils.buildDeviceUSBConnectId({ features });
    // if (connectId) {
    //   return connectId;
    // }

    return undefined;
  }

  async getDeviceTypeFromFeatures({
    features,
  }: {
    features: IOneKeyDeviceFeatures;
  }): Promise<IDeviceType> {
    return deviceUtils.getDeviceTypeFromFeatures({ features });
  }

  @backgroundMethod()
  async getDeviceSupportFeatures(connectId: string) {
    const compatibleConnectId = await this.getCompatibleConnectId({
      connectId,
      hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
    });
    const hardwareSDK = await this.getSDKInstance({
      connectId: compatibleConnectId,
    });
    return convertDeviceResponse(() =>
      hardwareSDK?.deviceSupportFeatures(compatibleConnectId),
    );
  }

  _getFeaturesLowLevel = async (options: IDeviceGetFeaturesOptions) => {
    const {
      connectId,
      params,
      silentMode,
      hardwareCallContext,
      hardwareTransportType,
    } = options;
    const {
      allowEmptyConnectId,
      detectBootloaderDevice,
      forceProtocolDetection,
      ...sdkParams
    } = params ?? {};
    serviceHardwareUtils.hardwareLog('read legacy app features', connectId);
    if (!allowEmptyConnectId && !connectId) {
      throw new OneKeyLocalError(
        'hardware getFeatures ERROR: connectId is undefined',
      );
    }
    const knownProtocol = forceProtocolDetection
      ? undefined
      : (sdkParams.connectProtocol ??
        (await this.getKnownDeviceProtocol(connectId ?? undefined)));
    const hardwareSDK = await this.getSDKInstance({
      connectId,
      connectProtocol: knownProtocol,
      forceProtocolDetection,
      hardwareCallContext,
      hardwareTransportType,
    });
    const getFeaturesParams = {
      ...sdkParams,
      ...(knownProtocol ? { connectProtocol: knownProtocol } : {}),
      ...(forceProtocolDetection && !knownProtocol
        ? { forceProtocolDetection: true }
        : {}),
      ...(detectBootloaderDevice ? { detectBootloaderDevice: true } : {}),
    };
    const readV1Features = async (confirmedProtocol?: 'V1') => {
      const effectiveGetFeaturesParams = confirmedProtocol
        ? {
            ...sdkParams,
            connectProtocol: confirmedProtocol,
            ...(detectBootloaderDevice ? { detectBootloaderDevice: true } : {}),
          }
        : getFeaturesParams;
      const features = await convertDeviceResponse(
        () =>
          hardwareSDK?.getFeatures(
            connectId as string,
            Object.keys(effectiveGetFeaturesParams).length > 0
              ? effectiveGetFeaturesParams
              : undefined,
          ),
        { silentMode },
      );
      await this.rememberDeviceProtocol({
        connectIds: [connectId],
        protocol: 'V1',
      });
      return features;
    };
    if (knownProtocol === 'V1') {
      return readV1Features();
    }
    let readParams:
      | (CommonParams & { forceProtocolDetection?: boolean })
      | undefined = Object.keys(sdkParams).length > 0 ? sdkParams : undefined;
    if (knownProtocol) {
      readParams = { ...sdkParams, connectProtocol: knownProtocol };
    } else if (forceProtocolDetection) {
      readParams = { ...sdkParams, forceProtocolDetection: true };
    }
    const currentState = await convertDeviceResponse(
      () => hardwareSDK?.getDeviceState(connectId as string, readParams),
      { silentMode },
    );
    if (sdkParams.onlyConnectBleDevice) {
      // Preserve the x-branch connection-only contract: the SDK returns an
      // empty payload after establishing BLE. Pro 2 still enters through the
      // V2 getDeviceState API, but the expected null is not a full DeviceState.
      return currentState as unknown as IOneKeyDeviceFeatures;
    }
    await this.rememberDeviceProtocol({
      connectIds: [connectId, currentState.identity.serialNo],
      protocol: currentState.protocol,
    });
    if (currentState.protocol === 'V1') {
      return readV1Features('V1');
    }
    if (
      detectBootloaderDevice &&
      isOneKeyLoaderMode(currentState.status.mode)
    ) {
      throw new deviceErrors.DeviceDetectInBootloaderMode();
    }
    return projectLegacyDeviceFeaturesFromState(currentState);
  };

  _getFeaturesWithTimeout = makeTimeoutPromise({
    asyncFunc: this._getFeaturesLowLevel,
    // todo remove: sdk guarantees not to block this method
    timeout: timerUtils.getTimeDurationMs({ seconds: 60 }),
    timeoutRejectError: new deviceErrors.DeviceMethodCallTimeout(),
    onTimeout: (options) => {
      if (options.connectId) {
        void this.cancel({
          connectId: options.connectId,
          immediate: true,
        });
      }
    },
  });

  getFeaturesMutex = new Semaphore(1);

  _getFeaturesWithMutex = async (
    options: IDeviceGetFeaturesOptions,
  ): Promise<IOneKeyDeviceFeatures> => {
    const fn = async () => {
      const features = await this.getFeaturesMutex.runExclusive(async () => {
        const r = await this._getFeaturesWithTimeout(options);
        return r;
      });
      return features;
    };
    return fn();
  };

  _getFeaturesWithCache = memoizee(
    async (options: IDeviceGetFeaturesOptions) => {
      const features = await this._getFeaturesWithMutex(options);
      return features;
    },
    {
      promise: true,
      max: 10,
      maxAge: timerUtils.getTimeDurationMs({ seconds: 15 }),
      normalizer: (args) => args[0]?.connectId || '',
    },
  );

  _getDeviceStateLowLevel = async (options: IDeviceGetStateOptions) => {
    const {
      connectId,
      desktopBleReuseConnectedOnly,
      params,
      silentMode,
      hardwareCallContext,
      hardwareTransportType,
      persistTransportType,
    } = options;
    const { allowEmptyConnectId, ...sdkParams } = params ?? {};
    serviceHardwareUtils.hardwareLog('call getDeviceState()', connectId);
    if (!allowEmptyConnectId && !connectId) {
      throw new OneKeyLocalError(
        'hardware getDeviceState ERROR: connectId is undefined',
      );
    }
    const knownProtocol =
      sdkParams.connectProtocol ??
      (await this.getKnownDeviceProtocol(connectId ?? undefined));
    if (connectId && !knownProtocol) {
      throw new OneKeyLocalError(HARDWARE_CONNECT_PROTOCOL_UNAVAILABLE_MESSAGE);
    }
    const normalizedSdkParams =
      params || knownProtocol
        ? {
            ...sdkParams,
            ...(knownProtocol ? { connectProtocol: knownProtocol } : {}),
          }
        : undefined;
    const hardwareSDK = await this.getSDKInstance({
      connectId,
      connectProtocol: knownProtocol,
      hardwareCallContext,
      hardwareTransportType,
      persistTransportType,
    });
    const state = await this.runInDesktopBleConnectedOnlyScope({
      connectId,
      enabled: desktopBleReuseConnectedOnly,
      task: () =>
        convertDeviceResponse(
          () => hardwareSDK.getDeviceState(connectId, normalizedSdkParams),
          {
            silentMode,
          },
        ),
    });
    await this.rememberDeviceProtocol({
      connectIds: [connectId, state.identity.serialNo],
      protocol: state.protocol,
    });
    return state;
  };

  _getDeviceStateWithTimeout = makeTimeoutPromise({
    asyncFunc: this._getDeviceStateLowLevel,
    timeout: timerUtils.getTimeDurationMs({ seconds: 60 }),
    timeoutRejectError: new deviceErrors.DeviceMethodCallTimeout(),
    onTimeout: (options) => {
      if (options.connectId) {
        void this.cancel({
          connectId: options.connectId,
          immediate: true,
        });
      }
    },
  });

  _getDeviceStateWithMutex = async (
    options: IDeviceGetStateOptions,
  ): Promise<IOneKeyDeviceState> =>
    this.getFeaturesMutex.runExclusive(async () =>
      this._getDeviceStateWithTimeout(options),
    );

  @backgroundMethod()
  async getDeviceState(options: IDeviceGetStateOptions) {
    const hardwareCallContext =
      options.hardwareCallContext ??
      EHardwareCallContext.USER_INTERACTION_NO_BLE_DIALOG;
    const compatibleConnectId = options.connectId
      ? await this.getCompatibleConnectId({
          connectId: options.connectId,
          hardwareCallContext,
          hardwareTransportType: options.hardwareTransportType,
        })
      : options.connectId;
    const state = await this._getDeviceStateWithMutex({
      ...options,
      connectId: compatibleConnectId,
      hardwareCallContext,
    });
    if (options.params?.scope === 'firmware') {
      await this.persistFirmwareSnapshot({
        connectId: compatibleConnectId,
        state,
      });
    }
    return state;
  }

  @backgroundMethod()
  async getDeviceStateWithUnlock({
    connectId,
    oneKeyOperationLease,
    pinType,
    params,
  }: {
    connectId: string;
    oneKeyOperationLease?: IOneKeyHardwareOperationLease;
    pinType?: DeviceSessionPinType;
    params?: GetDeviceStateParams;
  }) {
    const dbDevice = await localDb.getDeviceByQuery({ connectId });
    return this.backgroundApi.serviceHardwareUI.runExclusiveOneKeyOperation(
      () =>
        this.getDeviceStateWithUnlockInternal({ connectId, pinType, params }),
      {
        deviceKey:
          dbDevice?.id ||
          dbDevice?.deviceId ||
          dbDevice?.uuid ||
          dbDevice?.connectId ||
          connectId,
        lease: oneKeyOperationLease,
      },
    );
  }

  private async getDeviceStateWithUnlockInternal({
    connectId,
    pinType,
    params,
  }: {
    connectId: string;
    pinType?: DeviceSessionPinType;
    params?: GetDeviceStateParams;
  }) {
    const compatibleConnectId = await this.getCompatibleConnectId({
      connectId,
      hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
    });
    let state = await this.getDeviceState({
      connectId: compatibleConnectId,
      params,
      hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
    });
    if (state.status.initialized === false) {
      throw new OneKeyLocalError('Device is not initialized');
    }
    if (state.status.unlocked === false) {
      await this.unlockDevice({ connectId: compatibleConnectId, pinType });
      state = await this.getDeviceState({
        connectId: compatibleConnectId,
        params,
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
      });
    }
    return state;
  }

  /** @deprecated Use getDeviceState. */
  @backgroundMethod()
  async getFeatures(options: IDeviceGetFeaturesOptions) {
    const features = await this._getFeaturesWithCache(options);
    return features;
  }

  /** @deprecated Use getDeviceState. */
  @backgroundMethod()
  async getFeaturesWithoutCache(options: IDeviceGetFeaturesOptions) {
    const features = await this._getFeaturesWithMutex(options);
    return features;
  }

  /** @deprecated Use getDeviceStateByWallet. */
  @backgroundMethod()
  async getFeaturesByWallet({ walletId }: { walletId: string }) {
    const device = await this.backgroundApi.serviceAccount.getWalletDevice({
      walletId,
    });
    // device.connectId is already processed by LocalDbBase.getDevice()
    return this.getFeatures({ connectId: device.connectId });
  }

  @backgroundMethod()
  async getDeviceStateByWallet({
    walletId,
    params,
  }: {
    walletId: string;
    params?: GetDeviceStateParams;
  }) {
    const device = await this.backgroundApi.serviceAccount.getWalletDevice({
      walletId,
    });
    return this.getDeviceState({
      connectId: device.connectId,
      params,
    });
  }

  @backgroundMethod()
  async checkDeviceReachableForFirmwareUpdate(params: { connectId: string }) {
    const dbDevice = await localDb.getDeviceByQuery({
      connectId: params.connectId,
    });
    if (!dbDevice) {
      // 首次连接或 Bootloader 模式下，本地数据库可能还没有设备记录。
      // 此时跳过预检，把新发现的连接 ID 原样交给升级流程。
      return params.connectId;
    }
    const resolvedTransport = await this.resolveHardwareTransport({
      connectId: params.connectId,
      featuresDeviceId: dbDevice.deviceId,
      hardwareCallContext: EHardwareCallContext.UPDATE_FIRMWARE,
    });
    const { connectId: compatibleConnectId, transportType } = resolvedTransport;
    const forceProtocolDetection =
      transportType === EHardwareTransportType.DesktopWebBle;
    await this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
      () =>
        this.getFeaturesWithoutCache({
          connectId: compatibleConnectId,
          params: {
            retryCount: 1,
            forceProtocolDetection,
            ...(forceProtocolDetection
              ? { timeout: DESKTOP_BLE_FIRMWARE_CONNECTION_TIMEOUT_MS }
              : {}),
          },
          hardwareTransportType: transportType,
        }),
      {
        deviceParams: {
          dbDevice,
        },
      },
    );
    return compatibleConnectId;
  }

  @backgroundMethod()
  async getPassphraseState({
    connectId,
    forceInputPassphrase,
  }: {
    connectId: string;
    forceInputPassphrase: boolean;
  }) {
    return this.getPassphraseStateBase({ connectId, forceInputPassphrase });
  }

  @backgroundMethod()
  async getPassphraseStateBase({
    connectId,
    forceInputPassphrase,
    useEmptyPassphrase,
  }: {
    connectId: string;
    forceInputPassphrase: boolean; // not working?
    useEmptyPassphrase?: boolean;
  }): Promise<string | undefined> {
    const protocol = await this.getKnownDeviceProtocol(connectId);
    if (!protocol) {
      throw new OneKeyLocalError(HARDWARE_CONNECT_PROTOCOL_UNAVAILABLE_MESSAGE);
    }
    const hardwareSDK = await this.getSDKInstance({
      connectId,
      connectProtocol: protocol,
    });
    if (protocol === 'V2') {
      const openWalletSession = hardwareSDK?.openWalletSession;
      if (!openWalletSession) {
        throw new OneKeyLocalError(
          'Protocol V2 wallet session API is unavailable in the loaded hardware SDK',
        );
      }
      const walletSessionParams = useEmptyPassphrase
        ? { mode: 'standard' as const }
        : { mode: 'select-hidden' as const };
      const walletSession = await convertDeviceResponse(() =>
        openWalletSession(connectId, walletSessionParams),
      );
      serviceHardwareUtils.hardwareLog('openWalletSession', {
        protocol,
        mode: walletSessionParams.mode,
        resumed: walletSession.resumed,
      });
      const expectedWalletType = useEmptyPassphrase ? 'standard' : 'hidden';
      if (walletSession.walletType !== expectedWalletType) {
        throw new OneKeyLocalError(
          `Protocol V2 wallet type mismatch: expected ${expectedWalletType}, received ${walletSession.walletType}`,
        );
      }
      if (walletSession.walletType === 'standard') {
        return undefined;
      }
      const passphraseState = nullableToUndefined(
        walletSession.passphraseState,
      );
      if (!passphraseState) {
        throw new OneKeyLocalError(
          'Protocol V2 hidden wallet response is missing passphraseState',
        );
      }
      return passphraseState;
    }

    const getPassphraseState = hardwareSDK?.getPassphraseState as
      | ((
          targetConnectId: string,
          params: CommonParams,
        ) => HardwareResponse<string | undefined>)
      | undefined;
    if (!getPassphraseState) {
      return undefined;
    }

    return convertDeviceResponse(() =>
      getPassphraseState(connectId, {
        initSession: forceInputPassphrase, // always re-input passphrase on device
        useEmptyPassphrase,
        connectProtocol: protocol,
      }),
    );
  }

  @backgroundMethod()
  async setInputPinOnSoftware(p: ISetInputPinOnSoftwareParams) {
    return this.deviceSettingsManager.setInputPinOnSoftware(p);
  }

  @backgroundMethod()
  async setInputPinOnSoftwareByConnectId(p: {
    connectId: string;
    inputPinOnSoftware: boolean;
  }) {
    return this.deviceSettingsManager.setInputPinOnSoftwareByConnectId(p);
  }

  @backgroundMethod()
  @toastIfError()
  async setAutoLockDelayMs(p: ISetAutoLockDelayMsParams) {
    return this.deviceSettingsManager.setAutoLockDelayMs(p);
  }

  @backgroundMethod()
  @toastIfError()
  async setAutoShutDownDelayMs(p: ISetAutoShutDownDelayMsParams) {
    return this.deviceSettingsManager.setAutoShutDownDelayMs(p);
  }

  @backgroundMethod()
  @toastIfError()
  async setLanguage(p: ISetLanguageParams) {
    return this.deviceSettingsManager.setLanguage(p);
  }

  @backgroundMethod()
  @toastIfError()
  async setBrightness(p: ISetBrightnessParams) {
    return this.deviceSettingsManager.setBrightness(p);
  }

  @backgroundMethod()
  @toastIfError()
  async setHapticFeedback(p: ISetHapticFeedbackParams) {
    return this.deviceSettingsManager.setHapticFeedback(p);
  }

  @backgroundMethod()
  @toastIfError()
  async wipeDevice(p: IWipeDeviceParams) {
    return this.deviceSettingsManager.wipeDevice(p);
  }

  @backgroundMethod()
  @toastIfError()
  async setPassphraseEnabled(p: ISetPassphraseEnabledParams) {
    return this.deviceSettingsManager.setPassphraseEnabled(p);
  }

  @backgroundMethod()
  async getDeviceAdvanceSettings(p: IGetDeviceAdvanceSettingsParams) {
    return this.deviceSettingsManager.getDeviceAdvanceSettings(p);
  }

  @backgroundMethod()
  @toastIfError()
  async getDeviceLabel(p: IGetDeviceLabelParams) {
    return this.deviceSettingsManager.getDeviceLabel(p);
  }

  @backgroundMethod()
  @toastIfError()
  async changePin(p: IChangePinParams) {
    return this.deviceSettingsManager.changePin(p);
  }

  @backgroundMethod()
  @toastIfError()
  async setDeviceLabel(p: ISetDeviceLabelParams) {
    const result = await this.deviceSettingsManager.setDeviceLabel(p);
    if (result.message) {
      const wallet = await this.backgroundApi.serviceAccount.getWalletSafe({
        walletId: p.walletId,
      });
      const walletName = wallet?.name;
      const dbDeviceId = wallet?.associatedDevice;
      if (dbDeviceId) {
        await this.writeBackProtocolV2DeviceLabel({
          dbDeviceId,
          label: p.label,
        });
        await this.handleHardwareLabelChanged({
          walletId: p.walletId,
          dbDeviceId,
          label: p.label,
          walletName,
        });
      }
    }
    return result;
  }

  @backgroundMethod()
  @toastIfError()
  async setDeviceHomeScreen(p: ISetDeviceHomeScreenParams) {
    return this.deviceSettingsManager.setDeviceHomeScreen(p);
  }

  @backgroundMethod()
  async getDeviceHomeScreen({ deviceId }: { deviceId: string }) {
    return localDb.getHardwareHomeScreen({ deviceId });
  }

  @backgroundMethod()
  async saveDeviceHomeScreen(homeScreen: IDeviceHomeScreen) {
    return localDb.addHardwareHomeScreen({ homeScreen });
  }

  @backgroundMethod()
  async deleteDeviceHomeScreen(homeScreenId: string) {
    await localDb.deleteHardwareHomeScreen({ homeScreenId });
  }

  @backgroundMethod()
  async removeDeviceHomeScreen() {
    const appStatus = await simpleDb.appStatus.getRawData();
    if (appStatus?.removeDeviceHomeScreenMigrated) {
      console.log('removeDeviceHomeScreen: already migrated');
      return;
    }

    await localDb.clearRecords({
      name: ELocalDBStoreNames.HardwareHomeScreen,
    });

    await simpleDb.appStatus.setRawData(
      (v): ISimpleDBAppStatus => ({
        ...v,
        removeDeviceHomeScreenMigrated: true,
      }),
    );
  }

  @backgroundMethod()
  async migrateClassicPinInputDefault() {
    const appStatus = await simpleDb.appStatus.getRawData();
    if (appStatus?.classicPinInputDefaultMigrated) {
      return;
    }

    // One-time default flip (OK-61489): button devices (Classic / 1S /
    // Mini) now enter PIN on the device by default. `inputPinOnSoftwareSupport`
    // is only ever written by setInputPinOnSoftware, the user-driven enable
    // path whose firmware capability probe passed — record creation never
    // writes it. So a stored `true` carrying that marker is a deliberate
    // opt-in and is kept; a stored `true` without it is the legacy creation
    // default nobody chose, and that is what flips.
    const { devices } = await localDb.getAllDevices();
    for (const device of devices) {
      if (
        (device.vendor ?? EHardwareVendor.onekey) === EHardwareVendor.onekey &&
        deviceUtils.checkInputPinOnSoftwareSupport(device.deviceType) &&
        device.settings?.inputPinOnSoftware === true &&
        device.settings?.inputPinOnSoftwareSupport !== true
      ) {
        await localDb.updateDeviceDbSettings({
          dbDeviceId: device.id,
          settings: {
            ...device.settings,
            inputPinOnSoftware: false,
          },
        });
      }
    }

    await simpleDb.appStatus.setRawData(
      (v): ISimpleDBAppStatus => ({
        ...v,
        classicPinInputDefaultMigrated: true,
      }),
    );
  }

  @backgroundMethod()
  async getDeviceHomeScreenConfig({
    dbDeviceId,
    homeScreenType,
  }: {
    dbDeviceId: string | undefined;
    homeScreenType: 'WallPaper' | 'Nft';
  }): Promise<IDeviceHomeScreenConfig> {
    const { getHomeScreenDefaultList, getHomeScreenSize } =
      await CoreSDKLoader();
    const device = await localDb.getDevice(checkIsDefined(dbDeviceId));
    let names = getHomeScreenDefaultList(device.featuresInfo || ({} as any));

    const isT1Model = deviceHomeScreenUtils.isMonochromeScreen(
      device.deviceType,
    );

    if (isT1Model) {
      names = T1_HOME_SCREEN_DEFAULT_IMAGES;
    }
    const size =
      getHomeScreenSize({
        deviceType: device.deviceType,
        homeScreenType,
        thumbnail: false,
      }) ?? (isT1Model ? DEFAULT_T1_HOME_SCREEN_INFORMATION : undefined);
    const thumbnailSize = getHomeScreenSize({
      deviceType: device.deviceType,
      homeScreenType,
      thumbnail: true,
    });
    return { names, size, thumbnailSize };
  }

  @backgroundMethod()
  async getDeviceNftConfig({
    dbDeviceId,
  }: {
    dbDeviceId: string | undefined;
  }): Promise<IDeviceHomeScreenConfig> {
    const { getNftSize } = await CoreSDKLoader();
    const device = await localDb.getDevice(checkIsDefined(dbDeviceId));
    const size = getNftSize({
      deviceType: device.deviceType,
      thumbnail: false,
    });
    const thumbnailSize = getNftSize({
      deviceType: device.deviceType,
      thumbnail: true,
    });

    return { names: [], size, thumbnailSize };
  }

  @backgroundMethod()
  async shouldAuthenticateFirmware(p: IShouldAuthenticateFirmwareParams) {
    return this.hardwareVerifyManager.shouldAuthenticateFirmware(p);
  }

  @backgroundMethod()
  async firmwareAuthenticate(p: IFirmwareAuthenticateParams) {
    return this.hardwareVerifyManager.firmwareAuthenticate(p);
  }

  @backgroundMethod()
  async shouldAuthenticateFirmwareByHash(params: {
    features: IOneKeyDeviceFeatures | undefined;
  }) {
    return this.hardwareVerifyManager.shouldAuthenticateFirmwareByHash(params);
  }

  @backgroundMethod()
  async verifyFirmwareHash({
    deviceType,
    onekeyFeatures,
  }: {
    deviceType: IDeviceType;
    onekeyFeatures: OnekeyFeatures | undefined;
  }): Promise<IDeviceVerifyVersionCompareResult> {
    return this.hardwareVerifyManager.verifyFirmwareHash({
      deviceType,
      onekeyFeatures,
    });
  }

  @backgroundMethod()
  async uploadResource(connectId: string, params: DeviceUploadResourceParams) {
    const compatibleConnectId = await this.getCompatibleConnectId({
      connectId,
      hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
    });
    const hardwareSDK = await this.getSDKInstance({
      connectId: compatibleConnectId,
    });
    return convertDeviceResponse(() =>
      hardwareSDK?.deviceUploadResource(compatibleConnectId, params),
    );
  }

  @backgroundMethod()
  async uploadPro2Nft({
    connectId,
    imageJpegBase64,
    thumbnailJpegBase64,
    title,
    subtitle,
    timestampMs,
  }: IUploadPro2NftParams) {
    const compatibleConnectId = await this.getCompatibleConnectId({
      connectId,
      hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
    });
    const hardwareSDK = await this.getSDKInstance({
      connectId: compatibleConnectId,
      hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
    });
    const protocolV2NftSDK = hardwareSDK as IProtocolV2NftCoreApi;
    const uploadNft = protocolV2NftSDK.deviceUploadNft;
    if (!uploadNft) {
      throw new OneKeyLocalError(
        'Hardware SDK does not support Protocol V2 NFT upload',
      );
    }
    return convertDeviceResponse(() =>
      uploadNft(compatibleConnectId, {
        imageJpegBase64,
        thumbnailJpegBase64,
        title,
        subtitle,
        timestampMs,
      }),
    );
  }

  @backgroundMethod()
  async uploadPortfolioPackage({
    connectId,
    desktopBleReuseConnectedOnly,
    hardwareTransportType,
    packageBase64,
    uiMode = 'silent',
  }: {
    connectId: string;
    desktopBleReuseConnectedOnly?: boolean;
    hardwareTransportType?: EHardwareTransportType;
    packageBase64: string;
    uiMode?: 'silent' | 'progress';
  }) {
    if (
      desktopBleReuseConnectedOnly &&
      hardwareTransportType !== EHardwareTransportType.DesktopWebBle
    ) {
      throw new OneKeyLocalError(
        'Desktop BLE connected-only reuse requires a pinned BLE transport',
      );
    }
    const hardwareCallContext =
      uiMode === 'progress'
        ? EHardwareCallContext.USER_INTERACTION
        : EHardwareCallContext.BACKGROUND_NON_INTERACTIVE;
    const compatibleConnectId = await this.getCompatibleConnectId({
      connectId,
      hardwareCallContext,
      ...(hardwareTransportType ? { hardwareTransportType } : {}),
    });
    const hardwareSDK = await this.getSDKInstance({
      connectId: compatibleConnectId,
      hardwareCallContext,
      ...(uiMode === 'silent' ? { persistTransportType: false } : {}),
      ...(hardwareTransportType ? { hardwareTransportType } : {}),
    });
    return this.runInDesktopBleConnectedOnlyScope({
      connectId: compatibleConnectId,
      enabled: desktopBleReuseConnectedOnly,
      task: () =>
        convertDeviceResponse(
          () =>
            hardwareSDK.uploadPortfolio(compatibleConnectId, {
              packageBase64,
              ...(uiMode === 'progress' ? { uiMode } : {}),
            }),
          uiMode === 'silent' ? { silentMode: true } : undefined,
        ),
    });
  }

  @backgroundMethod()
  async getLogs(): Promise<string[]> {
    const logs: string[] = ['===== device logs ====='];
    try {
      const hardwareSDK = await this.getSDKInstance({
        connectId: undefined,
      });
      const messages = await convertDeviceResponse(() => hardwareSDK.getLogs());
      logs.push(...messages);
    } catch (_error) {
      // ignore
    }
    return logs;
  }

  @backgroundMethod()
  async getFirmwareVerificationFeatures({
    connectId,
    deviceType,
  }: {
    connectId: string;
    deviceType: IDeviceType;
  }): Promise<OnekeyFeatures> {
    const compatibleConnectId = await this.getCompatibleConnectId({
      connectId,
      hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
    });
    const state = await this.getDeviceState({
      connectId: compatibleConnectId,
      params: {
        scope: supportsDedicatedFirmwareFeatures(deviceType)
          ? 'firmware'
          : 'runtime',
      },
      hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
    });
    return buildOnekeyFeaturesFromState(state);
  }

  /** @deprecated Use getFirmwareVerificationFeatures. */
  @backgroundMethod()
  async getOneKeyFeatures({
    connectId,
    deviceType,
  }: {
    connectId: string;
    deviceType: IDeviceType;
  }): Promise<OnekeyFeatures> {
    return this.getFirmwareVerificationFeatures({ connectId, deviceType });
  }

  private fixHardwareBitcoinOnlyState(params: IUpdateFirmwareWorkflowParams) {
    let bitcoinOnlyFlag:
      | {
          fw_vendor: string | undefined;
          capabilities: number[] | undefined;
          $app_firmware_type?: EFirmwareType;
        }
      | undefined;
    const capabilityBitcoinLike = 2;
    const bitcoinOnlyFwVendor = 'OneKey Bitcoin-only';
    try {
      const updateFirmwareInfo = params?.releaseResult?.updateInfos?.firmware;
      if (
        updateFirmwareInfo?.fromFirmwareType === EFirmwareType.Universal &&
        updateFirmwareInfo?.toFirmwareType === EFirmwareType.BitcoinOnly
      ) {
        const originalCapabilities =
          (params?.releaseResult?.features
            ?.capabilities as unknown as number[]) || [];
        const newCapabilities = originalCapabilities.filter(
          (item) => item !== capabilityBitcoinLike,
        );

        bitcoinOnlyFlag = {
          fw_vendor: bitcoinOnlyFwVendor,
          capabilities: newCapabilities,
          $app_firmware_type: EFirmwareType.BitcoinOnly,
        };
      } else if (
        updateFirmwareInfo?.fromFirmwareType === EFirmwareType.BitcoinOnly &&
        updateFirmwareInfo?.toFirmwareType === EFirmwareType.Universal
      ) {
        const originalCapabilities =
          (params?.releaseResult?.features
            ?.capabilities as unknown as number[]) || [];
        const capabilities = [...originalCapabilities];

        const hasExists = capabilities.find(
          (item) => item === capabilityBitcoinLike,
        );
        if (!hasExists) {
          capabilities.push(capabilityBitcoinLike);
        }

        bitcoinOnlyFlag = {
          fw_vendor: undefined,
          capabilities,
          $app_firmware_type: EFirmwareType.Universal,
        };
      }
    } catch (_error) {
      // ignore
    }
    return bitcoinOnlyFlag;
  }

  @backgroundMethod()
  async updateDeviceVersionAfterFirmwareUpdate(
    params: IUpdateFirmwareWorkflowParams,
  ) {
    const connectId = params.releaseResult.originalConnectId;
    const dbDevice = await localDb.getDeviceByQuery({
      connectId,
    });
    if (!dbDevice || !connectId) {
      return;
    }
    try {
      await this.getDeviceState({
        connectId,
        params: { scope: 'firmware' },
        hardwareCallContext: EHardwareCallContext.UPDATE_FIRMWARE,
        silentMode: true,
      });
    } catch (error) {
      serviceHardwareUtils.hardwareLog(
        'refresh firmware state after update ERROR',
        error,
      );
    }
    const versionInfo: IDeviceVersionCacheInfo = {
      firmwareVersion: undefined,
      bleVersion: undefined,
      bootloaderVersion: undefined,
    };
    if (params?.releaseResult?.updateInfos?.bootloader?.hasUpgrade) {
      const bootVersion =
        params.releaseResult.updateInfos.bootloader?.toVersion;
      versionInfo.bootloaderVersion = bootVersion;
    }
    if (params?.releaseResult?.updateInfos?.firmware?.hasUpgrade) {
      versionInfo.firmwareVersion =
        params.releaseResult.updateInfos.firmware?.toVersion;
    }
    if (params?.releaseResult?.updateInfos?.ble?.hasUpgrade) {
      const bleVersion = params.releaseResult.updateInfos.ble?.toVersion;
      versionInfo.bleVersion = bleVersion;
    }

    const filteredVersionInfo: Partial<IDeviceVersionCacheInfo> = {};
    Object.entries(versionInfo).forEach(([key, value]) => {
      if (value !== undefined && semver.valid(value)) {
        filteredVersionInfo[key as keyof IDeviceVersionCacheInfo] = value;
      }
    });

    const bitcoinOnlyFlag = this.fixHardwareBitcoinOnlyState(params);

    await localDb.updateDeviceVersionInfo({
      dbDeviceId: dbDevice.id,
      versionCacheInfo: filteredVersionInfo as IDeviceVersionCacheInfo,
      bitcoinOnlyFlag,
    });
    if (bitcoinOnlyFlag) {
      await this.updateHwWalletsDeprecatedStatus({
        connectId,
      });
      const updateFirmwareInfo = params?.releaseResult?.updateInfos?.firmware;
      if (
        updateFirmwareInfo?.fromFirmwareType !== undefined &&
        updateFirmwareInfo?.toFirmwareType !== undefined
      ) {
        defaultLogger.update.firmware.firmwareSwitchSuccess({
          deviceType: dbDevice.deviceType,
          fromFirmwareType: updateFirmwareInfo.fromFirmwareType,
          toFirmwareType: updateFirmwareInfo.toFirmwareType,
        });
      }
    }
  }

  @backgroundMethod()
  async updateHwWalletsDeprecatedStatus({ connectId }: { connectId: string }) {
    const allHwWallets =
      await this.backgroundApi.serviceAccount.getAllHwQrWalletWithDevice({
        filterHiddenWallet: false,
        filterQrWallet: true,
      });

    const willUpdateDeprecateMap: Record<string, boolean> = {};

    for (const walletWithDevice of Object.values(allHwWallets)) {
      const wallet = walletWithDevice.wallet;
      const device = walletWithDevice.device;

      if (wallet?.id && device?.connectId) {
        const isSameConnectId =
          device.connectId === connectId || device.bleConnectId === connectId;

        // only handle wallet with same connectId
        if (isSameConnectId) {
          willUpdateDeprecateMap[wallet.id] = true;
        }
      }
    }

    const result =
      await this.backgroundApi.serviceAccount.updateWalletsDeprecatedState({
        willUpdateDeprecateMap,
      });
    if (result && Object.keys(willUpdateDeprecateMap).length > 0) {
      appEventBus.emit(EAppEventBusNames.WalletUpdate, undefined);
    }
  }

  /**
   * Get the adapter for a specific vendor.
   * NOTE: Not decorated with @backgroundMethod because the returned adapter
   * is a non-serializable object. Only call from in-process code (keyrings).
   */
  async getAdapterForVendor(
    vendor: EHardwareVendor,
  ): Promise<IThirdPartyHardwareAdapter | undefined> {
    return this.backgroundApi.serviceThirdPartyHardware.getAdapterForVendor(
      vendor,
    );
  }

  @backgroundMethod()
  async thirdPartyHardwareUiResponse(params: {
    vendor: EHardwareVendor;
    response: IAdapterUiResponse;
  }) {
    return this.backgroundApi.serviceThirdPartyHardware.thirdPartyHardwareUiResponse(
      params,
    );
  }

  @backgroundMethod()
  async thirdPartyHardwareCancel(params: {
    vendor: EHardwareVendor;
    connectId?: string;
  }) {
    return this.backgroundApi.serviceThirdPartyHardware.thirdPartyHardwareCancel(
      params,
    );
  }

  // ---------------------------------------------------------------------------
  // Third-party hardware app management (Ledger-only for now).
  //
  // Wraps the SDK's `LedgerAdapter.installApp / listInstalledApps /
  // listAvailableApps`. The `hw` field on IThirdPartyHardwareAdapter is typed
  // as the generic IHardwareWallet; we cast to the Ledger-specific shape
  // because these methods aren't part of the cross-vendor contract.
  //
  // Install progress streams as SDK `ui-event` AppInstallProgress, surfaced to
  // the UI via the thirdPartyAppInstallAtom (it cannot ride through these
  // @backgroundMethod return values — the function callback contract doesn't
  // survive the IPC proxy).
  // ---------------------------------------------------------------------------

  @backgroundMethod()
  async thirdPartyHardwareInstallApp(params: {
    vendor: EHardwareVendor;
    connectId: string;
    appName: string;
  }) {
    return this.backgroundApi.serviceThirdPartyHardware.thirdPartyHardwareInstallApp(
      params,
    );
  }

  @backgroundMethod()
  async thirdPartyHardwareListInstalledApps(params: {
    vendor: EHardwareVendor;
    connectId: string;
  }) {
    return this.backgroundApi.serviceThirdPartyHardware.thirdPartyHardwareListInstalledApps(
      params,
    );
  }

  @backgroundMethod()
  async thirdPartyHardwareListInstalledAppNames(params: {
    vendor: EHardwareVendor;
    connectId: string;
  }) {
    return this.backgroundApi.serviceThirdPartyHardware.thirdPartyHardwareListInstalledAppNames(
      params,
    );
  }

  @backgroundMethod()
  async thirdPartyHardwareListAvailableApps(params: {
    vendor: EHardwareVendor;
    connectId: string;
  }) {
    return this.backgroundApi.serviceThirdPartyHardware.thirdPartyHardwareListAvailableApps(
      params,
    );
  }

  @backgroundMethod()
  async thirdPartyHardwareGetFirmwareVersion(params: {
    vendor: EHardwareVendor;
    connectId: string;
  }) {
    return this.backgroundApi.serviceThirdPartyHardware.thirdPartyHardwareGetFirmwareVersion(
      params,
    );
  }

  @backgroundMethod()
  async thirdPartyHardwareGetDeviceInfo(params: {
    vendor: EHardwareVendor;
    connectId: string;
  }) {
    return this.backgroundApi.serviceThirdPartyHardware.thirdPartyHardwareGetDeviceInfo(
      params,
    );
  }

  @backgroundMethod()
  async getEvmAddressByWalletState(params: {
    connectId: string;
    deviceId: string;
    path: string;
    vendor?: EHardwareVendor;
    passphraseState?: string;
    useEmptyPassphrase?: boolean;
  }): Promise<string | null> {
    const evmProfile = params.vendor
      ? getVendorProfile(params.vendor)
      : undefined;
    if (params.vendor && evmProfile?.isThirdParty) {
      // Third-party (Trezor / Ledger) goes through its own service + adapter.
      return this.backgroundApi.serviceThirdPartyHardware.getEvmAddressByWalletState(
        {
          connectId: params.connectId,
          deviceId: params.deviceId,
          path: params.path,
          vendor: params.vendor,
          passphraseState: params.passphraseState,
          useEmptyPassphrase: params.useEmptyPassphrase,
        },
      );
    }
    let compatibleConnectId = params.connectId;
    try {
      compatibleConnectId = await this.getCompatibleConnectId({
        connectId: params.connectId,
        featuresDeviceId: params.deviceId,
        hardwareCallContext: EHardwareCallContext.SILENT_CALL,
      });
      const hardwareSDK = await this.getSDKInstance({
        connectId: compatibleConnectId,
      });
      await this.waitForLegacyHardwareCallBoundary(compatibleConnectId);
      const evmAddressResponse = await convertDeviceResponse(() =>
        hardwareSDK?.evmGetAddress(compatibleConnectId, params.deviceId, {
          path: params.path,
          showOnOneKey: false,
          useEmptyPassphrase: params.useEmptyPassphrase,
          passphraseState: params.passphraseState,
        }),
      );
      if (evmAddressResponse.address && evmAddressResponse.address.length > 0) {
        return evmAddressResponse.address;
      }
      return null;
    } catch (error) {
      console.error('getEvmAddress error', error);
      return null;
    } finally {
      await this.waitForLegacyHardwareCallBoundary(compatibleConnectId);
    }
  }

  @backgroundMethod()
  async getEvmAddressByStandardWallet(params: {
    connectId: string;
    deviceId: string;
    path: string;
    vendor?: EHardwareVendor;
  }): Promise<string | null> {
    return this.getEvmAddressByWalletState({
      ...params,
      useEmptyPassphrase: true,
    });
  }

  @backgroundMethod()
  async buildHwWalletXfp({
    connectId,
    deviceId,
    passphraseState,
    throwError,
    withUserInteraction,
    vendor,
  }: {
    connectId: string | undefined | null;
    deviceId: string | undefined | null;
    passphraseState: string | undefined;
    throwError: boolean;
    withUserInteraction: boolean;
    vendor?: EHardwareVendor;
  }): Promise<string | undefined> {
    if (!connectId) {
      return;
    }
    const xfpProfile = vendor ? getVendorProfile(vendor) : undefined;
    if (xfpProfile?.isThirdParty) {
      // Trezor can supply XFP via its adapter (master fingerprint + taproot
      // xpub). Other third-party vendors (e.g. Ledger) stay XFP-less for now.
      if (vendor !== EHardwareVendor.trezor) {
        return undefined;
      }
      try {
        return await this.backgroundApi.serviceThirdPartyHardware.buildHwWalletXfp(
          {
            connectId,
            deviceId: deviceId || '',
            vendor,
            passphraseState,
          },
        );
      } catch (error) {
        // Never block wallet creation on third-party XFP; fall back to XFP-less.
        defaultLogger.hardware.sdkLog.log(
          `[ServiceHardware] getHwWalletXfp third-party failed: ${
            (error as Error)?.message ?? String(error)
          }`,
        );
        return undefined;
      }
    }
    let compatibleConnectId = connectId;
    try {
      compatibleConnectId = await this.getCompatibleConnectId({
        connectId,
        featuresDeviceId: deviceId,
        hardwareCallContext: withUserInteraction
          ? EHardwareCallContext.USER_INTERACTION
          : EHardwareCallContext.SILENT_CALL,
      });
      const hardwareSDK = await this.getSDKInstance({
        connectId: compatibleConnectId,
      });
      await this.waitForLegacyHardwareCallBoundary(compatibleConnectId);
      const result = await convertDeviceResponse(() => {
        return hardwareSDK.btcGetPublicKey(
          compatibleConnectId,
          deviceId || '',
          {
            path: BTC_FIRST_TAPROOT_PATH,
            showOnOneKey: false,
            useEmptyPassphrase: passphraseState ? undefined : true,
            passphraseState: passphraseState || undefined,
          },
        );
      });
      if (result.root_fingerprint && result.xpub) {
        const xfp = numberUtils
          .numberToHex(result.root_fingerprint, { prefix0x: false })
          .toLowerCase();
        const fullXfp = accountUtils.buildFullXfp({
          xfp,
          firstTaprootXpub: result.xpub,
        });
        return fullXfp;
      }
    } catch (error) {
      if (throwError) {
        throw error;
      }
      console.error('getHwWalletXfp ERROR: ', error);
    } finally {
      await this.waitForLegacyHardwareCallBoundary(compatibleConnectId);
    }
  }

  @backgroundMethod()
  async promptWebDeviceAccess(params: { deviceSerialNumberFromUI: string }) {
    const hardwareSDK = await this.getSDKInstance({
      connectId: undefined,
    });
    let result: { device: KnownDevice | null };
    try {
      result = await convertDeviceResponse(() =>
        hardwareSDK?.promptWebDeviceAccess(params),
      );
    } catch (error) {
      if (await this.recoverLinuxWebUsbAccessDeniedError(error)) {
        result = await convertDeviceResponse(() =>
          hardwareSDK?.promptWebDeviceAccess(params),
        );
      } else {
        throw error;
      }
    }
    const device = result.device as KnownDevice | undefined;
    await this.rememberDeviceProtocol({
      connectIds: [
        params.deviceSerialNumberFromUI,
        device?.connectId,
        (device as (KnownDevice & { serialNo?: string }) | undefined)?.serialNo,
        device?.uuid,
        device?.path,
      ],
      protocol:
        device?.state?.protocol ??
        (
          device as
            | (KnownDevice & { connectProtocol?: 'V1' | 'V2' })
            | undefined
        )?.connectProtocol ??
        device?.features?.protocol,
    });
    return result;
  }

  @backgroundMethod()
  async switchTransport({
    transportType,
  }: {
    transportType: EHardwareTransportType;
  }) {
    const hardwareSDK = await this.getSDKInstance({
      connectId: undefined,
    });
    let env: 'webusb' | 'desktop-web-ble' | 'web';
    if (transportType === EHardwareTransportType.WEBUSB) {
      env = 'webusb';
    } else if (transportType === EHardwareTransportType.DesktopWebBle) {
      env = 'desktop-web-ble';
    } else {
      env = 'web';
    }
    await hardwareSDK.switchTransport(env);
  }

  @backgroundMethod()
  async switchHardwareTransportType({
    transportType,
  }: {
    transportType: EHardwareTransportType;
  }) {
    return this.backgroundApi.serviceHardwareUI.runExclusiveOneKeyOperation(
      async () => {
        try {
          // 1. Update transport type setting
          await this.backgroundApi.serviceSetting.setHardwareTransportType(
            transportType,
          );

          // Recreate the SDK under the lifecycle lock when the transport changes.
          const newInstance = await this.getSDKInstance({
            connectId: undefined,
            hardwareTransportType: transportType,
          });

          console.log(
            `Successfully switched hardware transport type to: ${transportType}`,
          );

          return newInstance;
        } catch (error) {
          console.error('Failed to switch hardware transport type:', error);
          throw error;
        }
      },
    );
  }

  @backgroundMethod()
  async setForceTransportType({
    forceTransportType,
  }: {
    forceTransportType: EHardwareTransportType;
  }) {
    const nextForceTransportType =
      deviceUtils.normalizeHardwareTransportTypeForPlatform({
        transportType: forceTransportType,
      });
    const operationId = stringUtils.randomString(12);
    await hardwareForceTransportAtom.set({
      forceTransportType: nextForceTransportType,
      operationId,
    });
    defaultLogger.setting.device.setForceTransportType({
      forceTransportType: nextForceTransportType,
      operationId,
    });
  }

  @backgroundMethod()
  async clearForceTransportType() {
    await hardwareForceTransportAtom.set({
      forceTransportType: undefined,
      operationId: undefined,
    });
    defaultLogger.setting.device.clearForceTransportType();
  }

  @backgroundMethod()
  async getCurrentForceTransportType(): Promise<
    EHardwareTransportType | undefined
  > {
    const state = await hardwareForceTransportAtom.get();
    return state.forceTransportType;
  }

  @backgroundMethod()
  async getCurrentTransportType() {
    return this.connectionManager.getCurrentTransportType();
  }

  private shouldPrecheckNativeBleForHardwareCall({
    hardwareCallContext,
  }: {
    hardwareCallContext: EHardwareCallContext;
  }) {
    return (
      platformEnv.isNativeAndroid &&
      hardwareCallContext === EHardwareCallContext.USER_INTERACTION
    );
  }

  private async ensureNativeBleReadyForHardwareCall({
    connectId,
    hardwareCallContext,
    hardwareTransportType,
  }: {
    connectId: string;
    hardwareCallContext: EHardwareCallContext;
    hardwareTransportType?: EHardwareTransportType;
  }) {
    if (!this.shouldPrecheckNativeBleForHardwareCall({ hardwareCallContext })) {
      return;
    }

    const transportType =
      hardwareTransportType ?? (await this.getCurrentTransportType());
    if (transportType !== EHardwareTransportType.BLE) {
      return;
    }

    const hasBlePermission = !!(await checkBLEPermissions());
    if (!hasBlePermission) {
      appEventBus.emit(EAppEventBusNames.RequestHardwareUIDialog, {
        uiRequestType: EHardwareUiStateAction.LOCATION_PERMISSION,
      });
      throw new deviceErrors.NeedBluetoothPermissions({
        payload: { connectId },
      });
    }

    const isBluetoothOn = !!(await checkBLEState());
    if (!isBluetoothOn) {
      appEventBus.emit(EAppEventBusNames.RequestHardwareUIDialog, {
        uiRequestType: EHardwareUiStateAction.BLUETOOTH_PERMISSION,
      });
      throw new deviceErrors.NeedBluetoothTurnedOn({
        payload: { connectId },
      });
    }
  }

  @backgroundMethod()
  async detectUSBDeviceAvailability(params?: {
    connectId?: string;
    connectProtocol?: HardwareConnectProtocol;
  }) {
    return this.connectionManager.detectUSBDeviceAvailability(
      params?.connectId,
      params?.connectProtocol,
    );
  }

  @backgroundMethod()
  async repairBleConnectIdWithProgress({
    connectId,
    featuresDeviceId,
    features,
  }: {
    connectId?: string;
    featuresDeviceId?: string | undefined | null;
    features?: IOneKeyDeviceFeatures;
  }): Promise<string> {
    if (!connectId || !features) {
      throw new deviceErrors.DeviceNotFound({
        payload: {
          connectId,
          deviceId: featuresDeviceId || undefined,
          inBluetoothCommunication: true,
        },
      });
    }

    try {
      // Step 1: 绑定流程必须锁定 BLE，不得因为 USB 在扫描期间重新出现
      // 而枚举 USB 设备，否则 USB serial 可能被误写入 bleConnectId。
      const searchResult = await this.searchDevices({ transportType: 'ble' });
      if (!searchResult?.success || !searchResult?.payload?.length) {
        throw new deviceErrors.DeviceNotFound({
          payload: {
            connectId,
            deviceId: featuresDeviceId || undefined,
            inBluetoothCommunication: true,
          },
        });
      }

      // Step 2: Get expected device name from features
      const expectedDeviceName = features.bleName || features.ble_name;

      // Step 3: Find matching device by name
      const matchingDevice = searchResult.payload.find(
        (device) =>
          Boolean(device.connectId) &&
          deviceUtils.isBluetoothSearchDevice(device) &&
          isSameOnekeyBleName(device.name, expectedDeviceName),
      );

      if (!matchingDevice) {
        throw new deviceErrors.DeviceNotFound({
          payload: {
            connectId,
            deviceId: featuresDeviceId || undefined,
            inBluetoothCommunication: true,
          },
        });
      }

      const expectedDeviceId =
        featuresDeviceId ||
        deviceUtils.getRawDeviceId({
          device: matchingDevice as any,
          features,
        });

      const bleConnectId = matchingDevice.connectId;
      if (!bleConnectId) {
        throw new deviceErrors.DeviceNotFound({
          payload: {
            connectId,
            deviceId: featuresDeviceId || undefined,
            inBluetoothCommunication: true,
          },
        });
      }

      // Step 4: 使用同一个 BLE transport 连接并验证，不在候选设备上重新选路。
      const connectResult = await this.connect({
        device: {
          ...matchingDevice,
          connectId: bleConnectId,
          deviceId: expectedDeviceId,
        },
        forceProtocolDetection: true,
        hardwareCallContext:
          EHardwareCallContext.USER_INTERACTION_NO_BLE_DIALOG,
        hardwareTransportType: EHardwareTransportType.DesktopWebBle,
      });

      // Step 5: The identity read over the live connection decides which
      // record owns this endpoint. The caller's expected id can be stale —
      // a connectId-only caller resolves the pre-wipe record and the dialog
      // derives its id from that record's frozen features, which can never
      // match the live device — and requiring it to match would make this
      // repair (and the stale-alias cleanup it carries) permanently
      // unreachable on that path. V2 state projections only carry the raw
      // `device_id` field.
      const liveDeviceId = connectResult?.deviceId || connectResult?.device_id;
      if (connectResult && liveDeviceId) {
        const device = await localDb.getDeviceByQuery({
          connectId,
          featuresDeviceId: liveDeviceId,
          features,
        });

        if (device) {
          // The binding is persisted together with de-aliasing stale
          // siblings (e.g. the pre-wipe record keeping the same USB serial)
          // in one transaction, or the whole repair fails and retries.
          await this.persistVerifiedBleConnectId({
            dbDeviceId: device.id,
            bleConnectId,
            verifiedDeviceId: liveDeviceId,
          });

          return bleConnectId;
        }
      }

      throw new deviceErrors.DeviceNotFound({
        payload: {
          connectId,
          deviceId: featuresDeviceId || undefined,
          inBluetoothCommunication: true,
        },
      });
    } catch (error) {
      console.error('Repair BLE connectId with progress failed:', error);
      // Re-throw if it's already a hardware error
      if (error instanceof deviceErrors.OneKeyHardwareError) {
        throw error;
      }
      // Wrap other errors in DeviceNotFound
      throw new deviceErrors.DeviceNotFound({
        payload: {
          connectId,
          deviceId: featuresDeviceId || undefined,
          inBluetoothCommunication: true,
        },
      });
    }
  }

  // Returns the device's bleConnectId when the Trezor call should go over BLE,
  // undefined otherwise. Honors a BLE target directly; for a USB-family target
  // it re-verifies with a Trezor-scoped USB check — the global optimal-transport
  // probe answers "is any OneKey USB / Bridge device present", which can be true
  // while THIS Trezor is BLE-only, routing its calls to the USB handle and
  // burning a BLE connect timeout before the fallback ladder recovers.
  private async resolveTrezorPreferredBleConnectId({
    device,
    bleConnectId,
    targetType,
  }: {
    device: { vendor?: string };
    bleConnectId?: string;
    targetType: EHardwareTransportType;
  }): Promise<string | undefined> {
    if (!bleConnectId) {
      return undefined;
    }
    if (targetType === EHardwareTransportType.DesktopWebBle) {
      return bleConnectId;
    }
    if (device.vendor !== EHardwareVendor.trezor) {
      return undefined;
    }
    const trezorUsbPresent =
      await this.connectionManager.detectTrezorUSBDeviceAvailability();
    if (trezorUsbPresent) {
      return undefined;
    }
    return bleConnectId;
  }

  // connectId (lowercased) -> timestamp of the last DEVICE.STATE /
  // DEVICE.CONNECT event observed on it. Real traffic implies the endpoint
  // is connected and OS-paired at that moment; DEVICE.DISCONNECT deletes
  // the entry because factory reset and OS-level unpair surface as a
  // disconnect first, invalidating that proof.
  private liveConnectIdEvidence = new Map<string, number>();

  recordLiveConnectIdEvidence(connectId?: string | null) {
    const normalized = connectId?.trim().toLowerCase();
    if (!normalized) {
      return;
    }
    this.liveConnectIdEvidence.set(normalized, Date.now());
  }

  clearLiveConnectIdEvidence(connectId?: string | null) {
    const normalized = connectId?.trim().toLowerCase();
    if (!normalized) {
      return;
    }
    this.liveConnectIdEvidence.delete(normalized);
  }

  private hasRecentLiveConnectIdEvidence(connectId: string): boolean {
    const stampedAt = this.liveConnectIdEvidence.get(
      connectId.trim().toLowerCase(),
    );
    return (
      stampedAt !== undefined &&
      Date.now() - stampedAt <= LIVE_CONNECT_ID_EVIDENCE_WINDOW_MS
    );
  }

  /**
   * Persist a BLE binding whose device identity was just verified against
   * the live device, atomically de-aliasing stale sibling records in the
   * same transaction. Errors propagate on purpose: nothing is committed on
   * failure, so the caller's bind path (pairing repair / silent bind) stays
   * fully retryable — a binding committed without the cleanup would make
   * the stale sibling shadow connectId-only lookups permanently.
   */
  private async persistVerifiedBleConnectId({
    dbDeviceId,
    bleConnectId,
    verifiedDeviceId,
  }: {
    dbDeviceId: string;
    bleConnectId: string;
    verifiedDeviceId: string;
  }) {
    const { cleanedRecordIds } =
      await localDb.updateDeviceBleConnectIdAndCleanStaleAliases({
        dbDeviceId,
        bleConnectId,
        verifiedDeviceId,
      });
    if (cleanedRecordIds.length) {
      defaultLogger.hardware.sdkLog.log(
        'persistVerifiedBleConnectId: cleared stale sibling connect-id aliases',
        JSON.stringify({ dbDeviceId, cleanedRecordIds }),
      );
    }
  }

  /**
   * Silently bind a live desktop BLE connectId held by the caller onto a
   * device record that lacks a BLE binding, so an in-progress BLE session
   * never raises the Bluetooth pairing dialog (OK-60091).
   *
   * Only attempted when the incoming connectId differs from the record's USB
   * identifiers (connectId/usbConnectId) — a USB serial input means a genuine
   * USB→BLE switch, which must keep the scan + pairing-dialog repair flow —
   * AND the connectId carried real device traffic within
   * LIVE_CONNECT_ID_EVIDENCE_WINDOW_MS, which proves the endpoint is
   * connected and OS-paired, so the probe can never summon the OS pairing
   * prompt. The endpoint is then verified with a bounded silent getFeatures
   * probe that must report the expected raw deviceId; on an active session
   * this reuses the live connection and answers in a few seconds. Any
   * failure returns undefined so the caller falls back to the existing
   * pairing-dialog flow.
   */
  private async silentlyBindLiveDesktopBleConnectId({
    device,
    connectId,
    featuresDeviceId,
    features,
  }: {
    device: IDBDevice;
    connectId: string;
    featuresDeviceId?: string | undefined | null;
    features?: IOneKeyDeviceFeatures;
  }): Promise<string | undefined> {
    const normalizedConnectId = connectId.trim().toLowerCase();
    if (!normalizedConnectId) {
      return undefined;
    }
    const isUsbAliasInput = [device.connectId, device.usbConnectId].some(
      (candidate) => candidate?.trim().toLowerCase() === normalizedConnectId,
    );
    if (isUsbAliasInput) {
      return undefined;
    }
    // Probe only endpoints that demonstrably carried device traffic moments
    // ago. Anything else (e.g. a stale UUID kept by the UI across a device
    // reboot or an unpair) might be an unpaired peripheral, and the probe's
    // characteristic subscription would summon the OS pairing prompt with
    // no app guidance UI — those cases must keep the pairing-dialog flow.
    if (!this.hasRecentLiveConnectIdEvidence(connectId)) {
      return undefined;
    }
    const expectedDeviceId =
      featuresDeviceId ||
      deviceUtils.getRawDeviceId({
        device: deviceUtils.dbDeviceToSearchDevice(device),
        features: features || device.featuresInfo,
      });
    if (!expectedDeviceId) {
      return undefined;
    }
    // A live session always has a remembered protocol (rememberDeviceProtocol
    // runs on every DEVICE.STATE event). Pin it: forcing re-detection here
    // sends a Protocol V2 Ping into an active V1 session, which the device
    // may not answer (observed as SDK error 713), while a protocol-pinned
    // getFeatures is exactly the same shape as the session's healthy calls.
    const knownProtocol = await this.getKnownDeviceProtocol(connectId);
    if (!knownProtocol) {
      return undefined;
    }
    try {
      // Probe the caller's connectId directly over the pinned BLE transport;
      // no connectId re-resolution happens here, so this cannot re-enter
      // getCompatibleConnectId. silentMode must reach convertDeviceResponse:
      // a failed probe would otherwise emit the global DeviceNotFound error
      // dialog from the error constructor. The short SDK timeout keeps the
      // pairing-dialog fallback fast when the endpoint is stale.
      const connectResult = await this.getFeaturesWithoutCache({
        connectId,
        silentMode: true,
        hardwareCallContext:
          EHardwareCallContext.USER_INTERACTION_NO_BLE_DIALOG,
        hardwareTransportType: EHardwareTransportType.DesktopWebBle,
        params: {
          retryCount: 1,
          connectProtocol: knownProtocol,
          timeout: DESKTOP_BLE_SILENT_BIND_CONNECTION_TIMEOUT_MS,
        },
      });
      // The probe identity must come from the probe result itself. V1
      // features carry the SDK-normalized `deviceId`; V2 state projections
      // (projectLegacyDeviceFeaturesFromState) only carry the raw
      // `device_id` field.
      const probedDeviceId =
        connectResult?.deviceId || connectResult?.device_id || '';
      if (probedDeviceId && probedDeviceId === expectedDeviceId) {
        await this.persistVerifiedBleConnectId({
          dbDeviceId: device.id,
          bleConnectId: connectId,
          verifiedDeviceId: probedDeviceId,
        });
        return connectId;
      }
    } catch (error) {
      console.error('Silent BLE connectId bind failed:', error);
    }
    return undefined;
  }

  @backgroundMethod()
  async getCompatibleConnectId({
    hardwareCallContext,
    connectId,
    featuresDeviceId,
    features,
    vendor,
    hardwareTransportType,
  }: {
    hardwareCallContext: EHardwareCallContext;
    connectId?: string;
    featuresDeviceId?: string | undefined | null; // rawDeviceId
    features?: IOneKeyDeviceFeatures;
    vendor?: EHardwareVendor;
    hardwareTransportType?: EHardwareTransportType;
  }) {
    // Allow connectId to be null in the following EHardwareCallContext cases
    if (
      EHardwareCallContext.UPDATE_FIRMWARE === hardwareCallContext &&
      !connectId &&
      !featuresDeviceId &&
      !features
    ) {
      return '';
    }

    if (!connectId) {
      throw new OneKeyLocalError('connectId is required');
    }

    // A transport connect ID is a precise device key only while it is unique:
    // a device wipe keeps the serial-based connectId on the stale record, so
    // an identity-qualified match must win over the connectId-only match —
    // otherwise reads resolve the stale record (no bleConnectId → pairing
    // dialog) while BLE repairs write to the live one, looping forever. Stale
    // device info must still never veto a valid USB/BLE ID match, hence the
    // connectId-only fallback.
    let device: IDBDevice | undefined;
    if (featuresDeviceId) {
      device = await localDb.getDeviceByQuery({
        connectId,
        featuresDeviceId,
        vendor,
      });
    }
    if (!device) {
      device = await localDb.getDeviceByQuery({ connectId, vendor });
    }
    if (!device && featuresDeviceId) {
      device = await localDb.getDeviceByQuery({
        featuresDeviceId,
        vendor,
      });
    }
    // Features are not an identity source for DeviceState-backed devices. This
    // final fallback only supports legacy records that have not connected yet.
    if (!device && features) {
      device = await localDb.getDeviceByQuery({ features, vendor });
    }
    const persistedDesktopBleConnectId =
      getPersistedDesktopBleConnectId(device);

    // Third-party devices keep USB as the primary connectId, but Trezor can
    // have a bound BLE connectId after USB->BLE pairing. Prefer the bound BLE
    // handle only when the active target transport is DesktopWebBle; do not
    // fall through to OneKey's generic BLE pairing dialog for unbound devices.
    if (device?.vendor) {
      const vp = getVendorProfile(device.vendor);
      if (vp.isThirdParty) {
        if (!platformEnv.isSupportDesktopBle) {
          return device.connectId || connectId;
        }
        if (
          hardwareCallContext === EHardwareCallContext.BACKGROUND_TASK ||
          hardwareCallContext ===
            EHardwareCallContext.BACKGROUND_NON_INTERACTIVE
        ) {
          const currentTransportType =
            hardwareTransportType ?? (await this.getCurrentTransportType());
          const preferredBle = await this.resolveTrezorPreferredBleConnectId({
            device,
            bleConnectId: persistedDesktopBleConnectId,
            targetType: currentTransportType,
          });
          return preferredBle || device.connectId || connectId;
        }

        const result = await this.connectionManager.resolveTransportType({
          connectId: device.connectId || connectId,
          hardwareCallContext,
        });
        const preferredBle = await this.resolveTrezorPreferredBleConnectId({
          device,
          bleConnectId: persistedDesktopBleConnectId,
          targetType: result.targetType,
        });
        return preferredBle || device.connectId || connectId;
      }
    }

    await this.ensureNativeBleReadyForHardwareCall({
      connectId,
      hardwareCallContext,
      hardwareTransportType,
    });

    if (!platformEnv.isSupportDesktopBle) {
      if (platformEnv.isNative) {
        if (device?.bleConnectId?.toLowerCase() === connectId.toLowerCase()) {
          // Preserve the current scan result, including the UUID casing returned by iOS.
          return connectId;
        }
        return device?.bleConnectId || connectId;
      }
      return device?.connectId || connectId;
    }

    const connectProtocol = await this.getKnownDeviceProtocol(
      device?.connectId || connectId,
    );

    if (
      hardwareCallContext === EHardwareCallContext.BACKGROUND_TASK ||
      hardwareCallContext === EHardwareCallContext.BACKGROUND_NON_INTERACTIVE
    ) {
      const currentTransportType =
        hardwareTransportType ?? (await this.getCurrentTransportType());
      if (currentTransportType === EHardwareTransportType.DesktopWebBle) {
        if (persistedDesktopBleConnectId) {
          return persistedDesktopBleConnectId;
        }
      }
      // 后台任务不能发起 BLE 配对，也不应把缺少 BLE 绑定误判为设备离线。
      // 移除硬件钱包等纯本地操作仍需要读取设备参数，因此沿用已持久化的
      // USB connectId；真正需要连接的硬件调用会在后续传输层完成可达性校验。
      return device?.connectId || connectId;
    }

    const result = await this.connectionManager.resolveTransportType({
      connectId: device?.connectId || connectId,
      connectProtocol,
      hardwareCallContext,
    });
    const targetTransportType = result.targetType;
    // Handle connection logic based on transport type
    if (targetTransportType === EHardwareTransportType.DesktopWebBle) {
      if (persistedDesktopBleConnectId) {
        // Device found in DB and has BLE connectId, use it
        return persistedDesktopBleConnectId;
      }
      if (!device) {
        return connectId;
      }
      if (device && !persistedDesktopBleConnectId) {
        if (hardwareCallContext === EHardwareCallContext.SILENT_CALL) {
          return device.usbConnectId || device.connectId || connectId;
        }
        // The caller may already hold a live BLE connectId (e.g. onboarding
        // communicates over an active Noble session while the device record
        // was created via USB and lacks bleConnectId). Verify and persist it
        // silently before falling back to the pairing dialog (OK-60091).
        const silentlyBoundBleConnectId =
          await this.silentlyBindLiveDesktopBleConnectId({
            device,
            connectId,
            featuresDeviceId,
            features,
          });
        if (silentlyBoundBleConnectId) {
          return silentlyBoundBleConnectId;
        }
        if (
          hardwareCallContext ===
          EHardwareCallContext.USER_INTERACTION_NO_BLE_DIALOG
        ) {
          throw new deviceErrors.DeviceNotFound({
            payload: {
              connectId,
              deviceId: featuresDeviceId || device.deviceId || undefined,
              inBluetoothCommunication: true,
            },
          });
        }
        // Use servicePromise to wait for UI dialog to complete BLE pairing
        const bleConnectId = await new Promise<string>((resolve, reject) => {
          const promiseId = this.backgroundApi.servicePromise.createCallback({
            resolve,
            reject,
          });

          // Show the new Bluetooth device pairing dialog with promiseId
          void this.backgroundApi.serviceHardwareUI.showBluetoothDevicePairingDialog(
            {
              device,
              deviceId:
                featuresDeviceId ||
                deviceUtils.getRawDeviceId({
                  device: deviceUtils.dbDeviceToSearchDevice(device),
                  features: device.featuresInfo,
                }) ||
                '',
              usbConnectId:
                device.usbConnectId || device.connectId || connectId,
              features: features || device.featuresInfo,
              promiseId,
            },
          );
        });

        // Validate bleConnectId result
        if (!bleConnectId) {
          throw new deviceErrors.DeviceNotFound({
            payload: {
              connectId,
              deviceId: featuresDeviceId || undefined,
              message: 'Failed to obtain BLE connectId during pairing process',
            },
          });
        }

        return bleConnectId;
      }
    }

    return device?.connectId || connectId;
  }

  /**
   * 统一解析一次硬件调用所使用的传输类型与 connectId。
   *
   * 调用方不应先单独选传输、再自行在 USB/BLE ID 之间转换；那会在固件升级
   * 等多阶段流程中把 BLE UUID 再次替换成 USB serial。该方法保证两者来自
   * 同一次探测结果，并且在 UI 显示前提交运行时传输状态。
   */
  @backgroundMethod()
  async resolveHardwareTransport(params: {
    hardwareCallContext: EHardwareCallContext;
    connectId?: string;
    featuresDeviceId?: string | undefined | null;
    features?: IOneKeyDeviceFeatures;
  }): Promise<{
    connectId: string;
    transportType: EHardwareTransportType;
  }> {
    const resolvedConnectId = await this.getCompatibleConnectId(params);
    return {
      connectId: resolvedConnectId,
      transportType: await this.getCurrentTransportType(),
    };
  }

  /**
   * 在通用硬件弹窗显示前确定并提交传输类型。
   * connectId 的 USB/BLE 映射仍由 resolveHardwareTransport 统一完成。
   */
  @backgroundMethod()
  async prepareHardwareTransport(params: {
    connectId?: string;
    connectProtocol?: HardwareConnectProtocol;
    hardwareCallContext: EHardwareCallContext;
    persistTransportType?: boolean;
    requestedTransportType?: 'usb' | 'ble';
  }): Promise<EHardwareTransportType> {
    const connectProtocol =
      params.connectProtocol ??
      (await this.getKnownDeviceProtocol(params.connectId));
    if (params.requestedTransportType) {
      const targetType =
        await this.connectionManager.getTransportTypeForChannel({
          transportType: params.requestedTransportType,
          connectProtocol,
        });
      if (params.persistTransportType !== false) {
        await this.connectionManager.setCurrentTransportType(targetType);
      }
      return targetType;
    }
    const transportParams = {
      connectId: params.connectId,
      hardwareCallContext: params.hardwareCallContext,
      connectProtocol,
    };
    const result =
      params.persistTransportType === false
        ? await this.connectionManager.shouldSwitchTransportType(
            transportParams,
          )
        : await this.connectionManager.resolveTransportType(transportParams);
    return result.targetType;
  }

  @backgroundMethod()
  async isBtcOnlyWallet({ walletId }: { walletId: string }) {
    if (
      accountUtils.isHwWallet({ walletId }) ||
      accountUtils.isQrWallet({ walletId })
    ) {
      try {
        const device = await this.backgroundApi.serviceAccount.getWalletDevice({
          walletId,
        });
        return await deviceUtils.isBtcOnlyFirmware({
          features: device?.featuresInfo,
        });
      } catch {
        return false;
      }
    }
    return false;
  }

  @backgroundMethod()
  async fetchHardwareHomeScreen({
    deviceType,
    serialNumber,
    firmwareVersion,
  }: {
    deviceType: IDeviceType;
    serialNumber: string;
    firmwareVersion: string;
  }): Promise<IHardwareHomeScreenData[]> {
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const response = await client.get<{
      data: IHardwareHomeScreenResponse[];
    }>('/utility/v1/wallet-homescreen/list', {
      params: {
        deviceType,
        serialNumber,
        firmwareVersion,
      },
    });
    const { data } = response.data;
    return data
      .filter((item) => item.deviceTypes.includes(deviceType))
      .filter(
        (item) =>
          item.resType === 'system' ||
          item.resType === 'prebuilt' ||
          item.resType === 'custom',
      )
      .filter(
        (item) =>
          item.wallpaperType === 'default' ||
          item.wallpaperType === 'cobranding',
      )
      .map((item) => ({
        id: item.id,
        wallpaperType: item.wallpaperType,
        resType: item.resType,
        url: item.url,
        screenHex: item.screenHex,
        nameHex: item.nameHex,
      }));
  }

  @backgroundMethod()
  async clearAllBleConnectIdsForTesting(): Promise<void> {
    try {
      // Get all devices from database
      const { devices } = await localDb.getAllDevices();

      if (devices.length === 0) {
        console.log('No devices found in database');
        return;
      }

      // Filter devices that have bleConnectId
      const devicesWithBle = devices.filter((device) => device.bleConnectId);

      if (devicesWithBle.length === 0) {
        console.log('No devices with bleConnectId found');
        return;
      }

      console.log(`Clearing bleConnectId for ${devicesWithBle.length} devices`);

      // Clear bleConnectId for each device using the existing update method
      for (const device of devicesWithBle) {
        await localDb.cleanDeviceConnectId({ dbDeviceId: device.id });
        console.log(
          `Cleared bleConnectId for device: ${device.name || device.id}`,
        );
      }

      console.log('Successfully cleared all bleConnectId fields for testing');
    } catch (error) {
      console.error('Failed to clear bleConnectId fields:', error);
      throw error;
    }
  }
}

export default ServiceHardware;
