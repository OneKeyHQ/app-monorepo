import type { ForwardedRef } from 'react';
import { forwardRef, memo, useCallback, useEffect, useRef } from 'react';

import type { IDialogInstance } from '@onekeyhq/components';
import { Dialog, DialogContainer, SizableText } from '@onekeyhq/components';
import {
  EHardwareUiStateAction,
  useHardwareUiStateAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import {
  CommonDeviceLoading,
  ConfirmOnDevice,
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

  // ConfirmOnDevice
  if (action === EHardwareUiStateAction.REQUEST_BUTTON) {
    title.current = 'Confirm on Device';
    content.current = <ConfirmOnDevice />;
  }

  // EnterPassphrase on App
  if (action === EHardwareUiStateAction.REQUEST_PASSPHRASE) {
    title.current = 'Enter Passphrase';
    content.current = (
      <EnterPhase
        onConfirm={async ({ passphrase, save }) => {
          await serviceHardware.sendPassphraseToDevice({
            passphrase,
          });
          // TODO show remember dialog after wallet created
          // TODO how to save remember state at EnterPassphraseOnDevice
          // TODO do not show remember dialog when creating address or sign tx
          // TODO default states when click dialog close
          if (save) {
            // update wallet db
          }
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
  console.log('HardwareUiStateContainer action========', action);

  const dialogRef = useRef<IDialogInstance | undefined>();
  const shouldShowDialog = Boolean(state && connectId);

  const HardwareSingletonDialogRender = useCallback(
    ({ ref }: { ref: any }) => (
      <HardwareSingletonDialog hello="world-338" ref={ref} />
    ),
    [],
  );

  // TODO support multiple connectId dialog show
  useEffect(() => {
    void (async () => {
      const closePrevDialog = () => dialogRef.current?.close();
      await closePrevDialog();

      if (shouldShowDialog && connectId) {
        dialogRef.current = Dialog.show({
          showFooter: false,
          dialogContainer: HardwareSingletonDialogRender,
          async onClose() {
            console.log('HardwareUiStateContainer onDismiss');
            await serviceHardware.closeHardwareUiStateDialog({
              connectId,
              reason: 'HardwareUiStateContainer onClose',
            });
          },
        });
      }
    })();

    return () => {};
  }, [
    HardwareSingletonDialogRender,
    serviceHardware,
    shouldShowDialog,
    connectId,
  ]);

  //   useEffect(() => {
  //     const closePrevDialog = () => void dialogRef.current?.close();
  //     closePrevDialog();

  //     if (action === EHardwareUiStateAction.DeviceChecking) {
  //       dialogRef.current = Dialog.show({
  //         title: 'Checking Device',
  //         showFooter: false,
  //         renderContent: (
  //           <Stack
  //             borderRadius="$3"
  //             p="$5"
  //             bg="$bgSubdued"
  //             style={{ borderCurve: 'continuous' }}
  //           >
  //             <Spinner size="large" />
  //           </Stack>
  //         ),
  //         onDismiss: async () => {
  //           // TODO not working
  //           await serviceHardware.cancel(state?.payload?.connectId);
  //         },
  //       });
  //     }

  //     // PIN - Passphrase
  //     if (action === EHardwareUiStateAction.REQUEST_PIN) {
  //       dialogRef.current = Dialog.show({
  //         title: 'Enter PIN', // Enter PIN on App
  //         showFooter: false,
  //         renderContent: (
  //           <EnterPin
  //             onConfirm={async () => {
  //               await serviceHardware.closeHardwareUiStateDialog();
  //             }}
  //           />
  //         ),
  //         onDismiss: async () => {
  //           await serviceHardware.cancel(state?.payload?.connectId);
  //         },
  //       });
  //     }

  //     return () => {
  //       // use closePrevDialog();
  //       // void serviceHardware.closeHardwareUiStateDialog();
  //     };
  //   }, [serviceHardware, action, state?.payload?.connectId]);

  return null;
}
export const HardwareUiStateContainer = memo(HardwareUiStateContainerCmp);
