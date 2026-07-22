import { EDeviceType, EFirmwareType } from '@onekeyfe/hd-shared';
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
  CoreSDKLoader,
  getHardwareSDKInstance,
  resetHardwareSDKInstance,
} from '@onekeyhq/shared/src/hardware/instance';
import { getVendorProfile } from '@onekeyhq/shared/src/hardware/vendorProfile';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import cacheUtils, { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import deviceHomeScreenUtils, {
  DEFAULT_T1_HOME_SCREEN_INFORMATION,
  T1_HOME_SCREEN_DEFAULT_IMAGES,
} from '@onekeyhq/shared/src/utils/deviceHomeScreenUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
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

import { DeviceSettingsManager } from './DeviceSettingsManager';
import { HardwareConnectionManager } from './HardwareConnectionManager';
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
} from '@onekeyfe/hd-core';
import type { HardwareConnectProtocol } from '@onekeyfe/hd-shared';

const DEVICE_PIN_ON_DEVICE_TYPES = new Set<IDeviceType>([
  EDeviceType.Touch,
  EDeviceType.Pro,
  EDeviceType.Pro2,
]);
const SKIP_APP_FIRMWARE_UPDATE_EVENT = true;

export type IDeviceGetFeaturesOptions = {
  connectId: string | undefined;
  vendor?: EHardwareVendor;
  withHardwareProcessing?: boolean;
  silentMode?: boolean;
  params?: CommonParams & {
    allowEmptyConnectId?: boolean;
  };
  hardwareCallContext?: IHardwareCallContext;
};

export type IDeviceGetStateOptions = Omit<
  IDeviceGetFeaturesOptions,
  'params'
> & {
  params?: CommonParams &
    GetDeviceStateParams & {
      allowEmptyConnectId?: boolean;
    };
};

export type IPro2DeviceManagementSnapshot = {
  state: IOneKeyDeviceState;
};

export type IPro2DeviceSettingsPage =
  | 'DeviceReset'
  | 'DevicePinChange'
  | 'DevicePassphrase'
  | 'DeviceAirgap';

const nullableToUndefined = (value?: string | null) => value ?? undefined;

function buildOnekeyFeaturesFromState(
  state: IOneKeyDeviceState,
): OnekeyFeatures {
  const rawFeatures = {
    ...state.raw?.protocolV1OneKeyFeatures,
  } as OnekeyFeatures;
  const { verification: verify, versions } = state;

  return {
    ...rawFeatures,
    onekey_serial_no: rawFeatures.onekey_serial_no || state.identity.serialNo,
    onekey_ble_name:
      rawFeatures.onekey_ble_name || state.identity.bleName || '',
    onekey_firmware_version:
      rawFeatures.onekey_firmware_version ??
      nullableToUndefined(versions.firmware),
    onekey_boot_version:
      rawFeatures.onekey_boot_version ??
      nullableToUndefined(versions.bootloader),
    onekey_board_version:
      rawFeatures.onekey_board_version ?? nullableToUndefined(versions.board),
    onekey_ble_version:
      rawFeatures.onekey_ble_version ?? nullableToUndefined(versions.ble),
    onekey_firmware_hash:
      rawFeatures.onekey_firmware_hash ?? verify?.firmwareHash,
    onekey_boot_hash: rawFeatures.onekey_boot_hash ?? verify?.bootloaderHash,
    onekey_board_hash: rawFeatures.onekey_board_hash ?? verify?.boardHash,
    onekey_ble_hash: rawFeatures.onekey_ble_hash ?? verify?.bleHash,
    onekey_firmware_build_id:
      rawFeatures.onekey_firmware_build_id ?? verify?.firmwareBuildId,
    onekey_boot_build_id:
      rawFeatures.onekey_boot_build_id ?? verify?.bootloaderBuildId,
    onekey_board_build_id:
      rawFeatures.onekey_board_build_id ?? verify?.boardBuildId,
    onekey_ble_build_id: rawFeatures.onekey_ble_build_id ?? verify?.bleBuildId,
    onekey_se01_version:
      rawFeatures.onekey_se01_version ?? nullableToUndefined(versions.se01),
    onekey_se02_version:
      rawFeatures.onekey_se02_version ?? nullableToUndefined(versions.se02),
    onekey_se03_version:
      rawFeatures.onekey_se03_version ?? nullableToUndefined(versions.se03),
    onekey_se04_version:
      rawFeatures.onekey_se04_version ?? nullableToUndefined(versions.se04),
    onekey_se01_hash: rawFeatures.onekey_se01_hash ?? verify?.se01Hash,
    onekey_se02_hash: rawFeatures.onekey_se02_hash ?? verify?.se02Hash,
    onekey_se03_hash: rawFeatures.onekey_se03_hash ?? verify?.se03Hash,
    onekey_se04_hash: rawFeatures.onekey_se04_hash ?? verify?.se04Hash,
    onekey_se01_build_id:
      rawFeatures.onekey_se01_build_id ?? verify?.se01BuildId,
    onekey_se02_build_id:
      rawFeatures.onekey_se02_build_id ?? verify?.se02BuildId,
    onekey_se03_build_id:
      rawFeatures.onekey_se03_build_id ?? verify?.se03BuildId,
    onekey_se04_build_id:
      rawFeatures.onekey_se04_build_id ?? verify?.se04BuildId,
    onekey_se01_boot_version:
      rawFeatures.onekey_se01_boot_version ??
      nullableToUndefined(versions.se01Boot),
    onekey_se02_boot_version:
      rawFeatures.onekey_se02_boot_version ??
      nullableToUndefined(versions.se02Boot),
    onekey_se03_boot_version:
      rawFeatures.onekey_se03_boot_version ??
      nullableToUndefined(versions.se03Boot),
    onekey_se04_boot_version:
      rawFeatures.onekey_se04_boot_version ??
      nullableToUndefined(versions.se04Boot),
    onekey_se01_boot_hash:
      rawFeatures.onekey_se01_boot_hash ?? verify?.se01BootHash,
    onekey_se02_boot_hash:
      rawFeatures.onekey_se02_boot_hash ?? verify?.se02BootHash,
    onekey_se03_boot_hash:
      rawFeatures.onekey_se03_boot_hash ?? verify?.se03BootHash,
    onekey_se04_boot_hash:
      rawFeatures.onekey_se04_boot_hash ?? verify?.se04BootHash,
    onekey_se01_boot_build_id:
      rawFeatures.onekey_se01_boot_build_id ?? verify?.se01BootBuildId,
    onekey_se02_boot_build_id:
      rawFeatures.onekey_se02_boot_build_id ?? verify?.se02BootBuildId,
    onekey_se03_boot_build_id:
      rawFeatures.onekey_se03_boot_build_id ?? verify?.se03BootBuildId,
    onekey_se04_boot_build_id:
      rawFeatures.onekey_se04_boot_build_id ?? verify?.se04BootBuildId,
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
  private activeHardwareConnectIds = new Set<string>();

  /** 合并同一连接并发发起的设备管理读取，避免硬件请求互相争用。 */
  private pro2DeviceManagementSnapshotInFlight = new Map<
    string,
    Promise<IPro2DeviceManagementSnapshot>
  >();

  private bridgeAvailabilityChecked = false;

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

  private connectedDeviceTracked = new Set<string>();

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

  async getSDKInstance(options: {
    connectId: string | undefined;
    hardwareCallContext?: EHardwareCallContext;
  }) {
    const { hardwareCallContext = EHardwareCallContext.USER_INTERACTION } =
      options || {};
    this.checkSdkVersionValid();
    await this.assertOneKeySdkConnectId(options?.connectId);

    const { hardwareConnectSrc } = await settingsPersistAtom.get();
    const isPreRelease =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'usePreReleaseConfig',
      );
    const hardwareConfigUrl =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'hardwareConfigUrl',
      );
    const debugMode =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'showDeviceDebugLogs',
      );

    let hardwareTransportType =
      await this.connectionManager.getCurrentTransportType();
    let shouldSwitch = false;

    // Desktop Auto switch transport type
    if (platformEnv.isSupportDesktopBle) {
      // Check if we should switch transport type based on optimal connection strategy
      const result = await this.connectionManager.shouldSwitchTransportType({
        connectId: options?.connectId,
        hardwareCallContext,
      });
      shouldSwitch = result.shouldSwitch;
      hardwareTransportType = result.targetType;
      // If transport type needs to be switched, update it
      if (shouldSwitch) {
        const currentTransportType =
          await this.connectionManager.getCurrentTransportType();
        console.log(
          `🔄 TRANSPORT SWITCH: ${
            currentTransportType ?? 'null'
          } → ${hardwareTransportType}`,
        );

        // Reset SDK instance to use new transport type
        await resetHardwareSDKInstance();
        this.activeHardwareConnectIds.clear();
        this.registeredEvents = false;

        console.log('✅ TRANSPORT SWITCH: SDK reset completed');
      }
    }

    // Update the connection manager's current transport type AFTER switch logic
    this.connectionManager.setCurrentTransportType(hardwareTransportType);

    try {
      if (hardwareConfigUrl) {
        console.log(
          '[HardwareSDK] using hardware config source:',
          hardwareConfigUrl,
        );
      }

      const instance = await getHardwareSDKInstance({
        hardwareTransportType,
        // https://data.onekey.so/pre-config.json?noCache=1714090312200
        // https://data.onekey.so/config.json?nocache=0.8336416330053136
        isPreRelease: !hardwareConfigUrl && isPreRelease === true,
        hardwareConfigUrl: hardwareConfigUrl || undefined,
        hardwareConnectSrc,
        debugMode,
      });

      // TODO re-register events when hardwareConnectSrc or isPreRelease changed
      await this.checkBridgeAndFallbackToWebUSB({
        hardwareSDKInstance: instance,
      });
      await this.registerSdkEvents(instance);

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
  }: {
    originEvent: UiEvent;
    usedPayload: IHardwareUiPayload;
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
        const supportInputPinOnSoftware =
          dbDevice?.settings?.inputPinOnSoftware !== false &&
          inputPinOnSoftware.support;

        const isAttachPin = type === 'PinMatrixRequestType_AttachToPin';
        newPayload.requestPinType = isAttachPin ? 'AttachPin' : undefined;

        if (!supportInputPinOnSoftware) {
          await this.backgroundApi.serviceHardwareUI.showEnterPinOnDevice();
          newUiRequestType = EHardwareUiStateAction.EnterPinOnDevice;
        }
      }
    }

    if (originEvent.type === EHardwareUiStateAction.FIRMWARE_TIP) {
      newPayload.firmwareTipData = originEvent.payload.data;
    }

    if (originEvent.type === EHardwareUiStateAction.FIRMWARE_PROGRESS) {
      newPayload.firmwareProgress = originEvent.payload.progress;
      newPayload.firmwareProgressType = originEvent.payload.progressType;
    }

    if (originEvent.type === EHardwareUiStateAction.REQUEST_PASSPHRASE) {
      copyWalletSessionUiMetadata(newPayload, originEvent.payload);
    }

    return {
      uiRequestType: newUiRequestType,
      payload: newPayload,
    };
  }

  async registerSdkEvents(instance: CoreApi) {
    if (!this.registeredEvents) {
      this.registeredEvents = true;
      const {
        UI_EVENT,
        DEVICE,
        LOG_EVENT,
        FIRMWARE,
        FIRMWARE_EVENT,
        // UI_REQUEST,
      } = await CoreSDKLoader();
      instance.on(UI_EVENT, async (e) => {
        const originEvent = e as UiEvent;
        const { type: uiRequestType, payload } = e;
        // console.log('=>>>> UI_EVENT: ', uiRequestType, payload);
        defaultLogger.hardware.sdkLog.uiEvent(uiRequestType, payload);

        const { device, type: eventType, passphraseState } = payload || {};
        const { deviceType, connectId, deviceId, features } = device || {};
        const deviceMode = await this.getDeviceModeFromFeatures({
          features: features || {},
        });
        const isBootloaderMode = deviceMode === EOneKeyDeviceMode.bootloader;

        const usedPayload: IHardwareUiPayload = {
          uiRequestType,
          eventType,
          deviceType,
          deviceId,
          connectId,
          deviceMode,
          isBootloaderMode: Boolean(isBootloaderMode),
          passphraseState,
          rawPayload: payload,
        };

        const { uiRequestType: newUiRequestType, payload: newPayload } =
          await this.specialProcessingEvent({
            originEvent,
            usedPayload,
          });

        // >>> mock hardware forceInputOnDevice
        // if (usedPayload) {
        //   usedPayload.supportInputPinOnSoftware = false;
        // }

        // skip ui-close_window event, which cause infinite loop
        //  ( emit ui-close_window -> Dialog close -> sdk cancel -> emit ui-close_window )
        if (!SKIPPED_EVENTS.has(newUiRequestType)) {
          defaultLogger.hardware.sdkLog.updateHardwareUiStateAtom({
            action: newUiRequestType,
            connectId,
            payload: newPayload,
          });

          if (NEW_DIALOG_EVENTS.has(newUiRequestType)) {
            appEventBus.emit(EAppEventBusNames.RequestHardwareUIDialog, {
              uiRequestType: newUiRequestType,
            });
          } else if (
            newUiRequestType ===
            EHardwareUiStateAction.REQUEST_DEVICE_IN_BOOTLOADER_FOR_WEB_DEVICE
          ) {
            appEventBus.emit(
              EAppEventBusNames.RequestDeviceInBootloaderForWebDevice,
              undefined,
            );
          } else if (
            newUiRequestType ===
            EHardwareUiStateAction.REQUEST_DEVICE_FOR_SWITCH_FIRMWARE_WEB_DEVICE
          ) {
            appEventBus.emit(
              EAppEventBusNames.RequestDeviceForSwitchFirmwareWebDevice,
              undefined,
            );
          } else {
            if (newUiRequestType === ('ui-device_progress' as any)) {
              console.log('ui-device_progress', originEvent);
            }
            // show hardware ui dialog
            await hardwareUiStateAtom.set(
              (): IHardwareUiState => ({
                action: newUiRequestType,
                connectId,
                payload: newPayload,
              }),
            );
          }
        }
        await hardwareUiStateCompletedAtom.set({
          action: newUiRequestType,
          connectId,
          payload: newPayload,
        });
      });

      instance.on(DEVICE.STATE, async (event: DeviceStateEvent) => {
        const { state, revision } = event;
        serviceHardwareUtils.hardwareLog('device state update', event);
        await localDb.updateDeviceState({ connectId: event.connectId, state });
        appEventBus.emit(EAppEventBusNames.HardwareDeviceStateUpdate, {
          ...event,
          state,
          revision,
        });
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

          // TODO: save features to dbDevice
          serviceHardwareUtils.hardwareLog('features update', features);

          void localDb.updateDevice({
            features,
          });
        },
      );

      instance.on(DEVICE.CONNECT, (message: { device: KnownDevice }) => {
        const activeConnectId = message.device?.connectId;
        if (activeConnectId) {
          this.activeHardwareConnectIds.add(activeConnectId);
        }
        const { features } = message.device || {};
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
        const activeConnectId = message.device?.connectId;
        if (activeConnectId) {
          this.activeHardwareConnectIds.delete(activeConnectId);
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

          if (
            messageType.includes('@onekey/hd-core') ||
            messageType.includes('@onekey/hd-transport') ||
            messageType.includes('@onekey/hd-ble-transport')
          ) {
            defaultLogger.hardware.sdkLog.log(
              messages.event,
              messages.payload.join(' '),
            );
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
    this.registeredEvents = false;
    this.activeHardwareConnectIds.clear();
    await resetHardwareSDKInstance();
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
  async searchDevices(params?: {
    connectProtocol?: HardwareConnectProtocol;
    vendor?: EHardwareVendor;
    resetSession?: boolean;
    waitForAllTransports?: boolean;
    transportType?: 'usb' | 'ble';
  }) {
    const vendorProfile = params?.vendor
      ? getVendorProfile(params.vendor)
      : undefined;
    if (params?.vendor && vendorProfile?.isThirdParty) {
      // Third-party (Trezor / Ledger) discovery lives in ServiceThirdPartyHardware.
      return this.backgroundApi.serviceThirdPartyHardware.searchDevices({
        vendor: params.vendor,
        resetSession: params.resetSession,
        waitForAllTransports: params.waitForAllTransports,
        transportType: params.transportType,
      });
    }

    // Original OneKey SDK path
    const hardwareSDK = await this.getSDKInstance({
      connectId: undefined,
    });
    const response = await hardwareSDK?.searchDevices(
      params?.connectProtocol
        ? { connectProtocol: params.connectProtocol }
        : undefined,
    );
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
        const retryResponse = await hardwareSDK?.searchDevices(
          params?.connectProtocol
            ? { connectProtocol: params.connectProtocol }
            : undefined,
        );
        defaultLogger.hardware.sdkLog.log(
          'searchDevices response after udev rules: ',
          JSON.stringify(retryResponse),
        );
        return retryResponse;
      }
    }
    return response;
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
      hardwareCallContext,
    });
    return convertDeviceResponse(() =>
      hardwareSDK.deviceGetOnboardingStatus(compatibleConnectId, {
        connectProtocol: 'V2',
      }),
    );
  }

  @backgroundMethod()
  async invalidatePro2DeviceManagementInfo({
    connectId,
  }: {
    connectId?: string;
  } = {}) {
    void connectId;
  }

  @backgroundMethod()
  async getPro2DeviceManagementSnapshot({
    connectId,
    refreshInfo = false,
  }: {
    connectId: string;
    refreshInfo?: boolean;
  }): Promise<IPro2DeviceManagementSnapshot> {
    const hardwareCallContext =
      EHardwareCallContext.USER_INTERACTION_NO_BLE_DIALOG;
    const compatibleConnectId = await this.getCompatibleConnectId({
      connectId,
      hardwareCallContext,
    });
    const existingRequest =
      this.pro2DeviceManagementSnapshotInFlight.get(compatibleConnectId);
    if (existingRequest) {
      return existingRequest;
    }

    const request = (async () => {
      return {
        state: await this.getDeviceState({
          connectId: compatibleConnectId,
          params: refreshInfo
            ? { refresh: ['identity', 'settings', 'versions', 'verification'] }
            : undefined,
          hardwareCallContext,
        }),
      };
    })();
    this.pro2DeviceManagementSnapshotInFlight.set(compatibleConnectId, request);

    try {
      return await request;
    } finally {
      if (
        this.pro2DeviceManagementSnapshotInFlight.get(compatibleConnectId) ===
        request
      ) {
        this.pro2DeviceManagementSnapshotInFlight.delete(compatibleConnectId);
      }
    }
  }

  @backgroundMethod()
  async showPro2DeviceSettingsPage({
    connectId,
    page,
    fieldName,
  }: {
    connectId: string;
    page: IPro2DeviceSettingsPage;
    fieldName?: string;
  }) {
    const hardwareCallContext = EHardwareCallContext.USER_INTERACTION;
    const compatibleConnectId = await this.getCompatibleConnectId({
      connectId,
      hardwareCallContext,
    });
    const hardwareSDK = await this.getSDKInstance({
      connectId: compatibleConnectId,
      hardwareCallContext,
    });
    return convertDeviceResponse(() =>
      hardwareSDK.deviceSettingsPageShow(compatibleConnectId, {
        connectProtocol: 'V2',
        page,
        ...(fieldName ? { fieldName } : {}),
      }),
    );
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
  }: {
    device: SearchDevice;
    hardwareCallContext?: EHardwareCallContext;
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

    // Get compatible connectId for the current transport type
    const compatibleConnectId = await this.getCompatibleConnectId({
      connectId: connectId || undefined,
      featuresDeviceId: device.deviceId,
      hardwareCallContext:
        hardwareCallContext || EHardwareCallContext.USER_INTERACTION,
    });

    if (platformEnv.isNative) {
      try {
        return await this.connectDevice({
          connectId: compatibleConnectId,
        });
      } catch (e: any) {
        this.handlerConnectError(e);
      }
    } else {
      /**
       * USB does not need the extra getFeatures call
       */
      try {
        return await this.connectDevice({
          connectId: compatibleConnectId,
          params: {
            allowEmptyConnectId:
              hardwareCallContext === EHardwareCallContext.UPDATE_FIRMWARE,
          },
        });
      } catch (_e: any) {
        return (device as KnownDevice).features;
      }
    }
  }

  @backgroundMethod()
  @toastIfError()
  async unlockDevice({ connectId }: { connectId: string }) {
    const hardwareSDK = await this.getSDKInstance({
      connectId,
    });
    const compatibleConnectId = await this.getCompatibleConnectId({
      connectId,
      hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
    });
    return convertDeviceResponse(() =>
      hardwareSDK?.deviceUnlock(compatibleConnectId, {}),
    );
  }

  @backgroundMethod()
  async getFeaturesWithUnlock({ connectId }: { connectId: string }) {
    const compatibleConnectId = await this.getCompatibleConnectId({
      connectId,
      hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
    });
    let features = await this.getFeaturesWithoutCache({
      connectId: compatibleConnectId,
    });

    if (!features.unlocked) {
      // unlock device
      features = (await this.unlockDevice({
        connectId: compatibleConnectId,
      })) as unknown as IOneKeyDeviceFeatures;
    }

    return features;
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
  }: {
    connectId?: string;
    walletId?: string;
    forceDeviceResetToHome?: boolean;
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
    const { connectId, params, silentMode, hardwareCallContext } = options;
    serviceHardwareUtils.hardwareLog('call getFeatures()', connectId);
    if (!params?.allowEmptyConnectId && !connectId) {
      throw new OneKeyLocalError(
        'hardware getFeatures ERROR: connectId is undefined',
      );
    }
    const hardwareSDK = await this.getSDKInstance({
      connectId,
      hardwareCallContext,
    });
    const features = await convertDeviceResponse(
      () => hardwareSDK?.getFeatures(connectId, params),
      { silentMode },
    );
    return features;
  };

  _getFeaturesWithTimeout = makeTimeoutPromise({
    asyncFunc: this._getFeaturesLowLevel,
    // todo remove: sdk guarantees not to block this method
    timeout: timerUtils.getTimeDurationMs({ seconds: 60 }),
    timeoutRejectError: new deviceErrors.DeviceMethodCallTimeout(),
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
    const { connectId, params, silentMode, hardwareCallContext } = options;
    const { allowEmptyConnectId, ...sdkParams } = params ?? {};
    const normalizedSdkParams = params ? sdkParams : undefined;
    serviceHardwareUtils.hardwareLog('call getDeviceState()', connectId);
    if (!allowEmptyConnectId && !connectId) {
      throw new OneKeyLocalError(
        'hardware getDeviceState ERROR: connectId is undefined',
      );
    }
    const hardwareSDK = await this.getSDKInstance({
      connectId,
      hardwareCallContext,
    });
    const state = await convertDeviceResponse(
      () => hardwareSDK?.getDeviceState(connectId, normalizedSdkParams),
      { silentMode },
    );
    return state;
  };

  _getDeviceStateWithTimeout = makeTimeoutPromise({
    asyncFunc: this._getDeviceStateLowLevel,
    timeout: timerUtils.getTimeDurationMs({ seconds: 60 }),
    timeoutRejectError: new deviceErrors.DeviceMethodCallTimeout(),
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
        })
      : options.connectId;
    return this._getDeviceStateWithMutex({
      ...options,
      connectId: compatibleConnectId,
      hardwareCallContext,
    });
  }

  @backgroundMethod()
  async getFeatures(options: IDeviceGetFeaturesOptions) {
    const features = await this._getFeaturesWithCache(options);
    return features;
  }

  @backgroundMethod()
  async getFeaturesWithoutCache(options: IDeviceGetFeaturesOptions) {
    const features = await this._getFeaturesWithMutex(options);
    return features;
  }

  @backgroundMethod()
  async getFeaturesByWallet({ walletId }: { walletId: string }) {
    const device = await this.backgroundApi.serviceAccount.getWalletDevice({
      walletId,
    });
    // device.connectId is already processed by LocalDbBase.getDevice()
    return this.getFeatures({ connectId: device.connectId });
  }

  @backgroundMethod()
  async getAboutDeviceFeatures(params: { connectId: string }) {
    const dbDevice = await localDb.getDeviceByQuery({
      connectId: params.connectId,
    });
    if (!dbDevice) {
      throw new OneKeyLocalError('device not found');
    }
    const compatibleConnectId = await this.getCompatibleConnectId({
      connectId: params.connectId,
      featuresDeviceId: dbDevice.deviceId,
      hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
    });
    return this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
      () =>
        this.getFeaturesWithoutCache({
          connectId: compatibleConnectId,
          params: { retryCount: 1 },
        }),
      {
        deviceParams: {
          dbDevice,
        },
        hideCheckingDeviceLoading: true,
      },
    );
  }

  @backgroundMethod()
  async checkDeviceReachableForFirmwareUpdate(params: { connectId: string }) {
    const dbDevice = await localDb.getDeviceByQuery({
      connectId: params.connectId,
    });
    if (!dbDevice) {
      // Onboarding / bootloader-mode flows hit this with a freshly-discovered
      // device that has no local DB record yet — skip pre-flight and let the
      // update modal proceed.
      return;
    }
    const compatibleConnectId = await this.getCompatibleConnectId({
      connectId: params.connectId,
      featuresDeviceId: dbDevice.deviceId,
      hardwareCallContext: EHardwareCallContext.UPDATE_FIRMWARE,
    });
    return this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
      () =>
        this.getFeaturesWithoutCache({
          connectId: compatibleConnectId,
          params: { retryCount: 1 },
        }),
      {
        deviceParams: {
          dbDevice,
        },
      },
    );
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
    const hardwareSDK = await this.getSDKInstance({
      connectId,
    });
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
        // deriveCardano, // TODO gePassphraseState different if networkImpl === IMPL_ADA ?
      }),
    );
  }

  @backgroundMethod()
  async setInputPinOnSoftware(p: ISetInputPinOnSoftwareParams) {
    return this.deviceSettingsManager.setInputPinOnSoftware(p);
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
    const result = await this.deviceSettingsManager.wipeDevice(p);
    return result;
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
        // Features 持久化和 HardwareFeaturesUpdate 由 SDK DEVICE.FEATURES 统一驱动。
        appEventBus.emit(EAppEventBusNames.SyncDeviceLabelToWalletName, {
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
    let size = getHomeScreenSize({
      deviceType: device.deviceType,
      homeScreenType,
      thumbnail: false,
    });
    const thumbnailSize =
      getHomeScreenSize({
        deviceType: device.deviceType,
        homeScreenType,
        thumbnail: true,
      }) ??
      serviceHardwareUtils.getPro2HomeScreenSizeFallback({
        deviceType: device.deviceType,
        thumbnail: true,
      });
    size ??= serviceHardwareUtils.getPro2HomeScreenSizeFallback({
      deviceType: device.deviceType,
      thumbnail: false,
    });
    if (!size && isT1Model) {
      size = DEFAULT_T1_HOME_SCREEN_INFORMATION;
    }
    return { names, size, thumbnailSize };
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
  async uploadPortfolioPackage({
    connectId,
    packageBytes,
  }: {
    connectId: string;
    packageBytes: ArrayBuffer;
  }) {
    const compatibleConnectId = await this.getCompatibleConnectId({
      connectId,
      hardwareCallContext: EHardwareCallContext.BACKGROUND_NON_INTERACTIVE,
    });
    const hardwareSDK = await this.getSDKInstance({
      connectId: compatibleConnectId,
      hardwareCallContext: EHardwareCallContext.BACKGROUND_NON_INTERACTIVE,
    });
    const portfolioSDK = hardwareSDK as typeof hardwareSDK & {
      uploadPortfolio: (
        targetConnectId: string,
        params: { packageBytes: ArrayBuffer },
      ) => HardwareResponse<{ portfolioUpdated: true }>;
    };
    return convertDeviceResponse(() =>
      portfolioSDK.uploadPortfolio(compatibleConnectId, {
        packageBytes,
      }),
    );
  }

  @backgroundMethod()
  async isDeviceConnectionActive({ connectId }: { connectId: string }) {
    if (this.activeHardwareConnectIds.has(connectId)) {
      return true;
    }
    const device = await localDb.getDeviceByQuery({ connectId });
    return Boolean(
      device?.bleConnectId &&
      this.activeHardwareConnectIds.has(device.bleConnectId),
    );
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
  async getOneKeyFeatures({
    connectId,
    deviceType,
  }: {
    connectId: string;
    deviceType: IDeviceType;
  }): Promise<OnekeyFeatures> {
    void deviceType;
    const compatibleConnectId = await this.getCompatibleConnectId({
      connectId,
      hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
    });
    const state = await this.getDeviceState({
      connectId: compatibleConnectId,
      params: {
        refresh: ['identity', 'versions', 'verification'],
        includeRaw: true,
      },
      hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
    });
    return buildOnekeyFeaturesFromState(state);
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

    await this.backgroundApi.serviceAccount.updateWalletsDeprecatedState({
      willUpdateDeprecateMap,
    });
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
    try {
      const compatibleConnectId = await this.getCompatibleConnectId({
        connectId: params.connectId,
        featuresDeviceId: params.deviceId,
        hardwareCallContext: EHardwareCallContext.SILENT_CALL,
      });
      const hardwareSDK = await this.getSDKInstance({
        connectId: compatibleConnectId,
      });
      await timerUtils.wait(600);
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
      await timerUtils.wait(600);
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
    try {
      const compatibleConnectId = await this.getCompatibleConnectId({
        connectId,
        featuresDeviceId: deviceId,
        hardwareCallContext: withUserInteraction
          ? EHardwareCallContext.USER_INTERACTION
          : EHardwareCallContext.SILENT_CALL,
      });
      const hardwareSDK = await this.getSDKInstance({
        connectId: compatibleConnectId,
      });
      await timerUtils.wait(600);
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
      await timerUtils.wait(600);
    }
  }

  @backgroundMethod()
  async promptWebDeviceAccess(params: { deviceSerialNumberFromUI: string }) {
    const hardwareSDK = await this.getSDKInstance({
      connectId: undefined,
    });
    try {
      return await convertDeviceResponse(() =>
        hardwareSDK?.promptWebDeviceAccess(params),
      );
    } catch (error) {
      if (await this.recoverLinuxWebUsbAccessDeniedError(error)) {
        return convertDeviceResponse(() =>
          hardwareSDK?.promptWebDeviceAccess(params),
        );
      }
      throw error;
    }
  }

  private async _needCheckBridgeStatus() {
    const hardwareTransportType =
      await this.backgroundApi.serviceSetting.getHardwareTransportType();
    if (hardwareTransportType === EHardwareTransportType.WEBUSB) {
      return false;
    }
    return platformEnv.isSupportWebUSB;
  }

  @backgroundMethod()
  async checkBridgeAndFallbackToWebUSB({
    hardwareSDKInstance,
  }: {
    hardwareSDKInstance: CoreApi;
  }) {
    try {
      if (this.bridgeAvailabilityChecked) {
        return;
      }
      if (!(await this._needCheckBridgeStatus())) {
        return;
      }
      this.bridgeAvailabilityChecked = true;
      const isBridgeAvailable = await new Promise<boolean>((resolve) => {
        convertDeviceResponse(() => hardwareSDKInstance?.checkBridgeStatus())
          .then((bridgeStatus) => {
            console.log('bridgeStatus ===>>>:: ', bridgeStatus);
            resolve(!!bridgeStatus);
          })
          .catch((error) => {
            console.error('Bridge status check failed:', error);
            resolve(false);
          });
      });

      if (!isBridgeAvailable) {
        await hardwareSDKInstance.switchTransport('webusb');
        await this.fallbackToWebUSBTransport();
      }
    } catch (error) {
      console.error('checkBridgeAndFallbackToWebUSB error', error);
    }
  }

  private async fallbackToWebUSBTransport() {
    await this.backgroundApi.serviceSetting.setHardwareTransportType(
      EHardwareTransportType.WEBUSB,
    );
    await timerUtils.wait(0);
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
    try {
      // 1. Update transport type setting
      await this.backgroundApi.serviceSetting.setHardwareTransportType(
        transportType,
      );

      // Reset event registration flag to allow re-registration
      this.registeredEvents = false;
      this.activeHardwareConnectIds.clear();

      // 3. Reset SDK instance (clears memoizee cache and cleans up SDK instance)
      await resetHardwareSDKInstance();

      // 4. Get new SDK instance with new transport type
      const newInstance = await this.getSDKInstance({
        connectId: undefined,
      });

      console.log(
        `Successfully switched hardware transport type to: ${transportType}`,
      );

      return newInstance;
    } catch (error) {
      console.error('Failed to switch hardware transport type:', error);
      throw error;
    }
  }

  @backgroundMethod()
  async setForceTransportType({
    forceTransportType,
  }: {
    forceTransportType: EHardwareTransportType;
  }) {
    const operationId = stringUtils.randomString(12);
    await hardwareForceTransportAtom.set({
      forceTransportType,
      operationId,
    });
    defaultLogger.setting.device.setForceTransportType({
      forceTransportType,
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
  }: {
    connectId: string;
    hardwareCallContext: EHardwareCallContext;
  }) {
    if (!this.shouldPrecheckNativeBleForHardwareCall({ hardwareCallContext })) {
      return;
    }

    const currentTransportType = await this.getCurrentTransportType();
    if (currentTransportType !== EHardwareTransportType.BLE) {
      return;
    }

    const hasBlePermission = !!(await checkBLEPermissions());
    if (!hasBlePermission) {
      appEventBus.emit(EAppEventBusNames.RequestHardwareUIDialog, {
        uiRequestType: EHardwareUiStateAction.LOCATION_PERMISSION,
      });
      throw new deviceErrors.NeedBluetoothPermissions({
        payload: {
          connectId,
        },
      });
    }

    const isBluetoothOn = !!(await checkBLEState());
    if (!isBluetoothOn) {
      appEventBus.emit(EAppEventBusNames.RequestHardwareUIDialog, {
        uiRequestType: EHardwareUiStateAction.BLUETOOTH_PERMISSION,
      });
      throw new deviceErrors.NeedBluetoothTurnedOn({
        payload: {
          connectId,
        },
      });
    }
  }

  @backgroundMethod()
  async getCurrentTransportType() {
    return this.connectionManager.getCurrentTransportType();
  }

  @backgroundMethod()
  async detectUSBDeviceAvailability() {
    return this.connectionManager.detectUSBDeviceAvailability();
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
      // Step 1: Search for available BLE devices
      const searchResult = await this.searchDevices();
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
      const expectedDeviceName = features.bleName;

      // Step 3: Find matching device by name
      const matchingDevice = searchResult.payload.find((device) => {
        const nameMatch = device.name === expectedDeviceName;
        return nameMatch;
      });

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

      // Step 4: Try to connect and verify
      const connectResult = await this.connect({
        device: {
          ...matchingDevice,
          connectId: matchingDevice.connectId || '',
          deviceId: expectedDeviceId,
        },
      });

      if (connectResult && connectResult.deviceId === expectedDeviceId) {
        // Step 5: Update device in DB with BLE connectId
        const device = await localDb.getDeviceByQuery({
          connectId,
          featuresDeviceId: featuresDeviceId || undefined,
          features,
        });

        if (device) {
          // Update device with BLE connectId using the dedicated function
          await localDb.updateDeviceConnectId({
            dbDeviceId: device.id,
            bleConnectId: matchingDevice.connectId || undefined,
          });

          return matchingDevice.connectId || '';
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

  @backgroundMethod()
  async getCompatibleConnectId({
    hardwareCallContext,
    connectId,
    featuresDeviceId,
    features,
  }: {
    hardwareCallContext: EHardwareCallContext;
    connectId?: string;
    featuresDeviceId?: string | undefined | null; // rawDeviceId
    features?: IOneKeyDeviceFeatures;
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

    // Try to get device from DB first. Keep the default OneKey vendor filter:
    // broadening it would pull shipped Ledger devices into the third-party
    // branch below and change a working flow.
    const device = await localDb.getDeviceByQuery({
      connectId,
      featuresDeviceId: featuresDeviceId || undefined,
      features,
    });

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
          const currentTransportType = await this.getCurrentTransportType();
          if (
            currentTransportType === EHardwareTransportType.DesktopWebBle &&
            device.bleConnectId
          ) {
            return device.bleConnectId;
          }
          return device.connectId || connectId;
        }

        const result = await this.connectionManager.shouldSwitchTransportType({
          connectId: device.connectId || connectId,
          hardwareCallContext,
        });
        if (
          result.targetType === EHardwareTransportType.DesktopWebBle &&
          device.bleConnectId
        ) {
          return device.bleConnectId;
        }
        return device.connectId || connectId;
      }
    }

    await this.ensureNativeBleReadyForHardwareCall({
      connectId,
      hardwareCallContext,
    });

    if (!platformEnv.isSupportDesktopBle) {
      return device?.connectId || connectId;
    }

    if (
      hardwareCallContext === EHardwareCallContext.BACKGROUND_TASK ||
      hardwareCallContext === EHardwareCallContext.BACKGROUND_NON_INTERACTIVE
    ) {
      const currentTransportType = await this.getCurrentTransportType();
      if (
        currentTransportType === EHardwareTransportType.DesktopWebBle &&
        device?.bleConnectId
      ) {
        return device.bleConnectId;
      }
      return device?.connectId || connectId;
    }

    const result = await this.connectionManager.shouldSwitchTransportType({
      connectId: device?.connectId || connectId,
      hardwareCallContext,
    });
    const targetTransportType = result.targetType;
    const forceTransportType = (await hardwareForceTransportAtom.get())
      .forceTransportType;

    // Handle connection logic based on transport type
    if (targetTransportType === EHardwareTransportType.DesktopWebBle) {
      if (device?.bleConnectId) {
        // Device found in DB and has BLE connectId, use it
        return device.bleConnectId;
      }
      if (!device) {
        return connectId;
      }
      // onboarding flow
      if (
        device.connectId &&
        forceTransportType === EHardwareTransportType.DesktopWebBle
      ) {
        return device.connectId;
      }
      if (device && !device.bleConnectId) {
        if (hardwareCallContext === EHardwareCallContext.SILENT_CALL) {
          return connectId;
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
              usbConnectId: connectId,
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
    const serverDeviceType =
      serviceHardwareUtils.getHomeScreenServerDeviceType(deviceType);
    const response = await client.get<{
      data: IHardwareHomeScreenResponse[];
    }>('/utility/v1/wallet-homescreen/list', {
      params: {
        deviceType: serverDeviceType,
        serialNumber,
        firmwareVersion,
      },
    });
    const { data } = response.data;
    return data
      .filter((item) => item.deviceTypes.includes(serverDeviceType))
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
