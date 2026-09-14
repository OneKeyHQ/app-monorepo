import { useCallback, useRef } from 'react';

import { useIntl } from 'react-intl';
import { Linking } from 'react-native';

import { Dialog, Stack, Toast } from '@onekeyhq/components';
import { HyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import { HARDWARE_BRIDGE_DOWNLOAD_URL } from '@onekeyhq/shared/src/config/appConfig';
import {
  BleLocationServiceError,
  BridgeTimeoutError,
  BridgeTimeoutErrorForDesktop,
  ConnectTimeoutError,
  DeviceBondError,
  DeviceMethodCallTimeout,
  InitIframeLoadFail,
  InitIframeTimeout,
  NeedBluetoothPermissions,
  NeedBluetoothTurnedOn,
  NeedOneKeyBridge,
} from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { shouldContinueOnboardingDeviceScan } from './onboardingDeviceScanErrorUtils';

import type { IntlShape } from 'react-intl';

function BridgeNotInstalledDialogContent(_props: { error: NeedOneKeyBridge }) {
  return (
    <Stack>
      <HyperlinkText
        size="$bodyLg"
        mt="$1.5"
        translationId={
          platformEnv.isSupportWebUSB
            ? ETranslations.device_communication_failed
            : ETranslations.onboarding_install_onekey_bridge_help_text
        }
      />
    </Stack>
  );
}

function isBluetoothSetupError(error: Error) {
  return (
    error instanceof NeedBluetoothTurnedOn ||
    error instanceof NeedBluetoothPermissions ||
    error instanceof BleLocationServiceError
  );
}

function isConnectionTimeoutError(error: Error) {
  return (
    error instanceof BridgeTimeoutError ||
    error instanceof BridgeTimeoutErrorForDesktop ||
    error instanceof ConnectTimeoutError ||
    error instanceof DeviceMethodCallTimeout
  );
}

function showStoppedScanError(error: Error, intl: IntlShape) {
  if (isBluetoothSetupError(error) || error instanceof DeviceBondError) {
    return;
  }
  if (
    error instanceof InitIframeLoadFail ||
    error instanceof InitIframeTimeout
  ) {
    Toast.error({
      title: intl.formatMessage({ id: ETranslations.global_network_error }),
    });
    return;
  }
  if (isConnectionTimeoutError(error)) {
    Toast.error({
      title: intl.formatMessage({ id: ETranslations.global_connection_failed }),
    });
    return;
  }
  if (error instanceof NeedOneKeyBridge) {
    Dialog.confirm({
      icon: 'OnekeyBrand',
      title: intl.formatMessage({
        id: ETranslations.onboarding_install_onekey_bridge,
      }),
      renderContent: <BridgeNotInstalledDialogContent error={error} />,
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_download_and_install,
      }),
      onConfirm: () => Linking.openURL(HARDWARE_BRIDGE_DOWNLOAD_URL),
    });
    return;
  }
  Toast.error({
    title: intl.formatMessage({
      id: ETranslations.device_communication_failed,
    }),
  });
}

export function useOnboardingDeviceScanErrorHandler({
  stopScan,
}: {
  stopScan: () => void;
}) {
  const intl = useIntl();
  const hasShownBluetoothUnavailableToastRef = useRef(false);

  const resetScanError = useCallback(() => {
    hasShownBluetoothUnavailableToastRef.current = false;
  }, []);

  const handleScanError = useCallback(
    (error: Error) => {
      if (shouldContinueOnboardingDeviceScan(error)) {
        if (!hasShownBluetoothUnavailableToastRef.current) {
          hasShownBluetoothUnavailableToastRef.current = true;
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.troubleshooting_desktop_bluetooth_usb_priority,
            }),
          });
        }
        return;
      }

      resetScanError();
      stopScan();
      showStoppedScanError(error, intl);
    },
    [intl, resetScanError, stopScan],
  );

  return { handleScanError, resetScanError };
}
