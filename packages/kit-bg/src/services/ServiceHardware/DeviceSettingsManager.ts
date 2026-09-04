import {
  type CoreApi,
  type DeviceSettingsParams,
  type DeviceSuccess,
  type DeviceUploadResourceParams,
  type DeviceUploadResourceResponse,
} from '@onekeyfe/hd-core';
import { DeviceSessionPinType } from '@onekeyfe/hd-transport';
import { isNil } from 'lodash';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  FirmwareVersionTooLow,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { convertDeviceResponse } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { convertThirdPartyDeviceError } from '@onekeyhq/shared/src/errors/utils/thirdPartyDeviceErrorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import deviceHomeScreenUtils from '@onekeyhq/shared/src/utils/deviceHomeScreenUtils';
import { devOnlyData } from '@onekeyhq/shared/src/utils/devModeUtils';
import { isProtocolV2ProductType } from '@onekeyhq/shared/src/utils/hardwareDeviceTypes';
import { isAsciiAlphanumericWithSpaces } from '@onekeyhq/shared/src/utils/stringUtils';
import thirdPartyDeviceUtils from '@onekeyhq/shared/src/utils/thirdPartyDeviceUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  EHardwareCallContext,
  EHardwareVendor,
  type IDeviceResponseResult,
  type IOneKeyDeviceFeatures,
} from '@onekeyhq/shared/types/device';

import localDb from '../../dbs/local/localDb';
import {
  buildTrezorBleFallbackOptions,
  callTrezorWithBleFallback,
  getTrezorAdapterFromBackgroundApi,
} from '../../vaults/base/trezorTransportUtils';

import { getWallpaperResourceType } from './getWallpaperResourceType';
import { ServiceHardwareManagerBase } from './ServiceHardwareManagerBase';
import serviceHardwareUtils from './serviceHardwareUtils';

import type { TrezorDeviceSettingsParams } from './adapters/types';
import type {
  IDBDevice,
  IDBDeviceSettings as IDBDeviceDbSettings,
} from '../../dbs/local/types';
import type { IWithHardwareProcessingControlParams } from '../ServiceHardwareUI/ServiceHardwareUI';
import type { Response as ThirdPartyResponse } from '@onekeyfe/hwk-adapter-core';

export type ISetInputPinOnSoftwareParams = {
  walletId: string;
  inputPinOnSoftware: boolean;
};

export type IBaseDeviceProcessingParams = {
  walletId?: string;
  connectId?: string;
  featuresDeviceId?: string;
};

export type ISetAutoLockDelayMsParams = IBaseDeviceProcessingParams & {
  autoLockDelayMs: number;
};

export type ISetAutoShutDownDelayMsParams = IBaseDeviceProcessingParams & {
  autoShutdownDelayMs: number;
};

export type ISetLanguageParams = IBaseDeviceProcessingParams & {
  language: string;
};

export type ISetHapticFeedbackParams = IBaseDeviceProcessingParams & {
  hapticFeedback: boolean;
};

export type ISetBrightnessParams = IBaseDeviceProcessingParams & {
  brightness?: number;
};

export type ISetPassphraseEnabledParams = IBaseDeviceProcessingParams & {
  passphraseEnabled: boolean;
};

// Matches hardware-js-sdk DeviceSettings when Protocol V2 already has the
// requested passphrase/air-gap value and skips the on-device settings page.
export const DEVICE_SETTINGS_ALREADY_MATCHED_MESSAGE =
  'Settings already match requested value.';

export function isDeviceSettingsAlreadyMatched(result: unknown): boolean {
  return (
    typeof result === 'object' &&
    result !== null &&
    'message' in result &&
    (result as { message?: unknown }).message ===
      DEVICE_SETTINGS_ALREADY_MATCHED_MESSAGE
  );
}

export type IWipeDeviceParams = IBaseDeviceProcessingParams;

export type IGetDeviceAdvanceSettingsParams = { walletId: string };
export type IGetDeviceLabelParams = { walletId: string };
export type IChangePinParams = IBaseDeviceProcessingParams & {
  remove: boolean;
};
export type ISetDeviceLabelParams = { walletId: string; label: string };

export type IHardwareHomeScreenData = {
  id: string;
  wallpaperType?: 'default' | 'cobranding';
  resType: 'system' | 'prebuilt' | 'custom'; // system: system image, prebuilt: prebuilt image, custom: user upload image

  // Service image config
  url?: string; // preview image url
  nameHex?: string; // Pro、Touch: image name hex, only system res type
  screenHex?: string; // Classic、mini、1s、pure: image hex, only prebuilt res type
  screenBase64?: string; // Pro2/Neo JPEG Base64 without a data URL prefix

  // software generated image
  thumbnailHex?: string; // Pro、Touch：thumb image hex by resize
  blurScreenHex?: string; // Pro、Touch：blur image hex by blur effect

  // User upload config
  uri?: string; // image base64 by upload & crop
  isUserUpload?: boolean;
};

export type ISetDeviceHomeScreenParams = {
  dbDeviceId: string;
  screenItem: IHardwareHomeScreenData;
};
export type IDeviceHomeScreenSizeInfo = {
  width: number;
  height: number;
  radius?: number;
};
export type IDeviceHomeScreenConfig = {
  names: string[];
  size?: IDeviceHomeScreenSizeInfo;
  thumbnailSize?: IDeviceHomeScreenSizeInfo;
};

type IWithDeviceProcessingParams = {
  debugMethodName?: string;
  walletId?: string;
  connectId?: string;
  featuresDeviceId?: string;
  hardwareCallContext?: EHardwareCallContext;
  dbDevice?: IDBDevice;
  params?: IWithHardwareProcessingControlParams;
  preciseUpdateFields?: Partial<IOneKeyDeviceFeatures>;
  // Set for destructive V1 flows (e.g. wipe) whose aftermath is handled by
  // their own teardown flow; a settings-sync refresh would only race it.
  skipV1SettingsSyncNotify?: boolean;
};

type ITrezorDeviceSettingsAction = (params: {
  connectId: string;
  device: IDBDevice;
}) => Promise<ThirdPartyResponse<Record<string, unknown>>>;

export class DeviceSettingsManager extends ServiceHardwareManagerBase {
  /**
   * Protocol V1 settings mutations cannot rely on SDK DEVICE.STATE events
   * alone: legacy SDKs emit nothing when the optimistic ApplySettings patch
   * matches the SDK cache (same-value writes, on-device brightness), and
   * events can be dropped by staleness/identity guards. After the mutation,
   * drain the pending event persists, then explicitly read the settings back
   * (a V1 GetFeatures round trip) and persist that snapshot, so device-side
   * changes (e.g. a language changed on the device itself) always reach the
   * DB. The whole sync is bounded: a device that dropped off right after the
   * write would otherwise hold the flow for the SDK's 60s timeout, and a
   * stuck event queue must never block the final UI refresh signal.
   */
  private async _notifyProtocolV1SettingsSynced({
    device,
    compatibleConnectId,
  }: {
    device: IDBDevice;
    compatibleConnectId?: string;
  }) {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutGuard = new Promise<void>((resolve) => {
      timeoutId = setTimeout(
        resolve,
        timerUtils.getTimeDurationMs({ seconds: 8 }),
      );
    });
    try {
      await Promise.race([
        this._syncProtocolV1SettingsSnapshot({ device, compatibleConnectId }),
        timeoutGuard,
      ]);
    } catch (error) {
      // The read-back is best-effort; the mutation itself already succeeded.
      serviceHardwareUtils.hardwareLog(
        'v1 settings read-back failed',
        devOnlyData(error instanceof Error ? error.message : error),
      );
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      // Consumers re-read whatever the DB holds; this signal must fire on
      // every path, especially when updateDevice suppressed its own event
      // via skipFeaturesUpdateEvent. Subscribers run synchronously in the
      // same heap on desktop/web, so a throwing subscriber must not fail
      // the already-successful mutation (or leak as an unhandled rejection
      // from fire-and-forget callers).
      try {
        appEventBus.emit(EAppEventBusNames.HardwareFeaturesUpdate, {
          deviceId: device.id,
        });
      } catch (error) {
        serviceHardwareUtils.hardwareLog(
          'v1 settings refresh subscriber failed',
          devOnlyData(error instanceof Error ? error.message : error),
        );
      }
    }
  }

  private async _syncProtocolV1SettingsSnapshot({
    device,
    compatibleConnectId,
  }: {
    device: IDBDevice;
    compatibleConnectId?: string;
  }) {
    const syncConnectIds = [
      compatibleConnectId,
      device.connectId,
      device.usbConnectId,
      device.bleConnectId,
      device.uuid,
      device.deviceId,
      device.deviceStateInfo?.identity.serialNo,
      device.deviceStateInfo?.identity.deviceId,
    ];
    await this.serviceHardware.waitForDeviceStateSync({
      connectIds: syncConnectIds,
    });
    const connectId = compatibleConnectId || device.connectId;
    if (!connectId) {
      return;
    }
    const state = await this.serviceHardware.getDeviceState({
      connectId,
      params: { scope: 'settings' },
      hardwareCallContext: EHardwareCallContext.USER_INTERACTION_NO_BLE_DIALOG,
      silentMode: true,
    });
    if (!state) {
      return;
    }
    // The snapshot also carries status fields written by V1 settings (e.g.
    // passphraseProtection after setPassphraseEnabled); persist both
    // sections, not just settings.
    const persistResult = await localDb.updateDeviceState({
      changedKeys: ['settings', 'status'],
      connectId,
      revision: state.revision,
      source: 'settings-read',
      state,
    });
    // The read-back GetFeatures may itself have emitted a DEVICE.STATE event
    // whose persistence task was queued after the first drain; drain again so
    // the refresh signal only fires once the authoritative state is in the DB.
    await this.serviceHardware.waitForDeviceStateSync({
      connectIds: syncConnectIds,
    });
    serviceHardwareUtils.hardwareLog('v1 settings read-back', {
      kind: persistResult.kind,
      language: state.settings?.language,
      revision: state.revision,
    });
  }

  private async _getDeviceForSettings({
    walletId,
    connectId,
    featuresDeviceId,
    dbDevice,
  }: Pick<
    IWithDeviceProcessingParams,
    'walletId' | 'connectId' | 'featuresDeviceId' | 'dbDevice'
  >): Promise<IDBDevice> {
    let device = dbDevice;
    if (!device && walletId) {
      device = await localDb.getWalletDevice({ walletId });
    }
    if (!device && (connectId || featuresDeviceId)) {
      device = await localDb.getDeviceByQuery({
        connectId,
        featuresDeviceId,
      });
    }
    if (!device) {
      throw new OneKeyLocalError('Device not found');
    }
    return device;
  }

  private _isTrezorDevice(device: IDBDevice | undefined): boolean {
    return (
      device?.vendor === EHardwareVendor.trezor ||
      device?.settings?.vendor === EHardwareVendor.trezor
    );
  }

  private _isProtocolV2Product(device: IDBDevice | undefined): boolean {
    return isProtocolV2ProductType(device?.deviceType);
  }

  private async _waitForProtocolV2SettingsSync({
    device,
    compatibleConnectId,
  }: {
    device: IDBDevice;
    compatibleConnectId: string;
  }) {
    await this.serviceHardware.waitForDeviceStateSync({
      connectIds: [
        compatibleConnectId,
        device.connectId,
        device.usbConnectId,
        device.bleConnectId,
        device.uuid,
        device.deviceId,
        device.deviceStateInfo?.identity.serialNo,
        device.deviceStateInfo?.identity.deviceId,
      ],
    });
  }

  private async _withTrezorDeviceProcessing({
    walletId,
    connectId,
    featuresDeviceId,
    dbDevice,
    debugMethodName,
    params,
    action,
    preciseUpdateFields,
  }: Pick<
    IWithDeviceProcessingParams,
    | 'walletId'
    | 'connectId'
    | 'featuresDeviceId'
    | 'dbDevice'
    | 'debugMethodName'
    | 'params'
  > & {
    action: ITrezorDeviceSettingsAction;
    preciseUpdateFields?: Partial<IOneKeyDeviceFeatures>;
  }): Promise<DeviceSuccess> {
    const device = await this._getDeviceForSettings({
      walletId,
      connectId,
      featuresDeviceId,
      dbDevice,
    });

    return this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
      async () => {
        const response = await callTrezorWithBleFallback(
          device,
          async (targetConnectId) =>
            action({ connectId: targetConnectId, device }),
          buildTrezorBleFallbackOptions(this.backgroundApi),
        );
        if (!response.success) {
          throw convertThirdPartyDeviceError(response.payload, {
            vendor: 'Trezor',
          });
        }
        if (preciseUpdateFields && device.featuresInfo) {
          await localDb.updateDevice({
            features: device.featuresInfo,
            preciseUpdateFields,
          });
        }
        return { message: 'Success' };
      },
      {
        deviceParams: {
          dbDevice: device,
        },
        ...params,
        debugMethodName:
          debugMethodName || 'deviceSettings.withTrezorDeviceProcessing',
      },
    );
  }

  private async _applyTrezorSettings({
    walletId,
    connectId,
    featuresDeviceId,
    dbDevice,
    debugMethodName,
    settings,
    preciseUpdateFields,
  }: Pick<
    IWithDeviceProcessingParams,
    | 'walletId'
    | 'connectId'
    | 'featuresDeviceId'
    | 'dbDevice'
    | 'debugMethodName'
  > & {
    settings: TrezorDeviceSettingsParams;
    preciseUpdateFields?: Partial<IOneKeyDeviceFeatures>;
  }): Promise<DeviceSuccess> {
    return this._withTrezorDeviceProcessing({
      walletId,
      connectId,
      featuresDeviceId,
      dbDevice,
      debugMethodName,
      preciseUpdateFields,
      action: async ({ connectId: targetConnectId }) => {
        const adapter = await getTrezorAdapterFromBackgroundApi(
          this.backgroundApi,
        );
        if (!adapter.deviceSettings) {
          throw new OneKeyLocalError('Trezor device settings not available');
        }
        return adapter.deviceSettings(targetConnectId, settings);
      },
    });
  }

  async _withDeviceProcessing<T>({
    walletId,
    connectId,
    featuresDeviceId,
    dbDevice,
    hardwareCallContext,
    debugMethodName,
    action,
    params,
    preciseUpdateFields,
    skipV1SettingsSyncNotify,
  }: IWithDeviceProcessingParams & {
    action: (
      hardwareSDK: CoreApi,
      connectId: string,
      device: IDBDevice,
    ) => Promise<IDeviceResponseResult<T>>;
  }): Promise<T> {
    const device = await this._getDeviceForSettings({
      walletId,
      connectId,
      featuresDeviceId,
      dbDevice,
    });

    return this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
      async () => {
        const compatibleConnectId =
          await this.serviceHardware.getCompatibleConnectId({
            connectId: device.connectId,
            hardwareCallContext:
              hardwareCallContext || EHardwareCallContext.USER_INTERACTION,
          });
        const hardwareSDK = await this.getSDKInstance({
          connectId: compatibleConnectId,
        });
        const result = await convertDeviceResponse(() =>
          action(hardwareSDK, compatibleConnectId, device),
        );
        if (this._isProtocolV2Product(device)) {
          await this._waitForProtocolV2SettingsSync({
            device,
            compatibleConnectId,
          });
        } else {
          const shouldNotifySettingsSynced = !skipV1SettingsSyncNotify;
          if (preciseUpdateFields && device.featuresInfo) {
            await localDb.updateDevice({
              features: device.featuresInfo,
              preciseUpdateFields,
              // When the authoritative notify below fires (after the SDK's
              // settings-read event persisted), emitting here as well would
              // trigger a redundant refresh that can read the DB too early.
              skipFeaturesUpdateEvent: shouldNotifySettingsSynced,
            });
          }
          if (shouldNotifySettingsSynced) {
            await this._notifyProtocolV1SettingsSynced({
              device,
              compatibleConnectId,
            });
          }
        }
        return result;
      },
      {
        deviceParams: {
          dbDevice: device,
        },
        ...params,
        debugMethodName:
          debugMethodName || 'deviceSettings.withDeviceProcessing',
      },
    );
  }

  @backgroundMethod()
  async changePin({
    walletId,
    connectId,
    featuresDeviceId,
    remove,
  }: IChangePinParams): Promise<DeviceSuccess> {
    const device = await this._getDeviceForSettings({
      walletId,
      connectId,
      featuresDeviceId,
    });
    if (this._isTrezorDevice(device)) {
      return this._withTrezorDeviceProcessing({
        walletId,
        connectId,
        featuresDeviceId,
        dbDevice: device,
        debugMethodName: 'deviceSettings.changePin.trezor',
        action: async ({ connectId: targetConnectId }) => {
          const adapter = await getTrezorAdapterFromBackgroundApi(
            this.backgroundApi,
          );
          if (!adapter.changePin) {
            throw new OneKeyLocalError('Trezor change PIN not available');
          }
          return adapter.changePin(targetConnectId, { remove });
        },
      });
    }
    return this._withDeviceProcessing({
      walletId,
      connectId,
      featuresDeviceId,
      dbDevice: device,
      debugMethodName: 'deviceSettings.changePin',
      action: async (hardwareSDK, compatibleConnectId, _device) =>
        hardwareSDK?.deviceChangePin(compatibleConnectId, {
          remove,
        }),
    });
  }

  @backgroundMethod()
  async applySettingsToDevice(
    connectId: string,
    settings: DeviceSettingsParams,
  ) {
    const compatibleConnectId =
      await this.serviceHardware.getCompatibleConnectId({
        connectId,
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
      });
    const hardwareSDK = await this.getSDKInstance({
      connectId: compatibleConnectId,
    });

    return convertDeviceResponse(() =>
      hardwareSDK?.deviceSettings(compatibleConnectId, settings),
    );
  }

  @backgroundMethod()
  async getDeviceAdvanceSettings({
    walletId,
  }: IGetDeviceAdvanceSettingsParams): Promise<{
    passphraseEnabled: boolean;
    inputPinOnSoftware: boolean;
    inputPinOnSoftwareSupport: boolean;
  }> {
    const dbDevice = await localDb.getWalletDevice({ walletId });

    if (this._isTrezorDevice(dbDevice)) {
      const thirdPartyState = thirdPartyDeviceUtils.getDeviceState({
        features: dbDevice.featuresInfo as Record<string, unknown>,
      });
      return {
        passphraseEnabled: Boolean(thirdPartyState.passphraseProtection),
        inputPinOnSoftware: false,
        inputPinOnSoftwareSupport: false,
      };
    }

    return this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
      async (oneKeyOperationLease) => {
        const isProtocolV2 = this._isProtocolV2Product(dbDevice);
        // Protocol V2 settings cannot be read while locked. Read runtime state
        // first so the shared helper only asks for a PIN when unlock is needed.
        const unlockedState =
          await this.serviceHardware.getDeviceStateWithUnlock({
            connectId: dbDevice.connectId,
            ...(isProtocolV2 ? { pinType: DeviceSessionPinType.Any } : {}),
            params: { scope: isProtocolV2 ? 'runtime' : 'settings' },
            oneKeyOperationLease,
          });

        const state = isProtocolV2
          ? await this.serviceHardware.getDeviceStateByWallet({
              walletId,
              params: { scope: 'settings' },
            })
          : unlockedState;
        const supportFeatures =
          await this.serviceHardware.getDeviceSupportFeatures(
            dbDevice.connectId,
          );
        const inputPinOnSoftwareSupport = Boolean(
          supportFeatures?.inputPinOnSoftware?.support,
        );
        const passphraseEnabled = Boolean(state.status.passphraseProtection);
        const inputPinOnSoftware = Boolean(
          dbDevice?.settings?.inputPinOnSoftware,
        );
        return {
          passphraseEnabled,
          inputPinOnSoftware,
          inputPinOnSoftwareSupport,
        };
      },
      {
        deviceParams: {
          dbDevice,
        },
        hideCheckingDeviceLoading: true,
        debugMethodName: 'deviceSettings.getDeviceSupportFeatures',
      },
    );
  }

  @backgroundMethod()
  async getDeviceLabel({ walletId }: IGetDeviceLabelParams) {
    const device = await localDb.getWalletDevice({ walletId });
    if (this._isTrezorDevice(device)) {
      return device.featuresInfo?.label || device.name || 'Unknown';
    }
    return this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
      async (oneKeyOperationLease) => {
        const compatibleConnectId =
          await this.serviceHardware.getCompatibleConnectId({
            connectId: device.connectId,
            hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
          });
        const state =
          await this.backgroundApi.serviceHardware.getDeviceStateWithUnlock({
            connectId: compatibleConnectId,
            // Protocol V2 settings accept the main PIN or an Attach PIN.
            // Protocol V1 does not define PIN types, so leave the parameter
            // absent and let the legacy device command handle the unlock.
            ...(this._isProtocolV2Product(device)
              ? { pinType: DeviceSessionPinType.Any }
              : {}),
            params: { scope: 'settings' },
            oneKeyOperationLease,
          });
        await this.backgroundApi.serviceHardwareUI.closeHardwareUiStateDialog({
          connectId: compatibleConnectId,
          skipDeviceCancel: true,
          deviceResetToHome: false,
        });
        return state.identity.label || '';
      },
      {
        deviceParams: {
          dbDevice: device,
        },
        debugMethodName: 'deviceSettings.getDeviceLabel',
      },
    );
  }

  @backgroundMethod()
  async setDeviceLabel({ walletId, label }: ISetDeviceLabelParams) {
    const device = await localDb.getWalletDevice({ walletId });
    if (
      this._isProtocolV2Product(device) &&
      !isAsciiAlphanumericWithSpaces(label)
    ) {
      throw new OneKeyLocalError(
        'OneKey Pro 2 device labels only support ASCII letters, numbers, and spaces',
      );
    }
    if (this._isTrezorDevice(device)) {
      return this._applyTrezorSettings({
        walletId,
        dbDevice: device,
        debugMethodName: 'deviceSettings.setDeviceLabel.trezor',
        settings: { label },
        preciseUpdateFields: { label },
      });
    }
    return this._withDeviceProcessing({
      walletId,
      dbDevice: device,
      debugMethodName: 'deviceSettings.setDeviceLabel',
      preciseUpdateFields: { label },
      action: async (sdk, compatibleConnectId) =>
        sdk.deviceSettings(compatibleConnectId, { label }),
    });
  }

  @backgroundMethod()
  async setDeviceHomeScreen({
    dbDeviceId,
    screenItem,
  }: ISetDeviceHomeScreenParams): Promise<DeviceUploadResourceResponse> {
    const device = await localDb.getDevice(dbDeviceId);

    const {
      nameHex,
      screenHex,
      screenBase64,
      thumbnailHex,
      blurScreenHex,
      resType,
      isUserUpload,
    } = screenItem;

    const isMonochrome = deviceHomeScreenUtils.isMonochromeScreen(
      device.deviceType,
    );
    const isCustomScreen = resType === 'custom' || isUserUpload;

    // Pro、Touch: custom upload wallpaper
    const needUploadResource = isCustomScreen && !isMonochrome;

    const finallyScreenHex = screenHex || nameHex || '';
    const finallyThumbnailHex: string | undefined = thumbnailHex;

    const result: DeviceUploadResourceResponse =
      await this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
        async () => {
          // pro touch custom upload wallpaper
          if (needUploadResource) {
            if (this._isProtocolV2Product(device)) {
              if (!screenBase64) {
                throw new OneKeyLocalError(
                  'Upload Pro2 wallpaper error: screenBase64 not defined',
                );
              }
              const compatibleConnectId =
                await this.serviceHardware.getCompatibleConnectId({
                  connectId: device.connectId,
                  featuresDeviceId: device.deviceId,
                  hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
                });
              const hardwareSDK = await this.getSDKInstance({
                connectId: compatibleConnectId,
              });
              const response = await convertDeviceResponse(() =>
                hardwareSDK.deviceUploadWallpaper(compatibleConnectId, {
                  jpegBase64: screenBase64,
                  fileName: screenItem.id.replace(/[^A-Za-z0-9_-]/g, '-'),
                }),
              );
              await this._waitForProtocolV2SettingsSync({
                device,
                compatibleConnectId,
              });
              return {
                ...response,
                message: response.message ?? 'Success',
                applyScreen: true,
              };
            }
            if (!finallyThumbnailHex) {
              throw new OneKeyLocalError(
                'Upload screen item error: thumbnailHex not defined',
              );
            }

            const compatibleConnectId =
              await this.serviceHardware.getCompatibleConnectId({
                connectId: device.connectId,
                featuresDeviceId: device.deviceId,
                hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
              });
            const hardwareSDK = await this.getSDKInstance({
              connectId: compatibleConnectId,
            });
            const uploadResParams: DeviceUploadResourceParams = {
              resType: getWallpaperResourceType(),
              suffix: 'jpeg',
              dataHex: finallyScreenHex,
              thumbnailDataHex: finallyThumbnailHex,
              blurDataHex: blurScreenHex ?? '',
              nftMetaData: '',
            };
            // upload wallpaper resource will automatically set the home screen
            return convertDeviceResponse(() =>
              hardwareSDK.deviceUploadResource(
                compatibleConnectId,
                uploadResParams,
              ),
            );
          }
          // Pro、Touch: built-in wallpaper
          // Classic、mini、1s、pure: custom upload and built-in wallpaper
          // An empty hex clears a monochrome home screen, including a user-confirmed solid image.
          if (!finallyScreenHex && !isMonochrome) {
            throw new OneKeyLocalError('Invalid home screen hex');
          }
          const response = await this.applySettingsToDevice(device.connectId, {
            homescreen: finallyScreenHex,
          });
          return {
            ...response,
            applyScreen: true,
          };
        },
        {
          deviceParams: {
            dbDevice: device,
          },
          debugMethodName: 'deviceSettings.applySettingsToDevice',
        },
      );
    if (!this._isProtocolV2Product(device) && !this._isTrezorDevice(device)) {
      // Fire-and-forget: the wallpaper is already applied and the processing
      // dialog closed; the caller must not stay pending on the read-back.
      void this._notifyProtocolV1SettingsSynced({ device }).catch(
        () => undefined,
      );
    }
    return result;
  }

  @backgroundMethod()
  async setPassphraseEnabled({
    walletId,
    connectId,
    featuresDeviceId,
    passphraseEnabled,
  }: ISetPassphraseEnabledParams) {
    const device = await this._getDeviceForSettings({
      walletId,
      connectId,
      featuresDeviceId,
    });
    const result = this._isTrezorDevice(device)
      ? await this._applyTrezorSettings({
          walletId,
          connectId,
          featuresDeviceId,
          dbDevice: device,
          debugMethodName: 'deviceSettings.setPassphraseEnabled.trezor',
          settings: { use_passphrase: passphraseEnabled },
          preciseUpdateFields: {
            passphrase_protection: passphraseEnabled,
          },
        })
      : await this._withDeviceProcessing({
          walletId,
          connectId,
          featuresDeviceId,
          dbDevice: device,
          debugMethodName: 'deviceSettings.setPassphraseEnabled',
          preciseUpdateFields: {
            passphrase_protection: passphraseEnabled,
          },
          action: async (sdk, compatibleConnectId) =>
            sdk.deviceSettings(compatibleConnectId, {
              usePassphrase: passphraseEnabled,
            }),
        });
    // Protocol V2 returns immediately when the device already has this
    // passphrase value (common after a Pass PIN unlock, when the app still
    // thinks passphrase is off). There is no on-device confirm page, so surface
    // the no-op as a success toast.
    if (isDeviceSettingsAlreadyMatched(result)) {
      appEventBus.emit(EAppEventBusNames.ShowToast, {
        method: 'success',
        title: appLocale.intl.formatMessage({
          id: ETranslations.global_success,
        }),
      });
    }
    return result;
  }

  @backgroundMethod()
  async setAutoLockDelayMs({
    walletId,
    connectId,
    featuresDeviceId,
    autoLockDelayMs,
  }: ISetAutoLockDelayMsParams) {
    const device = await this._getDeviceForSettings({
      walletId,
      connectId,
      featuresDeviceId,
    });
    if (this._isTrezorDevice(device)) {
      return this._applyTrezorSettings({
        walletId,
        connectId,
        featuresDeviceId,
        dbDevice: device,
        debugMethodName: 'deviceSettings.setAutoLockDelayMs.trezor',
        settings: { auto_lock_delay_ms: autoLockDelayMs },
        preciseUpdateFields: {
          auto_lock_delay_ms: autoLockDelayMs,
        },
      });
    }
    return this._withDeviceProcessing({
      walletId,
      connectId,
      featuresDeviceId,
      dbDevice: device,
      debugMethodName: 'deviceSettings.setAutoLockDelayMs',
      preciseUpdateFields: {
        auto_lock_delay_ms: autoLockDelayMs,
      },
      action: async (sdk, compatibleConnectId) =>
        sdk.deviceSettings(compatibleConnectId, {
          autoLockDelayMs,
        }),
    });
  }

  @backgroundMethod()
  async setAutoShutDownDelayMs({
    walletId,
    connectId,
    featuresDeviceId,
    autoShutdownDelayMs,
  }: ISetAutoShutDownDelayMsParams) {
    const device = await this._getDeviceForSettings({
      walletId,
      connectId,
      featuresDeviceId,
    });
    if (this._isTrezorDevice(device)) {
      throw new OneKeyLocalError('Trezor auto shutdown settings not available');
    }
    return this._withDeviceProcessing({
      walletId,
      connectId,
      featuresDeviceId,
      dbDevice: device,
      debugMethodName: 'deviceSettings.setAutoShutDownDelayMs',
      preciseUpdateFields: {
        auto_shutdown_delay_ms: autoShutdownDelayMs,
      },
      action: async (sdk, compatibleConnectId) =>
        sdk.deviceSettings(compatibleConnectId, {
          autoShutdownDelayMs,
        }),
    });
  }

  @backgroundMethod()
  async setLanguage({
    walletId,
    connectId,
    featuresDeviceId,
    language,
  }: ISetLanguageParams) {
    const device = await this._getDeviceForSettings({
      walletId,
      connectId,
      featuresDeviceId,
    });
    if (this._isTrezorDevice(device)) {
      return this._applyTrezorSettings({
        walletId,
        connectId,
        featuresDeviceId,
        dbDevice: device,
        debugMethodName: 'deviceSettings.setLanguage.trezor',
        settings: { language },
        preciseUpdateFields: {
          language,
        },
      });
    }
    return this._withDeviceProcessing({
      walletId,
      connectId,
      featuresDeviceId,
      dbDevice: device,
      debugMethodName: 'deviceSettings.setLanguage',
      preciseUpdateFields: {
        language,
      },
      action: async (sdk, compatibleConnectId) =>
        sdk.deviceSettings(compatibleConnectId, {
          language,
        }),
    });
  }

  @backgroundMethod()
  async setBrightness({
    walletId,
    connectId,
    featuresDeviceId,
    brightness,
  }: ISetBrightnessParams) {
    const device = await this._getDeviceForSettings({
      walletId,
      connectId,
      featuresDeviceId,
    });
    if (this._isTrezorDevice(device)) {
      return this._withTrezorDeviceProcessing({
        walletId,
        connectId,
        featuresDeviceId,
        dbDevice: device,
        debugMethodName: 'deviceSettings.setBrightness.trezor',
        action: async ({ connectId: targetConnectId }) => {
          const adapter = await getTrezorAdapterFromBackgroundApi(
            this.backgroundApi,
          );
          if (!adapter.setBrightness) {
            throw new OneKeyLocalError(
              'Trezor brightness settings not available',
            );
          }
          return adapter.setBrightness(targetConnectId);
        },
      });
    }
    return this._withDeviceProcessing({
      walletId,
      connectId,
      featuresDeviceId,
      dbDevice: device,
      debugMethodName: 'deviceSettings.setBrightness',
      action: async (sdk, compatibleConnectId, _device) =>
        sdk.deviceSettings(
          compatibleConnectId,
          typeof brightness === 'number'
            ? { brightness }
            : { changeBrightness: true },
        ),
    });
  }

  @backgroundMethod()
  async setHapticFeedback({
    walletId,
    connectId,
    featuresDeviceId,
    hapticFeedback,
  }: ISetHapticFeedbackParams) {
    const device = await this._getDeviceForSettings({
      walletId,
      connectId,
      featuresDeviceId,
    });
    if (this._isTrezorDevice(device)) {
      return this._applyTrezorSettings({
        walletId,
        connectId,
        featuresDeviceId,
        dbDevice: device,
        debugMethodName: 'deviceSettings.setHapticFeedback.trezor',
        settings: { haptic_feedback: hapticFeedback },
        preciseUpdateFields: {
          haptic_feedback: hapticFeedback,
        },
      });
    }
    return this._withDeviceProcessing({
      walletId,
      connectId,
      featuresDeviceId,
      dbDevice: device,
      debugMethodName: 'deviceSettings.setHapticFeedback',
      preciseUpdateFields: {
        haptic_feedback: hapticFeedback,
      },
      action: async (sdk, compatibleConnectId) =>
        sdk.deviceSettings(compatibleConnectId, {
          hapticFeedback,
        }),
    });
  }

  @backgroundMethod()
  async wipeDevice({
    walletId,
    connectId,
    featuresDeviceId,
  }: IWipeDeviceParams) {
    const device = await this._getDeviceForSettings({
      walletId,
      connectId,
      featuresDeviceId,
    });
    if (this._isTrezorDevice(device)) {
      const response = await this._withTrezorDeviceProcessing({
        walletId,
        connectId,
        featuresDeviceId,
        dbDevice: device,
        debugMethodName: 'deviceSettings.wipeDevice.trezor',
        action: async ({ connectId: targetConnectId }) => {
          const adapter = await getTrezorAdapterFromBackgroundApi(
            this.backgroundApi,
          );
          if (!adapter.wipeDevice) {
            throw new OneKeyLocalError('Trezor wipe not available');
          }
          return adapter.wipeDevice(targetConnectId);
        },
      });
      await localDb.clearTrezorDeviceThpState({ dbDeviceId: device.id });
      return response;
    }
    return this._withDeviceProcessing({
      walletId,
      connectId,
      featuresDeviceId,
      dbDevice: device,
      debugMethodName: 'deviceSettings.wipeDevice',
      // Wipe teardown (wallet removal) drives its own UI updates; a
      // settings-sync refresh here would race the removal flow.
      skipV1SettingsSyncNotify: true,
      action: async (sdk, compatibleConnectId, targetDevice) => {
        const response = await sdk.deviceWipe(compatibleConnectId);
        if (
          response.success &&
          (targetDevice.vendor === EHardwareVendor.trezor ||
            targetDevice.settings?.vendor === EHardwareVendor.trezor)
        ) {
          await localDb.clearTrezorDeviceThpState({
            dbDeviceId: targetDevice.id,
          });
        }
        return response;
      },
    });
  }

  @backgroundMethod()
  async setInputPinOnSoftware({
    walletId,
    inputPinOnSoftware,
  }: ISetInputPinOnSoftwareParams) {
    const device = await localDb.getWalletDevice({ walletId });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: dbDeviceId, deviceId, connectId } = device;
    if (this._isTrezorDevice(device)) {
      if (inputPinOnSoftware) {
        throw new OneKeyLocalError(
          'Trezor software PIN input is not available',
        );
      }
      await localDb.updateDeviceDbSettings({
        dbDeviceId,
        settings: {
          ...device.settings,
          inputPinOnSoftware: false,
          inputPinOnSoftwareSupport: false,
        },
      });
      return;
    }

    let minSupportVersion: string | undefined = '';
    let inputPinOnSoftwareSupport: boolean | undefined;

    // If open PIN input on the App
    // Check whether the hardware supports it
    if (inputPinOnSoftware && !device.settings?.inputPinOnSoftwareSupport) {
      const supportFeatures =
        await this.serviceHardware.getDeviceSupportFeatures(connectId);

      if (!supportFeatures?.inputPinOnSoftware?.support) {
        // eslint-disable-next-line no-param-reassign
        inputPinOnSoftware = false;
        minSupportVersion = supportFeatures?.inputPinOnSoftware?.require;
        inputPinOnSoftwareSupport = false;
      } else {
        inputPinOnSoftwareSupport = true;
      }
    }

    const settings: IDBDeviceDbSettings = {
      ...device.settings,
      inputPinOnSoftware,
    };
    if (!isNil(inputPinOnSoftwareSupport)) {
      settings.inputPinOnSoftwareSupport = inputPinOnSoftwareSupport;
    }

    await localDb.updateDeviceDbSettings({
      dbDeviceId,
      settings,
    });

    if (minSupportVersion) {
      const error = new FirmwareVersionTooLow({
        payload: undefined as any,
        info: {
          0: minSupportVersion,
        },
      });
      // error.payload?.code
      throw error;
    }
  }

  /** The stage's in-place PIN-entry switch (OK-61489) writes through
   * here — the hardware UI event carries a connectId, not a walletId.
   * No firmware support probe: a PIN request is in flight, so the device
   * cannot take another call; the REQUEST_PIN gate re-checks support
   * from features on the next request anyway. Turning app entry ON still
   * stamps `inputPinOnSoftwareSupport`, the marker that distinguishes a
   * person's choice from the creation-time default: the switch is only
   * offered once the background has already established the device is a
   * supported button model, and without the marker the startup migration
   * (migrateClassicPinInputDefault) would flip this choice back to
   * device entry if it ran after the switch. */
  @backgroundMethod()
  async setInputPinOnSoftwareByConnectId({
    connectId,
    inputPinOnSoftware,
  }: {
    connectId: string;
    inputPinOnSoftware: boolean;
  }) {
    const device = await localDb.getDeviceByQuery({ connectId });
    if (!device) {
      throw new OneKeyLocalError(
        'Device not found for the PIN input setting switch',
      );
    }
    await localDb.updateDeviceDbSettings({
      dbDeviceId: device.id,
      settings: {
        ...device.settings,
        inputPinOnSoftware,
        inputPinOnSoftwareSupport: inputPinOnSoftware
          ? true
          : device.settings?.inputPinOnSoftwareSupport,
      },
    });
  }
}
