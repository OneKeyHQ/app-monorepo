import { EDeviceType, HardwareErrorCode } from '@onekeyfe/hd-shared';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  isHardwareError,
  isHardwareErrorByCode,
} from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { CoreSDKLoader } from '@onekeyhq/shared/src/hardware/instance';
import { getVendorProfile } from '@onekeyhq/shared/src/hardware/vendorProfile';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  EHardwareCallContext,
  EHardwareVendor,
  EOneKeyDeviceMode,
} from '@onekeyhq/shared/types/device';
import type {
  IDeviceSharedCallParams,
  IOneKeyDeviceFeatures,
} from '@onekeyhq/shared/types/device';

import localDb from '../../dbs/local/localDb';
import {
  EHardwareUiStateAction,
  firmwareUpdateWorkflowRunningAtom,
  hardwareUiStateAtom,
  thirdPartyAppInstallAtom,
  thirdPartyHardwareUiStateAtom,
} from '../../states/jotai/atoms';
import ServiceBase from '../ServiceBase';

import {
  HardwareProcessingManager,
  type IOneKeyHardwareOperationLease,
} from './HardwareProcessingManager';
import { buildPassphraseUiResponsePayload } from './passphraseUiResponseUtils';

import type { IDBDevice } from '../../dbs/local/types';
import type {
  IHardwareUiPayload,
  IHardwareUiResponseCorrelation,
} from '../../states/jotai/atoms';
import type { UiResponseEvent } from '@onekeyfe/hd-core';

export type IWithHardwareProcessingControlParams = {
  hideCheckingDeviceLoading?: boolean;
  skipDeviceCancel?: boolean; // cancel device at end
  skipCloseHardwareUiStateDialog?: boolean; // close state dialog at end
  skipDeviceCancelAtFirst?: boolean;
  skipWaitingAnimationAtFirst?: boolean;
};

export type IWithHardwareProcessingOptions = {
  deviceParams: IDeviceSharedCallParams | undefined;
  debugMethodName?: string;
  oneKeyOperationLease?: IOneKeyHardwareOperationLease;
  onFinally?: () => void;
} & IWithHardwareProcessingControlParams;

export type ICloseHardwareUiStateDialogParams = {
  skipDeviceCancel?: boolean;
  delay?: number;
  connectId: string | undefined;
  walletId?: string;
  reason?: string;
  deviceResetToHome?: boolean;
  hardClose?: boolean; // hard close dialog by event bus
  skipDelayClose?: boolean;
};

@backgroundClass()
class ServiceHardwareUI extends ServiceBase {
  private deviceCacheByConnectId: Map<string, IDBDevice> = new Map();

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
    // This service caches `connectId -> IDBDevice` for hardware interaction dialogs.
    // Clear cached dialogs after device state changes so labels cannot become stale.
    appEventBus.on(
      EAppEventBusNames.HardwareDeviceStateUpdate,
      this.onHardwareDeviceStateUpdate,
    );
    // Third-party hardware remains driven by each SDK's features events.
    appEventBus.on(
      EAppEventBusNames.HardwareFeaturesUpdate,
      this.onThirdPartyHardwareFeaturesUpdate,
    );
  }

  hardwareProcessingManager = new HardwareProcessingManager();

  private onHardwareDeviceStateUpdate = async ({
    connectId,
    state,
  }: IAppEventBusPayload[EAppEventBusNames.HardwareDeviceStateUpdate]) => {
    try {
      // Delete from cache first to avoid a race where a new interaction immediately reads stale cache.
      for (const [
        cachedConnectId,
        cached,
      ] of this.deviceCacheByConnectId.entries()) {
        if (
          cached?.deviceId === state.identity.deviceId ||
          cached?.uuid === state.identity.serialNo
        ) {
          this.deviceCacheByConnectId.delete(cachedConnectId);
        }
      }
      if (connectId) this.deviceCacheByConnectId.delete(connectId);
    } catch {
      // Best-effort: this event is only for UI consistency. Clear cache on any error.
      this.deviceCacheByConnectId.clear();
    }
  };

  private onThirdPartyHardwareFeaturesUpdate = async ({
    deviceId,
  }: IAppEventBusPayload[EAppEventBusNames.HardwareFeaturesUpdate]) => {
    try {
      const device = await localDb.getDevice(deviceId);
      if (device?.connectId) {
        this.deviceCacheByConnectId.delete(device.connectId);
      } else {
        this.deviceCacheByConnectId.clear();
      }
    } catch {
      this.deviceCacheByConnectId.clear();
    }
  };

  @backgroundMethod()
  async sendUiResponse(response: UiResponseEvent) {
    return this.backgroundApi.serviceHardware.sendUiResponseToActiveSdk(
      response,
    );
  }

  @backgroundMethod()
  async showConfirmOnDeviceToastDemo({ connectId }: { connectId: string }) {
    await hardwareUiStateAtom.set({
      action: EHardwareUiStateAction.REQUEST_BUTTON,
      connectId,
      payload: {
        deviceType: EDeviceType.Classic,
        uiRequestType: EHardwareUiStateAction.REQUEST_BUTTON,
        eventType: '',
        deviceId: '',
        connectId,
        rawPayload: {},
        deviceMode: EOneKeyDeviceMode.normal,
      },
    });
  }

  private async getDeviceCached(
    connectId: string,
  ): Promise<IDBDevice | undefined> {
    const cached = this.deviceCacheByConnectId.get(connectId);
    if (cached) {
      return cached;
    }
    const device =
      await this.backgroundApi.serviceHardware.getDeviceByConnectId({
        connectId,
      });
    if (device) {
      this.deviceCacheByConnectId.set(connectId, device);
    }
    return device;
  }

  private async updateDialogWithDeviceInfo({
    action,
    connectId,
  }: {
    action: EHardwareUiStateAction;
    connectId: string;
  }) {
    try {
      const device = await this.getDeviceCached(connectId);
      if (!device) {
        return;
      }
      const currentState = await hardwareUiStateAtom.get();
      if (
        currentState?.action !== action ||
        currentState?.connectId !== connectId
      ) {
        return;
      }
      await hardwareUiStateAtom.set({
        action,
        connectId,
        payload: {
          uiRequestType: action,
          eventType: '',
          deviceType: device.deviceType,
          deviceId: device.deviceId ?? '',
          connectId,
          deviceMode: EOneKeyDeviceMode.normal,
          rawPayload: {
            features: device.featuresInfo,
          },
        },
      });
    } catch {
      // ignore error, device info is optional for display
    }
  }

  @backgroundMethod()
  async showCheckingDeviceDialog({ connectId }: { connectId: string }) {
    await hardwareUiStateAtom.set({
      action: EHardwareUiStateAction.DeviceChecking,
      connectId,
      payload: undefined,
    });
    if (connectId) {
      void this.updateDialogWithDeviceInfo({
        action: EHardwareUiStateAction.DeviceChecking,
        connectId,
      });
    }
  }

  @backgroundMethod()
  async showDeviceProcessLoadingDialog({ connectId }: { connectId: string }) {
    await hardwareUiStateAtom.set({
      action: EHardwareUiStateAction.ProcessLoading,
      connectId,
      payload: undefined,
    });
    if (connectId) {
      void this.updateDialogWithDeviceInfo({
        action: EHardwareUiStateAction.ProcessLoading,
        connectId,
      });
    }
    // wait animation done
    await timerUtils.wait(150);
  }

  @backgroundMethod()
  async showBluetoothDevicePairingDialog({
    device,
    features,
    deviceId,
    usbConnectId,
    promiseId,
  }: {
    device: IDBDevice;
    features: IOneKeyDeviceFeatures | undefined;
    deviceId: string;
    usbConnectId: string;
    promiseId?: number;
  }) {
    await hardwareUiStateAtom.set({
      action: EHardwareUiStateAction.DeviceChecking,
      connectId: usbConnectId,
      payload: {
        uiRequestType: EHardwareUiStateAction.DeviceChecking,
        eventType: EHardwareUiStateAction.BLUETOOTH_DEVICE_PAIRING,
        deviceType: device.deviceType,
        deviceId,
        connectId: usbConnectId,
        deviceMode: EOneKeyDeviceMode.normal,
        promiseId: promiseId?.toString(),
        rawPayload: { deviceId, usbConnectId, features },
      },
    });
  }

  @backgroundMethod()
  async showEnterPassphraseOnDeviceDialog({
    responseCorrelation,
  }: {
    responseCorrelation?: IHardwareUiResponseCorrelation;
  } = {}) {
    const { UI_RESPONSE } = await CoreSDKLoader();
    await this.sendUiResponse({
      type: UI_RESPONSE.RECEIVE_PASSPHRASE,
      payload: buildPassphraseUiResponsePayload({ mode: 'device' }),
      ...responseCorrelation,
    });
  }

  @backgroundMethod()
  async showEnterAttachPinOnDeviceDialog({
    responseCorrelation,
  }: {
    responseCorrelation?: IHardwareUiResponseCorrelation;
  } = {}) {
    const { UI_RESPONSE } = await CoreSDKLoader();
    await this.sendUiResponse({
      type: UI_RESPONSE.RECEIVE_PASSPHRASE,
      payload: buildPassphraseUiResponsePayload({ mode: 'attach-pin' }),
      ...responseCorrelation,
    });
  }

  @backgroundMethod()
  async sendPinToDevice({
    pin,
    responseCorrelation,
  }: {
    pin: string;
    responseCorrelation?: IHardwareUiResponseCorrelation;
  }) {
    const { UI_RESPONSE } = await CoreSDKLoader();

    await this.sendUiResponse({
      type: UI_RESPONSE.RECEIVE_PIN,
      payload: pin,
      ...responseCorrelation,
    });
  }

  @backgroundMethod()
  async sendPassphraseToDevice({
    passphrase,
    responseCorrelation,
  }: {
    passphrase: string;
    responseCorrelation?: IHardwareUiResponseCorrelation;
  }) {
    const { UI_RESPONSE } = await CoreSDKLoader();

    await this.sendUiResponse({
      type: UI_RESPONSE.RECEIVE_PASSPHRASE,
      payload: buildPassphraseUiResponsePayload({ mode: 'host', passphrase }),
      ...responseCorrelation,
    });
  }

  @backgroundMethod()
  async showEnterPinOnDevice({
    responseCorrelation,
  }: {
    responseCorrelation?: IHardwareUiResponseCorrelation;
  } = {}) {
    const { UI_RESPONSE } = await CoreSDKLoader();

    await this.sendUiResponse({
      type: UI_RESPONSE.RECEIVE_PIN,
      payload: '@@ONEKEY_INPUT_PIN_IN_DEVICE',
      ...responseCorrelation,
    });
  }

  @backgroundMethod()
  async sendEnterPinOnDeviceEvent({
    connectId,
    payload,
  }: {
    connectId: string;
    payload: IHardwareUiPayload | undefined;
  }) {
    await this.showEnterPinOnDevice({
      responseCorrelation: payload?.uiResponseCorrelation,
    });

    await hardwareUiStateAtom.set({
      action: EHardwareUiStateAction.EnterPinOnDevice,
      connectId,
      payload,
    });
  }

  @backgroundMethod()
  async sendRequestDeviceInBootloaderForWebDevice({
    deviceId,
  }: {
    deviceId: string;
  }) {
    const { UI_RESPONSE } = await CoreSDKLoader();
    await this.sendUiResponse({
      type: UI_RESPONSE.SELECT_DEVICE_IN_BOOTLOADER_FOR_WEB_DEVICE,
      payload: {
        deviceId,
      },
    });
  }

  @backgroundMethod()
  async sendRequestDeviceForSwitchFirmwareWebDevice({
    deviceId,
  }: {
    deviceId: string;
  }) {
    const { UI_RESPONSE } = await CoreSDKLoader();
    await this.sendUiResponse({
      type: UI_RESPONSE.SELECT_DEVICE_FOR_SWITCH_FIRMWARE_WEB_DEVICE,
      payload: {
        deviceId,
      },
    });
  }

  @backgroundMethod()
  async cleanHardwareUiState({
    hardClose,
  }: {
    hardClose?: boolean; // hard close dialog by event bus
  } = {}) {
    await hardwareUiStateAtom.set(undefined);
    if (hardClose) {
      // atom some times not work, emit event to hard close dialog
      appEventBus.emit(
        EAppEventBusNames.HardCloseHardwareUiStateDialog,
        undefined,
      );
    }
  }

  closeHardwareUiStateDialogTimer: ReturnType<typeof setTimeout> | undefined;

  @backgroundMethod()
  async closeHardwareUiStateDialog(params: ICloseHardwareUiStateDialogParams) {
    clearTimeout(this.closeHardwareUiStateDialogTimer);

    if (!params.skipDelayClose) {
      this.closeHardwareUiStateDialogTimer = setTimeout(
        () =>
          this.closeHardwareUiStateDialogFn({
            ...params,
            skipDeviceCancel: true,
          }),
        600,
      );
    }

    await this.closeHardwareUiStateDialogFn(params);
  }

  @backgroundMethod()
  async closeHardwareUiStateDialogFn(
    params: ICloseHardwareUiStateDialogParams,
  ) {
    /* eslint-disable prefer-const */
    let {
      skipDeviceCancel = true,
      delay,
      connectId,
      walletId,
      reason,
      deviceResetToHome = true,
      hardClose,
    } = params;
    /* eslint-enable prefer-const */

    try {
      if (!connectId && walletId) {
        const device =
          await this.backgroundApi.serviceAccount.getWalletDeviceSafe({
            walletId,
          });
        connectId = device?.connectId;
      }
      console.log(`closeHardwareUiStateDialog: ${reason || 'no reason'}`);
      if (delay) {
        await timerUtils.wait(delay);
      }
      await this.cleanHardwareUiState({ hardClose });

      if (!skipDeviceCancel) {
        if (connectId) {
          this.hardwareProcessingManager.cancelOperation(connectId);
        }
        console.log('closeHardwareUiStateDialog cancel device: ', connectId);
        // do not wait cancel, may cause caller stuck
        void this.backgroundApi.serviceHardware.cancel({
          connectId,
          forceDeviceResetToHome: deviceResetToHome,
        });
      }
    } catch (_error) {
      // closeHardwareUiStateDialog should be called safely, do not block caller
    }
  }

  processingNestedNum = 0;

  isOuterProcessing() {
    return this.processingNestedNum === 1;
  }

  @backgroundMethod()
  async isHardwareChannelBusy(_params?: { connectId?: string }) {
    const [hardwareUiState, firmwareUpdateWorkflowRunning] = await Promise.all([
      hardwareUiStateAtom.get(),
      firmwareUpdateWorkflowRunningAtom.get(),
    ]);
    return (
      this.processingNestedNum > 0 ||
      this.backgroundApi.serviceHardware.getFeaturesMutex.isLocked() ||
      firmwareUpdateWorkflowRunning ||
      Boolean(hardwareUiState)
    );
  }

  async withHardwareProcessing<T>(
    fn: (lease?: IOneKeyHardwareOperationLease) => Promise<T>,
    params: IWithHardwareProcessingOptions,
  ): Promise<T> {
    const device = params.deviceParams?.dbDevice;
    const isThirdPartyVendor = getVendorProfile(
      device?.vendor ?? EHardwareVendor.onekey,
    ).isThirdParty;
    if (isThirdPartyVendor) {
      return this.withHardwareProcessingInternal(() => fn(undefined), params);
    }
    // Keep operation-level serialization during the mixed-SDK rollout and for
    // shared lifecycle work outside the correlated PIN/passphrase response path.
    return this.runExclusiveOneKeyOperation(
      (lease) => this.withHardwareProcessingInternal(() => fn(lease), params),
      {
        deviceKey:
          device?.id || device?.deviceId || device?.uuid || device?.connectId,
        lease: params.oneKeyOperationLease,
      },
    );
  }

  runExclusiveOneKeyOperation<T>(
    operation: (lease: IOneKeyHardwareOperationLease) => Promise<T>,
    {
      deviceKey,
      lease,
    }: {
      deviceKey?: string;
      lease?: IOneKeyHardwareOperationLease;
    } = {},
  ) {
    return this.hardwareProcessingManager.runExclusiveOneKeyOperation({
      deviceKey,
      lease,
      operation,
    });
  }

  private async withHardwareProcessingInternal<T>(
    fn: () => Promise<T>,
    params: IWithHardwareProcessingOptions,
  ): Promise<T> {
    clearTimeout(this.closeHardwareUiStateDialogTimer);
    clearTimeout(this.backgroundApi.serviceHardware.cancelTimer);
    console.log(
      `withHardwareProcessing START: processingNestedNum=${this.processingNestedNum}`,
      params,
    );
    const {
      deviceParams,
      skipDeviceCancel = false,
      skipCloseHardwareUiStateDialog = false,
      skipDeviceCancelAtFirst = true,
      hideCheckingDeviceLoading,
      onFinally,
    } = params;
    const device = deviceParams?.dbDevice;
    const connectId = device?.connectId;
    let isOuterCall = false;

    // Third-party vendors (Ledger) don't use OneKey SDK
    // Skip all OneKey-specific flows: DeviceChecking dialog, mutex, cancel, resetToHome
    const isThirdPartyVendor = getVendorProfile(
      device?.vendor ?? EHardwareVendor.onekey,
    ).isThirdParty;
    let deviceResetToHome = true;
    let isBusy = false;
    try {
      if (this.processingNestedNum <= 0) {
        this.processingNestedNum = 0;
      }
      this.processingNestedNum += 1;
      // Determine outer call AFTER increment so that the first caller is treated as outer
      isOuterCall = this.isOuterProcessing();

      defaultLogger.hardware.sdkLog.consoleLog('withHardwareProcessing');
      defaultLogger.account.accountCreatePerf.withHardwareProcessingStart(
        params,
      );

      if (connectId) {
        // The device update detection is postponed for two hours
        // and the automatic detection is resumed after the device communication is completed
        void this.backgroundApi.serviceFirmwareUpdate.delayShouldDetectTimeCheckWithDelay(
          { connectId, delay: timerUtils.getTimeDurationMs({ hour: 2 }) },
        );
      }

      if (this.isOuterProcessing()) {
        // >>> mock hardware connectId
        // if (deviceParams?.dbDevice && deviceParams) {
        //   deviceParams.dbDevice.connectId = '11111';
        // }

        await this.cleanHardwareUiState();
        if (connectId && !hideCheckingDeviceLoading && !isThirdPartyVendor) {
          // 先在统一连接管理器中确定本次实际传输，再显示动画，避免 BLE
          // 通讯使用上一次持久化的 USB 弹窗。这里只选择传输，不发起设备通讯。
          await this.backgroundApi.serviceHardware.prepareHardwareTransport({
            connectId,
            connectProtocol: device?.connectProtocol,
            hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
          });
          await this.showCheckingDeviceDialog({
            connectId,
          });
        }
        // Third-party searching UI is driven by SDK ui-events.

        // await waitForCancelDone();

        defaultLogger.account.accountCreatePerf.cancelDeviceBeforeProcessing({
          message: 'cancelableDelay',
        });

        // Dialog 和 Toast 在执行 show ，但是动画未结束时，立即调用 close 无效，将导致 Dialog 和 Toast 一直显示
        // wait action animation done
        // action dialog may call getFeatures of the hardware when it is closed
        // if (connectId && !skipWaitingAnimationAtFirst) {
        //   await this.hardwareProcessingManager.cancelableDelay(connectId, 350);
        // }

        defaultLogger.account.accountCreatePerf.cancelDeviceBeforeProcessingDone(
          {
            message: 'cancelableDelay',
          },
        );
      } else {
        // await waitForCancelDone();
      }

      // test delay
      // await timerUtils.wait(6000);

      // Skip OneKey SDK mutex check for third-party vendors
      if (!isThirdPartyVendor) {
        let isMutexLocked =
          this.backgroundApi.serviceHardware.getFeaturesMutex.isLocked();
        if (isMutexLocked) {
          await this.backgroundApi.serviceHardware.getFeaturesMutex.waitForUnlock();
          isMutexLocked =
            this.backgroundApi.serviceHardware.getFeaturesMutex.isLocked();
          if (isMutexLocked) {
            isBusy = true;
            throw new OneKeyLocalError(
              appLocale.intl.formatMessage({
                id: ETranslations.feedback_hardware_is_busy,
              }),
            );
          }
        }
      }

      if (this.isOuterProcessing()) {
        // TODO wait 3s if device is canceling
        defaultLogger.account.accountCreatePerf.cancelDeviceBeforeProcessing({
          message: 'cancelAtFirst',
        });
        if (connectId && !skipDeviceCancelAtFirst && this.isOuterProcessing()) {
          // await this.backgroundApi.serviceHardware.cancel(connectId);
          // await this.hardwareProcessingManager.cancelableDelay(connectId, 600);
        }
        defaultLogger.account.accountCreatePerf.cancelDeviceBeforeProcessingDone(
          {
            message: 'cancelAtFirst',
          },
        );
      }

      defaultLogger.account.accountCreatePerf.withHardwareProcessingRunFn();
      const r = await fn();
      defaultLogger.account.accountCreatePerf.withHardwareProcessingRunFnDone();

      deviceResetToHome = false;
      console.log('withHardwareProcessing done: ', r);
      return r;
    } catch (error) {
      console.error('withHardwareProcessing ERROR: ', error);
      console.error(
        'withHardwareProcessing ERROR stack: ',
        (error as Error)?.stack,
      );
      if (
        isHardwareErrorByCode({
          error: error as any,
          code: HardwareErrorCode.NewFirmwareForceUpdate,
        })
      ) {
        if (this.isOuterProcessing()) {
          setTimeout(() => {
            // backdrop conflict, wait hardware ui dialog close
            appEventBus.emit(EAppEventBusNames.ShowFirmwareUpdateForce, {
              connectId,
            });
          }, 300);
        }
      }
      // skip reset to home if user cancel
      if (
        isHardwareErrorByCode({
          error: error as any,
          code: [
            HardwareErrorCode.ActionCancelled,
            HardwareErrorCode.CallQueueActionCancelled,
            HardwareErrorCode.PinCancelled,
            HardwareErrorCode.DeviceNotFound,
            // Hardware interrupts generally have follow-up actions; skip reset to home
            HardwareErrorCode.DeviceInterruptedFromUser,
            HardwareErrorCode.DeviceInterruptedFromOutside,
            // ble connect error, skip reset to home
            HardwareErrorCode.BleScanError,
            HardwareErrorCode.BlePermissionError,
            HardwareErrorCode.BleLocationError,
            HardwareErrorCode.BleRequiredUUID,
            HardwareErrorCode.BleConnectedError,
            HardwareErrorCode.BleDeviceNotBonded,
            HardwareErrorCode.BleServiceNotFound,
            HardwareErrorCode.BleCharacteristicNotFound,
            HardwareErrorCode.BleMonitorError,
            HardwareErrorCode.BleCharacteristicNotifyError,
            HardwareErrorCode.BleWriteCharacteristicError,
            HardwareErrorCode.BleAlreadyConnected,
            HardwareErrorCode.BleLocationServicesDisabled,
            HardwareErrorCode.BleTimeoutError,
            HardwareErrorCode.BleForceCleanRunPromise,
            HardwareErrorCode.BleDeviceBondError,
            HardwareErrorCode.BleCharacteristicNotifyChangeFailure,
          ],
        })
      ) {
        deviceResetToHome = false;
      } else if (!isHardwareError({ error: error as any })) {
        // not hardware error, reset to home
        deviceResetToHome = false;
      }
      throw error;
    } finally {
      console.log('withHardwareProcessing FINALLY:', {
        processingNestedNum: this.processingNestedNum,
        skipCloseHardwareUiStateDialog,
      });
      // Third-party vendors may have empty connectId (e.g. USB Ledger),
      // but still need to clear their loading UI state.
      if (isOuterCall) {
        if (isThirdPartyVendor) {
          if (!skipCloseHardwareUiStateDialog) {
            void thirdPartyHardwareUiStateAtom.set(undefined);
            void thirdPartyAppInstallAtom.set(undefined);
          }
        } else if (connectId) {
          if (!skipCloseHardwareUiStateDialog) {
            const closeDialogParams = {
              // skipDeviceCancel: true,
              skipDeviceCancel: skipDeviceCancel ?? false, // auto cancel if device call interaction action
              deviceResetToHome,
            };
            if (isBusy) {
              closeDialogParams.skipDeviceCancel = true;
              closeDialogParams.deviceResetToHome = false;
            }
            await this.closeHardwareUiStateDialog({
              connectId,
              skipDeviceCancel: closeDialogParams.skipDeviceCancel,
              deviceResetToHome: closeDialogParams.deviceResetToHome,
            });
            void this.backgroundApi.serviceAccount.generateHwWalletsMissingXfp({
              wallet: deviceParams?.dbWallet,
              connectId,
              deviceId: device?.deviceId,
              withUserInteraction: false,
            });
          }
          void this.backgroundApi.serviceFirmwareUpdate.delayShouldDetectTimeCheck(
            { connectId },
          );
        }
      }
      this.processingNestedNum -= 1;
      onFinally?.();
    }
  }
}

export default ServiceHardwareUI;
