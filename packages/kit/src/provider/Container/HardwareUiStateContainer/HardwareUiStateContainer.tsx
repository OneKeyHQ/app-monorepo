import type { ComponentProps, ForwardedRef } from 'react';
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import { throttle } from 'lodash';
import { useIntl } from 'react-intl';

import type { IDialogInstance, IDialogShowProps } from '@onekeyhq/components';
import {
  Dialog,
  DialogContainer,
  Portal,
  SizableText,
} from '@onekeyhq/components';
import type { IShowToasterInstance } from '@onekeyhq/components/src/actions/Toast/ShowCustom';
import { ShowCustom } from '@onekeyhq/components/src/actions/Toast/ShowCustom';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { DeviceNotFoundDialogContent } from '@onekeyhq/kit/src/components/Hardware/ConnectionTroubleShootingAccordion';
import {
  usePromptWebDeviceAccess,
  useToPromptWebDeviceAccessPage,
} from '@onekeyhq/kit/src/hooks/usePromptWebDeviceAccess';
import type { IHardwareUiState } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EHardwareUiStateAction,
  useHardwareUiStateAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IHardwareErrorDialogPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EFirmwareUpdateTipMessages } from '@onekeyhq/shared/types/device';

import {
  BluetoothDevicePairingContent,
  BluetoothPermissionUnauthorizedContent,
  CommonDeviceLoading,
  ConfirmOnDeviceToastContent,
  DesktopBluetoothPermissionContent,
  EnterPassphraseOnDevice,
  EnterPhase,
  EnterPin,
  EnterPinOnDevice,
} from '../../../components/Hardware/Hardware';
import {
  OpenBleNotifyChangeErrorDialog,
  OpenBleSettingsDialog,
  RequireBlePermissionDialog,
  buildBleNotifyChangeError,
  buildBleSettingsDialogProps,
  buildWebDeviceAccessDialogProps,
} from '../../../components/Hardware/HardwareDialog';

import {
  SHOW_CLOSE_ACTION_MIN_DURATION,
  SHOW_CLOSE_LOADING_ACTION_MIN_DURATION,
} from './constants';

let globalShowDeviceProgressDialogEnabled = true;

let autoEnabledTimer: ReturnType<typeof setTimeout> | null = null;
export function setGlobalShowDeviceProgressDialogEnabled(enabled: boolean) {
  globalShowDeviceProgressDialogEnabled = enabled;
  if (autoEnabledTimer) {
    clearTimeout(autoEnabledTimer);
  }
  autoEnabledTimer = setTimeout(
    () => {
      globalShowDeviceProgressDialogEnabled = true;
    },
    timerUtils.getTimeDurationMs({
      minute: 10,
    }),
  );
}

function HardwareSingletonDialogCmp(
  props: ComponentProps<typeof DialogContainer> & {
    state: IHardwareUiState | undefined;
  },
  ref: ForwardedRef<IDialogInstance>,
) {
  const { open } = props;
  const { state }: { state: IHardwareUiState | undefined } = props;
  const action = state?.action;
  const connectId = state?.connectId || '';

  // state?.payload?.deviceType
  const { serviceHardwareUI, serviceSetting } = backgroundApiProxy;
  const intl = useIntl();
  const [showCloseButton, setIsShowExitButton] = useState(false);
  const [persistBluetoothUnauthorized, setPersistBluetoothUnauthorized] =
    useState(false);

  // TODO make sure toast is last session action
  // TODO pin -> passpharse -> confirm -> address -> sign -> confirm

  const defaultLoadingView = useMemo(
    () => (
      <CommonDeviceLoading>
        {platformEnv.isDev ? (
          <SizableText size="$bodySmMedium">
            {action || 'unknow action'}
          </SizableText>
        ) : null}
      </CommonDeviceLoading>
    ),
    [action],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    let delayTime = SHOW_CLOSE_ACTION_MIN_DURATION;
    if (
      action &&
      [
        EHardwareUiStateAction.DeviceChecking,
        EHardwareUiStateAction.ProcessLoading,
      ].includes(action)
    ) {
      delayTime = SHOW_CLOSE_LOADING_ACTION_MIN_DURATION;
    }

    const timer = setTimeout(() => {
      setIsShowExitButton(true);
    }, delayTime);

    return () => {
      clearTimeout(timer);
    };
  }, [action, open]);

  useEffect(() => {
    if (!open) {
      setIsShowExitButton(false);
      setPersistBluetoothUnauthorized(false);
    }
  }, [open]);

  // Track when bluetooth unauthorized state is shown
  useEffect(() => {
    if (action === EHardwareUiStateAction.DeviceChecking) {
      const eventType = state?.payload?.eventType;
      if (
        eventType === EHardwareUiStateAction.BLUETOOTH_PERMISSION_UNAUTHORIZED
      ) {
        setPersistBluetoothUnauthorized(true);
      }
    }
  }, [action, state?.payload?.eventType]);

  const result = useMemo<{ title: string; content: React.ReactNode }>(() => {
    let title = intl.formatMessage({ id: ETranslations.global_processing });

    let content = defaultLoadingView;

    if (action === EHardwareUiStateAction.DeviceChecking) {
      const eventType = state?.payload?.eventType;
      if (
        eventType ===
        EHardwareUiStateAction.DESKTOP_REQUEST_BLUETOOTH_PERMISSION
      ) {
        title = intl.formatMessage({
          id: ETranslations.hardware_bluetooth_requires_permission_error,
        });
        content = (
          <DesktopBluetoothPermissionContent
            promiseId={state?.payload?.promiseId}
          />
        );
      } else if (
        // If bluetooth unauthorized is persisted, keep showing it
        persistBluetoothUnauthorized ||
        eventType === EHardwareUiStateAction.BLUETOOTH_PERMISSION_UNAUTHORIZED
      ) {
        title = intl.formatMessage({
          id: ETranslations.communication_communicating,
        });
        content = <BluetoothPermissionUnauthorizedContent />;
      } else if (
        eventType === EHardwareUiStateAction.BLUETOOTH_DEVICE_PAIRING
      ) {
        title = intl.formatMessage({
          id: ETranslations.bluetooth_paring_dialog_title,
        });
        content = (
          <BluetoothDevicePairingContent
            deviceId={state?.payload?.deviceId}
            usbConnectId={state?.payload?.connectId}
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            features={state?.payload?.rawPayload?.features}
            promiseId={state?.payload?.promiseId}
          />
        );
      } else {
        console.log('CheckDevice!!!!!!--->>>>: ', connectId);
        title = intl.formatMessage({
          id: ETranslations.communication_communicating,
        });
        content = defaultLoadingView;
      }
    }

    if (action === EHardwareUiStateAction.ProcessLoading) {
      title = intl.formatMessage({ id: ETranslations.global_processing });
      content = defaultLoadingView;
    }

    // EnterPin on Device
    if (action === EHardwareUiStateAction.EnterPinOnDevice) {
      const requestPinType = state?.payload?.requestPinType;
      if (requestPinType === 'AttachPin') {
        title = intl.formatMessage({
          id: ETranslations.global_enter_hidden_wallet_pin_on_device,
        });
      } else {
        title = intl.formatMessage({
          id: ETranslations.enter_pin_enter_on_device,
        });
      }
      content = <EnterPinOnDevice deviceType={state?.payload?.deviceType} />;
    }

    // EnterPin on App
    if (action === EHardwareUiStateAction.REQUEST_PIN) {
      const isAttachPin = state?.payload?.requestPinType === 'AttachPin';
      title = isAttachPin
        ? intl.formatMessage({
            id: ETranslations.global_enter_hidden_wallet_pin,
          })
        : intl.formatMessage({
            id: ETranslations.enter_pin_title,
          });
      content = (
        <EnterPin
          title={title}
          onConfirm={async (value) => {
            await serviceHardwareUI.sendPinToDevice({
              pin: value,
            });
            await serviceHardwareUI.closeHardwareUiStateDialog({
              skipDeviceCancel: true,
              connectId: state?.connectId,
              skipDelayClose: true,
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
      const isSingleInput = !!state?.payload?.passphraseState;
      const saveCachedHiddenWalletOptions = async ({
        hideImmediately,
      }: {
        hideImmediately: boolean;
      }) => {
        if (isSingleInput) {
          return;
        }
        await serviceSetting.setHiddenWalletImmediately(hideImmediately);
      };
      title = intl.formatMessage({
        id: isSingleInput
          ? ETranslations.global_enter_passphrase
          : ETranslations.global_add_hidden_wallet,
      });
      content = (
        <EnterPhase
          isVerifyMode={isSingleInput}
          allowUseAttachPin={!!state?.payload?.existsAttachPinUser}
          onConfirm={async ({ passphrase, hideImmediately }) => {
            await saveCachedHiddenWalletOptions({
              hideImmediately,
            });
            await serviceHardwareUI.sendPassphraseToDevice({
              passphrase,
            });
            // The device will not emit a loading event
            // so we need to manually display the loading to inform the user that the device is currently processing

            // **** The call sequence is prone to problems, causing the loading dialog to fail to close properly, so it is temporarily disabled
            await serviceHardwareUI.showDeviceProcessLoadingDialog({
              connectId,
            });

            // TODO skip show loading dialog if custom dialog is shown
            // ETranslations.onboarding_finalize_generating_accounts
          }}
          switchOnDevice={async ({ hideImmediately }) => {
            await saveCachedHiddenWalletOptions({
              hideImmediately,
            });
            await serviceHardwareUI.showEnterPassphraseOnDeviceDialog();
          }}
          switchOnDeviceAttachPin={async ({ hideImmediately }) => {
            await saveCachedHiddenWalletOptions({
              hideImmediately,
            });
            await serviceHardwareUI.showEnterAttachPinOnDeviceDialog();
          }}
        />
      );
    }

    // EnterPassphraseOnDevice
    if (action === EHardwareUiStateAction.REQUEST_PASSPHRASE_ON_DEVICE) {
      title = intl.formatMessage({
        id: ETranslations.hardware_enter_passphrase_on_device,
      });
      content = (
        <EnterPassphraseOnDevice deviceType={state?.payload?.deviceType} />
      );
    }

    return { title, content };
  }, [
    action,
    connectId,
    defaultLoadingView,
    intl,
    serviceHardwareUI,
    serviceSetting,
    state?.connectId,
    state?.payload,
    persistBluetoothUnauthorized,
  ]);

  const getDialogKey = (params: {
    action: EHardwareUiStateAction | undefined;
  }) => {
    // Use consistent dialogKey for bluetooth permission flow
    if (params.action === EHardwareUiStateAction.DeviceChecking) {
      return 'DeviceCheckingFlow';
    }
    return result.title + (params.action?.toString() || '');
  };

  const dialogKey = getDialogKey({ action });

  // Need Open Bluetooth Dialog Container
  if (action === EHardwareUiStateAction.BLUETOOTH_PERMISSION) {
    return <OpenBleSettingsDialog key={dialogKey} ref={ref} {...props} />;
  }

  // Need Open Bluetooth Notify Change Error Dialog Container
  if (
    action ===
    EHardwareUiStateAction.BLUETOOTH_CHARACTERISTIC_NOTIFY_CHANGE_FAILURE
  ) {
    return (
      <OpenBleNotifyChangeErrorDialog key={dialogKey} ref={ref} {...props} />
    );
  }

  // Bluetooth Permission Dialog Container
  if (
    action === EHardwareUiStateAction.LOCATION_PERMISSION ||
    action === EHardwareUiStateAction.LOCATION_SERVICE_PERMISSION
  ) {
    return <RequireBlePermissionDialog key={dialogKey} ref={ref} {...props} />;
  }

  if (action === EHardwareUiStateAction.FIRMWARE_PROCESSING) {
    return undefined;
  }

  return open ? (
    <DialogContainer
      ref={ref}
      // title change will not re-render, so we need to use key to force update, but the closing animation will be lost
      key={dialogKey}
      title={result.title}
      renderContent={result.content}
      {...props} // pass down cloneElement props
      showExitButton={showCloseButton}
    />
  ) : null;
}

const _hasConfirmAction = (localState: IHardwareUiState | undefined) => {
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

const SHOW_HARDWARE_TOAST_VIEWPORT_NAME = 'SHOW_HARDWARE_TOAST_VIEWPORT_NAME';

function HardwareUiStateContainerCmpControlled() {
  const intl = useIntl();
  const [state] = useHardwareUiStateAtom();
  const stateRef = useRef(state);
  stateRef.current = state;

  const { serviceHardwareUI } = backgroundApiProxy;

  const action = state?.action;

  const AUTO_CLOSED_FLAG = 'autoClosed';

  const log = (...args: any[]) => {
    const ts = Date.now();
    console.log(`${ts}## HardwareUiStateContainerUiLog`, ...args);
  };

  log('state', action, state);

  const getDeviceType = useCallback(
    (currentState: IHardwareUiState | undefined) =>
      currentState?.payload?.deviceType || EDeviceType.Unknown,
    [],
  );

  const hasToastAction = useCallback(
    (currentState: IHardwareUiState | undefined) => {
      if (!currentState?.action) {
        return false;
      }

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

      // **** ui-close_window from hardware may cause toast to be closed abnormally, use withHardwareProcessing to close it uniformly
      // if (currentState?.action === EHardwareUiStateAction.CLOSE_UI_WINDOW) {
      // return false;
      // }

      // **** should hide toast when firmware is flashing in progress
      if (currentState?.action === EHardwareUiStateAction.FIRMWARE_PROGRESS) {
        return false;
      }

      if (currentState?.action === EHardwareUiStateAction.FIRMWARE_TIP) {
        // **** should hide toast when firmware reboot to bootloader or erased
        if (
          currentState?.payload?.firmwareTipData?.message ===
            EFirmwareUpdateTipMessages.GoToBootloaderSuccess ||
          currentState?.payload?.firmwareTipData?.message ===
            EFirmwareUpdateTipMessages.FirmwareEraseSuccess
        ) {
          return false;
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
      if (currentState?.action === EHardwareUiStateAction.CLOSE_UI_PIN_WINDOW) {
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

      if (currentState?.action === EHardwareUiStateAction.FIRMWARE_PROGRESS) {
        return true;
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
          EHardwareUiStateAction.REQUEST_DEVICE_IN_BOOTLOADER_FOR_WEB_DEVICE,
        ].includes(currentState?.action)
      ) {
        return false;
      }

      if (currentState?.action === EHardwareUiStateAction.DEVICE_PROGRESS) {
        if (!globalShowDeviceProgressDialogEnabled) {
          return false;
        }
      }

      return true;
    },
    [hasToastAction],
  );

  const hasOperationAction = useCallback(
    (currentState: IHardwareUiState | undefined) => {
      if (!currentState?.action) return false;
      if (hasToastAction(currentState)) return false;

      if (
        currentState &&
        [
          EHardwareUiStateAction.BLUETOOTH_PERMISSION,
          EHardwareUiStateAction.BLUETOOTH_CHARACTERISTIC_NOTIFY_CHANGE_FAILURE,
          EHardwareUiStateAction.LOCATION_PERMISSION,
          EHardwareUiStateAction.LOCATION_SERVICE_PERMISSION,
          EHardwareUiStateAction.WEB_DEVICE_PROMPT_ACCESS_PERMISSION,
        ].includes(currentState.action)
      ) {
        return true;
      }

      return false;
    },
    [hasToastAction],
  );

  const hasDeviceResetToHome = useCallback(
    (currentState: IHardwareUiState | undefined) => {
      if (
        currentState?.action &&
        [
          EHardwareUiStateAction.REQUEST_PASSPHRASE,
          EHardwareUiStateAction.REQUEST_PASSPHRASE_ON_DEVICE,
          EHardwareUiStateAction.REQUEST_PIN,
          EHardwareUiStateAction.EnterPinOnDevice,
          EHardwareUiStateAction.REQUEST_BUTTON,
        ].includes(currentState?.action)
      ) {
        return true;
      }

      return false;
    },
    [],
  );

  const shouldSkipCancel = useMemo(() => {
    // TODO atom firmware is updating
    if (
      action &&
      [
        EHardwareUiStateAction.FIRMWARE_TIP,
        EHardwareUiStateAction.FIRMWARE_PROGRESS,
        EHardwareUiStateAction.FIRMWARE_PROCESSING,
        EHardwareUiStateAction.CLOSE_UI_PIN_WINDOW,
      ].includes(action)
    ) {
      return true;
    }

    return false;
  }, [action]);

  const shouldSkipCancelRef = useRef(shouldSkipCancel);
  shouldSkipCancelRef.current = shouldSkipCancel;

  const actionStatus = useMemo(() => {
    const isToastAction = hasToastAction(state);
    const isDialogAction = hasDialogAction(state);
    const isToastCloseAction = hasToastCloseAction(state);
    const isOperationAction = hasOperationAction(state);
    const currentShouldDeviceResetToHome = hasDeviceResetToHome(state);
    const currentDeviceType = getDeviceType(state);
    return {
      isToastAction,
      isDialogAction,
      isToastCloseAction,
      isOperationAction,
      currentShouldDeviceResetToHome,
      currentDeviceType,
    };
  }, [
    getDeviceType,
    hasDeviceResetToHome,
    hasDialogAction,
    hasOperationAction,
    hasToastAction,
    hasToastCloseAction,
    state,
  ]);

  const dialogInstanceRef = useRef<IDialogInstance | null>(null);
  const toastInstanceRef = useRef<IShowToasterInstance | null>(null);
  const hardwareErrorDialogInstanceRef = useRef<IDialogInstance | null>(null);
  if (process.env.NODE_ENV !== 'production') {
    // @ts-ignore
    globalThis.$$hardwareUiStateDialogInstanceRef = dialogInstanceRef;
    // @ts-ignore
    globalThis.$$hardwareUiStateToastInstanceRef = toastInstanceRef;
    // @ts-ignore
    globalThis.$$hardwareErrorDialogInstanceRef =
      hardwareErrorDialogInstanceRef;
  }

  const toastElement = (
    <ShowCustom
      ref={toastInstanceRef}
      name={SHOW_HARDWARE_TOAST_VIEWPORT_NAME}
      open={actionStatus.isToastAction}
      dismissOnOverlayPress={false}
      disableSwipeGesture
      onClose={async (params) => {
        log('close toast:', params, state, {
          currentShouldDeviceResetToHome:
            actionStatus.currentShouldDeviceResetToHome,
          shouldSkipCancel: shouldSkipCancelRef.current,
        });
        if (params?.flag !== AUTO_CLOSED_FLAG) {
          appEventBus.emit(
            EAppEventBusNames.CloseHardwareUiStateDialogManually,
            undefined,
          );
          await serviceHardwareUI.closeHardwareUiStateDialog({
            connectId: state?.connectId,
            skipDeviceCancel: shouldSkipCancelRef.current,
            deviceResetToHome: actionStatus.currentShouldDeviceResetToHome,
          });
        }
      }}
    >
      <ConfirmOnDeviceToastContent
        deviceType={actionStatus.currentDeviceType}
      />
    </ShowCustom>
  );

  const dialogElement = (
    <HardwareSingletonDialog
      ref={dialogInstanceRef}
      open={actionStatus.isDialogAction}
      state={state}
      dismissOnOverlayPress={false}
      // disableSwipeGesture
      disableDrag
      showFooter={!!actionStatus.isOperationAction}
      onClose={async (params) => {
        log(
          'close dialog',
          { params, state },
          {
            currentShouldDeviceResetToHome:
              actionStatus.currentShouldDeviceResetToHome,
            shouldSkipCancel: shouldSkipCancelRef.current,
          },
        );

        if (params?.flag !== AUTO_CLOSED_FLAG) {
          appEventBus.emit(
            EAppEventBusNames.CloseHardwareUiStateDialogManually,
            undefined,
          );
          await serviceHardwareUI.closeHardwareUiStateDialog({
            connectId: state?.connectId,
            reason: 'HardwareUiStateContainer onClose',
            skipDeviceCancel: shouldSkipCancelRef.current,
            deviceResetToHome: actionStatus.currentShouldDeviceResetToHome,
          });
        }
      }}
    />
  );

  const { promptWebUsbDeviceAccess } = usePromptWebDeviceAccess();
  const toPromptWebDeviceAccessPage = useToPromptWebDeviceAccessPage();

  // Handle hardware error dialog
  useEffect(() => {
    const callback = throttle(
      ({
        errorType,
        payload,
        errorCode: _errorCode,
        errorMessage: _errorMessage,
      }: IHardwareErrorDialogPayload) => {
        // Only handle DeviceNotFound errors for now, can be extended for other error types
        if (errorType !== 'DeviceNotFound') {
          return;
        }
        // Prevent duplicate dialog instances
        if (hardwareErrorDialogInstanceRef.current?.isExist()) {
          return;
        }

        void serviceHardwareUI.cleanHardwareUiState();

        hardwareErrorDialogInstanceRef.current = Dialog.show({
          title: intl.formatMessage({
            id: ETranslations.communication_timeout,
          }),
          description: intl.formatMessage({
            id: ETranslations.troubleshooting_show_helper_cta_label,
          }),
          showFooter: false,
          renderContent: <DeviceNotFoundDialogContent />,
        });
      },
      2500, // Same throttle duration as other hardware dialog instances
    );

    appEventBus.on(EAppEventBusNames.ShowHardwareErrorDialog, callback);
    return () => {
      appEventBus.off(EAppEventBusNames.ShowHardwareErrorDialog, callback);
      hardwareErrorDialogInstanceRef.current = null;
    };
  }, [intl, serviceHardwareUI]);

  useEffect(() => {
    const instanceRef: {
      current: IDialogInstance | undefined;
    } = {
      current: undefined,
    };
    const callback = throttle(
      ({ uiRequestType }: { uiRequestType: EHardwareUiStateAction }) => {
        if (instanceRef.current?.isExist()) {
          return;
        }
        let dialogProps: IDialogShowProps | undefined;
        if (uiRequestType === EHardwareUiStateAction.BLUETOOTH_PERMISSION) {
          dialogProps = buildBleSettingsDialogProps(intl);
        } else if (
          uiRequestType ===
          EHardwareUiStateAction.BLUETOOTH_CHARACTERISTIC_NOTIFY_CHANGE_FAILURE
        ) {
          dialogProps = buildBleNotifyChangeError(intl);
        } else if (
          uiRequestType ===
          EHardwareUiStateAction.WEB_DEVICE_PROMPT_ACCESS_PERMISSION
        ) {
          const connectId = stateRef.current?.connectId;
          dialogProps = buildWebDeviceAccessDialogProps({
            intl,
            connectId,
            // @ts-expect-error
            promptWebUsbDeviceAccess: (dialogInstance?: IDialogInstance) => {
              // Use the provided instance or the current instance
              const instance = dialogInstance || instanceRef.current;
              return (async () => {
                try {
                  const promptWebUsbDeviceAccessFn =
                    platformEnv.isExtensionUiPopup ||
                    platformEnv.isExtensionUiSidePanel ||
                    platformEnv.isExtensionUiStandaloneWindow
                      ? toPromptWebDeviceAccessPage
                      : promptWebUsbDeviceAccess;
                  const result = await promptWebUsbDeviceAccessFn();
                  // Close dialog after successful connection
                  await instance?.close();
                  return result;
                } catch (error) {
                  console.log('promptWebUsbDeviceAccess error', error);
                }
              })();
            },
          });
        }
        if (dialogProps) {
          setTimeout(() => {
            instanceRef.current = Dialog.show(dialogProps);
          }, 200);
        }
      },
      2500,
    );
    appEventBus.on(EAppEventBusNames.RequestHardwareUIDialog, callback);
    return () => {
      appEventBus.off(EAppEventBusNames.RequestHardwareUIDialog, callback);
      instanceRef.current = undefined;
    };
  }, [intl, toPromptWebDeviceAccessPage, promptWebUsbDeviceAccess]);

  return (
    <>
      <Portal.Body container={Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL}>
        {dialogElement}
      </Portal.Body>
      <Portal.Body container={Portal.Constant.TOASTER_OVERLAY_PORTAL}>
        {toastElement}
      </Portal.Body>
    </>
  );
}

export const HardwareUiStateContainer = memo(
  HardwareUiStateContainerCmpControlled,
);
