import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { UI_RESPONSE } from '@onekeyfe/hwk-adapter-core';
import { type IntlShape, useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  DialogContainer,
  Icon,
  IconButton,
  LottieView,
  Portal,
  Progress,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IDialogInstance, ILottieViewProps } from '@onekeyhq/components';
import type { IShowToasterInstance } from '@onekeyhq/components/src/actions/Toast/ShowCustom';
import { ShowCustom } from '@onekeyhq/components/src/actions/Toast/ShowCustom';
import type { IThirdPartyHardwareUiState } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EThirdPartyHardwareUiAction,
  isThirdPartyToastAction,
  thirdPartyAppInstallAtom,
  thirdPartyHardwareUiStateAtom,
  useThirdPartyAppInstallAtom,
  useThirdPartyHardwareUiStateAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EThirdPartyDevicePermissionDeniedReason } from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { getVendorProfile } from '@onekeyhq/shared/src/hardware/vendorProfile';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  OpenBleSettingsDialog,
  RequireBlePermissionDialog,
} from '../../../components/Hardware/HardwareDialog';
import { useThemeVariant } from '../../../hooks/useThemeVariant';

import { showLedgerInstallCoreAppsDialog } from './LedgerInstallCoreAppsDialog';
import {
  buildThirdPartyHardwareUiResponse,
  cancelThirdPartyHardwareUiRequest,
} from './utils';

const AUTO_CLOSED_FLAG = 'autoClosed';
const SHOW_CLOSE_BUTTON_DELAY = 8000;
// Install legitimately takes time; only reveal the in-progress cancel
// escape-hatch after a long delay (the confirm step is always cancelable).
const INSTALL_CANCEL_DELAY = 60_000;
const TOAST_VIEWPORT_NAME = 'THIRD_PARTY_HW_TOAST';

function OpenBleSettingsDialogRender({ ref }: { ref: any }) {
  return <OpenBleSettingsDialog ref={ref} />;
}

function RequireBlePermissionDialogRender({ ref }: { ref: any }) {
  return <RequireBlePermissionDialog ref={ref} />;
}

// Install dialog content, driven by the install atom (no progress = confirm,
// progress = installing). Rendered via Dialog.show renderContent so it coexists
// with device-prompt toasts.
function InstallAppDialogContent() {
  const intl = useIntl();
  const [state] = useThirdPartyAppInstallAtom();
  const appName = state?.appName ?? '';
  const vendor = state?.vendor;
  const progress = state?.progress;
  const installing = progress !== undefined;

  // Reveal the in-progress cancel escape-hatch only after INSTALL_CANCEL_DELAY.
  const [showInstallCancel, setShowInstallCancel] = useState(false);
  useEffect(() => {
    if (!installing) {
      setShowInstallCancel(false);
      return undefined;
    }
    const timer = setTimeout(
      () => setShowInstallCancel(true),
      INSTALL_CANCEL_DELAY,
    );
    return () => clearTimeout(timer);
  }, [installing]);

  const sendResponse = useCallback(
    async (confirmed: boolean) => {
      if (!vendor) return;
      await backgroundApiProxy.serviceHardware.thirdPartyHardwareUiResponse({
        vendor,
        response: {
          type: UI_RESPONSE.RECEIVE_INSTALL_APP,
          payload: { confirmed },
        },
      });
    },
    [vendor],
  );

  // Confirm step: decline the install (SDK resolves the request as not-confirmed).
  const onCancel = useCallback(async () => {
    try {
      await sendResponse(false);
    } finally {
      await thirdPartyAppInstallAtom.set(undefined);
    }
  }, [sendResponse]);

  // In-progress escape-hatch: abort the running install on the device.
  const onAbortInstall = useCallback(async () => {
    try {
      if (vendor) {
        await backgroundApiProxy.serviceHardware.thirdPartyHardwareCancel({
          vendor,
        });
      }
    } finally {
      await thirdPartyAppInstallAtom.set(undefined);
    }
  }, [vendor]);

  // Atom cleared while the dialog is still closing → render nothing so we don't
  // flash an empty-name confirm. (After all hooks, per rules-of-hooks.)
  if (!appName) {
    return null;
  }

  const percent = Math.round((progress ?? 0) * 100);
  // At 100% the device is still finalizing (SDK streams 100% during the
  // post-install dashboard step); show "Processing" until CLOSE_UI_WINDOW.
  const finalizing = installing && percent >= 100;

  return (
    <YStack gap="$5" pt="$2">
      {/* title/desc in content (not Dialog title) so they track the atom on reuse */}
      <YStack gap="$1.5">
        <SizableText size="$headingMd">
          {intl.formatMessage(
            {
              id: installing
                ? ETranslations.hardware_third_party_install_app_in_progress__title
                : ETranslations.hardware_third_party_install_app__title,
            },
            { appName },
          )}
        </SizableText>
        <SizableText size="$bodyLg" color="$textSubdued">
          {!installing
            ? intl.formatMessage(
                { id: ETranslations.hardware_third_party_install_app__desc },
                { appName },
              )
            : intl.formatMessage({
                id: finalizing
                  ? ETranslations.global_processing
                  : ETranslations.global_confirm_on_device,
              })}
        </SizableText>
      </YStack>
      {installing ? (
        <YStack gap="$4">
          <YStack gap="$2">
            <XStack justifyContent="space-between" alignItems="center">
              <SizableText size="$bodyMdMedium">{appName}</SizableText>
              <SizableText size="$bodyMdMedium" color="$textSubdued">
                {`${percent}%`}
              </SizableText>
            </XStack>
            <Progress animated value={percent} w="100%" />
          </YStack>
          {/* After the delay, reveal the escape hatch even when finalizing —
              stuck at "Processing" is exactly when the user needs to abort. */}
          {showInstallCancel ? (
            <XStack justifyContent="flex-end">
              <Button
                testID="third-party-hw-install-abort-btn"
                onPress={onAbortInstall}
              >
                {intl.formatMessage({ id: ETranslations.global_cancel })}
              </Button>
            </XStack>
          ) : null}
        </YStack>
      ) : (
        <XStack gap="$3" justifyContent="flex-end">
          <Button testID="third-party-hw-install-cancel-btn" onPress={onCancel}>
            {intl.formatMessage({ id: ETranslations.global_cancel })}
          </Button>
          <Button
            testID="third-party-hw-install-confirm-btn"
            variant="primary"
            onPress={() => void sendResponse(true)}
          >
            {intl.formatMessage({ id: ETranslations.global_install })}
          </Button>
        </XStack>
      )}
    </YStack>
  );
}

function getDeviceLabel(vendor: string | undefined): string {
  const fallback = 'Device';
  if (!vendor) return fallback;
  return (
    getVendorProfile(vendor as EHardwareVendor).defaultDeviceName || fallback
  );
}

function getToastLabel(
  action: string | undefined,
  _vendor: string,
  intl: IntlShape,
): string {
  switch (action) {
    case EThirdPartyHardwareUiAction.openApp:
      return intl.formatMessage({
        id: ETranslations.hardware_third_party_app_not_open,
      });
    case EThirdPartyHardwareUiAction.unlockDevice:
      return intl.formatMessage({
        id: ETranslations.hardware_third_party_device_locked,
      });
    case EThirdPartyHardwareUiAction.searching:
      return intl.formatMessage({
        id: ETranslations.hardware_searching_for_device,
      });
    case EThirdPartyHardwareUiAction.confirmOnDevice:
    default:
      return intl.formatMessage({
        id: ETranslations.global_confirm_on_device,
      });
  }
}

function getLedgerActionAnimation(
  action: string | undefined,
  themeVariant: 'light' | 'dark',
): ILottieViewProps['source'] | null {
  switch (action) {
    case EThirdPartyHardwareUiAction.confirmOnDevice:
    case EThirdPartyHardwareUiAction.openApp:
      return themeVariant === 'dark'
        ? (require('@onekeyhq/kit/assets/animations/confirm-on-ledger-dark.json') as ILottieViewProps['source'])
        : (require('@onekeyhq/kit/assets/animations/confirm-on-ledger-light.json') as ILottieViewProps['source']);
    case EThirdPartyHardwareUiAction.unlockDevice:
      return themeVariant === 'dark'
        ? (require('@onekeyhq/kit/assets/animations/enter-pin-on-ledger-dark.json') as ILottieViewProps['source'])
        : (require('@onekeyhq/kit/assets/animations/enter-pin-on-ledger-light.json') as ILottieViewProps['source']);
    default:
      return null;
  }
}

function DeviceActionToast({
  action,
  vendor,
  onCloseByUser,
}: {
  action?: string;
  vendor: string;
  onCloseByUser: () => void;
}) {
  const intl = useIntl();
  const [showCloseButton, setShowCloseButton] = useState(false);
  const themeVariant = useThemeVariant();

  useEffect(() => {
    setShowCloseButton(false);
    const timer = setTimeout(
      () => setShowCloseButton(true),
      SHOW_CLOSE_BUTTON_DELAY,
    );
    return () => clearTimeout(timer);
  }, [action, vendor]);

  const label = getToastLabel(action, vendor, intl);

  const animationSource = useMemo(() => {
    if (vendor !== EHardwareVendor.ledger) return null;
    return getLedgerActionAnimation(action, themeVariant);
  }, [action, vendor, themeVariant]);

  return (
    <XStack alignItems="center">
      <Stack
        bg="$bgStrong"
        btlr="$2"
        bblr="$2"
        w={72}
        h={72}
        alignItems="center"
        justifyContent="center"
        overflow="hidden"
      >
        {animationSource ? (
          <LottieView
            autoPlay
            loop
            width="100%"
            height="100%"
            resizeMode="cover"
            source={animationSource}
          />
        ) : (
          <Icon name="CheckboxOutline" size="$10" color="$iconSubdued" />
        )}
      </Stack>
      <XStack flex={1} alignItems="center" px="$3" gap="$5">
        <SizableText flex={1} size="$bodyLgMedium">
          {label}
        </SizableText>
        <Stack minWidth="$8">
          {showCloseButton ? (
            <IconButton
              testID="third-party-hw-ui-close-btn"
              size="small"
              icon="CrossedSmallOutline"
              onPress={onCloseByUser}
            />
          ) : null}
        </Stack>
      </XStack>
    </XStack>
  );
}

function getDialogContent(
  state: IThirdPartyHardwareUiState,
  intl: IntlShape,
): {
  title: string;
  message: string;
  showFooter: boolean;
} {
  const { action, payload, vendor } = state;
  const device = getDeviceLabel(vendor);

  switch (action) {
    case EThirdPartyHardwareUiAction.requestDeviceNotFound:
      // TODO: replace with ETranslations + ICU {device} placeholder when available
      return {
        title: `Connect ${device}`,
        message:
          payload?.message ||
          `Please connect and unlock your ${device} device, then press Confirm.`,
        showFooter: true,
      };
    case EThirdPartyHardwareUiAction.requestBtcHighIndexConfirm:
      return {
        title: intl.formatMessage({
          id: ETranslations.hardware_third_party_btc_high_index_confirm_title,
        }),
        message: intl.formatMessage(
          {
            id: ETranslations.hardware_third_party_btc_high_index_confirm_desc,
          },
          {
            path: payload?.path ?? '',
            accountIndex: payload?.accountIndex ?? '',
          },
        ),
        showFooter: true,
      };
    default:
      return { title: '', message: '', showFooter: false };
  }
}

function ThirdPartyHardwareUiStateContainerCmp() {
  const intl = useIntl();
  const [uiState] = useThirdPartyHardwareUiStateAtom();
  const uiStateRef = useRef(uiState);
  uiStateRef.current = uiState;

  const dialogInstanceRef = useRef<IDialogInstance | null>(null);
  const permissionDialogInstanceRef = useRef<IDialogInstance | null>(null);
  const installDialogInstanceRef = useRef<IDialogInstance | null>(null);
  // Deferred-close timer so a rapid next-chain request reuses the same dialog.
  const installCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const toastInstanceRef = useRef<IShowToasterInstance | null>(null);

  const [appInstallState] = useThirdPartyAppInstallAtom();

  // Open/close the install dialog as the atom appears/clears; reuse + deferred
  // close keep a single dialog across chains (no overlap). Content reads the atom.
  useEffect(() => {
    if (appInstallState) {
      // reuse the open dialog; cancel any pending close
      if (installCloseTimerRef.current) {
        clearTimeout(installCloseTimerRef.current);
        installCloseTimerRef.current = null;
      }
      if (!installDialogInstanceRef.current) {
        const instance = Dialog.show({
          icon: 'DownloadOutline',
          renderContent: <InstallAppDialogContent />,
          showFooter: false,
          dismissOnOverlayPress: false,
          disableDrag: true,
          // No chrome dismiss (header X / Android back): those bypass the
          // SDK response and hang it. All exits are in-content, state-aware:
          // confirm → Cancel (sends decline); installing → abort after delay.
          showExitButton: false,
          disableSystemClose: true,
          // stale onClose (fires after close animation) may run once the ref
          // moved on — only null if it still points to this instance
          onClose: async () => {
            if (installDialogInstanceRef.current === instance) {
              installDialogInstanceRef.current = null;
            }
          },
        });
        installDialogInstanceRef.current = instance;
      }
    } else if (
      installDialogInstanceRef.current &&
      !installCloseTimerRef.current
    ) {
      // defer close so a rapid next-chain request reuses this dialog
      installCloseTimerRef.current = setTimeout(() => {
        installCloseTimerRef.current = null;
        void installDialogInstanceRef.current?.close();
        installDialogInstanceRef.current = null;
      }, 250);
    }
  }, [appInstallState]);

  // Clear the deferred-close timer on unmount.
  useEffect(
    () => () => {
      if (installCloseTimerRef.current) {
        clearTimeout(installCloseTimerRef.current);
        installCloseTimerRef.current = null;
      }
    },
    [],
  );

  const isToastAction = isThirdPartyToastAction(uiState?.action);
  const isDialogAction = !!uiState && !isToastAction;

  // Programmatic closes pass autoClosed; unflagged closes come from user exits.
  const handleToastClose = useCallback(async () => undefined, []);

  const clearCurrentUiState = useCallback(async () => {
    uiStateRef.current = undefined;
    await thirdPartyHardwareUiStateAtom.set(undefined);
  }, []);

  const handleDialogClose = useCallback(
    async (params?: { flag?: string }) => {
      if (params?.flag === AUTO_CLOSED_FLAG) {
        await clearCurrentUiState();
        return;
      }
      await cancelThirdPartyHardwareUiRequest({
        state: uiStateRef.current,
        uiResponse: (requestParams) =>
          backgroundApiProxy.serviceHardware.thirdPartyHardwareUiResponse(
            requestParams,
          ),
        cancel: (requestParams) =>
          backgroundApiProxy.serviceHardware.thirdPartyHardwareCancel(
            requestParams,
          ),
        clearState: clearCurrentUiState,
      });
    },
    [clearCurrentUiState],
  );

  const handlePermissionDialogClose = useCallback(async () => {
    await clearCurrentUiState();
  }, [clearCurrentUiState]);

  useEffect(() => {
    const callback = async ({
      vendor,
      reason,
    }: {
      vendor: EHardwareVendor;
      reason: EThirdPartyDevicePermissionDeniedReason;
    }) => {
      if (vendor !== EHardwareVendor.ledger) {
        return;
      }
      await permissionDialogInstanceRef.current?.close();
      permissionDialogInstanceRef.current = Dialog.show({
        dialogContainer:
          reason === EThirdPartyDevicePermissionDeniedReason.bluetoothTurnedOff
            ? OpenBleSettingsDialogRender
            : RequireBlePermissionDialogRender,
        onClose: handlePermissionDialogClose,
      });
    };
    appEventBus.on(
      EAppEventBusNames.ShowThirdPartyHardwarePermissionDialog,
      callback,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.ShowThirdPartyHardwarePermissionDialog,
        callback,
      );
    };
  }, [handlePermissionDialogClose]);

  // Bare-device core-app install dialog, triggered from the account-selector
  // state layer via event bus (keeps that layer decoupled from this UI).
  useEffect(() => {
    const callback = ({ walletId }: { walletId: string }) => {
      void showLedgerInstallCoreAppsDialog({ walletId });
    };
    appEventBus.on(EAppEventBusNames.ShowLedgerInstallCoreApps, callback);
    return () => {
      appEventBus.off(EAppEventBusNames.ShowLedgerInstallCoreApps, callback);
    };
  }, []);

  const handleUserCancel = useCallback(
    async (close: () => Promise<void>) => {
      await cancelThirdPartyHardwareUiRequest({
        state: uiStateRef.current,
        uiResponse: (requestParams) =>
          backgroundApiProxy.serviceHardware.thirdPartyHardwareUiResponse(
            requestParams,
          ),
        cancel: (requestParams) =>
          backgroundApiProxy.serviceHardware.thirdPartyHardwareCancel(
            requestParams,
          ),
        clearState: clearCurrentUiState,
      });
      await close();
    },
    [clearCurrentUiState],
  );

  const handleConfirm = useCallback(async () => {
    const vendor = uiStateRef.current?.vendor;
    const action = uiStateRef.current?.action;
    if (vendor) {
      const response = buildThirdPartyHardwareUiResponse(action, true);
      if (response) {
        await backgroundApiProxy.serviceHardware.thirdPartyHardwareUiResponse({
          vendor,
          response,
        });
      }
    }
    await clearCurrentUiState();
  }, [clearCurrentUiState]);

  const dialogContent = useMemo(() => {
    if (!uiState || isToastAction) return null;
    const { message } = getDialogContent(uiState, intl);
    return (
      <YStack>
        <SizableText size="$bodyMd" color="$textSubdued">
          {message}
        </SizableText>
      </YStack>
    );
  }, [uiState, isToastAction, intl]);

  const dialogTitle = useMemo(() => {
    if (!uiState || isToastAction) return '';
    return getDialogContent(uiState, intl).title;
  }, [uiState, isToastAction, intl]);

  const showFooter = useMemo(() => {
    if (!uiState || isToastAction) return false;
    return getDialogContent(uiState, intl).showFooter;
  }, [uiState, isToastAction, intl]);

  const handleToastUserClose = useCallback(async () => {
    const vendor = uiStateRef.current?.vendor;
    try {
      if (vendor) {
        await backgroundApiProxy.serviceHardware.thirdPartyHardwareCancel({
          vendor,
        });
      }
    } finally {
      await clearCurrentUiState();
    }
  }, [clearCurrentUiState]);

  return (
    <>
      <Portal.Body container={Portal.Constant.TOASTER_OVERLAY_PORTAL}>
        <ShowCustom
          ref={toastInstanceRef}
          name={TOAST_VIEWPORT_NAME}
          open={isToastAction}
          dismissOnOverlayPress={false}
          disableSwipeGesture
          onClose={handleToastClose}
        >
          <DeviceActionToast
            action={uiState?.action}
            vendor={uiState?.vendor ?? ''}
            onCloseByUser={handleToastUserClose}
          />
        </ShowCustom>
      </Portal.Body>

      <Portal.Body container={Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL}>
        {isDialogAction ? (
          <DialogContainer
            ref={dialogInstanceRef}
            open={isDialogAction}
            title={dialogTitle}
            renderContent={dialogContent}
            dismissOnOverlayPress={false}
            disableDrag
            showFooter={showFooter}
            onConfirm={handleConfirm}
            onCancel={handleUserCancel}
            onClose={handleDialogClose}
          />
        ) : null}
      </Portal.Body>
    </>
  );
}

export const ThirdPartyHardwareUiStateContainer = memo(
  ThirdPartyHardwareUiStateContainerCmp,
);
