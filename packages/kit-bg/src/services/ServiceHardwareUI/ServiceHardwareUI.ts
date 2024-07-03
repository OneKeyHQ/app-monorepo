import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { UserCancelFromOutside } from '@onekeyhq/shared/src/errors';
import { isHardwareErrorByCode } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { CoreSDKLoader } from '@onekeyhq/shared/src/hardware/instance';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
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

export type IWithHardwareProcessingOptions = {
  deviceParams: IDeviceSharedCallParams | undefined;
  skipDeviceCancel?: boolean;
  skipDeviceCancelAtFirst?: boolean;
  hideCheckingDeviceLoading?: boolean;
  debugMethodName?: string;
};

export type ICloseHardwareUiStateDialogParams = {
  skipDeviceCancel?: boolean;
  delay?: number;
  connectId: string | undefined;
  reason?: string;
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
    console.log('=====>>>>>> showCheckingDeviceDialog show dialog');
    await hardwareUiStateAtom.set({
      action: EHardwareUiStateAction.DeviceChecking,
      connectId,
      payload: undefined,
    });

    // wait animation done
    // await timerUtils.wait(300);
    console.log('=====>>>>>> showCheckingDeviceDialog show dialog Done!!!');
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
  async closeHardwareUiStateDialog({
    skipDeviceCancel,
    delay,
    connectId,
    reason,
  }: ICloseHardwareUiStateDialogParams) {
    try {
      console.log(`closeHardwareUiStateDialog: ${reason || 'no reason'}`);
      if (delay) {
        await timerUtils.wait(delay);
      }
      await hardwareUiStateAtom.set(undefined);

      if (!skipDeviceCancel) {
        if (connectId) {
          this.hardwareProcessingManager.cancelOperation(connectId);
        }
        console.log('closeHardwareUiStateDialog cancel device: ', connectId);
        // do not wait cancel, may cause caller stuck
        void this.backgroundApi.serviceHardware.cancel(connectId, {
          forceDeviceResetToHome: true,
        });
      }
    } catch (error) {
      // closeHardwareUiStateDialog should be called safely, do not block caller
    }
  }

  async withHardwareProcessing<T>(
    fn: () => Promise<T>,
    {
      deviceParams,
      skipDeviceCancel,
      skipDeviceCancelAtFirst,
      hideCheckingDeviceLoading,
      debugMethodName,
    }: IWithHardwareProcessingOptions,
  ): Promise<T> {
    console.log('=====>>>>>> withHardwareProcessing start: ', debugMethodName);
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

    // Prevents the sdk from continuing to run if it has not been initialized and clicking Cancel is invalid
    if (connectId) {
      await this.hardwareProcessingManager.cancelableFn(connectId, () =>
        this.backgroundApi.serviceHardware.getSDKInstance(),
      );
    }
    try {
      if (connectId && !skipDeviceCancelAtFirst) {
        await this.backgroundApi.serviceHardware.cancel(connectId);
        try {
          await this.hardwareProcessingManager.cancelableDelay(connectId, 600);
        } catch (error) {
          throw new UserCancelFromOutside();
        }
      }

      const r = await fn();
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
      throw error;
    } finally {
      if (connectId) {
        await this.closeHardwareUiStateDialog({
          connectId,
          skipDeviceCancel, // auto cancel if device call interaction action
        });
        void this.backgroundApi.serviceFirmwareUpdate.delayShouldDetectTimeCheck(
          { connectId },
        );
      }
    }
  }
}

export default ServiceHardwareUI;
