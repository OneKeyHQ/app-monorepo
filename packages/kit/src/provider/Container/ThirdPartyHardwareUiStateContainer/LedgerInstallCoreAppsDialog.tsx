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
  thirdPartyBatchInstallAtom,
  useThirdPartyAppInstallAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { convertThirdPartyDeviceError } from '@onekeyhq/shared/src/errors/utils/thirdPartyDeviceErrorUtils';
import {
  type ILedgerCoreAppName,
  LEDGER_CORE_APPS,
  hasAnyRequiredLedgerAppInstalled,
} from '@onekeyhq/shared/src/hardware/ledgerApps';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import type {
  IEnsureLedgerCoreAppsReadyResult,
  IInstallCoreAppsResult,
} from './ledgerCoreAppsReadyUtils';

function InstallCoreAppsContent({
  apps = LEDGER_CORE_APPS,
  connectId,
  onClose,
  onResult,
  installCtx,
}: {
  apps?: readonly ILedgerCoreAppName[];
  connectId: string;
  onClose: () => void;
  onResult?: (result: IInstallCoreAppsResult) => void;
  installCtx?: { started: boolean };
}) {
  const intl = useIntl();
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(apps.map((appName) => [appName, true])),
  );
  const [installing, setInstalling] = useState(false);
  const [appInstallState] = useThirdPartyAppInstallAtom();

  const hasSelection = apps.some((appName) => selected[appName]);

  useEffect(() => {
    if (installing && appInstallState) {
      onClose();
    }
  }, [installing, appInstallState, onClose]);

  const onInstall = async () => {
    const selectedApps = apps.filter((appName) => selected[appName]);
    if (selectedApps.length === 0) {
      return;
    }
    if (installCtx) installCtx.started = true;
    setInstalling(true);
    let installedOk = false;
    let installError: unknown;
    try {
      await thirdPartyBatchInstallAtom.set({
        queue: [...selectedApps],
        currentIndex: 0,
      });
      for (let i = 0; i < selectedApps.length; i += 1) {
        await thirdPartyBatchInstallAtom.set({
          queue: [...selectedApps],
          currentIndex: i,
        });
        const res =
          (await backgroundApiProxy.serviceHardware.thirdPartyHardwareInstallApp(
            {
              vendor: EHardwareVendor.ledger,
              connectId,
              appName: selectedApps[i],
            },
          )) as { success: boolean; payload: { error: string; code: number } };
        if (!res?.success) {
          throw convertThirdPartyDeviceError(res.payload, {
            vendor: EHardwareVendor.ledger,
          });
        }
      }
      installedOk = true;
      await thirdPartyBatchInstallAtom.set({
        queue: [...selectedApps],
        currentIndex: selectedApps.length,
      });
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 600);
      });
    } catch (error) {
      installError = error;
      Toast.error({ title: (error as Error)?.message ?? 'Install failed' });
    } finally {
      await thirdPartyAppInstallAtom.set(undefined);
      await thirdPartyBatchInstallAtom.set(undefined);
      onResult?.(
        installedOk
          ? { ok: true }
          : {
              ok: false,
              reason: 'installNotCompleted',
              error: installError instanceof Error ? installError : undefined,
            },
      );
      onClose();
    }
  };

  return (
    <YStack gap="$6" pt="$2">
      <YStack gap="$2">
        <SizableText size="$heading2xl">
          {intl.formatMessage({ id: ETranslations.global_get_started })}
        </SizableText>
        <SizableText size="$bodyLg" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.hardware_third_party_app_install_required_desc,
          })}
        </SizableText>
      </YStack>
      <YStack gap="$3" p="$4" borderRadius="$3" bg="$bgSubdued">
        {apps.map((appName) => (
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

export async function showLedgerInstallCoreAppsDialog(params: {
  walletId?: string;
  connectId?: string;
  requiredApps?: readonly ILedgerCoreAppName[];
}): Promise<IInstallCoreAppsResult> {
  let connectId = params.connectId ?? '';
  if (!connectId && params.walletId) {
    const device = await backgroundApiProxy.serviceAccount.getWalletDevice({
      walletId: params.walletId,
    });
    connectId =
      device?.connectId || device?.usbConnectId || device?.bleConnectId || '';
  }

  return new Promise<IInstallCoreAppsResult>((resolve) => {
    let settled = false;
    const settle = (result: IInstallCoreAppsResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const installCtx = { started: false };
    const holder: { instance?: IDialogInstance } = {};
    holder.instance = Dialog.show({
      showFooter: false,
      onClose: () => {
        if (!installCtx.started) {
          settle({ ok: false, reason: 'installNotCompleted' });
        }
      },
      renderContent: (
        <InstallCoreAppsContent
          apps={params.requiredApps}
          connectId={connectId}
          installCtx={installCtx}
          onResult={settle}
          onClose={() => {
            void holder.instance?.close();
          }}
        />
      ),
    });
  });
}

export async function ensureLedgerCoreAppsReady(params: {
  walletId?: string;
  connectId?: string;
  requiredApps?: readonly ILedgerCoreAppName[];
}): Promise<IEnsureLedgerCoreAppsReadyResult> {
  let connectId = params.connectId ?? '';
  if (!connectId && params.walletId) {
    const device = await backgroundApiProxy.serviceAccount.getWalletDevice({
      walletId: params.walletId,
    });
    connectId =
      device?.connectId || device?.usbConnectId || device?.bleConnectId || '';
  }

  const probeRes =
    (await backgroundApiProxy.serviceHardware.thirdPartyHardwareListInstalledAppNames(
      { vendor: EHardwareVendor.ledger, connectId },
    )) as {
      success: boolean;
      payload: string[] | { error: string; code: number };
    };
  if (!probeRes?.success) {
    return {
      ok: false,
      reason: 'probeFailed',
      error: convertThirdPartyDeviceError(
        probeRes.payload as { error: string; code: number },
        { vendor: EHardwareVendor.ledger },
      ),
    };
  }
  const installed = (probeRes.payload as string[]) ?? [];
  const requiredApps = params.requiredApps?.length
    ? params.requiredApps
    : LEDGER_CORE_APPS;
  const hasCoreApp = hasAnyRequiredLedgerAppInstalled({
    installedApps: installed,
    requiredApps: [...requiredApps],
  });
  if (hasCoreApp) {
    return { ok: true };
  }

  const dialogResult = await showLedgerInstallCoreAppsDialog({
    connectId,
    requiredApps,
  });
  return dialogResult;
}
