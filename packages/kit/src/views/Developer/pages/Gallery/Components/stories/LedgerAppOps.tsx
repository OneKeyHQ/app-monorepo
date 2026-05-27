/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable react/no-unstable-nested-components */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { useEffect, useRef, useState } from 'react';

import {
  Button,
  Divider,
  Input,
  Progress,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { Layout } from './utils/Layout';

interface IAppMetadata {
  versionName: string;
  version: string;
  bytes: number | null;
  currencyId: string | null;
  isDevTools: boolean;
}

interface ILogEntry {
  at: string;
  text: string;
}

const LedgerAppOpsTester = () => {
  const [connectId, setConnectId] = useState('');
  const [appName, setAppName] = useState('Cardano');
  const [progress, setProgress] = useState<number | null>(null);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recoveryEventBusy, setRecoveryEventBusy] = useState(false);
  const [logs, setLogs] = useState<ILogEntry[]>([]);
  const [installed, setInstalled] = useState<IAppMetadata[] | null>(null);
  const [available, setAvailable] = useState<IAppMetadata[] | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<Record<string, unknown> | null>(
    null,
  );

  const logsRef = useRef<ILogEntry[]>([]);
  logsRef.current = logs;

  const appendLog = (text: string) => {
    setLogs([
      ...logsRef.current,
      { at: new Date().toLocaleTimeString(), text },
    ]);
  };

  const handleSearch = async () => {
    setBusy(true);
    try {
      const res = (await backgroundApiProxy.serviceHardware.searchDevices({
        vendor: EHardwareVendor.ledger,
      })) as
        | {
            success: true;
            payload: Array<{ connectId: string; name?: string }>;
          }
        | { success: false; payload: { code: number; message?: string } };
      if (res.success) {
        if (res.payload.length === 0) {
          appendLog(
            'searchDevices → no Ledger found (plug in + unlock + grant WebHID permission)',
          );
        } else if (res.payload.length === 1) {
          setConnectId(res.payload[0].connectId);
          appendLog(
            `searchDevices → auto-filled connectId from sole device: ${res.payload[0].name ?? 'Ledger'}`,
          );
        } else {
          appendLog(
            `searchDevices → ${res.payload.length} devices found; multi-USB not supported by this flow. Devices: ${res.payload
              .map((d) => `${d.name ?? 'Ledger'}@${d.connectId.slice(0, 8)}…`)
              .join(', ')}`,
          );
        }
      } else {
        appendLog(
          `searchDevices FAILED → ${res.payload.message ?? res.payload.code}`,
        );
      }
    } catch (err) {
      appendLog(`searchDevices threw → ${(err as Error)?.message ?? err}`);
    } finally {
      setBusy(false);
    }
  };

  // Don't auto-search on mount: WebHID `requestDevice()` requires a real
  // user gesture (button click). Auto-firing it from useEffect is silently
  // rejected by the browser, leaving the user staring at "no Ledger found"
  // with no system dialog to grant permission. Wait for the user to click
  // "Search devices" instead.

  // Subscribe to install progress events from the SDK adapter, bridged
  // through the kit-bg LedgerAdapter wrapper into appEventBus.
  useEffect(() => {
    const listener = (e: {
      vendor: EHardwareVendor;
      connectId: string;
      appName: string;
      progress: number;
      requiredUserInteraction?: string;
    }) => {
      if (e.vendor !== EHardwareVendor.ledger) return;
      // Only track events for the connectId we asked to install.
      if (connectId && e.connectId !== connectId) return;
      setProgress(e.progress);
      setProgressLabel(
        e.requiredUserInteraction && e.requiredUserInteraction !== 'none'
          ? `${e.requiredUserInteraction} (${Math.round(e.progress * 100)}%)`
          : `${Math.round(e.progress * 100)}%`,
      );
    };
    appEventBus.on(
      EAppEventBusNames.ThirdPartyHardwareAppInstallProgress,
      listener,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.ThirdPartyHardwareAppInstallProgress,
        listener,
      );
    };
  }, [connectId]);

  const handleListInstalled = async () => {
    setBusy(true);
    try {
      const res =
        (await backgroundApiProxy.serviceHardware.thirdPartyHardwareListInstalledApps(
          { vendor: EHardwareVendor.ledger, connectId },
        )) as { success: boolean; payload: unknown };
      if (res.success) {
        const apps = res.payload as IAppMetadata[];
        setInstalled(apps);
        appendLog(`listInstalledApps → ${apps.length} apps`);
      } else {
        appendLog(`listInstalledApps FAILED → ${JSON.stringify(res.payload)}`);
      }
    } catch (err) {
      appendLog(`listInstalledApps threw → ${(err as Error)?.message ?? err}`);
    } finally {
      setBusy(false);
    }
  };

  const handleListAvailable = async () => {
    setBusy(true);
    try {
      const res =
        (await backgroundApiProxy.serviceHardware.thirdPartyHardwareListAvailableApps(
          { vendor: EHardwareVendor.ledger, connectId },
        )) as { success: boolean; payload: unknown };
      if (res.success) {
        const apps = res.payload as IAppMetadata[];
        setAvailable(apps);
        appendLog(`listAvailableApps → ${apps.length} apps (catalog)`);
      } else {
        appendLog(`listAvailableApps FAILED → ${JSON.stringify(res.payload)}`);
      }
    } catch (err) {
      appendLog(`listAvailableApps threw → ${(err as Error)?.message ?? err}`);
    } finally {
      setBusy(false);
    }
  };

  const handleInstall = async () => {
    if (!appName) {
      appendLog('ERROR: appName is required');
      return;
    }
    setBusy(true);
    setProgress(0);
    setProgressLabel('starting…');
    appendLog(`installApp ${appName} → start`);
    try {
      const res =
        (await backgroundApiProxy.serviceHardware.thirdPartyHardwareInstallApp({
          vendor: EHardwareVendor.ledger,
          connectId,
          appName,
        })) as { success: boolean; payload: unknown };
      if (res.success) {
        appendLog(`installApp ${appName} → SUCCESS`);
        setProgress(1);
        setProgressLabel('done');
      } else {
        appendLog(
          `installApp ${appName} FAILED → ${JSON.stringify(res.payload)}`,
        );
        setProgressLabel('failed');
      }
    } catch (err) {
      appendLog(`installApp threw → ${(err as Error)?.message ?? err}`);
      setProgressLabel('failed');
    } finally {
      setBusy(false);
    }
  };

  const handleGetFirmwareVersion = async () => {
    setBusy(true);
    try {
      const res =
        (await backgroundApiProxy.serviceHardware.thirdPartyHardwareGetFirmwareVersion(
          { vendor: EHardwareVendor.ledger, connectId },
        )) as { success: boolean; payload: unknown };
      if (res.success) {
        const v = res.payload as Record<string, unknown>;
        setDeviceInfo(v);
        appendLog(
          `getFirmwareVersion → seVersion=${String(v.seVersion)} mcu=${String(v.mcuVersion)}`,
        );
      } else {
        appendLog(`getFirmwareVersion FAILED → ${JSON.stringify(res.payload)}`);
      }
    } catch (err) {
      appendLog(`getFirmwareVersion threw → ${(err as Error)?.message ?? err}`);
    } finally {
      setBusy(false);
    }
  };

  const handleGetDeviceInfo = async () => {
    setBusy(true);
    try {
      const res =
        (await backgroundApiProxy.serviceHardware.thirdPartyHardwareGetDeviceInfo(
          { vendor: EHardwareVendor.ledger, connectId },
        )) as { success: boolean; payload: unknown };
      if (res.success) {
        const info = res.payload as Record<string, unknown>;
        setDeviceInfo(info);
        appendLog(`getDeviceInfo → ${JSON.stringify(info)}`);
      } else {
        appendLog(`getDeviceInfo FAILED → ${JSON.stringify(res.payload)}`);
      }
    } catch (err) {
      appendLog(`getDeviceInfo threw → ${(err as Error)?.message ?? err}`);
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!connectId) return;
    await backgroundApiProxy.serviceHardware.thirdPartyHardwareCancel({
      vendor: EHardwareVendor.ledger,
      connectId,
    });
    appendLog('cancel sent');
  };

  const handleEmitRecoveryEvents = async () => {
    const eventConnectId = connectId || '';
    const events = [
      {
        type: 'ledger_app_install_required',
        vendor: EHardwareVendor.ledger,
        connectId: eventConnectId,
        appName: 'Bitcoin',
        source: 'createAccount',
      },
      {
        type: 'ledger_app_install_required',
        vendor: EHardwareVendor.ledger,
        connectId: eventConnectId,
        appName: 'Bitcoin',
        source: 'batchCreateAccount',
      },
      {
        type: 'ledger_app_install_required',
        vendor: EHardwareVendor.ledger,
        connectId: eventConnectId,
        appName: 'TON',
        source: 'sign',
      },
    ] as const;

    setRecoveryEventBusy(true);
    try {
      for (const [index, event] of events.entries()) {
        if (index > 0) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        appEventBus.emit(
          EAppEventBusNames.ThirdPartyHardwareRecoveryAction,
          event,
        );
        appendLog(
          `emit recovery event ${index + 1}/${events.length} → ${
            event.appName
          } connectId=${event.connectId || '(empty)'}`,
        );
      }
    } finally {
      setRecoveryEventBusy(false);
    }
  };

  return (
    <YStack gap="$4" p="$4">
      <YStack gap="$2">
        <XStack gap="$2" alignItems="center" justifyContent="space-between">
          <SizableText size="$bodyMdMedium">connectId (optional)</SizableText>
          <Button size="small" onPress={handleSearch} disabled={busy}>
            Search devices
          </Button>
        </XStack>
        <Input
          value={connectId}
          onChangeText={setConnectId}
          placeholder="leave empty for USB (single device auto-picked); only required for BLE"
        />
      </YStack>

      <XStack gap="$2" flexWrap="wrap">
        <Button onPress={handleListInstalled} disabled={busy}>
          List Installed
        </Button>
        <Button onPress={handleListAvailable} disabled={busy}>
          List Available (catalog)
        </Button>
        <Button onPress={handleGetFirmwareVersion} disabled={busy}>
          Firmware Version
        </Button>
        <Button onPress={handleGetDeviceInfo} disabled={busy}>
          Device Info
        </Button>
        <Button onPress={handleCancel} variant="destructive" disabled={!busy}>
          Cancel
        </Button>
      </XStack>

      <Divider />

      <YStack gap="$2">
        <SizableText size="$bodyMdMedium">Install</SizableText>
        <XStack gap="$2" alignItems="center">
          <Input
            value={appName}
            onChangeText={setAppName}
            placeholder="App name (e.g. Cardano)"
            flex={1}
          />
          <Button onPress={handleInstall} disabled={busy} variant="primary">
            Install
          </Button>
        </XStack>
        {progress !== null ? (
          <YStack gap="$1">
            <Progress value={Math.round(progress * 100)} />
            <SizableText size="$bodySm" color="$textSubdued">
              {progressLabel}
            </SizableText>
          </YStack>
        ) : null}
      </YStack>

      <Divider />

      <YStack gap="$2">
        <SizableText size="$bodyMdMedium">
          Recovery Dialog Event Bus
        </SizableText>
        <XStack gap="$2" alignItems="center" flexWrap="wrap">
          <Button
            onPress={() => void handleEmitRecoveryEvents()}
            disabled={recoveryEventBusy}
          >
            Emit 3 Recovery Events
          </Button>
          <SizableText size="$bodySm" color="$textSubdued">
            Bitcoin, duplicated Bitcoin, TON
          </SizableText>
        </XStack>
      </YStack>

      <Divider />

      {deviceInfo ? (
        <YStack gap="$1">
          <SizableText size="$bodyMdMedium">Device info</SizableText>
          {Object.entries(deviceInfo).map(([k, v]) => (
            <SizableText key={k} size="$bodySm">
              · {k}: {v === null || v === undefined ? '—' : String(v)}
            </SizableText>
          ))}
        </YStack>
      ) : null}

      {installed ? (
        <YStack gap="$1">
          <SizableText size="$bodyMdMedium">
            Installed ({installed.length})
          </SizableText>
          {installed.map((a) => (
            <SizableText key={`${a.versionName}-${a.version}`} size="$bodySm">
              · {a.versionName} {a.version} {a.bytes ? `(${a.bytes}b)` : ''}
            </SizableText>
          ))}
        </YStack>
      ) : null}

      {available ? (
        <YStack gap="$1">
          <SizableText size="$bodyMdMedium">
            Available catalog ({available.length})
          </SizableText>
          <ScrollView maxHeight={240}>
            {available.map((a) => (
              <SizableText key={`${a.versionName}-${a.version}`} size="$bodySm">
                · {a.versionName} {a.version} {a.bytes ? `(${a.bytes}b)` : ''}
                {a.isDevTools ? ' [devtools]' : ''}
              </SizableText>
            ))}
          </ScrollView>
        </YStack>
      ) : null}

      <Divider />

      <YStack gap="$1">
        <SizableText size="$bodyMdMedium">Log</SizableText>
        <ScrollView maxHeight={240}>
          {logs.map((l, idx) => (
            // eslint-disable-next-line react/no-array-index-key
            <SizableText key={idx} size="$bodySm" color="$textSubdued">
              [{l.at}] {l.text}
            </SizableText>
          ))}
        </ScrollView>
      </YStack>
    </YStack>
  );
};

const LedgerAppOpsGallery = () => (
  <Layout
    componentName="LedgerAppOps"
    getFilePath={() => __CURRENT_FILE_PATH__}
    elements={[
      {
        title: 'Ledger app management (install / list)',
        element: (
          <Stack>
            <LedgerAppOpsTester />
          </Stack>
        ),
      },
    ]}
  />
);

export default LedgerAppOpsGallery;
