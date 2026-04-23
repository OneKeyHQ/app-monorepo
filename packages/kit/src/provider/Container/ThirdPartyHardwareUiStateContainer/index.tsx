import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  DialogContainer,
  Icon,
  IconButton,
  LottieView,
  Portal,
  SizableText,
  Stack,
  Toast,
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
  thirdPartyHardwareUiStateAtom,
  useThirdPartyHardwareUiStateAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getVendorProfile } from '@onekeyhq/shared/src/hardware/vendorProfile';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useThemeVariant } from '../../../hooks/useThemeVariant';

const AUTO_CLOSED_FLAG = 'autoClosed';
const SHOW_CLOSE_BUTTON_DELAY = 8000;
const TOAST_VIEWPORT_NAME = 'THIRD_PARTY_HW_TOAST';

// ---------------------------------------------------------------------------
// Toast content for "confirm on device" — no Lottie, simple icon + text
// ---------------------------------------------------------------------------

function getDeviceLabel(vendor: string | undefined): string {
  const fallback = 'Device';
  if (!vendor) return fallback;
  return (
    getVendorProfile(vendor as EHardwareVendor).defaultDeviceName || fallback
  );
}

function getToastLabel(action: string | undefined, _vendor: string): string {
  switch (action) {
    case EThirdPartyHardwareUiAction.openApp:
      return appLocale.intl.formatMessage({
        id: ETranslations.hardware_third_party_app_not_installed,
      });
    case EThirdPartyHardwareUiAction.unlockDevice:
      return appLocale.intl.formatMessage({
        id: ETranslations.hardware_third_party_device_locked,
      });
    case EThirdPartyHardwareUiAction.searching:
      return appLocale.intl.formatMessage({
        id: ETranslations.hardware_searching_for_device,
      });
    case EThirdPartyHardwareUiAction.confirmOnDevice:
    default:
      return appLocale.intl.formatMessage({
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
}: {
  action?: string;
  vendor: string;
}) {
  const [showCloseButton, setShowCloseButton] = useState(false);
  const themeVariant = useThemeVariant();

  useEffect(() => {
    const timer = setTimeout(
      () => setShowCloseButton(true),
      SHOW_CLOSE_BUTTON_DELAY,
    );
    return () => clearTimeout(timer);
  }, []);

  const label = getToastLabel(action, vendor);

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
            <Toast.Close>
              <IconButton size="small" icon="CrossedSmallOutline" />
            </Toast.Close>
          ) : null}
        </Stack>
      </XStack>
    </XStack>
  );
}

// ---------------------------------------------------------------------------
// Dialog content config
// ---------------------------------------------------------------------------

function getDialogContent(state: IThirdPartyHardwareUiState): {
  title: string;
  message: string;
  showFooter: boolean;
} {
  const { action, payload, vendor } = state;
  const device = getDeviceLabel(vendor);

  switch (action) {
    case EThirdPartyHardwareUiAction.requestUnlock:
      // TODO: replace with ETranslations + ICU {device} placeholder when available
      return {
        title: `Connect ${device}`,
        message:
          payload?.message ||
          `Please connect and unlock your ${device} device, then press Confirm.`,
        showFooter: true,
      };
    // open-app, searching, unlock-device, confirm-on-device → handled by Toast
    // error → let withHardwareProcessing handle it, no separate dialog
    default:
      return { title: '', message: '', showFooter: false };
  }
}

// Actions that need confirm/cancel footer (blocking requests)
const REQUEST_ACTIONS = new Set([EThirdPartyHardwareUiAction.requestUnlock]);

// ---------------------------------------------------------------------------
// Container
// ---------------------------------------------------------------------------

function ThirdPartyHardwareUiStateContainerCmp() {
  const [uiState] = useThirdPartyHardwareUiStateAtom();
  const uiStateRef = useRef(uiState);
  uiStateRef.current = uiState;

  const dialogInstanceRef = useRef<IDialogInstance | null>(null);
  const toastInstanceRef = useRef<IShowToasterInstance | null>(null);

  const isToastAction = isThirdPartyToastAction(uiState?.action);
  const isDialogAction = !!uiState && !isToastAction;

  const handleClose = useCallback(async (params?: { flag?: string }) => {
    if (params?.flag !== AUTO_CLOSED_FLAG) {
      const vendor = uiStateRef.current?.vendor;
      if (vendor) {
        await backgroundApiProxy.serviceHardware.thirdPartyHardwareUiResponse({
          vendor,
          type: 'cancel',
        });
      }
    }
    await thirdPartyHardwareUiStateAtom.set(undefined);
  }, []);

  const handleConfirm = useCallback(async () => {
    const vendor = uiStateRef.current?.vendor;
    if (vendor) {
      await backgroundApiProxy.serviceHardware.thirdPartyHardwareUiResponse({
        vendor,
        type: 'confirm',
      });
    }
    await thirdPartyHardwareUiStateAtom.set(undefined);
  }, []);

  const dialogContent = useMemo(() => {
    if (!uiState || isToastAction) return null;
    const { message } = getDialogContent(uiState);
    return (
      <YStack>
        <SizableText size="$bodyMd" color="$textSubdued">
          {message}
        </SizableText>
      </YStack>
    );
  }, [uiState, isToastAction]);

  const dialogTitle = useMemo(() => {
    if (!uiState || isToastAction) return '';
    return getDialogContent(uiState).title;
  }, [uiState, isToastAction]);

  const showFooter = useMemo(() => {
    if (!uiState) return false;
    return REQUEST_ACTIONS.has(uiState.action);
  }, [uiState]);

  return (
    <>
      {/* Toast for "confirm on device" */}
      <Portal.Body container={Portal.Constant.TOASTER_OVERLAY_PORTAL}>
        <ShowCustom
          ref={toastInstanceRef}
          name={TOAST_VIEWPORT_NAME}
          open={isToastAction}
          dismissOnOverlayPress={false}
          disableSwipeGesture
          onClose={handleClose}
        >
          <DeviceActionToast
            action={uiState?.action}
            vendor={uiState?.vendor ?? ''}
          />
        </ShowCustom>
      </Portal.Body>

      {/* Dialog for everything else */}
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
            onClose={handleClose}
          />
        ) : null}
      </Portal.Body>
    </>
  );
}

export const ThirdPartyHardwareUiStateContainer = memo(
  ThirdPartyHardwareUiStateContainerCmp,
);
