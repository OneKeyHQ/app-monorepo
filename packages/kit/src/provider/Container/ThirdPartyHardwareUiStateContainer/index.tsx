import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { UI_RESPONSE } from '@onekeyfe/hwk-adapter-core/ui-events';
import { type IntlShape, useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  DialogContainer,
  Icon,
  IconButton,
  Input,
  LottieView,
  Portal,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IDialogInstance, ILottieViewProps } from '@onekeyhq/components';
import type { IShowToasterInstance } from '@onekeyhq/components/src/actions/Toast/ShowCustom';
import { ShowCustom } from '@onekeyhq/components/src/actions/Toast/ShowCustom';
import type {
  IThirdPartyBatchInstallState,
  IThirdPartyHardwareUiState,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EThirdPartyHardwareUiAction,
  isThirdPartyToastAction,
  thirdPartyAppInstallAtom,
  thirdPartyBatchInstallAtom,
  thirdPartyHardwareUiStateAtom,
  useThirdPartyAppInstallAtom,
  useThirdPartyBatchInstallAtom,
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
import { EnterPhase } from '../../../components/Hardware/Hardware';
import {
  OpenBleSettingsDialog,
  RequireBlePermissionDialog,
} from '../../../components/Hardware/HardwareDialog';
import { showTrezorBleBindingDialog } from '../../../components/Hardware/TrezorBleBindingDialog';
import { useThemeVariant } from '../../../hooks/useThemeVariant';

import { useInstallCancelVisibility } from './installCancelVisibility';
import {
  buildThirdPartyHardwareUiResponse,
  cancelThirdPartyHardwareUiRequest,
  clearThirdPartyHardwareUiStateIfCurrent,
  createTrezorBleBindingDialogCallbacks,
} from './utils';

const AUTO_CLOSED_FLAG = 'autoClosed';
const SHOW_CLOSE_BUTTON_DELAY = 8000;
const TOAST_VIEWPORT_NAME = 'THIRD_PARTY_HW_TOAST';
const TREZOR_THP_APP_NAME = 'OneKey Wallet';

function OpenBleSettingsDialogRender({ ref }: { ref: any }) {
  return <OpenBleSettingsDialog ref={ref} />;
}

function RequireBlePermissionDialogRender({ ref }: { ref: any }) {
  return <RequireBlePermissionDialog ref={ref} />;
}

type IInstallView = {
  appName: string;
  vendor?: EHardwareVendor;
  phase: 'idle' | 'confirm' | 'installing' | 'completing';
  percent: number;
};

const INITIAL_VIEW: IInstallView = {
  appName: '',
  phase: 'idle',
  percent: 0,
};

function InlineProgressBar({
  percent,
  size = 'small',
}: {
  percent: number;
  size?: 'small' | 'medium';
}) {
  const trackHeight = size === 'medium' ? '$1' : '$0.5';
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <Stack
      h={trackHeight}
      bg="$neutral5"
      borderRadius="$full"
      overflow="hidden"
      w="100%"
    >
      <Stack
        h="100%"
        width={`${clamped}%`}
        bg="$bgPrimary"
        animation="quick"
        animateOnly={['width']}
      />
    </Stack>
  );
}

function getChecklistRowStyle(isDone: boolean, isActive: boolean) {
  if (isDone) {
    return {
      iconName: 'CheckRadioSolid',
      iconColor: '$iconSuccess',
      textColor: '$text',
    } as const;
  }
  if (isActive) {
    return {
      iconName: 'CirclePlaceholderOnSolid',
      iconColor: '$icon',
      textColor: '$text',
    } as const;
  }
  return {
    iconName: 'CirclePlaceholderOnOutline',
    iconColor: '$iconDisabled',
    textColor: '$textDisabled',
  } as const;
}

function BatchInstallChecklist({
  batch,
  activePercent,
}: {
  batch: IThirdPartyBatchInstallState;
  activePercent: number;
}) {
  const { queue, currentIndex } = batch;
  return (
    <YStack gap="$3" p="$4" borderRadius="$3" bg="$bgSubdued">
      {queue.map((appName, idx) => {
        const isDone = idx < currentIndex;
        const isActive = idx === currentIndex;
        const { iconName, iconColor, textColor } = getChecklistRowStyle(
          isDone,
          isActive,
        );
        return (
          <YStack key={appName} gap="$2">
            <XStack alignItems="center" gap="$3">
              <Icon name={iconName} size="$6" color={iconColor} />
              <SizableText flex={1} size="$bodyLgMedium" color={textColor}>
                {appName}
              </SizableText>
              {isActive ? (
                <SizableText size="$bodyMdMedium" color="$textSubdued">
                  {`${activePercent}%`}
                </SizableText>
              ) : null}
            </XStack>
            {isActive ? (
              <InlineProgressBar percent={activePercent} size="small" />
            ) : null}
          </YStack>
        );
      })}
    </YStack>
  );
}

function InstallAppDialogContent() {
  const intl = useIntl();
  const [state] = useThirdPartyAppInstallAtom();
  const [batch] = useThirdPartyBatchInstallAtom();

  const [view, setView] = useState<IInstallView>(INITIAL_VIEW);
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    if (state?.progress !== undefined) {
      const raw = Math.round(state.progress * 100);
      const prev = viewRef.current;
      const watermark =
        prev.phase === 'installing' && prev.appName === state.appName
          ? prev.percent
          : 0;
      setView({
        appName: state.appName,
        vendor: state.vendor,
        phase: 'installing',
        percent: Math.min(99, Math.max(watermark, raw)),
      });
    } else if (state) {
      setView({
        appName: state.appName,
        vendor: state.vendor,
        phase: 'confirm',
        percent: 0,
      });
    } else if (viewRef.current.phase === 'installing') {
      setView({ ...viewRef.current, phase: 'completing', percent: 100 });
    }
  }, [state]);

  const { appName, vendor, phase, percent } = view;
  const installing = phase === 'installing' || phase === 'completing';
  const inBatch = !!batch;

  // Key mutates whenever the active app or its progress advances; the hook
  // resets its watchdog on every change and only reveals cancel once
  // progress has stalled.
  const installProgressKey = `${vendor ?? ''}:${appName}:${percent}`;

  const showInstallCancel = useInstallCancelVisibility({
    installing: phase === 'installing',
    progressKey: installProgressKey,
  });

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
      await thirdPartyBatchInstallAtom.set(undefined);
    }
  }, [sendResponse]);

  const onAbortInstall = useCallback(async () => {
    try {
      if (vendor) {
        await backgroundApiProxy.serviceHardware.thirdPartyHardwareCancel({
          vendor,
        });
      }
    } finally {
      await thirdPartyAppInstallAtom.set(undefined);
      await thirdPartyBatchInstallAtom.set(undefined);
    }
  }, [vendor]);

  if (!appName && !inBatch) {
    return null;
  }

  const titleText = (() => {
    if (inBatch) {
      return intl.formatMessage({ id: ETranslations.global_get_started });
    }
    return intl.formatMessage(
      {
        id: installing
          ? ETranslations.hardware_third_party_install_app_in_progress__title
          : ETranslations.hardware_third_party_install_app__title,
      },
      { appName },
    );
  })();

  const subtitleText = (() => {
    if (inBatch) {
      return intl.formatMessage({
        id: ETranslations.hardware_third_party_app_install_required_desc,
      });
    }
    if (installing) {
      return intl.formatMessage({ id: ETranslations.global_processing });
    }
    return intl.formatMessage(
      { id: ETranslations.hardware_third_party_install_app__desc },
      { appName },
    );
  })();

  let body: ReactNode;
  if (inBatch) {
    body = <BatchInstallChecklist batch={batch} activePercent={percent} />;
  } else if (installing) {
    body = (
      <YStack gap="$3" p="$4" borderRadius="$3" bg="$bgSubdued">
        <XStack justifyContent="space-between" alignItems="center">
          <SizableText size="$bodyLgMedium">{appName}</SizableText>
          <SizableText size="$bodyMdMedium" color="$textSubdued">
            {`${percent}%`}
          </SizableText>
        </XStack>
        <InlineProgressBar percent={percent} size="medium" />
      </YStack>
    );
  } else {
    body = (
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
    );
  }

  return (
    <YStack gap="$6" pt="$2">
      <XStack justifyContent="space-between" alignItems="flex-start" gap="$3">
        <YStack gap="$2" flex={1}>
          <SizableText size="$heading2xl">{titleText}</SizableText>
          <SizableText size="$bodyLg" color="$textSubdued">
            {subtitleText}
          </SizableText>
        </YStack>
        {phase === 'installing' && showInstallCancel ? (
          <IconButton
            testID="third-party-hw-install-abort-btn"
            size="small"
            icon="CrossedSmallOutline"
            onPress={onAbortInstall}
          />
        ) : null}
      </XStack>
      {body}
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
    case EThirdPartyHardwareUiAction.requestTrezorUnlock:
      return intl.formatMessage({
        id: ETranslations.hardware_third_party_device_locked,
      });
    case EThirdPartyHardwareUiAction.searching:
      return intl.formatMessage({
        id: ETranslations.hardware_searching_for_device,
      });
    case EThirdPartyHardwareUiAction.connecting:
      return intl.formatMessage({ id: ETranslations.connecting_your_device });
    case EThirdPartyHardwareUiAction.processing:
      return intl.formatMessage({ id: ETranslations.global_processing });
    case EThirdPartyHardwareUiAction.done:
      return intl.formatMessage({ id: ETranslations.global_done });
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
    case EThirdPartyHardwareUiAction.requestTrezorThpPairing:
      // Temporary ETranslationsMock copy until real i18n keys land.
      return {
        title: intl.formatMessage({
          id: ETranslations.trezor_thp_pairing__title,
        }),
        message: intl.formatMessage(
          { id: ETranslations.trezor_thp_pairing__desc },
          { appName: TREZOR_THP_APP_NAME, device },
        ),
        showFooter: true,
      };
    case EThirdPartyHardwareUiAction.requestTrezorPassphrase:
      return {
        title: intl.formatMessage({
          id: payload?.passphraseState
            ? ETranslations.global_enter_passphrase
            : ETranslations.global_add_hidden_wallet,
        }),
        message: '',
        showFooter: false,
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

  // Trezor THP pairing tag — user types the code shown on the device. UI
  // value; held in state so the Input is controlled. Ref mirror keeps
  // handleConfirm (declared above the JSX) able to read the latest value
  // without re-creating the callback on every keystroke.
  const [thpTagInput, setThpTagInput] = useState('');
  const thpTagInputRef = useRef('');
  thpTagInputRef.current = thpTagInput;

  // Clear the input whenever a new request comes in (different connect
  // attempt) or the request closes. Only fires when action changes —
  // typing in the same dialog doesn't reset.
  const currentAction = uiState?.action;
  useEffect(() => {
    if (currentAction !== EThirdPartyHardwareUiAction.requestTrezorThpPairing) {
      setThpTagInput('');
    }
  }, [currentAction]);

  const dialogInstanceRef = useRef<IDialogInstance | null>(null);
  const bleBindingDialogInstanceRef = useRef<IDialogInstance | null>(null);
  const bleBindingSettledRef = useRef(false);
  const permissionDialogInstanceRef = useRef<IDialogInstance | null>(null);
  const installDialogInstanceRef = useRef<IDialogInstance | null>(null);
  // Deferred-close timer so a rapid next-chain request reuses the same dialog.
  const installCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const toastInstanceRef = useRef<IShowToasterInstance | null>(null);

  const [appInstallState] = useThirdPartyAppInstallAtom();

  const dialogActive = !!appInstallState;
  useEffect(() => {
    if (dialogActive) {
      // reuse the open dialog; cancel any pending close
      if (installCloseTimerRef.current) {
        clearTimeout(installCloseTimerRef.current);
        installCloseTimerRef.current = null;
      }
      if (!installDialogInstanceRef.current) {
        const instance = Dialog.show({
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
  }, [dialogActive]);

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
  const isTrezorBleBinding =
    uiState?.action === EThirdPartyHardwareUiAction.requestTrezorBleBinding;
  const isDialogAction = !!uiState && !isToastAction && !isTrezorBleBinding;

  // Programmatic closes pass autoClosed; unflagged closes come from user exits.
  const handleToastClose = useCallback(async () => undefined, []);

  const clearCurrentUiState = useCallback(async () => {
    const expectedState = uiStateRef.current;
    const cleared = await clearThirdPartyHardwareUiStateIfCurrent({
      expectedState,
      getState: () => thirdPartyHardwareUiStateAtom.get(),
      setState: (state) => thirdPartyHardwareUiStateAtom.set(state),
    });
    uiStateRef.current = cleared
      ? undefined
      : await thirdPartyHardwareUiStateAtom.get();
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
          backgroundApiProxy.serviceThirdPartyHardware.thirdPartyHardwareUiResponse(
            requestParams,
          ),
        cancel: (requestParams) =>
          backgroundApiProxy.serviceThirdPartyHardware.thirdPartyHardwareCancel(
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
    if (!isTrezorBleBinding) {
      return;
    }
    const { usbConnectId, featuresDeviceId, promiseId } =
      uiState?.payload ?? {};
    if (!usbConnectId || !featuresDeviceId || !promiseId) {
      // A malformed request may still carry a promiseId the keyring is awaiting.
      // Resolve it (no binding) so the caller doesn't hang until timeout.
      if (promiseId) {
        void backgroundApiProxy.servicePromise.resolveCallback({
          id: promiseId,
          data: null,
        });
      }
      void clearCurrentUiState();
      return;
    }
    if (bleBindingDialogInstanceRef.current) {
      return;
    }

    bleBindingSettledRef.current = false;
    const callbacks = createTrezorBleBindingDialogCallbacks({
      promiseId,
      dialogInstanceRef: bleBindingDialogInstanceRef,
      settledRef: bleBindingSettledRef,
      resolveCallback: (requestParams) =>
        backgroundApiProxy.servicePromise.resolveCallback(requestParams),
      clearState: clearCurrentUiState,
    });
    const instance = showTrezorBleBindingDialog({
      usbConnectId,
      featuresDeviceId,
      onBound: callbacks.onBound,
      onClose: callbacks.onClose,
    });
    bleBindingDialogInstanceRef.current = instance;
  }, [clearCurrentUiState, isTrezorBleBinding, uiState?.payload]);

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
          backgroundApiProxy.serviceThirdPartyHardware.thirdPartyHardwareUiResponse(
            requestParams,
          ),
        cancel: (requestParams) =>
          backgroundApiProxy.serviceThirdPartyHardware.thirdPartyHardwareCancel(
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
      // THP pairing carries a user-typed tag in the response. Reads the
      // latest tag via ref so this callback identity doesn't change on
      // every keystroke (would re-render the Dialog footer).
      const tag =
        action === EThirdPartyHardwareUiAction.requestTrezorThpPairing
          ? thpTagInputRef.current.trim()
          : undefined;
      // THP pairing needs a non-empty code: an empty tag builds no response, so
      // the SDK would get neither a tag nor a cancel and stall until its 10-min
      // UI timeout. Keep the dialog open instead (Confirm is also disabled for
      // empty input below).
      if (
        action === EThirdPartyHardwareUiAction.requestTrezorThpPairing &&
        !tag
      ) {
        return;
      }
      const response = buildThirdPartyHardwareUiResponse(action, true, { tag });
      if (response) {
        await backgroundApiProxy.serviceThirdPartyHardware.thirdPartyHardwareUiResponse(
          {
            vendor,
            response,
          },
        );
      }
    }
    await clearCurrentUiState();
  }, [clearCurrentUiState]);

  const isThpPairing =
    uiState?.action === EThirdPartyHardwareUiAction.requestTrezorThpPairing;
  const isTrezorPassphrase =
    uiState?.action === EThirdPartyHardwareUiAction.requestTrezorPassphrase;

  const sendTrezorPassphraseResponse = useCallback(
    async ({
      passphrase,
      passphraseOnDevice,
      save,
      hideImmediately,
    }: {
      passphrase?: string;
      passphraseOnDevice: boolean;
      save: boolean;
      hideImmediately: boolean;
    }) => {
      const vendor = uiStateRef.current?.vendor;
      const action = uiStateRef.current?.action;
      if (
        !vendor ||
        action !== EThirdPartyHardwareUiAction.requestTrezorPassphrase
      ) {
        return;
      }
      if (!uiStateRef.current?.payload?.passphraseState) {
        await backgroundApiProxy.serviceSetting.setHiddenWalletImmediately(
          hideImmediately,
        );
      }
      const response = buildThirdPartyHardwareUiResponse(action, true, {
        passphrase,
        passphraseOnDevice,
        save,
      });
      if (response) {
        await backgroundApiProxy.serviceThirdPartyHardware.thirdPartyHardwareUiResponse(
          {
            vendor,
            response,
          },
        );
      }
      await clearCurrentUiState();
    },
    [clearCurrentUiState],
  );

  const dialogContent = useMemo(() => {
    if (!uiState || isToastAction) return null;
    const { message } = getDialogContent(uiState, intl);
    if (isTrezorPassphrase) {
      return (
        <EnterPhase
          isVerifyMode={!!uiState.payload?.passphraseState}
          allowUseAttachPin={false}
          onConfirm={async ({ passphrase, save, hideImmediately }) => {
            await sendTrezorPassphraseResponse({
              passphrase,
              passphraseOnDevice: false,
              save,
              hideImmediately,
            });
          }}
          switchOnDevice={async ({ hideImmediately }) => {
            await sendTrezorPassphraseResponse({
              passphraseOnDevice: true,
              save: true,
              hideImmediately,
            });
          }}
          switchOnDeviceAttachPin={async ({ hideImmediately }) => {
            await sendTrezorPassphraseResponse({
              passphraseOnDevice: true,
              save: true,
              hideImmediately,
            });
          }}
        />
      );
    }
    return (
      <YStack gap="$3">
        <SizableText size="$bodyMd" color="$textSubdued">
          {message}
        </SizableText>
        {isThpPairing ? (
          <Input
            testID="third-party-hw-trezor-thp-pairing-input"
            value={thpTagInput}
            onChangeText={setThpTagInput}
            placeholder={intl.formatMessage({
              id: ETranslations.trezor_thp_pairing_code__desc,
            })}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="number-pad"
            autoFocus
          />
        ) : null}
      </YStack>
    );
  }, [
    uiState,
    isToastAction,
    intl,
    isTrezorPassphrase,
    isThpPairing,
    sendTrezorPassphraseResponse,
    thpTagInput,
  ]);

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
        await backgroundApiProxy.serviceThirdPartyHardware.thirdPartyHardwareCancel(
          {
            vendor,
          },
        );
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
            confirmButtonProps={
              isThpPairing
                ? { disabled: thpTagInput.trim().length === 0 }
                : undefined
            }
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
