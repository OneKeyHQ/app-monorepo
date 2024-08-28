import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { isHardwareErrorByCode } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { CoreSDKLoader } from '@onekeyhq/shared/src/hardware/instance';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IDeviceSharedCallParams } from '@onekeyhq/shared/types/device';

import {
  EHardwareUiStateAction,
  hardwareUiStateAtom,
} from '../../states/jotai/atoms';
import ServiceBase from '../ServiceBase';

import { HardwareProcessingManager } from './HardwareProcessingManager';

import type { IHardwareUiPayload } from '../../states/jotai/atoms';
import type { UiResponseEvent } from '@onekeyfe/hd-core';

export type IWithHardwareProcessingControlParams = {
  skipDeviceCancel?: boolean;
  skipCloseHardwareUiStateDialog?: boolean;
  skipDeviceCancelAtFirst?: boolean;
  skipWaitingAnimationAtFirst?: boolean;
  hideCheckingDeviceLoading?: boolean;
};

export type IWithHardwareProcessingOptions = {
  deviceParams: IDeviceSharedCallParams | undefined;
  debugMethodName?: string;
} & IWithHardwareProcessingControlParams;

export type ICloseHardwareUiStateDialogParams = {
  skipDeviceCancel?: boolean;
  delay?: number;
  connectId: string | undefined;
  reason?: string;
  deviceResetToHome?: boolean;
  hardClose?: boolean; // hard close dialog by event bus
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
      await this.backgroundApi.serviceHardware.getSDKInstance()
    ).uiResponse(response);
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
  async showEnterPassphraseOnDeviceDialog() {
    const { UI_RESPONSE } = await CoreSDKLoader();
    await this.sendUiResponse({
      type: UI_RESPONSE.RECEIVE_PASSPHRASE,
      payload: {
        value: '',
        passphraseOnDevice: true,
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

  @backgroundMethod()
  async closeHardwareUiStateDialog({
    skipDeviceCancel,
    delay,
    connectId,
    reason,
    deviceResetToHome = true,
    hardClose,
  }: ICloseHardwareUiStateDialogParams) {
    try {
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
        void this.backgroundApi.serviceHardware.cancel(connectId, {
          forceDeviceResetToHome: deviceResetToHome,
        });
      }
    } catch (error) {
      // closeHardwareUiStateDialog should be called safely, do not block caller
    }
  }

  async withHardwareProcessing<T>(
    fn: () => Promise<T>,
    params: IWithHardwareProcessingOptions,
  ): Promise<T> {
    const {
      deviceParams,
      skipDeviceCancel,
      skipCloseHardwareUiStateDialog,
      skipDeviceCancelAtFirst,
      skipWaitingAnimationAtFirst,
      hideCheckingDeviceLoading,
      debugMethodName,
    } = params;
    defaultLogger.account.accountCreatePerf.withHardwareProcessingStart(params);

    // >>> mock hardware connectId
    // if (deviceParams?.dbDevice && deviceParams) {
    //   deviceParams.dbDevice.connectId = '11111';
    // }

    const device = deviceParams?.dbDevice;
    const connectId = device?.connectId;
    if (connectId && !hideCheckingDeviceLoading) {
      await this.showCheckingDeviceDialog({
        connectId,
      });
    }

    defaultLogger.account.accountCreatePerf.cancelDeviceBeforeProcessing({
      message: 'cancelableDelay',
    });

    // TODO: Dialog 和 Toast 在执行 show ，但是动画未结束时，立即调用 close 无效，将导致 Dialog 和 Toast 一直显示
    // wait action animation done
    // action dialog may call getFeatures of the hardware when it is closed
    if (connectId && !skipWaitingAnimationAtFirst) {
      await this.hardwareProcessingManager.cancelableDelay(connectId, 350);
    }
    defaultLogger.account.accountCreatePerf.cancelDeviceBeforeProcessingDone({
      message: 'cancelableDelay',
    });

    // test delay
    // await timerUtils.wait(6000);

    let isMutexLocked =
      this.backgroundApi.serviceHardware.getFeaturesMutex.isLocked();
    if (isMutexLocked) {
      await this.backgroundApi.serviceHardware.getFeaturesMutex.waitForUnlock();
      isMutexLocked =
        this.backgroundApi.serviceHardware.getFeaturesMutex.isLocked();
      if (isMutexLocked) {
        throw new Error(
          appLocale.intl.formatMessage({
            id: ETranslations.feedback_hardware_is_busy,
          }),
        );
      }
    }

    let deviceResetToHome = true;
    try {
      defaultLogger.account.accountCreatePerf.cancelDeviceBeforeProcessing({
        message: 'cancelAtFirst',
      });
      if (connectId && !skipDeviceCancelAtFirst) {
        await this.backgroundApi.serviceHardware.cancel(connectId);
        await this.hardwareProcessingManager.cancelableDelay(connectId, 600);
      }
      defaultLogger.account.accountCreatePerf.cancelDeviceBeforeProcessingDone({
        message: 'cancelAtFirst',
      });

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
        appEventBus.emit(EAppEventBusNames.ShowFirmwareUpdateForce, {
          connectId,
        });
      }
      // skip reset to home if user cancel
      if (
        isHardwareErrorByCode({
          error: error as any,
          code: [
            HardwareErrorCode.ActionCancelled,
            HardwareErrorCode.PinCancelled,
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
      }
      throw error;
    } finally {
      if (connectId) {
        if (!skipCloseHardwareUiStateDialog) {
          await this.closeHardwareUiStateDialog({
            connectId,
            skipDeviceCancel, // auto cancel if device call interaction action
            deviceResetToHome,
          });
        }
        void this.backgroundApi.serviceFirmwareUpdate.delayShouldDetectTimeCheck(
          { connectId },
        );
      }
    }
  }
}

export default ServiceHardwareUI;
