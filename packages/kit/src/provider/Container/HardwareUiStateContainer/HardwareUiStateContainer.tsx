import type { ForwardedRef } from 'react';
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
import {
  Dialog,
  DialogContainer,
  SizableText,
  Toast,
} from '@onekeyhq/components';
import type { IHardwareUiState } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EHardwareUiStateAction,
  useHardwareUiStateAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
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
import {
  OpenBleSettingsDialog,
  RequireBlePermissionDialog,
} from '../../../components/Hardware/HardwareDialog';

import ActionsQueueManager from './ActionsQueueManager';

function HardwareSingletonDialogCmp(
  props: any,
  ref: ForwardedRef<IDialogInstance>,
) {
  const { state }: { state: IHardwareUiState | undefined } = props;
  const action = state?.action;
  const connectId = state?.connectId || '';
  // state?.payload?.deviceType
  const { serviceHardwareUI } = backgroundApiProxy;
  const intl = useIntl();

  // TODO make sure toast is last session action
  // TODO pin -> passpharse -> confirm -> address -> sign -> confirm

  const title = useRef('Loading');
  const content = useRef(
    <CommonDeviceLoading>
      {platformEnv.isDev ? (
        <SizableText size="$bodySmMedium">{action}</SizableText>
      ) : null}
    </CommonDeviceLoading>,
  );

  if (action === EHardwareUiStateAction.DeviceChecking) {
    title.current = intl.formatMessage({
      id: ETranslations.global_checking_device,
    });
    content.current = <CommonDeviceLoading />;
  }

  if (action === EHardwareUiStateAction.ProcessLoading) {
    title.current = intl.formatMessage({ id: ETranslations.global_processing });
    content.current = <CommonDeviceLoading />;
  }

  // EnterPin on Device
  if (action === EHardwareUiStateAction.EnterPinOnDevice) {
    title.current = intl.formatMessage({
      id: ETranslations.enter_pin_enter_on_device,
    });
    content.current = (
      <EnterPinOnDevice deviceType={state?.payload?.deviceType} />
    );
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
          await serviceHardwareUI.sendEnterPinOnDeviceEvent({
            connectId,
            payload: state?.payload,
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
    title.current = intl.formatMessage({
      id: ETranslations.hardware_enter_passphrase_on_device,
    });
    content.current = (
      <EnterPassphraseOnDevice deviceType={state?.payload?.deviceType} />
    );
  }

  // Need Open Bluetooth Dialog Container
  if (action === EHardwareUiStateAction.BLUETOOTH_PERMISSION) {
    return <OpenBleSettingsDialog ref={ref} {...props} />;
  }

  // Bluetooth Permission Dialog Container
  if (
    action === EHardwareUiStateAction.LOCATION_PERMISSION ||
    action === EHardwareUiStateAction.LOCATION_SERVICE_PERMISSION
  ) {
    return <RequireBlePermissionDialog ref={ref} {...props} />;
  }

  return (
    <DialogContainer
      ref={ref}
      title={title.current}
      renderContent={content.current}
      {...props} // pass down cloneElement props
    />
  );
}

const hasConfirmAction = (localState: IHardwareUiState | undefined) => {
  if (localState?.action === EHardwareUiStateAction.REQUEST_BUTTON) {
    return true;
  }
  if (
    localState?.action === EHardwareUiStateAction.FIRMWARE_TIP &&
    (localState?.payload?.firmwareTipData?.message ===
      EFirmwareUpdateTipMessages.ConfirmOnDevice ||
      localState?.payload?.firmwareTipData?.message ===
        EFirmwareUpdateTipMessages.InstallingFirmware)
  ) {
    return true;
  }

  return false;
};

const HardwareSingletonDialog = forwardRef(HardwareSingletonDialogCmp);

function HardwareUiStateContainerCmp() {
  const [state] = useHardwareUiStateAtom();
  const { serviceHardwareUI } = backgroundApiProxy;

  const toastQueueManagerRef = useRef(new ActionsQueueManager('toast'));
  const dialogQueueManagerRef = useRef(new ActionsQueueManager('dialog'));

  const action = state?.action;

  const autoClosedFlag = 'autoClosed';

  const log = (...args: any[]) => {
    const ts = Date.now();
    console.log(`${ts}## HardwareUiStateContainerUiLog`, ...args);
  };

  const getDeviceType = useCallback(
    (currentState: IHardwareUiState | undefined) =>
      currentState?.payload?.deviceType || 'unknown',
    [],
  );

  const hasToastAction = useCallback(
    (currentState: IHardwareUiState | undefined) => {
      if (!currentState?.action) return false;

      if (
        [EHardwareUiStateAction.REQUEST_BUTTON].includes(currentState?.action)
      ) {
        return true;
      }

      if (currentState?.action === EHardwareUiStateAction.FIRMWARE_TIP) {
        if (
          currentState?.payload?.firmwareTipData?.message ===
            EFirmwareUpdateTipMessages.ConfirmOnDevice ||
          currentState?.payload?.firmwareTipData?.message ===
            EFirmwareUpdateTipMessages.InstallingFirmware
        ) {
          return true;
        }
      }

      return false;
    },
    [],
  );

  const hasToastCloseAction = useCallback(
    (currentState: IHardwareUiState | undefined) => {
      if (!currentState?.action) return false;

      if (currentState?.action === EHardwareUiStateAction.CLOSE_UI_WINDOW) {
        return true;
      }

      if (currentState?.action === EHardwareUiStateAction.FIRMWARE_TIP) {
        if (
          currentState?.payload?.firmwareTipData?.message ===
            EFirmwareUpdateTipMessages.GoToBootloaderSuccess ||
          currentState?.payload?.firmwareTipData?.message ===
            EFirmwareUpdateTipMessages.FirmwareEraseSuccess
        ) {
          return true;
        }
      }

      return false;
    },
    [],
  );

  // const isToastActionRef = useRef(isToastAction);
  // isToastActionRef.current = isToastAction;

  const hasDialogAction = useCallback(
    (currentState: IHardwareUiState | undefined) => {
      if (!currentState?.action) return false;

      if (hasToastAction(currentState)) return false;

      if (
        [
          EHardwareUiStateAction.FIRMWARE_TIP,
          EHardwareUiStateAction.FIRMWARE_PROGRESS,
          EHardwareUiStateAction.CLOSE_UI_WINDOW,
          EHardwareUiStateAction.PREVIOUS_ADDRESS,
        ].includes(currentState?.action)
      ) {
        return false;
      }

      return true;
    },
    [hasToastAction],
  );

  const hasOperationAction = useCallback(
    (currentState: IHardwareUiState | undefined) => {
      if (!currentState?.action) return false;
      if (!hasToastAction(currentState)) return false;

      if (
        currentState &&
        [
          EHardwareUiStateAction.BLUETOOTH_PERMISSION,
          EHardwareUiStateAction.LOCATION_PERMISSION,
          EHardwareUiStateAction.LOCATION_SERVICE_PERMISSION,
        ].includes(currentState.action)
      ) {
        return true;
      }

      return false;
    },
    [hasToastAction],
  );

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

  const showActionsToast = useCallback(
    (currentState: IHardwareUiState | undefined) => {
      const currentDeviceType = getDeviceType(currentState);
      toastQueueManagerRef?.current?.addQueue(() => ({
        state: currentState,
        action: () =>
          Toast.show({
            children: (
              <ConfirmOnDeviceToastContent deviceType={currentDeviceType} />
            ),
            dismissOnOverlayPress: false,
            disableSwipeGesture: false,
            onClose: async (params) => {
              log('close toast');
              if (params?.flag !== autoClosedFlag) {
                await serviceHardwareUI.closeHardwareUiStateDialog({
                  connectId: currentState?.connectId,
                  skipDeviceCancel: shouldSkipCancelRef.current,
                });
              }
            },
          }),
      }));
    },
    [getDeviceType, serviceHardwareUI],
  );

  const showActionsDialog = useCallback(
    (currentState: IHardwareUiState | undefined) => {
      // Required operation dialog
      const isOperationAction = hasOperationAction(currentState);
      dialogQueueManagerRef?.current?.addQueue(() => ({
        state: currentState,
        action: () =>
          Dialog.show({
            dismissOnOverlayPress: !!isOperationAction,
            showFooter: !!isOperationAction,
            // eslint-disable-next-line react/no-unstable-nested-components
            dialogContainer: ({ ref }: { ref: any }) => (
              <HardwareSingletonDialog ref={ref} state={currentState} />
            ),
            async onClose(params) {
              log('close dialog');
              if (params?.flag !== autoClosedFlag) {
                await serviceHardwareUI.closeHardwareUiStateDialog({
                  connectId: currentState?.connectId,
                  reason: 'HardwareUiStateContainer onClose',
                  skipDeviceCancel: shouldSkipCancelRef.current,
                });
              }
            },
          }),
      }));
    },
    [hasOperationAction, serviceHardwareUI],
  );

  const hasSameDialogAction = useCallback(
    (currentState: IHardwareUiState | undefined) => {
      const dialogCurrentState =
        dialogQueueManagerRef?.current?.currentActionState;

      if (dialogCurrentState?.action === undefined) {
        return false;
      }

      if (currentState?.action === dialogCurrentState?.action) {
        return true;
      }

      return false;
    },
    [],
  );

  const hasSameToastAction = useCallback(
    (currentState: IHardwareUiState | undefined) => {
      const toastCurrentState =
        toastQueueManagerRef?.current?.currentActionState;

      if (toastCurrentState?.action === undefined) {
        return false;
      }

      if (currentState?.action === toastCurrentState?.action) {
        return true;
      }

      if (
        currentState?.payload?.deviceType ===
          toastCurrentState?.payload?.deviceType &&
        hasConfirmAction(currentState) &&
        hasConfirmAction(toastCurrentState)
      ) {
        return true;
      }

      return false;
    },
    [],
  );

  useEffect(() => {
    const handleStateChange = async () => {
      const isToastAction = hasToastAction(state);
      const isDialogAction = hasDialogAction(state);
      const isToastCloseAction = hasToastCloseAction(state);

      console.log('HardwareUiStateContainer action change === ', {
        isToastAction,
        isDialogAction,
        state: state?.action,
        hasSameDialogAction: hasSameDialogAction(state),
        hasSameToastAction: hasSameToastAction(state),
        dialogCurrentState:
          dialogQueueManagerRef?.current?.currentActionState?.action,
        toastCurrentState:
          toastQueueManagerRef?.current?.currentActionState?.action,
        statePayload: state?.payload,
      });

      if (state) {
        if (isToastAction && !hasSameToastAction(state)) {
          await dialogQueueManagerRef.current?.closeAll();
          showActionsToast(state);
        } else if (isDialogAction && !hasSameDialogAction(state)) {
          await toastQueueManagerRef.current?.closeAll();
          showActionsDialog(state);
        }

        if (isToastCloseAction) {
          await toastQueueManagerRef.current?.closeAll();
        }
      } else {
        await toastQueueManagerRef.current?.closeAll();
        await dialogQueueManagerRef.current?.closeAll();
      }
    };

    void handleStateChange();
  }, [
    hasDialogAction,
    hasSameDialogAction,
    hasSameToastAction,
    hasToastAction,
    hasToastCloseAction,
    showActionsDialog,
    showActionsToast,
    state,
  ]);

  return null;
}
export const HardwareUiStateContainer = memo(HardwareUiStateContainerCmp);
