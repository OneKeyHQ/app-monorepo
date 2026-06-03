import { useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
import {
  Button,
  Checkbox,
  Dialog,
  SizableText,
  Toast,
  YStack,
} from '@onekeyhq/components';
import {
  thirdPartyAppInstallAtom,
  useThirdPartyAppInstallAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { convertThirdPartyDeviceError } from '@onekeyhq/shared/src/errors/utils/thirdPartyDeviceErrorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

// Core apps offered on a bare device; user can uncheck before installing.
const CORE_LEDGER_APPS = ['Bitcoin', 'Ethereum', 'Solana', 'Tron'] as const;

function InstallCoreAppsContent({
  connectId,
  onClose,
}: {
  connectId: string;
  onClose: () => void;
}) {
  const intl = useIntl();
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CORE_LEDGER_APPS.map((appName) => [appName, true])),
  );
  const [installing, setInstalling] = useState(false);
  const [appInstallState] = useThirdPartyAppInstallAtom();

  const hasSelection = CORE_LEDGER_APPS.some((appName) => selected[appName]);

  // Hand off to the global progress dialog once it takes over (atom set); until
  // then the button stays spinning so the click never leaves a blank screen.
  useEffect(() => {
    if (installing && appInstallState) {
      onClose();
    }
  }, [installing, appInstallState, onClose]);

  const onInstall = async () => {
    const apps = CORE_LEDGER_APPS.filter((appName) => selected[appName]);
    if (apps.length === 0) {
      return;
    }
    setInstalling(true);
    try {
      // Install sequentially; accounts aren't auto-recreated (user re-adds).
      // A failed app (thrown, or success:false — declined / out of space)
      // stops the run and surfaces as a standard third-party HW error toast.
      for (const appName of apps) {
        const res =
          (await backgroundApiProxy.serviceHardware.thirdPartyHardwareInstallApp(
            { vendor: EHardwareVendor.ledger, connectId, appName },
          )) as { success: boolean; payload: { error: string; code: number } };
        if (!res?.success) {
          throw convertThirdPartyDeviceError(res.payload, {
            vendor: EHardwareVendor.ledger,
          });
        }
      }
    } catch (error) {
      Toast.error({ title: (error as Error)?.message ?? 'Install failed' });
    } finally {
      // Standalone install gets no CLOSE_UI_WINDOW; clear the atom to close the
      // progress dialog, and the selector if it never handed off.
      await thirdPartyAppInstallAtom.set(undefined);
      onClose();
    }
  };

  return (
    <YStack gap="$5" pt="$2">
      <YStack gap="$1.5">
        <SizableText size="$headingMd">
          {intl.formatMessage({ id: ETranslations.global_get_started })}
        </SizableText>
        <SizableText size="$bodyLg" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.hardware_third_party_app_install_required_desc,
          })}
        </SizableText>
      </YStack>
      <YStack gap="$3">
        {CORE_LEDGER_APPS.map((appName) => (
          <Checkbox
            key={appName}
            testID={`ledger-install-core-app-${appName.toLowerCase()}`}
            label={appName}
            value={selected[appName]}
            onChange={(checked) =>
              setSelected((prev) => ({ ...prev, [appName]: !!checked }))
            }
          />
        ))}
      </YStack>
      <Button
        testID="ledger-install-core-apps-btn"
        variant="primary"
        loading={installing}
        disabled={installing || !hasSelection}
        onPress={onInstall}
      >
        {intl.formatMessage({ id: ETranslations.global_install })}
      </Button>
    </YStack>
  );
}

// Bare-device recovery: install the core Ledger apps in-app (triggered when a
// batch finds zero installed apps — every chain failed AppNotInstalled).
export async function showLedgerInstallCoreAppsDialog({
  walletId,
}: {
  walletId: string;
}): Promise<void> {
  const device = await backgroundApiProxy.serviceAccount.getWalletDevice({
    walletId,
  });
  // USB Ledger connectId is empty by design; SDK auto-picks the sole device.
  const connectId =
    device?.connectId || device?.usbConnectId || device?.bleConnectId || '';

  const holder: { instance?: IDialogInstance } = {};
  holder.instance = Dialog.show({
    icon: 'DownloadOutline',
    showFooter: false,
    renderContent: (
      <InstallCoreAppsContent
        connectId={connectId}
        onClose={() => {
          void holder.instance?.close();
        }}
      />
    ),
  });
}
