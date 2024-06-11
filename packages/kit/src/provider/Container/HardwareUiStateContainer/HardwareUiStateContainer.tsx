import type { ForwardedRef } from 'react';
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import { Semaphore } from 'async-mutex';
import { useIntl } from 'react-intl';

import type { IDialogInstance, IToastShowResult } from '@onekeyhq/components';
import {
  Dialog,
  DialogContainer,
  SizableText,
  Toast,
} from '@onekeyhq/components';
import {
  EHardwareUiStateAction,
  useHardwareUiStateAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EFirmwareUpdateTipMessages } from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  CommonDeviceLoading,
  ConfirmOnDeviceToastContent,
  EnterPassphraseOnDevice,
  EnterPhase,
  EnterPin,
  EnterPinOnDevice,
} from '../../../components/Hardware/Hardware';
import { useThemeVariant } from '../../../hooks/useThemeVariant';

function HardwareSingletonDialogCmp(
  props: any,
  ref: ForwardedRef<IDialogInstance>,
) {
  const [state] = useHardwareUiStateAtom();
  const action = state?.action;
  const connectId = state?.connectId || '';
  // state?.payload?.deviceType
  const { serviceHardware, serviceHardwareUI } = backgroundApiProxy;
  const intl = useIntl();

  // TODO make sure toast is last session action
  // TODO pin -> passpharse -> confirm -> address -> sign -> confirm

  const title = useRef('Loading');
  const content = useRef(
    <CommonDeviceLoading>
      <SizableText size="$bodySmMedium">{action}</SizableText>
    </CommonDeviceLoading>,
  );

  if (action === EHardwareUiStateAction.DeviceChecking) {
    title.current = 'Checking Device';
    content.current = <CommonDeviceLoading />;
  }

  if (action === EHardwareUiStateAction.ProcessLoading) {
    title.current = 'Processing';
    content.current = <CommonDeviceLoading />;
  }

  // EnterPin on Device
  if (action === EHardwareUiStateAction.EnterPinOnDevice) {
    title.current = intl.formatMessage({
      id: ETranslations.enter_pin_enter_on_device,
    });
    content.current = <EnterPinOnDevice />;
  }

  // EnterPin on App
  if (action === EHardwareUiStateAction.REQUEST_PIN) {
    title.current = intl.formatMessage({
      id: ETranslations.enter_pin_title,
    });
    content.current = (
      <EnterPin
        onConfirm={async (value) => {
          await serviceHardwareUI.sendPinToDevice({
            pin: value,
          });
          await serviceHardwareUI.showDeviceProcessLoadingDialog({
            connectId,
          });
        }}
        switchOnDevice={async () => {
          await serviceHardwareUI.showEnterPinOnDeviceDialog({
            connectId,
          });
        }}
      />
    );
  }

  // ConfirmOnDevice: use toast instead

  // EnterPassphrase on App
  if (action === EHardwareUiStateAction.REQUEST_PASSPHRASE) {
    title.current = intl.formatMessage({
      id: ETranslations.global_enter_passphrase,
    });
    content.current = (
      <EnterPhase
        isSingleInput={!!state?.payload?.passphraseState}
        onConfirm={async ({ passphrase }) => {
          await serviceHardwareUI.sendPassphraseToDevice({
            passphrase,
          });
          await serviceHardwareUI.showDeviceProcessLoadingDialog({ connectId });
        }}
        switchOnDevice={async () => {
          await serviceHardwareUI.showEnterPassphraseOnDeviceDialog();
        }}
      />
    );
  }

  // EnterPassphraseOnDevice
  if (action === EHardwareUiStateAction.REQUEST_PASSPHRASE_ON_DEVICE) {
    title.current = 'Enter Passphrase on Device';
    content.current = <EnterPassphraseOnDevice />;
  }

  const shouldEnterPinOnDevice =
    action === EHardwareUiStateAction.REQUEST_PIN &&
    !state?.payload?.supportInputPinOnSoftware;

  useEffect(() => {
    if (shouldEnterPinOnDevice) {
      void serviceHardwareUI.showEnterPinOnDeviceDialog({
        connectId,
      });
    }
  }, [connectId, serviceHardware, serviceHardwareUI, shouldEnterPinOnDevice]);

  return (
    <DialogContainer
      ref={ref}
      title={title.current}
      renderContent={content.current}
      {...props} // pass down cloneElement props
    />
  );
}

const HardwareSingletonDialog = forwardRef(HardwareSingletonDialogCmp);

function HardwareUiStateContainerCmp() {
  const [state] = useHardwareUiStateAtom();
  const { serviceHardware, serviceHardwareUI } = backgroundApiProxy;

  const action = state?.action;
  const connectId = state?.connectId; // connectId maybe undefined usb-sdk
  const deviceType = state?.payload?.deviceType || 'unknown';

  const dialogRef = useRef<IDialogInstance | undefined>();
  const toastRef = useRef<IToastShowResult | undefined>();
  const shouldShowAction = Boolean(state);

  const isToastAction = useMemo(() => {
    if (!action) {
      return false;
    }
    if ([EHardwareUiStateAction.REQUEST_BUTTON].includes(action)) {
      return true;
    }
    if (action === EHardwareUiStateAction.FIRMWARE_TIP) {
      if (
        state?.payload?.firmwareTipData?.message ===
        EFirmwareUpdateTipMessages.ConfirmOnDevice
      ) {
        return true;
      }
    }
    return false;
  }, [action, state?.payload?.firmwareTipData?.message]);

  const isToastActionRef = useRef(isToastAction);
  isToastActionRef.current = isToastAction;

  const isDialogAction = useMemo(() => {
    if (!action) {
      return false;
    }
    if (isToastAction) {
      return false;
    }
    if (
      [
        EHardwareUiStateAction.FIRMWARE_TIP,
        EHardwareUiStateAction.FIRMWARE_PROGRESS,
        EHardwareUiStateAction.CLOSE_UI_WINDOW,
        EHardwareUiStateAction.PREVIOUS_ADDRESS,
      ].includes(action)
    ) {
      return false;
    }
    return true;
  }, [action, isToastAction]);

  const shouldSkipCancel = useMemo(() => {
    // TODO atom firmware is updating
    if (
      action &&
      [
        EHardwareUiStateAction.FIRMWARE_TIP,
        EHardwareUiStateAction.FIRMWARE_PROGRESS,
      ].includes(action)
    ) {
      return true;
    }
    return false;
  }, [action]);

  const shouldSkipCancelRef = useRef(shouldSkipCancel);
  shouldSkipCancelRef.current = shouldSkipCancel;

  const HardwareSingletonDialogRender = useCallback(
    ({ ref }: { ref: any }) => (
      <HardwareSingletonDialog hello="world-338" ref={ref} />
    ),
    [],
  );

  console.log(
    'HardwareUiStateContainer action ========',
    state,
    action,
    shouldShowAction,
    [
      HardwareSingletonDialogRender,
      connectId,
      isToastAction,
      serviceHardware,
      shouldShowAction,
    ],
  );

  const autoClosedFlag = 'autoClosed';

  const showOrHideMutex = useRef(new Semaphore(1));

  // TODO support multiple connectId dialog show
  useEffect(() => {
    void showOrHideMutex.current.runExclusive(async () => {
      // TODO do not cancel device here
      const closePrevActions = async () => {
        await dialogRef.current?.close({ flag: autoClosedFlag });
        await toastRef.current?.close({ flag: autoClosedFlag });
      };
      await closePrevActions();
      await timerUtils.wait(300);
      if (shouldShowAction) {
        if (isToastAction) {
          toastRef.current = Toast.show({
            children: <ConfirmOnDeviceToastContent deviceType={deviceType} />,
            dismissOnOverlayPress: false,
            disableSwipeGesture: false,
            onClose: async (params) => {
              console.log('close ConfirmOnDeviceToastContent');
              if (params?.flag !== autoClosedFlag) {
                await serviceHardwareUI.closeHardwareUiStateDialog({
                  connectId,
                  skipDeviceCancel: shouldSkipCancelRef.current,
                });
              }
            },
          });
        } else if (isDialogAction) {
          dialogRef.current = Dialog.show({
            dismissOnOverlayPress: false,
            showFooter: false,
            dialogContainer: HardwareSingletonDialogRender,
            async onClose(params) {
              console.log('HardwareUiStateContainer onDismiss');
              if (params?.flag !== autoClosedFlag) {
                await serviceHardwareUI.closeHardwareUiStateDialog({
                  connectId,
                  reason: 'HardwareUiStateContainer onClose',
                  skipDeviceCancel: shouldSkipCancelRef.current,
                });
              }
            },
          });
        }
      } else {
        await closePrevActions();
      }
    });

    return () => {};
  }, [
    HardwareSingletonDialogRender,
    connectId,
    deviceType,
    isDialogAction,
    isToastAction,
    serviceHardware,
    serviceHardwareUI,
    shouldShowAction,
  ]);

  return null;
}
export const HardwareUiStateContainer = memo(HardwareUiStateContainerCmp);
