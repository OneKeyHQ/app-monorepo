import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type IntlShape, useIntl } from 'react-intl';

import { UI_RESPONSE } from '@onekeyfe/hwk-adapter-core';

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

import {
  buildThirdPartyHardwareUiResponse,
  cancelThirdPartyHardwareUiRequest,
} from './utils';

const AUTO_CLOSED_FLAG = 'autoClosed';
const SHOW_CLOSE_BUTTON_DELAY = 8000;
const TOAST_VIEWPORT_NAME = 'THIRD_PARTY_HW_TOAST';

function OpenBleSettingsDialogRender({ ref }: { ref: any }) {
  return <OpenBleSettingsDialog ref={ref} />;
}

function RequireBlePermissionDialogRender({ ref }: { ref: any }) {
  return <RequireBlePermissionDialog ref={ref} />;
}

// Standalone install dialog (shown imperatively, like the BLE permission
// dialog) so it coexists with device-prompt toasts. Reads the dedicated
// install atom: no progress = confirm step; progress = installing. Buttons
// live in the content (showFooter=false) so confirm doesn't auto-close — the
// SDK keeps the dialog up through install and clears the atom when done.
function InstallAppDialog({ ref }: { ref: any }) {
  const intl = useIntl();
  const [state] = useThirdPartyAppInstallAtom();
  const appName = state?.appName ?? '';
  const vendor = state?.vendor;
  const progress = state?.progress;
  const installing = progress != null;

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

  const onCancel = useCallback(async () => {
    try {
      await sendResponse(false);
    } finally {
      await thirdPartyAppInstallAtom.set(undefined);
    }
  }, [sendResponse]);

  const content = (
    <YStack gap="$4">
      <SizableText size="$bodyMd" color="$textSubdued">
        {installing
          ? intl.formatMessage({ id: ETranslations.global_confirm_on_device })
          : `"${appName}" is not installed. Install it now?`}
      </SizableText>
      {installing ? (
        <Progress animated value={Math.round((progress ?? 0) * 100)} w="100%" />
      ) : (
        <XStack gap="$3" justifyContent="flex-end">
          <Button onPress={onCancel}>
            {intl.formatMessage({ id: ETranslations.global_cancel })}
          </Button>
          <Button variant="primary" onPress={() => void sendResponse(true)}>
            {intl.formatMessage({ id: ETranslations.global_install })}
          </Button>
        </XStack>
      )}
    </YStack>
  );

  return (
    <DialogContainer
      ref={ref}
      title={
        installing ? `Installing ${appName}` : `Install ${appName}`
      }
      renderContent={content}
      showFooter={false}
      dismissOnOverlayPress={false}
      disableDrag
      onClose={async () => undefined}
    />
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
  const toastInstanceRef = useRef<IShowToasterInstance | null>(null);

  const [appInstallState] = useThirdPartyAppInstallAtom();

  // Show/close the standalone install dialog as the dedicated install atom
  // appears/clears. Progress updates re-render the dialog from inside (it reads
  // the atom), so this effect only manages open/close, not content.
  useEffect(() => {
    if (appInstallState && !installDialogInstanceRef.current) {
      installDialogInstanceRef.current = Dialog.show({
        dialogContainer: InstallAppDialog,
        onClose: async () => {
          installDialogInstanceRef.current = null;
        },
      });
    } else if (!appInstallState && installDialogInstanceRef.current) {
      void installDialogInstanceRef.current.close();
      installDialogInstanceRef.current = null;
    }
  }, [appInstallState]);

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
