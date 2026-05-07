import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { UI_RESPONSE } from '@onekeyfe/hwk-adapter-core';
import { useIntl } from 'react-intl';

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
import type { IAdapterUiResponse } from '@onekeyhq/kit-bg/src/services/ServiceHardware/adapters/types';
import type { IThirdPartyHardwareUiState } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EThirdPartyHardwareUiAction,
  isThirdPartyToastAction,
  thirdPartyHardwareUiStateAtom,
  useThirdPartyHardwareUiStateAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getVendorProfile } from '@onekeyhq/shared/src/hardware/vendorProfile';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useThemeVariant } from '../../../hooks/useThemeVariant';

import type { IntlShape } from 'react-intl';

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
}: {
  action?: string;
  vendor: string;
}) {
  const intl = useIntl();
  const [showCloseButton, setShowCloseButton] = useState(false);
  const themeVariant = useThemeVariant();

  useEffect(() => {
    const timer = setTimeout(
      () => setShowCloseButton(true),
      SHOW_CLOSE_BUTTON_DELAY,
    );
    return () => clearTimeout(timer);
  }, []);

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
    // open-app, searching, unlock-device, confirm-on-device → handled by Toast
    // error → let withHardwareProcessing handle it, no separate dialog
    default:
      return { title: '', message: '', showFooter: false };
  }
}

// Actions that need confirm/cancel footer (blocking requests)
const REQUEST_ACTIONS = new Set([
  EThirdPartyHardwareUiAction.requestDeviceNotFound,
  EThirdPartyHardwareUiAction.requestBtcHighIndexConfirm,
]);

// ---------------------------------------------------------------------------
// Container
// ---------------------------------------------------------------------------

function ThirdPartyHardwareUiStateContainerCmp() {
  const intl = useIntl();
  const [uiState] = useThirdPartyHardwareUiStateAtom();
  const uiStateRef = useRef(uiState);
  uiStateRef.current = uiState;

  const dialogInstanceRef = useRef<IDialogInstance | null>(null);
  const toastInstanceRef = useRef<IShowToasterInstance | null>(null);

  const isToastAction = isThirdPartyToastAction(uiState?.action);
  const isDialogAction = !!uiState && !isToastAction;

  // Toast / Dialog onClose are passive notifications only — they fire on every
  // open=false transition (atom programmatic change, Confirm-driven clear,
  // user dismiss, Esc, etc.) and Tamagui gives us no way to distinguish them.
  // The "user-actually-cancelled" contract is bound to the explicit footer
  // Cancel button (handleUserCancel) instead, which is the only path allowed
  // to call thirdPartyHardwareCancel. This keeps programmatic atom transitions
  // (handleConfirm clearing atom, SDK driving ui-state changes) from
  // accidentally rejecting an in-flight SDK _uiRegistry.wait.
  const handleToastClose = useCallback(async () => {
    // intentional no-op
  }, []);

  const handleDialogClose = useCallback(async (params?: { flag?: string }) => {
    if (params?.flag === AUTO_CLOSED_FLAG) {
      await thirdPartyHardwareUiStateAtom.set(undefined);
    }
    // intentional no-op for any other source — see comment above.
  }, []);

  const buildUiResponse = useCallback(
    (
      action: EThirdPartyHardwareUiAction | undefined,
      confirmed: boolean,
    ): IAdapterUiResponse | null => {
      switch (action) {
        case EThirdPartyHardwareUiAction.requestDeviceNotFound:
          return {
            type: UI_RESPONSE.RECEIVE_DEVICE_CONNECT,
            payload: { confirmed },
          };
        case EThirdPartyHardwareUiAction.requestBtcHighIndexConfirm:
          return {
            type: UI_RESPONSE.RECEIVE_BTC_HIGH_INDEX_CONFIRM,
            payload: { confirmed },
          };
        default:
          return null;
      }
    },
    [],
  );

  const handleUserCancel = useCallback(
    async (close: () => Promise<void>) => {
      const vendor = uiStateRef.current?.vendor;
      const action = uiStateRef.current?.action;
      if (vendor) {
        const response = buildUiResponse(action, false);
        if (response) {
          await backgroundApiProxy.serviceHardware.thirdPartyHardwareUiResponse(
            { vendor, response },
          );
        } else {
          await backgroundApiProxy.serviceHardware.thirdPartyHardwareCancel({
            vendor,
          });
        }
      }
      await thirdPartyHardwareUiStateAtom.set(undefined);
      await close();
    },
    [buildUiResponse],
  );

  const handleConfirm = useCallback(async () => {
    const vendor = uiStateRef.current?.vendor;
    const action = uiStateRef.current?.action;
    if (vendor) {
      const response = buildUiResponse(action, true);
      if (response) {
        await backgroundApiProxy.serviceHardware.thirdPartyHardwareUiResponse({
          vendor,
          response,
        });
      }
    }
    await thirdPartyHardwareUiStateAtom.set(undefined);
  }, [buildUiResponse]);

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
          onClose={handleToastClose}
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
