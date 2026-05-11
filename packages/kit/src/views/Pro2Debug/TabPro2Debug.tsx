// cspell:ignore rssi
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Image as RNImage } from 'react-native';

import {
  Button,
  Page,
  ScrollView,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import RNFS from '@onekeyhq/shared/src/modules3rdParty/react-native-fs';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

const PRO2_BLE_FIRMWARE_ASSET = require('./assets/ble-firmware.bin');
const PRO2_BLE_FIRMWARE_FILE_NAME = 'ble-firmware.bin';
const PRO2_BLE_FIRMWARE_FILE_SIZE = 262_572;
const PRO2_DEMO_FILE_PATH = 'vol0:app-pro2-demo.txt';
const PRO2_DEMO_DIR_PATH = 'vol0:app-pro2-demo-dir';
const PRO2_FIRMWARE_STAGING_PATH = 'vol1:ble-firmware.bin';
const PRO2_BLE_CHUNK_SIZE = 1800;

type IPro2DebugSdkMethod =
  | 'getProtoVersion'
  | 'ping'
  | 'devGetDeviceInfo'
  | 'devGetOnboardingStatus'
  | 'devGetFirmwareUpdateStatus'
  | 'filesystemPathInfoQuery'
  | 'filesystemDirList'
  | 'filesystemDirMake'
  | 'filesystemDirRemove'
  | 'filesystemFileWrite'
  | 'filesystemFileRead'
  | 'filesystemFileDelete'
  | 'filesystemFixPermission'
  | 'devFirmwareUpdate'
  | 'devReboot'
  | 'filesystemFormat';

type IPro2DebugDevice = {
  id?: string;
  connectId?: string;
  name?: string;
  localName?: string;
  deviceType?: string;
  protocolType?: string;
  commType?: string;
  rssi?: number;
};

type IPro2DebugAction = {
  key: string;
  label: string;
  method: IPro2DebugSdkMethod;
  payload?: Record<string, unknown>;
  danger?: boolean;
};

type ILogLine = {
  id: string;
  message: string;
};

type IResponseLike = {
  success?: boolean;
  payload?: unknown;
};

function getDeviceConnectId(device: IPro2DebugDevice) {
  return device.connectId || device.id || '';
}

function stringifyResult(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatDuration(ms?: number) {
  if (ms === undefined) {
    return '-';
  }
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function loadBleFirmwareBase64() {
  const assetSource = RNImage.resolveAssetSource(PRO2_BLE_FIRMWARE_ASSET);
  const uri = assetSource?.uri;
  if (!uri) {
    throw new OneKeyLocalError('BLE firmware asset uri not found');
  }
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    return bufferUtils.bytesToBase64(new Uint8Array(arrayBuffer));
  }
  if (!RNFS) {
    throw new OneKeyLocalError('RNFS is not available');
  }
  const filePath = uri.startsWith('file://')
    ? uri.slice('file://'.length)
    : uri;
  return RNFS.readFile(filePath, 'base64');
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <YStack gap="$2.5">
      <SizableText size="$headingSm">{title}</SizableText>
      <YStack
        gap="$2.5"
        borderWidth={1}
        borderColor="$borderSubdued"
        borderRadius="$2"
        p="$3"
      >
        {children}
      </YStack>
    </YStack>
  );
}

function ResultBlock({ value }: { value: unknown }) {
  return (
    <Stack bg="$bgSubdued" borderRadius="$2" p="$3">
      <SizableText size="$bodySm" color="$textSubdued">
        {stringifyResult(value)}
      </SizableText>
    </Stack>
  );
}

export default function TabPro2Debug() {
  const tabBarHeight = useScrollContentTabBarOffset();
  const [devices, setDevices] = useState<IPro2DebugDevice[]>([]);
  const [selectedConnectId, setSelectedConnectId] = useState('');
  const [busyKey, setBusyKey] = useState<string | undefined>();
  const [lastResult, setLastResult] = useState<unknown>();
  const [lastDurationMs, setLastDurationMs] = useState<number | undefined>();
  const [logs, setLogs] = useState<ILogLine[]>([]);

  const selectedDevice = useMemo(
    () =>
      devices.find(
        (device) => getDeviceConnectId(device) === selectedConnectId,
      ),
    [devices, selectedConnectId],
  );

  const actions = useMemo<IPro2DebugAction[]>(
    () => [
      {
        key: 'getProtoVersion',
        label: 'getProtoVersion',
        method: 'getProtoVersion',
      },
      {
        key: 'ping',
        label: 'ping',
        method: 'ping',
        payload: { message: 'app-pro2-debug' },
      },
      {
        key: 'devGetDeviceInfo',
        label: 'devGetDeviceInfo',
        method: 'devGetDeviceInfo',
        payload: {
          targetHw: true,
          targetFw: true,
          targetBt: true,
          targetSe1: true,
          targetSe2: true,
          targetSe3: true,
          targetSe4: true,
          targetStatus: true,
          includeVersion: true,
          includeBuildId: true,
          includeHash: true,
          includeSpecific: true,
        },
      },
      {
        key: 'devGetOnboardingStatus',
        label: 'devGetOnboardingStatus',
        method: 'devGetOnboardingStatus',
      },
      {
        key: 'devGetFirmwareUpdateStatus',
        label: 'devGetFirmwareUpdateStatus',
        method: 'devGetFirmwareUpdateStatus',
      },
      {
        key: 'filesystemPathInfoQuery',
        label: 'filesystemPathInfoQuery',
        method: 'filesystemPathInfoQuery',
        payload: { path: PRO2_DEMO_FILE_PATH },
      },
      {
        key: 'filesystemDirList',
        label: 'filesystemDirList(vol0)',
        method: 'filesystemDirList',
        payload: { path: 'vol0:', depth: 1 },
      },
      {
        key: 'filesystemDirMake',
        label: 'filesystemDirMake',
        method: 'filesystemDirMake',
        payload: { path: PRO2_DEMO_DIR_PATH },
      },
      {
        key: 'filesystemDirRemove',
        label: 'filesystemDirRemove',
        method: 'filesystemDirRemove',
        payload: { path: PRO2_DEMO_DIR_PATH },
        danger: true,
      },
      {
        key: 'filesystemFileWrite',
        label: 'filesystemFileWrite',
        method: 'filesystemFileWrite',
        payload: {
          path: PRO2_DEMO_FILE_PATH,
          data: `OneKey App Pro2 debug ${new Date().toISOString()}`,
          offset: 0,
          totalSize: 0,
          chunkSize: PRO2_BLE_CHUNK_SIZE,
          overwrite: true,
          append: false,
        },
      },
      {
        key: 'filesystemFileRead',
        label: 'filesystemFileRead',
        method: 'filesystemFileRead',
        payload: {
          path: PRO2_DEMO_FILE_PATH,
          offset: 0,
          totalSize: 0,
          chunkLen: PRO2_BLE_CHUNK_SIZE,
        },
      },
      {
        key: 'filesystemFileDelete',
        label: 'filesystemFileDelete',
        method: 'filesystemFileDelete',
        payload: { path: PRO2_DEMO_FILE_PATH },
        danger: true,
      },
      {
        key: 'filesystemFixPermission',
        label: 'filesystemFixPermission',
        method: 'filesystemFixPermission',
      },
      {
        key: 'devFirmwareUpdate',
        label: 'devFirmwareUpdate(TARGET_BT)',
        method: 'devFirmwareUpdate',
        payload: {
          target_id: 2,
          path: PRO2_FIRMWARE_STAGING_PATH,
        },
        danger: true,
      },
      {
        key: 'devRebootNormal',
        label: 'devReboot(Normal)',
        method: 'devReboot',
        payload: { rebootType: 'Normal' },
        danger: true,
      },
      {
        key: 'filesystemFormat',
        label: 'filesystemFormat',
        method: 'filesystemFormat',
        danger: true,
      },
    ],
    [],
  );

  const appendLog = useCallback((message: string) => {
    setLogs((prev) =>
      [
        {
          id: `${Date.now()}-${Math.random()}`,
          message,
        },
        ...prev,
      ].slice(0, 30),
    );
  }, []);

  const scanDevices = useCallback(async () => {
    const startedAt = Date.now();
    setBusyKey('scan');
    try {
      const response =
        (await backgroundApiProxy.serviceHardware.searchDevices()) as IResponseLike;
      const payload = Array.isArray(response.payload)
        ? (response.payload as IPro2DebugDevice[])
        : [];
      const pro2Devices = payload.filter(
        (device) =>
          device.deviceType === 'pro2' ||
          device.protocolType === 'V2' ||
          (device.name || device.localName || '')
            .toLowerCase()
            .includes('pro2'),
      );
      setDevices(pro2Devices);
      if (!selectedConnectId && pro2Devices[0]) {
        setSelectedConnectId(getDeviceConnectId(pro2Devices[0]));
      }
      setLastResult(response);
      setLastDurationMs(Date.now() - startedAt);
      appendLog(`scanDevices: ${pro2Devices.length} Pro2 device(s)`);
    } catch (error) {
      setLastResult(error);
      setLastDurationMs(Date.now() - startedAt);
      appendLog(`scanDevices failed: ${String(error)}`);
    } finally {
      setBusyKey(undefined);
    }
  }, [appendLog, selectedConnectId]);

  useEffect(() => {
    void scanDevices();
  }, [scanDevices]);

  const runAction = useCallback(
    async (action: IPro2DebugAction) => {
      if (!selectedConnectId) {
        appendLog(`${action.label}: no selected Pro2 device`);
        return;
      }
      const startedAt = Date.now();
      setBusyKey(action.key);
      try {
        const response =
          await backgroundApiProxy.serviceHardware.pro2DebugCallSdkMethod({
            connectId: selectedConnectId,
            method: action.method,
            payload: action.payload,
          });
        setLastResult(response);
        setLastDurationMs(Date.now() - startedAt);
        appendLog(
          `${action.label}: done in ${formatDuration(Date.now() - startedAt)}`,
        );
      } catch (error) {
        setLastResult(error);
        setLastDurationMs(Date.now() - startedAt);
        appendLog(`${action.label}: failed ${String(error)}`);
      } finally {
        setBusyKey(undefined);
      }
    },
    [appendLog, selectedConnectId],
  );

  const runFirmwareUpdateV4 = useCallback(async () => {
    if (!selectedConnectId) {
      appendLog('firmwareUpdateV4: no selected Pro2 device');
      return;
    }
    const startedAt = Date.now();
    setBusyKey('firmwareUpdateV4');
    try {
      appendLog(`firmwareUpdateV4: loading ${PRO2_BLE_FIRMWARE_FILE_NAME}`);
      const bleFirmwareBase64 = await loadBleFirmwareBase64();
      const response =
        await backgroundApiProxy.serviceHardware.pro2DebugFirmwareUpdateV4({
          connectId: selectedConnectId,
          bleFirmwareBase64,
          chunkSize: PRO2_BLE_CHUNK_SIZE,
        });
      const durationMs = Date.now() - startedAt;
      setLastResult(response);
      setLastDurationMs(durationMs);
      appendLog(`firmwareUpdateV4: done in ${formatDuration(durationMs)}`);
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      setLastResult(error);
      setLastDurationMs(durationMs);
      appendLog(
        `firmwareUpdateV4: failed in ${formatDuration(durationMs)} ${String(error)}`,
      );
    } finally {
      setBusyKey(undefined);
    }
  }, [appendLog, selectedConnectId]);

  return (
    <Page>
      <Page.Header title="Pro2 Debug" />
      <Page.Body>
        <ScrollView
          flex={1}
          width="100%"
          px="$5"
          contentContainerStyle={{ paddingBottom: tabBarHeight ?? 24 }}
        >
          <YStack gap="$5" pt="$16" pb="$4">
            <Section title="Device">
              <XStack gap="$2" flexWrap="wrap">
                <Button
                  size="small"
                  onPress={() => void scanDevices()}
                  disabled={Boolean(busyKey)}
                >
                  {busyKey === 'scan' ? <Spinner size="small" /> : 'Scan Pro2'}
                </Button>
              </XStack>
              <SizableText size="$bodySm" color="$textSubdued">
                Selected:{' '}
                {selectedDevice?.name || selectedDevice?.localName || '-'}
              </SizableText>
              {devices.map((device) => {
                const connectId = getDeviceConnectId(device);
                const selected = connectId === selectedConnectId;
                return (
                  <Button
                    key={connectId}
                    size="small"
                    variant={selected ? 'primary' : 'secondary'}
                    onPress={() => setSelectedConnectId(connectId)}
                  >
                    {`${device.name || device.localName || 'Pro2'} · ${
                      device.commType || '-'
                    } · ${device.rssi ?? '-'} dBm`}
                  </Button>
                );
              })}
            </Section>

            <Section title="Methods">
              <SizableText size="$bodySm" color="$textSubdued">
                File: {PRO2_DEMO_FILE_PATH}
              </SizableText>
              <XStack gap="$2" flexWrap="wrap">
                {actions.map((action) => (
                  <Button
                    key={action.key}
                    size="small"
                    variant={action.danger ? 'destructive' : 'secondary'}
                    onPress={() => void runAction(action)}
                    disabled={Boolean(busyKey) || !selectedConnectId}
                  >
                    {busyKey === action.key ? (
                      <Spinner size="small" />
                    ) : (
                      action.label
                    )}
                  </Button>
                ))}
              </XStack>
            </Section>

            <Section title="FirmwareUpdateV4">
              <SizableText size="$bodySm" color="$textSubdued">
                BLE: {PRO2_BLE_FIRMWARE_FILE_NAME} ·{' '}
                {formatBytes(PRO2_BLE_FIRMWARE_FILE_SIZE)}
              </SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                Target: TARGET_BT(2) · {PRO2_FIRMWARE_STAGING_PATH} · chunk{' '}
                {PRO2_BLE_CHUNK_SIZE} B
              </SizableText>
              <Button
                onPress={() => void runFirmwareUpdateV4()}
                disabled={Boolean(busyKey) || !selectedConnectId}
                variant="primary"
              >
                {busyKey === 'firmwareUpdateV4' ? (
                  <Spinner size="small" />
                ) : (
                  'Start BLE firmwareUpdateV4'
                )}
              </Button>
            </Section>

            <Section title="Result">
              <SizableText size="$bodySm" color="$textSubdued">
                Total: {formatDuration(lastDurationMs)}
              </SizableText>
              <ResultBlock value={lastResult ?? 'No result yet'} />
            </Section>

            <Section title="Logs">
              {logs.length ? (
                logs.map((log) => (
                  <SizableText key={log.id} size="$bodySm" color="$textSubdued">
                    {log.message}
                  </SizableText>
                ))
              ) : (
                <SizableText size="$bodySm" color="$textSubdued">
                  No logs yet
                </SizableText>
              )}
            </Section>
          </YStack>
        </ScrollView>
      </Page.Body>
    </Page>
  );
}
