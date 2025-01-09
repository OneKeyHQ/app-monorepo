import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { isArray, isNil } from 'lodash';
import semver from 'semver';

import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { makeTimeoutPromise } from '@onekeyhq/shared/src/background/backgroundUtils';
import {
  BridgeTimeoutError,
  FirmwareUpdateBatteryTooLow,
  FirmwareUpdateExit,
  FirmwareUpdateTasksClear,
  InitIframeLoadFail,
  InitIframeTimeout,
  NeedFirmwareUpgradeFromWeb,
  NeedOneKeyBridgeUpgrade,
  UseDesktopToUpdateFirmware,
} from '@onekeyhq/shared/src/errors';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import {
  convertDeviceResponse,
  isHardwareErrorByCode,
} from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { CoreSDKLoader } from '@onekeyhq/shared/src/hardware/instance';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { equalsIgnoreCase } from '@onekeyhq/shared/src/utils/stringUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IBleFirmwareReleasePayload,
  IBleFirmwareUpdateInfo,
  IBootloaderReleasePayload,
  IBootloaderUpdateInfo,
  ICheckAllFirmwareReleaseResult,
  IDeviceFirmwareType,
  IFirmwareChangeLog,
  IFirmwareReleasePayload,
  IFirmwareUpdateInfo,
  IHardwareBridgeReleasePayload,
  IOneKeyDeviceFeatures,
  IResourceUpdateInfo,
} from '@onekeyhq/shared/types/device';
import { EOneKeyDeviceMode } from '@onekeyhq/shared/types/device';

import localDb from '../../dbs/local/localDb';
import {
  EFirmwareUpdateSteps,
  EHardwareUiStateAction,
  firmwareUpdateRetryAtom,
  firmwareUpdateStepInfoAtom,
  firmwareUpdateWorkflowRunningAtom,
} from '../../states/jotai/atoms';
import ServiceBase from '../ServiceBase';
import serviceHardwareUtils from '../ServiceHardware/serviceHardwareUtils';

import {
  FIRMWARE_UPDATE_MIN_BATTERY_LEVEL,
  FIRMWARE_UPDATE_MIN_VERSION_ALLOWED,
} from './firmwareUpdateConsts';
import { FirmwareUpdateDetectMap } from './FirmwareUpdateDetectMap';

import type {
  IPromiseContainerCallbackCreate,
  IPromiseContainerReject,
  IPromiseContainerResolve,
} from '../ServicePromise';
import type {
  CoreApi,
  Success as CoreSuccess,
  DeviceUploadResourceParams,
  IDeviceType,
  IVersionArray,
} from '@onekeyfe/hd-core';
import type { Success } from '@onekeyfe/hd-transport';

export type IAutoUpdateFirmwareParams = {
  connectId: string | undefined;
  version: string;
  firmwareType: IDeviceFirmwareType;
  deviceType: IDeviceType | undefined;
};

export type IUpdateFirmwareWorkflowParams = {
  backuped: boolean;
  usbConnected: boolean;
  releaseResult: ICheckAllFirmwareReleaseResult;
};

export type IUpdateFirmwareTaskFn = ({
  id,
}: {
  id: number;
}) => Promise<Success | undefined>; // return Success | undefined go to next task, throw error to retry

@backgroundClass()
class ServiceFirmwareUpdate extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  async getSDKInstance(): Promise<CoreApi> {
    const hardwareSDK =
      await this.backgroundApi.serviceHardware.getSDKInstance();
    return hardwareSDK;
  }

  @backgroundMethod()
  async rebootToBootloader(connectId: string): Promise<boolean> {
    const hardwareSDK = await this.getSDKInstance();
    return convertDeviceResponse(() =>
      hardwareSDK?.deviceUpdateReboot(connectId),
    );
  }

  @backgroundMethod()
  async rebootToBoardloader(connectId: string): Promise<Success> {
    const hardwareSDK = await this.getSDKInstance();

    return convertDeviceResponse(() =>
      hardwareSDK?.deviceRebootToBoardloader(connectId),
    );
  }

  async checkDeviceIsBootloaderMode({
    connectId,
  }: {
    connectId: string | undefined;
  }) {
    let features: IOneKeyDeviceFeatures | undefined;
    let error: IOneKeyError | undefined;
    let isBootloaderMode = false;
    try {
      // call getFeatures, use FIRMWARE_EVENT to setFirmwareUpdateInfo() and setBleFirmwareUpdateInfo()
      features =
        await this.backgroundApi.serviceHardware.getFeaturesWithoutCache({
          connectId,
          params: {
            retryCount: 0, // don't retry, just checking once
            // force sdk throw DeviceDetectInBootloaderMode but not DeviceNotFound when device at bootloader mode and only one device connected
            detectBootloaderDevice: true,
          },
        });
      isBootloaderMode = await deviceUtils.isBootloaderModeByFeatures({
        features,
      });
    } catch (e) {
      if (
        isHardwareErrorByCode({
          error: e as any,
          code: HardwareErrorCode.DeviceDetectInBootloaderMode,
        })
      ) {
        isBootloaderMode = true;
      } else {
        error = e as any;
      }
    }
    return {
      isBootloaderMode,
      features,
      error,
    };
  }

  @backgroundMethod()
  async uploadResource(connectId: string, params: DeviceUploadResourceParams) {
    const hardwareSDK = await this.getSDKInstance();
    return convertDeviceResponse(() =>
      hardwareSDK?.deviceUploadResource(connectId, params),
    );
  }

  detectMap = new FirmwareUpdateDetectMap({
    backgroundApi: this.backgroundApi,
  });

  @backgroundMethod()
  async resetShouldDetectTimeCheck({ connectId }: { connectId: string }) {
    this.detectMap.resetLastDetectAt({ connectId });
  }

  @backgroundMethod()
  async showAutoUpdateCheckDebugToast(message: string) {
    void this.backgroundApi.serviceDevSetting
      .getFirmwareUpdateDevSettings('showAutoCheckHardwareUpdatesToast')
      .then((result) => {
        if (!result) return;

        void this.backgroundApi.serviceApp.showToast({
          method: 'message',
          title: message,
        });
      })
      .catch(() => {
        // ignore
      });
  }

  /**
   * Defer device update checks
   * @param connectId device connectId
   */
  @backgroundMethod()
  async delayShouldDetectTimeCheck({ connectId }: { connectId: string }) {
    this.detectMap.updateLastDetectAt({ connectId });

    void this.showAutoUpdateCheckDebugToast('推迟硬件自动更新检测');
  }

  @backgroundMethod()
  async getFirmwareUpdateDetectInfo({ connectId }: { connectId: string }) {
    const info = this.detectMap.detectMapCache[connectId];
    return info;
  }

  // TODO sdk not ready yet(slow network test)
  // TODO check firmware update from hidden wallet
  // TODO check firmware update from onboarding
  @backgroundMethod()
  async detectActiveAccountFirmwareUpdates({
    connectId,
  }: {
    connectId: string;
  }) {
    // detect certain account device firmware update, so connectId is required
    if (!connectId) {
      return;
    }
    const showBootloaderUpdateModal = () => {
      appEventBus.emit(EAppEventBusNames.ShowFirmwareUpdateFromBootloaderMode, {
        connectId,
      });
    };
    if (!this.detectMap.shouldDetect({ connectId })) {
      return;
    }
    this.detectMap.updateLastDetectAt({
      connectId,
    });

    const { isBootloaderMode, features, error } =
      await this.checkDeviceIsBootloaderMode({ connectId });

    serviceHardwareUtils.hardwareLog('checkFirmwareUpdateStatus', features);

    if (error) throw error;

    if (isBootloaderMode) {
      showBootloaderUpdateModal();
    }
  }

  @backgroundMethod()
  @toastIfError()
  async checkAllFirmwareRelease({
    connectId,
  }: {
    connectId: string | undefined;
  }): Promise<ICheckAllFirmwareReleaseResult> {
    const { getDeviceUUID } = await CoreSDKLoader();

    const originalConnectId = connectId;

    if (platformEnv.isNative && !originalConnectId) {
      throw new Error(
        'checkAllFirmwareRelease ERROR: native ble-sdk connectId is required',
      );
    }

    await firmwareUpdateStepInfoAtom.set({
      step: EFirmwareUpdateSteps.init,
      payload: undefined,
    });
    await firmwareUpdateRetryAtom.set(undefined);
    serviceHardwareUtils.hardwareLog('checkAllFirmwareRelease');

    const sdk = await this.getSDKInstance();
    try {
      sdk.cancel(originalConnectId);
    } catch (error) {
      //
    }

    await timerUtils.wait(1000);

    const updatingConnectId = deviceUtils.getUpdatingConnectId({
      connectId: originalConnectId,
    });

    try {
      sdk.cancel(updatingConnectId);
    } catch (error) {
      //
    }

    const { isBootloaderMode } = await this.checkDeviceIsBootloaderMode({
      connectId: originalConnectId,
    });

    // use originalConnectId getFeatures() make sure sdk throw DeviceNotFound if connected device not matched with originalConnectId
    const features =
      await this.backgroundApi.serviceHardware.getFeaturesWithoutCache({
        connectId: isBootloaderMode ? updatingConnectId : originalConnectId,
        params: {
          allowEmptyConnectId: true,
        },
      });

    const firmware = await this.checkFirmwareRelease({
      connectId: updatingConnectId,
      features,
    });

    let ble;
    let bootloader;
    let bridge;
    if (firmware?.hasUpgrade && firmware.toVersion) {
      bridge = await this.checkBridgeRelease({
        connectId: updatingConnectId,
        willUpdateFirmwareVersion: firmware.toVersion,
      });

      const mockShouldUpdateBridge =
        await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
          'shouldUpdateBridge',
        );
      if (bridge && mockShouldUpdateBridge === true) {
        // TODO mock bridge?.shouldUpdate
        bridge.shouldUpdate = true;
      }

      // TODO only check bootloader upgrade？
      if (!bridge?.shouldUpdate) {
        bootloader = await this.checkBootloaderRelease({
          connectId: updatingConnectId,
          willUpdateFirmwareVersion: firmware.toVersion,
          features,
          firmwareUpdateInfo: firmware,
        });
      }
    }

    if (!bridge?.shouldUpdate) {
      ble = await this.checkBLEFirmwareRelease({
        connectId: updatingConnectId,
        features,
      });
    }

    let hasUpgrade =
      firmware?.hasUpgrade || ble?.hasUpgrade || bootloader?.hasUpgrade;

    const mockAllIsUpToDate =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'allIsUpToDate',
      );
    if (mockAllIsUpToDate) {
      hasUpgrade = false;
    }

    // TODO boot mode device uuid is empty
    const deviceUUID = getDeviceUUID(features);
    const deviceType = await deviceUtils.getDeviceTypeFromFeatures({
      features,
    });
    let deviceName = await deviceUtils.buildDeviceName({ features });
    const dbDeviceName = (
      await localDb.getDeviceByQuery({
        connectId: originalConnectId,
      })
    )?.name;
    if (dbDeviceName) {
      deviceName = `${deviceName} (${dbDeviceName})`;
    }

    const totalPhase: Array<IDeviceFirmwareType | undefined> = [
      bootloader?.hasUpgrade ? 'bootloader' : undefined,
      firmware?.hasUpgrade ? 'firmware' : undefined,
      ble?.hasUpgrade ? 'ble' : undefined,
    ];

    if (!hasUpgrade && originalConnectId) {
      await this.detectMap.deleteUpdateInfo({
        connectId: originalConnectId,
      });
    }

    return {
      updatingConnectId,
      originalConnectId,
      features,
      deviceType,
      deviceName,
      deviceUUID,
      hasUpgrade,
      isBootloaderMode: features
        ? (await deviceUtils.getDeviceModeFromFeatures({ features })) ===
          EOneKeyDeviceMode.bootloader
        : false,
      updateInfos: {
        firmware,
        ble,
        bootloader,
        bridge,
      },
      totalPhase: totalPhase.filter(Boolean),
    };
  }

  @backgroundMethod()
  async checkFirmwareRelease({
    connectId,
    features,
  }: {
    connectId: string | undefined;
    features: IOneKeyDeviceFeatures;
  }): Promise<IFirmwareUpdateInfo> {
    const hardwareSDK = await this.getSDKInstance();
    // "DeviceNotFound" if device with connectId not connected
    // "NotInBootLoaderMode" if device in boot mode
    // "NewFirmwareForceUpdate" if device in boot mode, and call getAddress method
    const result = await convertDeviceResponse(() =>
      // method fail if device on boot mode
      hardwareSDK.checkFirmwareRelease(
        deviceUtils.getUpdatingConnectId({ connectId }),
      ),
    );

    const releasePayload: IFirmwareReleasePayload = {
      ...result,
      features,
      connectId, // set connectId as result missing features, but events include
    };

    // TODO check releaseInfo.version with current version
    // 1. manual check here
    // 2. auto check by event: FIRMWARE_EVENT (event emit by method calling like sdk.getFeatures())
    return this.setFirmwareUpdateInfo(releasePayload);
  }

  @backgroundMethod()
  async checkBLEFirmwareRelease({
    connectId,
    features,
  }: {
    connectId: string | undefined;
    features: IOneKeyDeviceFeatures;
  }): Promise<IBleFirmwareUpdateInfo> {
    const hardwareSDK = await this.getSDKInstance();
    const result = await convertDeviceResponse(() =>
      // method fail if device on boot mode
      hardwareSDK.checkBLEFirmwareRelease(
        deviceUtils.getUpdatingConnectId({ connectId }),
      ),
    );

    const releasePayload: IBleFirmwareReleasePayload = {
      ...result,
      features,
      connectId,
    };

    // TODO check releaseInfo.version with current version
    // 1. manual check here
    // 2. auto check by event: FIRMWARE_EVENT (event emit by method calling like sdk.getFeatures())
    return this.setBleFirmwareUpdateInfo(releasePayload);
  }

  // TODO only for classic and mini?
  @backgroundMethod()
  async checkBootloaderRelease({
    connectId,
    willUpdateFirmwareVersion,
    features,
    firmwareUpdateInfo,
  }: {
    connectId: string | undefined;
    willUpdateFirmwareVersion: string;
    features: IOneKeyDeviceFeatures;
    firmwareUpdateInfo: IFirmwareUpdateInfo;
  }): Promise<IBootloaderUpdateInfo> {
    const hardwareSDK = await this.getSDKInstance();
    const releasePayload = await convertDeviceResponse(() =>
      hardwareSDK?.checkBootloaderRelease(
        deviceUtils.getUpdatingConnectId({ connectId }),
        {
          willUpdateFirmwareVersion,
        },
      ),
    );
    // releasePayload?.release
    // TODO type mismatch
    const usedReleasePayload = releasePayload as IBootloaderReleasePayload;

    const { bootloaderVersion } = await deviceUtils.getDeviceVersion({
      features,
      device: undefined,
    });
    let toVersion = '';
    let changelog: IFirmwareChangeLog | undefined;
    // boot releaseInfo?.release may be string of resource download url
    const versionFromReleaseInfo =
      usedReleasePayload?.release?.displayBootloaderVersion;
    if (versionFromReleaseInfo && isArray(versionFromReleaseInfo)) {
      toVersion = this.arrayVersionToString(versionFromReleaseInfo as any);
    }
    if (!toVersion) {
      toVersion = this.arrayVersionToString(
        firmwareUpdateInfo.releasePayload.release?.displayBootloaderVersion,
      );
    }
    changelog = usedReleasePayload.release?.bootloaderChangelog;
    if (!changelog) {
      changelog =
        firmwareUpdateInfo.releasePayload.release?.bootloaderChangelog;
    }

    const fromVersion = bootloaderVersion;
    const { hasUpgrade, hasUpgradeForce } =
      await this.getFirmwareHasUpgradeStatus({
        releasePayload: usedReleasePayload,
        firmwareType: 'bootloader',
        fromVersion,
        toVersion,
      });

    const updateInfo: IBootloaderUpdateInfo = {
      connectId,
      hasUpgrade,
      hasUpgradeForce,
      fromVersion,
      toVersion,
      releasePayload: usedReleasePayload,
      changelog,
      firmwareType: 'bootloader',
    };
    return updateInfo;
  }

  async getFirmwareHasUpgradeStatus({
    releasePayload,
    firmwareType,
    fromVersion,
    toVersion,
  }: {
    releasePayload:
      | IFirmwareReleasePayload
      | IBleFirmwareReleasePayload
      | IBootloaderReleasePayload;
    firmwareType: IDeviceFirmwareType;
    fromVersion: string;
    toVersion: string;
  }) {
    let hasUpgradeForce = false;
    let hasUpgrade = false;
    switch (releasePayload?.status) {
      case 'required':
        hasUpgradeForce = true;
        hasUpgrade = true;
        break;
      case 'valid':
      case 'none':
        hasUpgrade = false;
        break;
      case 'outdated':
        hasUpgrade = true;
        break;
      default:
        hasUpgrade = false;
        break;
    }

    // bootloaderMode may return status: 'unknown' | 'none'
    // TODO: different of 'unknown' | 'none';
    if (
      // bootloader can't detect current firmware version, so we always upgrade fw and ble
      releasePayload?.bootloaderMode &&
      releasePayload?.release &&
      ['firmware', 'ble'].includes(firmwareType) // bootloader can't reinstall
    ) {
      hasUpgrade = true;
    }

    // TODO sdk missing type shouldUpdate
    // @ts-ignore
    if (releasePayload?.shouldUpdate) {
      // if sdk indicate should update, always update
      hasUpgrade = true;
    }

    if (
      firmwareType !== 'bootloader' &&
      !releasePayload?.bootloaderMode &&
      fromVersion &&
      toVersion
    ) {
      if (semver.gte(fromVersion, toVersion)) {
        hasUpgrade = false;
        hasUpgradeForce = false;
      }
    }

    // re-fix at last, if valid status, never upgrade
    if (releasePayload?.status === 'valid') {
      hasUpgrade = false;
    }

    const mockUpdateFirmware =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'forceUpdateFirmware',
      );
    const mockUpdateBle =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'forceUpdateBle',
      );
    const mockUpdateBootloader =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'forceUpdateBootloader',
      );
    if (firmwareType === 'firmware' && mockUpdateFirmware) {
      hasUpgrade = true;
    }
    if (firmwareType === 'ble' && mockUpdateBle) {
      hasUpgrade = true;
    }
    if (firmwareType === 'bootloader' && mockUpdateBootloader) {
      hasUpgrade = true;
    }

    return {
      hasUpgradeForce,
      hasUpgrade,
    };
  }

  async getConnectIdFromReleaseInfo(
    payload: IFirmwareReleasePayload | IBleFirmwareReleasePayload,
  ) {
    let connectId = payload.connectId;
    // features only included by events calling
    if (!connectId && payload.features) {
      connectId =
        await this.backgroundApi.serviceHardware.getConnectIdFromFeatures({
          features: payload.features,
        });
    }
    return connectId;
  }

  arrayVersionToString(version: IVersionArray | undefined) {
    return version?.join('.') || '';
  }

  // TODO move to standalone service
  @backgroundMethod()
  async setFirmwareUpdateInfo(
    payload: IFirmwareReleasePayload,
  ): Promise<IFirmwareUpdateInfo> {
    serviceHardwareUtils.hardwareLog('_checkFirmwareUpdate', payload);
    if (!payload?.features) {
      throw new Error('setFirmwareUpdateInfo ERROR: features is required');
    }
    const connectId = await this.getConnectIdFromReleaseInfo(payload);

    const { firmwareVersion } = await deviceUtils.getDeviceVersion({
      device: undefined,
      features: payload?.features,
    });

    const fromVersion = firmwareVersion || '';
    const toVersion = this.arrayVersionToString(payload?.release?.version);
    const { hasUpgrade, hasUpgradeForce } =
      await this.getFirmwareHasUpgradeStatus({
        releasePayload: payload,
        firmwareType: 'firmware',
        fromVersion,
        toVersion,
      });

    const updateInfo: IFirmwareUpdateInfo = {
      connectId,
      hasUpgrade,
      hasUpgradeForce,
      fromVersion,
      toVersion,
      releasePayload: payload,
      changelog: payload.release?.changelog,
      firmwareType: 'firmware',
    };
    if (connectId) {
      await this.detectMap.updateFirmwareUpdateInfo({
        connectId,
        updateInfo,
      });
    }
    serviceHardwareUtils.hardwareLog(
      '_checkFirmwareUpdate updateInfo',
      updateInfo,
    );
    return updateInfo;
  }

  @backgroundMethod()
  async setBleFirmwareUpdateInfo(payload: IBleFirmwareReleasePayload) {
    serviceHardwareUtils.hardwareLog('showBleFirmwareReleaseInfo', payload);
    if (!payload.features) {
      throw new Error('setBleFirmwareUpdateInfo ERROR: features is required');
    }
    const connectId = await this.getConnectIdFromReleaseInfo(payload);
    const { bleVersion } = await deviceUtils.getDeviceVersion({
      device: undefined,
      features: payload.features,
    });
    const fromVersion = bleVersion || '';
    const toVersion = this.arrayVersionToString(payload?.release?.version);
    const { hasUpgrade, hasUpgradeForce } =
      await this.getFirmwareHasUpgradeStatus({
        releasePayload: payload,
        firmwareType: 'ble',
        fromVersion,
        toVersion,
      });

    const updateInfo: IBleFirmwareUpdateInfo = {
      connectId,
      hasUpgrade,
      hasUpgradeForce,
      fromVersion,
      toVersion,
      releasePayload: payload,
      changelog: payload.release?.changelog,
      firmwareType: 'ble',
    };
    if (connectId) {
      await this.detectMap.updateBleFirmwareUpdateInfo({
        connectId,
        updateInfo,
      });
    }
    return updateInfo;
  }

  async withFirmwareUpdateEvents<T>(fn: () => Promise<T>): Promise<T> {
    const hardwareSDK = await this.getSDKInstance();
    const listener = (data: any) => {
      serviceHardwareUtils.hardwareLog('autoUpdateFirmware', data);
      // dispatch(setUpdateFirmwareStep(get(data, 'data.message', '')));
    };
    hardwareSDK.on(EHardwareUiStateAction.FIRMWARE_TIP, listener);
    try {
      return await fn();
    } finally {
      hardwareSDK.off(EHardwareUiStateAction.FIRMWARE_TIP, listener);
    }
  }

  @backgroundMethod()
  async ensureDeviceExist(
    connectId: string,
    maxTryCount = 10,
    bootloaderMode = false,
  ) {
    return new Promise((resolve) => {
      const scanner = deviceUtils.getDeviceScanner({
        backgroundApi: this.backgroundApi,
      });
      let tryCount = 0;
      scanner.startDeviceScan(
        (response) => {
          tryCount += 1;
          if (tryCount > maxTryCount) {
            scanner.stopScan();
            resolve(false);
          }
          if (!response.success) {
            return;
          }
          const deviceExist = bootloaderMode
            ? // bootloader mode does not have connect id for classic
              (response.payload ?? []).length > 0
            : (response.payload ?? []).find((d) =>
                equalsIgnoreCase(d.connectId, connectId),
              );
          if (deviceExist) {
            scanner.stopScan();
            resolve(true);
          }
        },
        () => {},
        1,
        3000,
        Number.MAX_VALUE,
      );
    });
  }

  async updatingBootloader(
    params: IUpdateFirmwareWorkflowParams,
    updateInfo: IBootloaderUpdateInfo,
  ): Promise<undefined | Success> {
    const hardwareSDK = await this.getSDKInstance();

    const deviceType = params.releaseResult?.deviceType;
    if (!deviceType) return;

    // TODO move to utils
    const isClassicOrMini =
      deviceType === 'classic' ||
      deviceType === 'mini' ||
      deviceType === 'classic1s';

    const isTouchOrPro = deviceType === 'touch' || deviceType === 'pro';

    return this.withFirmwareUpdateEvents(async () => {
      if (isClassicOrMini) {
        await firmwareUpdateStepInfoAtom.set({
          step: EFirmwareUpdateSteps.installing,
          payload: {
            installingTarget: {
              totalPhase: params.releaseResult.totalPhase,
              currentPhase: 'bootloader',
              updateInfo,
            },
          },
        });
        const result = convertDeviceResponse(async () =>
          hardwareSDK.firmwareUpdateV2(params.releaseResult.updatingConnectId, {
            updateType: 'firmware',
            platform: platformEnv.symbol ?? 'web',
            isUpdateBootloader: true,
          }),
        );
        return result;
      }
      if (isTouchOrPro) {
        await firmwareUpdateStepInfoAtom.set({
          step: EFirmwareUpdateSteps.installing,
          payload: {
            installingTarget: {
              totalPhase: params.releaseResult.totalPhase,
              currentPhase: 'bootloader',
              updateInfo,
            },
          },
        });
        const result = convertDeviceResponse(async () =>
          // TODO connectId can be undefined
          hardwareSDK.deviceUpdateBootloader(
            params.releaseResult.updatingConnectId as string,
            {},
          ),
        );

        return result;
      }
    });
  }

  updatingBootloaderForTouchAndProLegacy(
    params: IUpdateFirmwareWorkflowParams,
  ) {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve) => {
      const hardwareSDK = await this.getSDKInstance();
      // restart count down
      await timerUtils.wait(8000);
      let tryCount = 0;
      //  polling device when restart success
      const DISCONNECT_ERROR = 'Request failed with status code';
      const execute = async () => {
        if (!params.releaseResult.updatingConnectId) {
          return;
        }
        const isFoundDevice = await this.ensureDeviceExist(
          params.releaseResult.updatingConnectId,
        );
        if (!isFoundDevice) {
          resolve({
            success: false,
            payload: {
              error: 'Device Not Found',
              code: HardwareErrorCode.DeviceNotFound,
            },
          });
        }
        const res = await hardwareSDK.deviceUpdateBootloader(
          params.releaseResult.updatingConnectId,
          {},
        );
        if (!res.success) {
          if (
            res.payload.error.indexOf(DISCONNECT_ERROR) > -1 &&
            tryCount < 3
          ) {
            tryCount += 1;
            await execute();
          } else {
            resolve(res);
            return;
          }
        }
        resolve(res as unknown as CoreSuccess<boolean>);
      };

      await execute();
    });
  }

  @backgroundMethod()
  @toastIfError()
  async updatingFirmware(
    { connectId, version, firmwareType, deviceType }: IAutoUpdateFirmwareParams,
    updateInfo: IBleFirmwareUpdateInfo | IFirmwareUpdateInfo,
    workflowParams: IUpdateFirmwareWorkflowParams,
  ): Promise<Success> {
    // const { dispatch } = this.backgroundApi;
    // dispatch(setUpdateFirmwareStep(''));

    const hardwareSDK = await this.getSDKInstance();

    return this.withFirmwareUpdateEvents(async () => {
      // dev
      // const settings = this.backgroundApi.appSelector((s) => s.settings);
      // const enable = settings?.devMode?.enable ?? false;
      // const updateDeviceRes = settings?.devMode?.updateDeviceRes ?? false;

      // const forcedUpdateRes = enable && updateDeviceRes;
      // const version = settings.deviceUpdates?.[connectId][firmwareType]?.version;

      const forceUpdateResEvenIfSameVersion =
        await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
          'forceUpdateResEvenSameVersion',
        );
      const versionArr = version.split('.').map((v) => parseInt(v, 10)); // TODO move to utils
      await firmwareUpdateStepInfoAtom.set({
        step: EFirmwareUpdateSteps.installing,
        payload: {
          installingTarget: {
            totalPhase: workflowParams.releaseResult.totalPhase,
            currentPhase: firmwareType,
            updateInfo,
          },
        },
      });
      const result = await convertDeviceResponse(() =>
        hardwareSDK.firmwareUpdateV2(
          deviceUtils.getUpdatingConnectId({ connectId }),
          {
            updateType: firmwareType as any,
            // update res is always enabled when firmware version changed
            // forcedUpdateRes for TEST only, means always update res even if firmware version is same (re-flash the same firmware)
            forcedUpdateRes: forceUpdateResEvenIfSameVersion === true,
            version: versionArr,
            platform: platformEnv.symbol ?? 'web',
          },
        ),
      );

      // TODO update bootloader after firmware update??
      // update bootloader
      if (result && deviceType === 'touch' && firmwareType === 'firmware') {
        // const updateBootRes = await this.updateBootloader(connectId);
        // if (!updateBootRes.success) return updateBootRes;
      }

      // TODO handleErrors UpdatingModal

      return result;
    });
  }

  @backgroundMethod()
  async checkBridgeStatus(): Promise<{ status: boolean; timeout?: boolean }> {
    if (!this._hasUseBridge()) {
      return Promise.resolve({ status: true });
    }

    const hardwareSDK = await this.getSDKInstance();

    try {
      const bridgeStatus = await convertDeviceResponse(() =>
        hardwareSDK?.checkBridgeStatus(),
      );
      return { status: bridgeStatus };
    } catch (error) {
      if (
        error instanceof InitIframeLoadFail ||
        error instanceof InitIframeTimeout
      ) {
        return Promise.resolve({ status: true });
      }
      /**
       * Sometimes we need to capture the Bridge timeout error
       * it does not mean that the user does not have bridge installed
       */
      if (error instanceof BridgeTimeoutError) {
        return Promise.resolve({ status: true, timeout: true });
      }

      return Promise.resolve({ status: false });
    }
  }

  _hasUseBridge() {
    return (
      platformEnv.isDesktop || platformEnv.isWeb || platformEnv.isExtension
    );
  }

  @backgroundMethod()
  async checkBridgeRelease({
    connectId,
    willUpdateFirmwareVersion,
  }: {
    connectId: string | undefined;
    willUpdateFirmwareVersion: string;
  }): Promise<IHardwareBridgeReleasePayload | undefined> {
    if (!this._hasUseBridge()) {
      return undefined;
    }
    const hardwareSDK = await this.getSDKInstance();
    const releaseInfo = await convertDeviceResponse(() =>
      hardwareSDK?.checkBridgeRelease(
        deviceUtils.getUpdatingConnectId({ connectId }),
        {
          willUpdateFirmwareVersion,
        },
      ),
    );
    // releaseInfo?.releaseVersion;
    return releaseInfo ?? undefined;
  }

  updateTasks: Record<number | string, IUpdateFirmwareTaskFn> = {};

  updateTasksAdd({
    fn,
    reject,
    resolve,
  }: IPromiseContainerCallbackCreate & {
    fn: IUpdateFirmwareTaskFn;
  }) {
    const { servicePromise } = this.backgroundApi;
    // TODO disabled servicePromise auto reject when timeout
    const id = servicePromise.createCallback({ reject, resolve });

    this.updateTasks[id] = fn;
    return id;
  }

  async updateTasksReject({ id, error }: IPromiseContainerReject) {
    const { servicePromise } = this.backgroundApi;
    await servicePromise.rejectCallback({ id, error });
    delete this.updateTasks[id];
  }

  async updateTasksResolve({ id, data }: IPromiseContainerResolve) {
    const { servicePromise } = this.backgroundApi;
    await servicePromise.resolveCallback({
      id,
      data,
    });
    delete this.updateTasks[id];
  }

  async updateTasksClear(reason: string) {
    await Promise.all([
      Object.keys(this.updateTasks).map(async (id) => {
        await this.updateTasksReject({
          id,
          error: new FirmwareUpdateTasksClear({
            message: `updateTasksClear: ${reason}`,
          }),
        });
      }),
    ]);
    this.updateTasks = {};
  }

  @backgroundMethod()
  async exitUpdateWorkflow() {
    await this.updateTasksClear('exitUpdateWorkflow');
    await firmwareUpdateWorkflowRunningAtom.set(false);
  }

  async cancelUpdateWorkflowIfExit() {
    const isRunning = await firmwareUpdateWorkflowRunningAtom.get();
    if (!isRunning) {
      throw new FirmwareUpdateExit();
    }
  }

  async waitDeviceRestart({
    releaseResult,
    actionType,
  }: {
    releaseResult: ICheckAllFirmwareReleaseResult | undefined;
    actionType: 'nextPhase' | 'retry' | 'ble-done' | 'boot-done' | 'done';
  }) {
    // use getFeatures to wait device reboot, not working, will pending forever
    // await this.backgroundApi.serviceHardware.getFeatures(
    //   params.connectId,
    //   {
    //     allowEmptyConnectId: true,
    //   },
    // );
    if (actionType === 'nextPhase') {
      await timerUtils.wait(15 * 1000);
    }
    if (actionType === 'retry') {
      await timerUtils.wait(5 * 1000);
    }
    if (actionType === 'ble-done') {
      if (['touch', 'pro'].includes(releaseResult?.deviceType ?? '')) {
        await timerUtils.wait(15 * 1000);
      }
    }
    if (actionType === 'done') {
      await timerUtils.wait(
        releaseResult?.deviceType === 'mini' ? 5 * 1000 : 2 * 1000,
      );
    }
    if (actionType === 'boot-done') {
      if (['touch', 'pro'].includes(releaseResult?.deviceType ?? '')) {
        await timerUtils.wait(20 * 1000);
      }
    }
  }

  @backgroundMethod()
  @toastIfError()
  async startUpdateWorkflow(params: IUpdateFirmwareWorkflowParams) {
    const dbDevice = await localDb.getDeviceByQuery({
      connectId: params.releaseResult.originalConnectId, // TODO remove connectId check
    });
    if (!dbDevice) {
      // throw new Error('device not found');
    }
    await this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
      async () => {
        appEventBus.emit(EAppEventBusNames.BeginFirmwareUpdate, undefined);
        // await other hardware task stop processing
        await timerUtils.wait(3000);

        // TODO verify current device is matched with params.connectId\params.updateFirmware\params.updateBle
        // pre checking
        await this.validateMnemonicBackuped(params);
        await this.validateUSBConnection(params);
        // must before validateMinVersionAllowed, go to https://help.onekey.so/
        await this.validateShouldUpdateFullResource(params);
        // go to https://firmware.onekey.so/
        await this.validateMinVersionAllowed(params);
        await this.validateDeviceBattery(params);
        await this.validateShouldUpdateBridge(params);

        // ** clear all retry tasks
        await this.updateTasksClear('startUpdateWorkflow');

        let shouldRebootAfterUpdate = false;

        const waitRebootDelayForNextPhase = async () => {
          if (shouldRebootAfterUpdate) {
            await this.waitDeviceRestart({
              actionType: 'nextPhase',
              releaseResult: params.releaseResult,
            });
            shouldRebootAfterUpdate = false;
          }
        };

        // ** bootloader update
        await this.cancelUpdateWorkflowIfExit();
        if (params?.releaseResult?.updateInfos?.bootloader?.hasUpgrade) {
          await waitRebootDelayForNextPhase();

          await this.startUpdateBootloaderTask(params);

          shouldRebootAfterUpdate = true;

          // await hardware boot install and reboot
          // move sdk
          await this.waitDeviceRestart({
            actionType: 'boot-done',
            releaseResult: params.releaseResult,
          });
        }

        // TODO cancel workflow if modal closed or back

        // ** firmware update (including res update)
        if (params?.releaseResult?.updateInfos?.firmware?.hasUpgrade) {
          await waitRebootDelayForNextPhase();

          const deviceType = params?.releaseResult?.deviceType;
          // TODO recheck release if match with current connect device
          // TODO check update version gt current version
          // TODO check features matched
          await this.cancelUpdateWorkflowIfExit();
          await this.startUpdateFirmwareTaskBase(
            {
              connectId: params?.releaseResult?.updatingConnectId,
              version: params?.releaseResult?.updateInfos?.firmware?.toVersion,
              firmwareType: 'firmware',
              deviceType,
            },
            params?.releaseResult?.updateInfos?.firmware,
            params,
          );

          shouldRebootAfterUpdate = true;
        }

        //  ble update
        if (params?.releaseResult?.updateInfos?.ble?.hasUpgrade) {
          await waitRebootDelayForNextPhase();

          const deviceType = params?.releaseResult?.deviceType;

          // TODO recheck release if match with current connect device
          await this.cancelUpdateWorkflowIfExit();
          await this.startUpdateFirmwareTaskBase(
            {
              connectId: params?.releaseResult?.updatingConnectId,
              version: params?.releaseResult?.updateInfos?.ble?.toVersion,
              firmwareType: 'ble',
              deviceType,
            },
            params?.releaseResult?.updateInfos?.ble,
            params,
          );

          shouldRebootAfterUpdate = true;

          await this.waitDeviceRestart({
            actionType: 'ble-done',
            releaseResult: params.releaseResult,
          });
        }

        serviceHardwareUtils.hardwareLog('startUpdateWorkflow DONE', params);

        await firmwareUpdateRetryAtom.set(undefined);
        if (params.releaseResult.originalConnectId) {
          await this.waitDeviceRestart({
            actionType: 'done',
            releaseResult: params.releaseResult,
          });
          await this.detectMap.deleteUpdateInfo({
            connectId: params.releaseResult.originalConnectId,
          });
        }
      },
      {
        deviceParams: {
          dbDevice: dbDevice || ({} as any),
        },
        skipDeviceCancel: true,
        hideCheckingDeviceLoading: true,
        debugMethodName: 'startUpdateWorkflow',
      },
    );
  }

  async startUpdateBootloaderTask(params: IUpdateFirmwareWorkflowParams) {
    const firmwareUpdateInfo = params?.releaseResult?.updateInfos?.firmware;
    const firmwareToVersion = firmwareUpdateInfo?.toVersion;
    if (!firmwareUpdateInfo || !firmwareToVersion) {
      return;
    }
    const features =
      await this.backgroundApi.serviceHardware.getFeaturesWithoutCache({
        connectId: params.releaseResult.updatingConnectId,
        params: {
          allowEmptyConnectId: true,
        },
      });

    // TODO move to fn
    const updateInfo = await this.checkBootloaderRelease({
      features,
      connectId: params.releaseResult.updatingConnectId,
      willUpdateFirmwareVersion: firmwareToVersion,
      firmwareUpdateInfo,
    });
    // TODO mock boot re-update
    // if (release) {
    //   release.shouldUpdate = true;
    // }

    const mockUpdateBootloader =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'forceUpdateBootloader',
      );
    // TODO check update version gt current version
    if (updateInfo?.hasUpgrade || mockUpdateBootloader) {
      return this.createRunTaskWithRetry({
        fn: async () => this.updatingBootloader(params, updateInfo),
      });
    }
  }

  async startUpdateFirmwareTaskBase(
    params: IAutoUpdateFirmwareParams,
    updateInfo: IBleFirmwareUpdateInfo | IFirmwareUpdateInfo,
    workflowParams: IUpdateFirmwareWorkflowParams,
  ) {
    return this.createRunTaskWithRetry({
      fn: async () => this.updatingFirmware(params, updateInfo, workflowParams),
    });
  }

  createRunTaskWithRetry({ fn }: { fn: IUpdateFirmwareTaskFn }) {
    return new Promise((resolve, reject) => {
      const id = this.updateTasksAdd({ fn, reject, resolve });
      void this.runUpdateTask({ id });
    });
  }

  @backgroundMethod()
  async runUpdateTask({
    id,
    preFn,
  }: {
    id: number;
    preFn?: (params?: undefined) => Promise<void | undefined>;
  }): Promise<void> {
    try {
      await this.cancelUpdateWorkflowIfExit();
    } catch (error) {
      await this.updateTasksReject({ id, error });
      return;
    }

    try {
      await firmwareUpdateRetryAtom.set(undefined);

      await preFn?.();

      const fn = this.updateTasks[id];
      const result = await fn?.({ id });
      await this.updateTasksResolve({ id, data: result });
      serviceHardwareUtils.hardwareLog('runUpdateTask SUCCESS', result);
    } catch (error) {
      //
      serviceHardwareUtils.hardwareLog('startUpdateWorkflow ERROR', error);
      // never reject here, we should use retry
      // await servicePromise.rejectCallback({ id, error });
      await firmwareUpdateRetryAtom.set({
        id,
        error: toPlainErrorObject(error as any),
      });

      await this.backgroundApi.serviceHardwareUI.closeHardwareUiStateDialog({
        skipDeviceCancel: true,
        connectId: '',
      });

      // TODO hide deviceCheckingLoading and confirm dialog
    } finally {
      //
      try {
        await this.cancelUpdateWorkflowIfExit();
      } catch (error2) {
        await this.updateTasksReject({ id, error: error2 });
      }
    }
  }

  @backgroundMethod()
  async retryUpdateTask({
    id,
    connectId,
    releaseResult,
  }: {
    id: number;
    // TODO put connectId to updateTasks
    connectId: string | undefined;
    releaseResult: ICheckAllFirmwareReleaseResult | undefined;
  }) {
    await firmwareUpdateRetryAtom.set(undefined);

    await this.waitDeviceRestart({
      releaseResult,
      actionType: 'retry',
    });

    await this.runUpdateTask({
      id,
      preFn: makeTimeoutPromise({
        asyncFunc: async () => {
          // make sure device is ready after reboot
          // TODO move to fn and re-checking release \ device \ version matched
          const features =
            await this.backgroundApi.serviceHardware.getFeaturesWithoutCache({
              connectId,
              params: {
                allowEmptyConnectId: true,
              },
            });
          serviceHardwareUtils.hardwareLog('retryUpdateTask', {
            connectId,
            features,
          });
        },
        timeout: timerUtils.getTimeDurationMs({
          // user may retry just when device reboot, getFeatures() will pending forever, so we need timeout reject, then user can see retry button
          seconds: 30,
        }),
        timeoutRejectError: new Error('Retry Timeout'),
      }),
    });
  }

  checkTouchNeedUpdateResource(
    params: IUpdateFirmwareWorkflowParams,
  ): IResourceUpdateInfo {
    const deviceType = params.releaseResult?.deviceType;
    const fwUpdateInfo = params.releaseResult?.updateInfos?.firmware;
    const fwRelease = fwUpdateInfo?.releasePayload?.release;
    if (fwRelease) {
      const { version, fullResourceRange = ['3.5.0', '3.5.0'] } = fwRelease;
      if (deviceType !== 'touch') {
        return { error: null, needUpdate: false };
      }
      const currentVersion = fwUpdateInfo.fromVersion;
      const targetVersion = version.join('.');
      const [minVersion, limitVersion] = fullResourceRange;
      if (
        currentVersion &&
        targetVersion &&
        minVersion &&
        limitVersion &&
        semver.lt(currentVersion, minVersion) &&
        semver.gte(targetVersion, limitVersion)
      ) {
        return {
          error: !platformEnv.isDesktop ? 'USE_DESKTOP' : null,
          needUpdate: true,
          minVersion,
          limitVersion,
        };
      }
    }

    return { error: null, needUpdate: false };
  }

  async validateShouldUpdateFullResource(
    params: IUpdateFirmwareWorkflowParams,
  ) {
    const mockShouldUpdateFullRes =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'shouldUpdateFullRes',
      );
    if (
      mockShouldUpdateFullRes === true ||
      this.checkTouchNeedUpdateResource(params).needUpdate
    ) {
      throw new UseDesktopToUpdateFirmware();
    }
  }

  async validateShouldUpdateBridge(params: IUpdateFirmwareWorkflowParams) {
    if (params?.releaseResult?.updateInfos?.bridge?.shouldUpdate) {
      throw new NeedOneKeyBridgeUpgrade();
    }
  }

  async validateMinVersionAllowed(params: IUpdateFirmwareWorkflowParams) {
    const minVersionMap = FIRMWARE_UPDATE_MIN_VERSION_ALLOWED;

    const mockShouldUpdateFromWeb =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'shouldUpdateFromWeb',
      );

    if (mockShouldUpdateFromWeb === true) {
      throw new NeedFirmwareUpgradeFromWeb();
    }

    const deviceType = params.releaseResult?.deviceType;

    const checkFn = ({
      updateInfo,
      minVersion,
    }: {
      updateInfo: IFirmwareUpdateInfo | IBootloaderUpdateInfo | undefined;
      minVersion: string | undefined;
    }) => {
      if (
        deviceType &&
        updateInfo?.hasUpgrade &&
        updateInfo?.fromVersion &&
        minVersion &&
        semver.lt(updateInfo?.fromVersion || '', minVersion || '')
      ) {
        throw new NeedFirmwareUpgradeFromWeb();
      }
    };

    // bootloader mode device may return wrong firmware current version. so we skip this check
    if (params.releaseResult?.isBootloaderMode) {
      // only check bootloader version at boot mode
      checkFn({
        updateInfo: params.releaseResult?.updateInfos?.bootloader,
        minVersion: minVersionMap?.[deviceType || 'unknown']?.bootloader,
      });
      if (
        params.releaseResult?.updateInfos?.bootloader?.hasUpgrade &&
        !params.releaseResult?.updateInfos?.bootloader?.fromVersion
      ) {
        throw new NeedFirmwareUpgradeFromWeb();
      }
      return;
    }

    checkFn({
      updateInfo: params.releaseResult?.updateInfos?.firmware,
      minVersion: minVersionMap?.[deviceType || 'unknown']?.firmware,
    });

    checkFn({
      updateInfo: params.releaseResult?.updateInfos?.ble,
      minVersion: minVersionMap?.[deviceType || 'unknown']?.ble,
    });

    checkFn({
      updateInfo: params.releaseResult?.updateInfos?.bootloader,
      minVersion: minVersionMap?.[deviceType || 'unknown']?.bootloader,
    });
  }

  async validateMnemonicBackuped(params: IUpdateFirmwareWorkflowParams) {
    if (!params.backuped) {
      throw new Error('mnemonic not backuped');
    }
  }

  async validateUSBConnection(params: IUpdateFirmwareWorkflowParams) {
    // TODO device is connected by USB
    if (!params.usbConnected) {
      throw new Error('USB not connected');
    }
  }

  async validateDeviceBattery(params: IUpdateFirmwareWorkflowParams) {
    // USB connected, skip battery check
    if (!platformEnv.isNative) {
      return;
    }

    const { features: deviceFeatures } = params.releaseResult;

    let batteryLevel: number | undefined = deviceFeatures?.battery_level;

    const mockLowBattery =
      await this.backgroundApi.serviceDevSetting.getFirmwareUpdateDevSettings(
        'lowBatteryLevel',
      );
    if (mockLowBattery === true) {
      batteryLevel = 1;
    }

    if (isNil(batteryLevel) || Number.isNaN(batteryLevel)) return;

    // <= 25%
    if (Number(batteryLevel ?? 0) <= FIRMWARE_UPDATE_MIN_BATTERY_LEVEL) {
      throw new FirmwareUpdateBatteryTooLow();
    }
  }
}

export default ServiceFirmwareUpdate;
