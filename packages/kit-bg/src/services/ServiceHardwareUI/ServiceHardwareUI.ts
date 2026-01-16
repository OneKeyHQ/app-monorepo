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
import { CoreSDKLoader } from '@onekeyhq/shared/src/hardware/instance';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EOneKeyDeviceMode } from '@onekeyhq/shared/types/device';
import type {
  IDeviceSharedCallParams,
  IOneKeyDeviceFeatures,
} from '@onekeyhq/shared/types/device';

import {
  EHardwareUiStateAction,
  hardwareUiStateAtom,
} from '../../states/jotai/atoms';
import ServiceBase from '../ServiceBase';

import { HardwareProcessingManager } from './HardwareProcessingManager';

import type { IDBDevice } from '../../dbs/local/types';
import type { IHardwareUiPayload } from '../../states/jotai/atoms';
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
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  hardwareProcessingManager = new HardwareProcessingManager();

  @backgroundMethod()
  async sendUiResponse(response: UiResponseEvent) {
    return (
      await this.backgroundApi.serviceHardware.getSDKInstance({
        connectId: undefined,
      })
    ).uiResponse(response);
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

  @backgroundMethod()
  async showCheckingDeviceDialog({ connectId }: { connectId: string }) {
    await hardwareUiStateAtom.set({
      action: EHardwareUiStateAction.DeviceChecking,
      connectId,
      payload: undefined,
    });
  }

  @backgroundMethod()
  async showDeviceProcessLoadingDialog({ connectId }: { connectId: string }) {
    await hardwareUiStateAtom.set({
      action: EHardwareUiStateAction.ProcessLoading,
      connectId,
      payload: undefined,
    });
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
  async showEnterPassphraseOnDeviceDialog() {
    const { UI_RESPONSE } = await CoreSDKLoader();
    await this.sendUiResponse({
      type: UI_RESPONSE.RECEIVE_PASSPHRASE,
      payload: {
        value: '',
        passphraseOnDevice: true,
        attachPinOnDevice: false,
        save: false,
      },
    });
  }

  @backgroundMethod()
  async showEnterAttachPinOnDeviceDialog() {
    const { UI_RESPONSE } = await CoreSDKLoader();
    await this.sendUiResponse({
      type: UI_RESPONSE.RECEIVE_PASSPHRASE,
      payload: {
        value: '',
        passphraseOnDevice: false,
        attachPinOnDevice: true,
        save: false,
      },
    });
  }

  @backgroundMethod()
  async sendPinToDevice({ pin }: { pin: string }) {
    const { UI_RESPONSE } = await CoreSDKLoader();

    await this.sendUiResponse({
      type: UI_RESPONSE.RECEIVE_PIN,
      payload: pin,
    });
  }

  @backgroundMethod()
  async sendPassphraseToDevice({ passphrase }: { passphrase: string }) {
    const { UI_RESPONSE } = await CoreSDKLoader();

    await this.sendUiResponse({
      type: UI_RESPONSE.RECEIVE_PASSPHRASE,
      payload: {
        value: passphrase,
        passphraseOnDevice: false,
        save: false,
      },
    });
  }

  @backgroundMethod()
  async showEnterPinOnDevice() {
    const { UI_RESPONSE } = await CoreSDKLoader();

    await this.sendUiResponse({
      type: UI_RESPONSE.RECEIVE_PIN,
      payload: '@@ONEKEY_INPUT_PIN_IN_DEVICE',
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
    await this.showEnterPinOnDevice();

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
    let {
      skipDeviceCancel = true,
      delay,
      connectId,
      walletId,
      reason,
      deviceResetToHome = true,
      hardClose,
    } = params;

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
    } catch (error) {
      // closeHardwareUiStateDialog should be called safely, do not block caller
    }
  }

  processingNestedNum = 0;

  isOuterProcessing() {
    return this.processingNestedNum === 1;
  }

  async withHardwareProcessing<T>(
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
        if (connectId && !hideCheckingDeviceLoading) {
          await this.showCheckingDeviceDialog({
            connectId,
          });
        }

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
      if (connectId && isOuterCall) {
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
      this.processingNestedNum -= 1;
      onFinally?.();
    }
  }
}

export default ServiceHardwareUI;
