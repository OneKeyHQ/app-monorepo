import type { ForwardedRef } from 'react';
import { forwardRef, memo, useCallback, useEffect, useRef } from 'react';

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
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import {
  CommonDeviceLoading,
  ConfirmOnClassic,
  EnterPassphraseOnDevice,
  EnterPhase,
  EnterPin,
  EnterPinOnDevice,
} from '../../components/Hardware/Hardware';

function HardwareSingletonDialogCmp(
  props: any,
  ref: ForwardedRef<IDialogInstance>,
) {
  const [state] = useHardwareUiStateAtom();
  const action = state?.action;
  const connectId = state?.connectId || '';
  const { serviceHardware } = backgroundApiProxy;

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

  if (action === EHardwareUiStateAction.EnterPinOnDevice) {
    title.current = 'Enter PIN on Device';
    content.current = <EnterPinOnDevice />;
  }

  // EnterPin on App
  if (action === EHardwareUiStateAction.REQUEST_PIN) {
    title.current = 'Enter PIN';
    content.current = (
      <EnterPin
        onConfirm={async (value) => {
          await serviceHardware.sendPinToDevice({
            pin: value,
          });
          await serviceHardware.showDeviceProcessLoadingDialog({
            connectId,
          });
        }}
        switchOnDevice={async () => {
          await serviceHardware.showEnterPinOnDeviceDialog({
            connectId,
          });
        }}
      />
    );
  }

  // ConfirmOnDevice: use toast instead

  // EnterPassphrase on App
  if (action === EHardwareUiStateAction.REQUEST_PASSPHRASE) {
    title.current = 'Enter Passphrase';
    content.current = (
      <EnterPhase
        onConfirm={async ({ passphrase }) => {
          await serviceHardware.sendPassphraseToDevice({
            passphrase,
          });
          await serviceHardware.showDeviceProcessLoadingDialog({ connectId });
        }}
        switchOnDevice={async () => {
          await serviceHardware.showEnterPassphraseOnDeviceDialog();
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
  // || settings.enterPinOnDevice enabled on
  useEffect(() => {
    if (shouldEnterPinOnDevice) {
      void serviceHardware.showEnterPinOnDeviceDialog({
        connectId,
      });
    }
  }, [connectId, serviceHardware, shouldEnterPinOnDevice]);

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
  const { serviceHardware } = backgroundApiProxy;

  const action = state?.action;
  const connectId = state?.connectId;

  const dialogRef = useRef<IDialogInstance | undefined>();
  const toastRef = useRef<IToastShowResult | undefined>();
  const shouldShowAction = Boolean(state && connectId);

  const isToastAction =
    action && [EHardwareUiStateAction.REQUEST_BUTTON].includes(action);
  const isToastActionRef = useRef(isToastAction);
  isToastActionRef.current = isToastAction;

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

  // TODO support multiple connectId dialog show
  useEffect(() => {
    void (async () => {
      // TODO do not cancel device here
      const closePrevActions = async () => {
        await dialogRef.current?.close({ flag: autoClosedFlag });
        await toastRef.current?.close({ flag: autoClosedFlag });
        await timerUtils.wait(300);
      };
      await closePrevActions();
      if (shouldShowAction && connectId) {
        if (isToastAction) {
          toastRef.current = Toast.show({
            children: <ConfirmOnClassic />,
            dismissOnOverlayPress: false,
            disableSwipeGesture: false,
            onClose: async (params) => {
              console.log('close ConfirmOnClassic');
              if (params?.flag !== autoClosedFlag) {
                await serviceHardware.closeHardwareUiStateDialog({
                  connectId,
                });
              }
            },
          });
        } else {
          dialogRef.current = Dialog.show({
            showFooter: false,
            dialogContainer: HardwareSingletonDialogRender,
            async onClose(params) {
              console.log('HardwareUiStateContainer onDismiss');
              if (params?.flag !== autoClosedFlag) {
                await serviceHardware.closeHardwareUiStateDialog({
                  connectId,
                  reason: 'HardwareUiStateContainer onClose',
                });
              }
            },
          });
        }
      }
    })();

    return () => {};
  }, [
    HardwareSingletonDialogRender,
    connectId,
    isToastAction,
    serviceHardware,
    shouldShowAction,
  ]);

  return null;
}
export const HardwareUiStateContainer = memo(HardwareUiStateContainerCmp);
