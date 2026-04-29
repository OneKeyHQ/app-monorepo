import { EDeviceType, EFirmwareType } from '@onekeyfe/hd-shared';
import { UI_RESPONSE } from '@onekeyfe/hwk-adapter-core';
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
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
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

import { thirdPartyHardwareAdapterRegistry } from './adapters/thirdPartyHardwareAdapterRegistry';
import { DeviceSettingsManager } from './DeviceSettingsManager';
import { HardwareConnectionManager } from './HardwareConnectionManager';
import { HardwareVerifyManager } from './HardwareVerifyManager';
import serviceHardwareUtils from './serviceHardwareUtils';

import type { IThirdPartyVendor } from './adapters/thirdPartyHardwareAdapterRegistry';
import type { DeviceInfo, IThirdPartyHardwareAdapter } from './adapters/types';
import type {
  IBaseDeviceProcessingParams,
  IChangePinParams,
  IDeviceHomeScreenConfig,
  IGetDeviceAdvanceSettingsParams,
  IGetDeviceLabelParams,
  IHardwareHomeScreenData,
  ISetAutoLockDelayMsParams,
  ISetAutoShutDownDelayMsParams,
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
  DeviceSupportFeaturesPayload,
  DeviceUploadResourceParams,
  Features,
  IDeviceType,
  KnownDevice,
  OnekeyFeatures,
  Response,
  SearchDevice,
  UiEvent,
} from '@onekeyfe/hd-core';

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

@backgroundClass()
class ServiceHardware extends ServiceBase {
  private bridgeAvailabilityChecked = false;

  // Third-party hardware adapters — vendor → adapter via
  // ./adapters/thirdPartyHardwareAdapterRegistry. Public facade is
  // getAdapterForVendor(vendor).

  /** Live adapter instances, keyed by vendor name. */
  private thirdPartyAdapters = new Map<
    IThirdPartyVendor,
    IThirdPartyHardwareAdapter
  >();

  /** In-flight init promises so concurrent callers share one factory run. */
  private thirdPartyAdapterInitPromises = new Map<
    IThirdPartyVendor,
    Promise<void>
  >();

  private isRegisteredThirdPartyVendor(
    vendor: string | undefined,
  ): vendor is IThirdPartyVendor {
    return (
      !!vendor &&
      Object.prototype.hasOwnProperty.call(
        thirdPartyHardwareAdapterRegistry,
        vendor,
      )
    );
  }

  private async ensureThirdPartyAdapterInitialized(
    vendor: IThirdPartyVendor,
  ): Promise<void> {
    if (this.thirdPartyAdapters.has(vendor)) return;
    let p = this.thirdPartyAdapterInitPromises.get(vendor);
    if (!p) {
      const factory = thirdPartyHardwareAdapterRegistry[vendor];
      p = factory()
        .then((adapter) => {
          this.thirdPartyAdapters.set(vendor, adapter);
        })
        .catch((error) => {
          console.error(
            `[ServiceHardware] Failed to init ${vendor} adapter:`,
            error,
          );
          throw error;
        })
        .finally(() => {
          // Drop inflight marker so a subsequent call can re-attempt.
          this.thirdPartyAdapterInitPromises.delete(vendor);
        });
      this.thirdPartyAdapterInitPromises.set(vendor, p);
    }
    await p;
  }

  /**
   * Ensure the adapter for `vendor` is initialized. If no vendor is given,
   * initialize every registered third-party adapter (used by discovery paths).
   */
  private async ensureAdaptersInitialized(vendor?: string): Promise<void> {
    if (this.isRegisteredThirdPartyVendor(vendor)) {
      await this.ensureThirdPartyAdapterInitialized(vendor);
      return;
    }
    await Promise.allSettled(
      (
        Object.keys(thirdPartyHardwareAdapterRegistry) as IThirdPartyVendor[]
      ).map((v) => this.ensureThirdPartyAdapterInitialized(v)),
    );
  }

  /**
   * Get the in-memory adapter for a vendor (does NOT trigger init).
   * Use after ensureAdaptersInitialized().
   */
  private getThirdPartyAdapter(
    vendor: string,
  ): IThirdPartyHardwareAdapter | undefined {
    if (!this.isRegisteredThirdPartyVendor(vendor)) return undefined;
    return this.thirdPartyAdapters.get(vendor);
  }

  /** Reset the adapter and evict it from the registry (use instead of adapter.reset() directly). */
  resetThirdPartyAdapter(vendor: string): void {
    if (!this.isRegisteredThirdPartyVendor(vendor)) return;
    const adapter = this.thirdPartyAdapters.get(vendor);
    if (!adapter) return;
    try {
      adapter.reset();
    } finally {
      this.thirdPartyAdapters.delete(vendor);
    }
  }

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

    const { hardwareConnectSrc } = await settingsPersistAtom.get();
    const isPreRelease =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'usePreReleaseConfig',
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
        this.registeredEvents = false;

        console.log('✅ TRANSPORT SWITCH: SDK reset completed');
      }
    }

    // Update the connection manager's current transport type AFTER switch logic
    this.connectionManager.setCurrentTransportType(hardwareTransportType);

    try {
      const instance = await getHardwareSDKInstance({
        hardwareTransportType,
        // https://data.onekey.so/pre-config.json?noCache=1714090312200
        // https://data.onekey.so/config.json?nocache=0.8336416330053136
        isPreRelease: isPreRelease === true,
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
      // always show error toast when sdk init, so user can report to us
      void this.backgroundApi.serviceApp.showToast({
        method: 'error',
        title: (error as Error)?.message || 'Hardware SDK init failed',
      });
      throw error;
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
      const dbDevice = await localDb.getDeviceByQuery({
        connectId: newPayload.connectId,
      });

      if (
        dbDevice?.deviceType &&
        [EDeviceType.Touch, EDeviceType.Pro].includes(dbDevice?.deviceType)
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
        const { device, type } = originEvent.payload || {};
        const { features } = device || {};

        const inputPinOnSoftware = supportInputPinOnSoftwareSdk(features);
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
      newPayload.existsAttachPinUser = originEvent.payload.existsAttachPinUser;
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

      instance.on(
        DEVICE.SUPPORT_FEATURES,
        (message: DeviceSupportFeaturesPayload) => {
          const { features } = message.device || {};
          if (!features || !features.device_id) return;

          // TODO: save features to dbDevice
          serviceHardwareUtils.hardwareLog('features update', features);

          void localDb.updateDevice({
            features,
          });
        },
      );

      instance.on(DEVICE.CONNECT, (message: { device: KnownDevice }) => {
        const { features } = message.device || {};
        if (!features || !features.device_id) return;
        const { device_id: deviceId } = features;

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

      // TODO how to emit this event?
      // call getFeatures() or checkFirmwareRelease();
      instance.on(FIRMWARE_EVENT, (messages: CoreMessage) => {
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

  // startDeviceScan
  // TODO use convertDeviceResponse()
  @backgroundMethod()
  async searchDevices(params?: { vendor?: EHardwareVendor }) {
    const vendorProfile = params?.vendor
      ? getVendorProfile(params.vendor)
      : undefined;
    if (params?.vendor && vendorProfile?.isThirdParty) {
      try {
        await this.ensureAdaptersInitialized(params.vendor);
        const adapter = this.getThirdPartyAdapter(params.vendor);
        if (!adapter) {
          // Vendor is registered but adapter slot is empty — registry bug,
          // not a transient init failure. Surface explicitly.
          throw new OneKeyLocalError(
            `No adapter registered for vendor "${params.vendor}"`,
          );
        }
        const devices = await adapter.searchDevices();
        defaultLogger.hardware.sdkLog.thirdPartySearchDevicesResponse({
          vendor: params.vendor,
          success: true,
          count: devices.length,
        });

        const isUuidLike = (s?: string) =>
          s ? /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(s) : false;

        return {
          success: true as const,
          payload: devices.map((d) => {
            const isBle = d.connectionType === 'ble';

            // BLE: connectId is the stable 4-digit HEX (e.g. "A58F"), name is "Ledger"
            // USB: connectId is null (ephemeral), name from label or default
            let name: string;
            let connectId: string | null = null;

            if (isBle) {
              connectId = d.connectId || null;
              name = vendorProfile.defaultDeviceName || 'Ledger';
            } else {
              const rawName =
                d.label || (d as DeviceInfo & { name?: string }).name || '';
              name = isUuidLike(rawName)
                ? vendorProfile.defaultDeviceName
                : rawName || vendorProfile.defaultDeviceName;
            }

            return {
              connectId,
              deviceId: null,
              name,
              // Third-party vendors (Ledger) don't map to OneKey IDeviceType;
              // use 'unknown' and carry vendor identity separately via
              // IConnectYourDeviceItem.vendor at the UI layer.
              deviceType: 'unknown',
              uuid: '',
              commType: 'bridge',
            } as SearchDevice;
          }),
        };
      } catch (error) {
        // Preserve HWK's structured error (code + message) so downstream
        // can route to the correct error class.
        const err = error as { code?: number | string; message?: string };
        const rawCode =
          typeof err?.code === 'number' ? err.code : Number(err?.code);
        return {
          success: false as const,
          payload: {
            code: Number.isFinite(rawCode) ? rawCode : -1,
            error: err?.message ?? String(error),
          },
        };
      }
    }

    // Original OneKey SDK path
    const hardwareSDK = await this.getSDKInstance({
      connectId: undefined,
    });
    const response = await hardwareSDK?.searchDevices();
    console.log('searchDevices response: ', response);
    return response;
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
      features = await this.unlockDevice({
        connectId: compatibleConnectId,
      });
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

    // TODO get connectId from SDK: connectId = getDeviceUUID() only works on usb sdk
    // connectId: DataManager.isBleConnect(env) ? this.mainId || null : getDeviceUUID(this.features),
    // TODO uuid is equal to connectId in ble sdk?
    // const connectId = getDeviceUUID(features);
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

    return convertDeviceResponse(() =>
      hardwareSDK?.getPassphraseState(connectId, {
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
  async setBrightness(p: IBaseDeviceProcessingParams) {
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
    const result = await this.deviceSettingsManager.setPassphraseEnabled(p);
    if (result.message) {
      let dbDeviceId: string | undefined;
      if (p.walletId) {
        const wallet = await this.backgroundApi.serviceAccount.getWalletSafe({
          walletId: p.walletId,
        });
        dbDeviceId = wallet?.associatedDevice;
      } else {
        const device = await localDb.getDeviceByQuery({
          connectId: p.connectId,
          featuresDeviceId: p.featuresDeviceId,
        });
        dbDeviceId = device?.id;
      }
      if (dbDeviceId) {
        await localDb.updateDeviceFeaturesPassphraseProtection({
          dbDeviceId,
          passphraseProtection: p.passphraseEnabled,
        });
      }
    }
    return result;
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
        // update db features label
        await localDb.updateDeviceFeaturesLabel({
          dbDeviceId,
          label: p.label,
        });
        // After device label is updated, notify UI/hardware interaction layer to refresh cached device info,
        // otherwise the hardware interaction dialog may keep showing the old name until app restart.
        appEventBus.emit(EAppEventBusNames.HardwareFeaturesUpdate, {
          deviceId: dbDeviceId,
        });
        // update db wallet name
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
    const thumbnailSize = getHomeScreenSize({
      deviceType: device.deviceType,
      homeScreenType,
      thumbnail: true,
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
    const compatibleConnectId = await this.getCompatibleConnectId({
      connectId,
      hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
    });
    const hardwareSDK = await this.getSDKInstance({
      connectId: compatibleConnectId,
    });
    return convertDeviceResponse(() => {
      // classic1s does not support getOnekeyFeatures method
      if (
        deviceType === EDeviceType.Classic1s ||
        deviceType === EDeviceType.ClassicPure
      ) {
        return hardwareSDK?.getFeatures(
          compatibleConnectId,
        ) as unknown as Response<OnekeyFeatures>;
      }
      return hardwareSDK?.getOnekeyFeatures(compatibleConnectId);
    });
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
      onekey_firmware_version: undefined,
      onekey_ble_version: undefined,
      ble_ver: undefined,
      onekey_boot_version: undefined,
      bootloader_version: undefined,
    };
    if (params?.releaseResult?.updateInfos?.bootloader?.hasUpgrade) {
      const bootVersion =
        params.releaseResult.updateInfos.bootloader?.toVersion;
      versionInfo.onekey_boot_version = bootVersion;
      versionInfo.bootloader_version = bootVersion;
    }
    if (params?.releaseResult?.updateInfos?.firmware?.hasUpgrade) {
      versionInfo.onekey_firmware_version =
        params.releaseResult.updateInfos.firmware?.toVersion;
    }
    if (params?.releaseResult?.updateInfos?.ble?.hasUpgrade) {
      const bleVersion = params.releaseResult.updateInfos.ble?.toVersion;
      versionInfo.onekey_ble_version = bleVersion;
      versionInfo.ble_ver = bleVersion;
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
    await this.ensureAdaptersInitialized(vendor);
    return this.getThirdPartyAdapter(vendor);
  }

  @backgroundMethod()
  async thirdPartyHardwareUiResponse(params: {
    vendor: EHardwareVendor;
    type: 'confirm' | 'cancel';
  }) {
    await this.ensureAdaptersInitialized(params.vendor);
    const adapter = this.getThirdPartyAdapter(params.vendor);
    if (!adapter) return;

    // Only REQUEST_DEVICE_CONNECT flows through this path today. Extend the
    // mapping when PIN / passphrase / select-device dialogs are wired up.
    adapter.uiResponse({
      type: UI_RESPONSE.RECEIVE_DEVICE_CONNECT,
      payload: { confirmed: params.type === 'confirm' },
    });
  }

  @backgroundMethod()
  async thirdPartyHardwareCancel(params: {
    vendor: EHardwareVendor;
    connectId?: string;
  }) {
    await this.ensureAdaptersInitialized(params.vendor);
    const adapter = this.getThirdPartyAdapter(params.vendor);
    if (!adapter) return;
    adapter.cancel(params.connectId);
  }

  @backgroundMethod()
  async getEvmAddressByStandardWallet(params: {
    connectId: string;
    deviceId: string;
    path: string;
    vendor?: EHardwareVendor;
  }): Promise<string | null> {
    const evmProfile = params.vendor
      ? getVendorProfile(params.vendor)
      : undefined;
    if (params.vendor && evmProfile?.isThirdParty) {
      try {
        await this.ensureAdaptersInitialized(params.vendor);
        const adapter = this.getThirdPartyAdapter(params.vendor);
        if (!adapter) return null;
        const result = await adapter.hw.evmGetAddress(
          params.connectId,
          params.deviceId,
          {
            path: params.path,
            showOnDevice: false,
          },
        );
        if (result.success) {
          return result.payload.address || null;
        }
        return null;
      } catch (error) {
        console.error(
          `[ServiceHardware] getEvmAddressByStandardWallet failed:`,
          error,
        );
        return null;
      }
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
          useEmptyPassphrase: true,
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
      // Third-party XFP not needed initially — can be added later
      return undefined;
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
    return convertDeviceResponse(() =>
      hardwareSDK?.promptWebDeviceAccess(params),
    );
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
      const expectedDeviceName = features.ble_name;

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

      // Step 4: Try to connect and verify
      const connectResult = await this.connect({
        device: {
          ...matchingDevice,
          connectId: matchingDevice.connectId || '',
          deviceId: features.device_id,
        },
      });

      if (connectResult && connectResult.device_id === features.device_id) {
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

    // Try to get device from DB first
    const device = await localDb.getDeviceByQuery({
      connectId,
      featuresDeviceId: featuresDeviceId || undefined,
      features,
    });

    // Third-party devices (Ledger) manage their own transport.
    // Their connectId is already the correct identifier for the current
    // connection type (e.g. BLE 4-digit HEX), so skip the OneKey
    // USB↔BLE compatibility layer entirely.
    if (device?.vendor) {
      const vp = getVendorProfile(device.vendor);
      if (vp.isThirdParty) {
        return device.connectId || connectId;
      }
    }

    if (!platformEnv.isSupportDesktopBle) {
      return device?.connectId || connectId;
    }

    if (hardwareCallContext === EHardwareCallContext.BACKGROUND_TASK) {
      const currentTransportType = await this.getCurrentTransportType();
      if (
        currentTransportType === EHardwareTransportType.DesktopWebBle &&
        device?.bleConnectId
      ) {
        return device.bleConnectId;
      }
      return device?.connectId || connectId;
    }

    // Determine the transport type to use
    const result = await this.connectionManager.shouldSwitchTransportType({
      connectId: device?.connectId || connectId,
      hardwareCallContext,
    });
    console.log('🔍 shouldSwitchTransportType result:', result);
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
                featuresDeviceId || device.featuresInfo?.device_id || '',
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
