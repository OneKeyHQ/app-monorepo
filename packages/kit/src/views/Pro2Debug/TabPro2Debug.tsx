// cspell:ignore rssi
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Image as RNImage } from 'react-native';

import {
  Button,
  Page,
  Progress,
  ScrollView,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import {
  EHardwareUiStateAction,
  useHardwareUiStateAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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
  | 'factoryGetDeviceInfo'
  | 'factoryDeviceInfoSettings'
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
};

type IPro2DebugActionGroup = {
  key: string;
  title: string;
  actions: IPro2DebugAction[];
};

type ILogLine = {
  id: string;
  message: string;
};

type IResponseLike = {
  success?: boolean;
  payload?: unknown;
};

type IMethodResult = {
  label: string;
  method: IPro2DebugSdkMethod;
  durationMs?: number;
  updatedAt: number;
  pending?: boolean;
  response?: unknown;
  error?: unknown;
};

type IFirmwareProgressState = {
  progress: number;
  progressType?: string;
  transferredBytes?: number;
  totalBytes?: number;
  rateBytesPerSecond?: number;
  elapsedMs?: number;
};

type IFirmwareTiming = {
  key: string;
  label: string;
  startAt: number;
  endAt?: number;
  durationMs?: number;
};

type IFirmwareTimingSummary = {
  status: 'success' | 'failed';
  totalDurationMs?: number;
};

const FIRMWARE_TIP_STATUS: Record<string, string> = {
  StartDownloadFirmware: 'Preparing firmware package',
  FinishDownloadFirmware: 'Firmware package ready',
  AutoRebootToBootloader: 'Rebooting to bootloader',
  GoToBootloaderSuccess: 'Bootloader ready',
  StartTransferData: 'Uploading firmware file',
  ConfirmOnDevice: 'Waiting for device confirmation',
  FirmwareUpdating: 'Installing selected target',
  SwitchFirmwareReconnectDevice: 'Rebooting to normal, polling Ping',
  FirmwareUpdateCompleted: 'Normal mode ready',
};

const FIRMWARE_PROGRESS_STATUS: Record<string, string> = {
  transferData: 'Uploading firmware file',
  installingFirmware: 'Installing selected target',
  rebootNormal: 'Rebooting to normal, polling Ping',
  completed: 'Normal mode ready',
  prepare: 'Preparing firmware package',
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

function formatBytes(bytes?: number) {
  if (!Number.isFinite(bytes)) {
    return '-';
  }
  const value = bytes as number;
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function formatRate(bytesPerSecond?: number) {
  if (!Number.isFinite(bytesPerSecond)) {
    return '-';
  }
  return `${formatBytes(bytesPerSecond)}/s`;
}

function formatClock(timestamp?: number) {
  if (!timestamp) {
    return '-';
  }
  return new Date(timestamp).toLocaleTimeString();
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return error;
}

function getFiniteNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function clampProgress(progress: number) {
  return Math.max(0, Math.min(100, progress));
}

function getFirmwareStatusFromTip(message: string) {
  return FIRMWARE_TIP_STATUS[message] || message;
}

function getFirmwareStatusFromProgressType(progressType?: string) {
  if (!progressType) {
    return 'Firmware update running';
  }
  return FIRMWARE_PROGRESS_STATUS[progressType] || progressType;
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
  const [hardwareUiState] = useHardwareUiStateAtom();
  const [devices, setDevices] = useState<IPro2DebugDevice[]>([]);
  const [selectedConnectId, setSelectedConnectId] = useState('');
  const [busyKey, setBusyKey] = useState<string | undefined>();
  const [methodResults, setMethodResults] = useState<
    Record<string, IMethodResult>
  >({});
  const [lastMethodResultKey, setLastMethodResultKey] = useState('');
  const [firmwareStatus, setFirmwareStatus] = useState('Idle');
  const [firmwareProgress, setFirmwareProgress] =
    useState<IFirmwareProgressState>();
  const [firmwareResult, setFirmwareResult] = useState<unknown>();
  const [firmwareTimings, setFirmwareTimings] = useState<IFirmwareTiming[]>([]);
  const [firmwareTimingSummary, setFirmwareTimingSummary] =
    useState<IFirmwareTimingSummary>();
  const [firmwareTick, setFirmwareTick] = useState(0);
  const [logs, setLogs] = useState<ILogLine[]>([]);
  const firmwareStartedAtRef = useRef<number | undefined>(undefined);
  const firmwareStageRef = useRef<{
    activeKey?: string;
    timings: IFirmwareTiming[];
  }>({ timings: [] });

  const selectedDevice = useMemo(
    () =>
      devices.find(
        (device) => getDeviceConnectId(device) === selectedConnectId,
      ),
    [devices, selectedConnectId],
  );

  const actionGroups = useMemo<IPro2DebugActionGroup[]>(
    () => [
      {
        key: 'device',
        title: 'Device / Factory',
        actions: [
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
            key: 'devRebootNormal',
            label: 'devReboot(Normal)',
            method: 'devReboot',
            payload: { rebootType: 'Normal' },
          },
          {
            key: 'factoryGetDeviceInfo',
            label: 'factoryGetDeviceInfo',
            method: 'factoryGetDeviceInfo',
          },
          {
            key: 'factoryDeviceInfoSettings',
            label: 'factoryDeviceInfoSettings',
            method: 'factoryDeviceInfoSettings',
            payload: {
              serialNo: 'APP-PRO2-DEMO-SERIAL',
              cpuInfo: 'APP-PRO2-DEMO-CPU',
              preFirmware: 'APP-PRO2-DEMO-FW',
            },
          },
        ],
      },
      {
        key: 'firmware',
        title: 'Firmware',
        actions: [
          {
            key: 'devGetFirmwareUpdateStatus',
            label: 'devGetFirmwareUpdateStatus',
            method: 'devGetFirmwareUpdateStatus',
          },
          {
            key: 'devFirmwareUpdate',
            label: 'devFirmwareUpdate(TARGET_BT)',
            method: 'devFirmwareUpdate',
            payload: {
              target_id: 2,
              path: PRO2_FIRMWARE_STAGING_PATH,
            },
          },
        ],
      },
      {
        key: 'filesystem',
        title: 'Filesystem',
        actions: [
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
          },
          {
            key: 'filesystemFixPermission',
            label: 'filesystemFixPermission',
            method: 'filesystemFixPermission',
          },
          {
            key: 'filesystemFormat',
            label: 'filesystemFormat',
            method: 'filesystemFormat',
          },
        ],
      },
    ],
    [],
  );

  const lastMethodResult = lastMethodResultKey
    ? methodResults[lastMethodResultKey]
    : undefined;

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

  const syncFirmwareTimings = useCallback(() => {
    setFirmwareTimings([...firmwareStageRef.current.timings]);
  }, []);

  const startFirmwareStage = useCallback(
    (key: string, label: string) => {
      const now = Date.now();
      const state = firmwareStageRef.current;
      if (state.activeKey === key) {
        return;
      }
      if (state.activeKey) {
        const active = state.timings.find(
          (item) => item.key === state.activeKey && !item.endAt,
        );
        if (active) {
          active.endAt = now;
          active.durationMs = active.endAt - active.startAt;
        }
      }
      state.activeKey = key;
      state.timings.push({ key, label, startAt: now });
      syncFirmwareTimings();
    },
    [syncFirmwareTimings],
  );

  const finishFirmwareStage = useCallback(
    (key?: string) => {
      const now = Date.now();
      const state = firmwareStageRef.current;
      const stageKey = key ?? state.activeKey;
      if (!stageKey) {
        return;
      }
      let active: IFirmwareTiming | undefined;
      for (let index = state.timings.length - 1; index >= 0; index -= 1) {
        const item = state.timings[index];
        if (item.key === stageKey && !item.endAt) {
          active = item;
          break;
        }
      }
      if (active) {
        active.endAt = now;
        active.durationMs = active.endAt - active.startAt;
      }
      if (state.activeKey === stageKey) {
        state.activeKey = undefined;
      }
      syncFirmwareTimings();
    },
    [syncFirmwareTimings],
  );

  const finishFirmwareTimingSummary = useCallback(
    (status: IFirmwareTimingSummary['status']) => {
      finishFirmwareStage();
      const startedAt = firmwareStartedAtRef.current;
      const totalDurationMs = startedAt ? Date.now() - startedAt : undefined;
      setFirmwareTimingSummary({ status, totalDurationMs });
      appendLog(
        `firmwareUpdateV4 ${status}: total ${formatDuration(totalDurationMs)}`,
      );
    },
    [appendLog, finishFirmwareStage],
  );

  const scanDevices = useCallback(async () => {
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
      appendLog(`scanDevices: ${pro2Devices.length} Pro2 device(s)`);
    } catch (error) {
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
      setLastMethodResultKey(action.key);
      setMethodResults((prev) => ({
        ...prev,
        [action.key]: {
          label: action.label,
          method: action.method,
          updatedAt: startedAt,
          pending: true,
          response: 'Running...',
        },
      }));
      try {
        const response =
          await backgroundApiProxy.serviceHardware.pro2DebugCallSdkMethod({
            connectId: selectedConnectId,
            method: action.method,
            payload: action.payload,
          });
        const durationMs = Date.now() - startedAt;
        setMethodResults((prev) => ({
          ...prev,
          [action.key]: {
            label: action.label,
            method: action.method,
            durationMs,
            updatedAt: Date.now(),
            response,
          },
        }));
        appendLog(`${action.label}: done in ${formatDuration(durationMs)}`);
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        const normalizedError = normalizeError(error);
        setMethodResults((prev) => ({
          ...prev,
          [action.key]: {
            label: action.label,
            method: action.method,
            durationMs,
            updatedAt: Date.now(),
            error: normalizedError,
          },
        }));
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
    firmwareStartedAtRef.current = startedAt;
    setFirmwareTick(startedAt);
    firmwareStageRef.current = { timings: [] };
    setFirmwareTimings([]);
    setFirmwareTimingSummary(undefined);
    setFirmwareResult(undefined);
    setFirmwareProgress({
      progress: 0,
      progressType: 'prepare',
      totalBytes: PRO2_BLE_FIRMWARE_FILE_SIZE,
      elapsedMs: 0,
    });
    setFirmwareStatus(`Loading ${PRO2_BLE_FIRMWARE_FILE_NAME}`);
    setBusyKey('firmwareUpdateV4');
    try {
      appendLog(`firmwareUpdateV4: loading ${PRO2_BLE_FIRMWARE_FILE_NAME}`);
      startFirmwareStage('loadAsset', 'Load bundled asset');
      const bleFirmwareBase64 = await loadBleFirmwareBase64();
      finishFirmwareStage('loadAsset');
      setFirmwareStatus('Running firmwareUpdateV4');
      const response =
        await backgroundApiProxy.serviceHardware.pro2DebugFirmwareUpdateV4({
          connectId: selectedConnectId,
          bleFirmwareBase64,
          chunkSize: PRO2_BLE_CHUNK_SIZE,
        });
      const durationMs = Date.now() - startedAt;
      const isSuccessResponse = (response as IResponseLike)?.success !== false;
      setFirmwareResult(response);
      setFirmwareProgress((prev) => ({
        progress: 100,
        progressType: 'completed',
        totalBytes: PRO2_BLE_FIRMWARE_FILE_SIZE,
        transferredBytes: PRO2_BLE_FIRMWARE_FILE_SIZE,
        elapsedMs: durationMs,
        rateBytesPerSecond:
          durationMs > 0
            ? (PRO2_BLE_FIRMWARE_FILE_SIZE / durationMs) * 1000
            : prev?.rateBytesPerSecond,
      }));
      setFirmwareStatus(
        isSuccessResponse
          ? 'Normal mode ready'
          : 'firmwareUpdateV4 returned error',
      );
      finishFirmwareTimingSummary(isSuccessResponse ? 'success' : 'failed');
      appendLog(`firmwareUpdateV4: done in ${formatDuration(durationMs)}`);
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const normalizedError = normalizeError(error);
      setFirmwareResult(normalizedError);
      setFirmwareStatus('firmwareUpdateV4 failed');
      setFirmwareProgress((prev) => ({
        progress: prev?.progress ?? 0,
        progressType: prev?.progressType ?? 'failed',
        transferredBytes: prev?.transferredBytes,
        totalBytes: prev?.totalBytes ?? PRO2_BLE_FIRMWARE_FILE_SIZE,
        rateBytesPerSecond: prev?.rateBytesPerSecond,
        elapsedMs: durationMs,
      }));
      finishFirmwareTimingSummary('failed');
      appendLog(
        `firmwareUpdateV4: failed in ${formatDuration(durationMs)} ${String(error)}`,
      );
    } finally {
      setBusyKey(undefined);
    }
  }, [
    appendLog,
    finishFirmwareStage,
    finishFirmwareTimingSummary,
    selectedConnectId,
    startFirmwareStage,
  ]);

  useEffect(() => {
    if (busyKey !== 'firmwareUpdateV4') {
      return undefined;
    }
    const timer = setInterval(() => setFirmwareTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [busyKey]);

  useEffect(() => {
    if (!hardwareUiState || !selectedConnectId) {
      return;
    }
    const isSelectedDeviceEvent =
      hardwareUiState.connectId === selectedConnectId ||
      (!hardwareUiState.connectId && busyKey === 'firmwareUpdateV4');
    if (!isSelectedDeviceEvent) {
      return;
    }

    const { action, payload } = hardwareUiState;
    const rawPayload = payload?.rawPayload as
      | Record<string, unknown>
      | undefined;

    if (action === EHardwareUiStateAction.FIRMWARE_TIP) {
      const firmwareTipData = rawPayload?.data as
        | { message?: unknown }
        | undefined;
      const message = String(
        payload?.firmwareTipData?.message ?? firmwareTipData?.message ?? '',
      );
      if (!message) {
        return;
      }
      setFirmwareStatus(getFirmwareStatusFromTip(message));
      appendLog(`firmwareUpdateV4 event: ${message}`);

      if (message === 'StartDownloadFirmware') {
        startFirmwareStage('prepare', 'Prepare package');
      } else if (message === 'FinishDownloadFirmware') {
        finishFirmwareStage('prepare');
      } else if (message === 'AutoRebootToBootloader') {
        startFirmwareStage('bootloader', 'Reboot to bootloader');
      } else if (message === 'GoToBootloaderSuccess') {
        finishFirmwareStage('bootloader');
      } else if (message === 'StartTransferData') {
        startFirmwareStage('transfer', 'Transfer data');
      } else if (message === 'ConfirmOnDevice') {
        finishFirmwareStage('transfer');
        startFirmwareStage('confirm', 'Confirm on device');
      } else if (message === 'FirmwareUpdating') {
        finishFirmwareStage('confirm');
        startFirmwareStage('install', 'Install firmware');
      } else if (message === 'SwitchFirmwareReconnectDevice') {
        finishFirmwareStage('install');
        startFirmwareStage('reboot', 'Reboot and poll');
        setFirmwareProgress((prev) => ({
          ...(prev || { progress: 0 }),
          progress: Math.max(prev?.progress ?? 0, 99),
          progressType: 'rebootNormal',
        }));
      } else if (message === 'FirmwareUpdateCompleted') {
        finishFirmwareStage('reboot');
        setFirmwareProgress((prev) => ({
          ...(prev || { progress: 0 }),
          progress: 100,
          progressType: 'completed',
        }));
      }
      return;
    }

    if (
      action !== EHardwareUiStateAction.DEVICE_PROGRESS &&
      action !== EHardwareUiStateAction.FIRMWARE_PROGRESS
    ) {
      return;
    }

    const progress = getFiniteNumber(
      payload?.firmwareProgress ?? rawPayload?.progress,
    );
    if (progress === undefined) {
      return;
    }

    const progressType = String(
      payload?.firmwareProgressType ?? rawPayload?.progressType ?? '',
    );
    const startedAt = firmwareStartedAtRef.current;
    const elapsedMs =
      getFiniteNumber(payload?.firmwareProgressElapsedMs) ??
      getFiniteNumber(rawPayload?.elapsedMs) ??
      (startedAt ? Date.now() - startedAt : undefined);
    const totalBytes =
      getFiniteNumber(payload?.firmwareProgressTotalBytes) ??
      getFiniteNumber(rawPayload?.totalBytes) ??
      PRO2_BLE_FIRMWARE_FILE_SIZE;
    const transferredBytes =
      getFiniteNumber(payload?.firmwareProgressTransferredBytes) ??
      getFiniteNumber(rawPayload?.transferredBytes) ??
      (totalBytes * clampProgress(progress)) / 100;
    const rateBytesPerSecond =
      getFiniteNumber(payload?.firmwareProgressRateBytesPerSecond) ??
      getFiniteNumber(rawPayload?.rateBytesPerSecond) ??
      (elapsedMs && elapsedMs > 0
        ? (transferredBytes / elapsedMs) * 1000
        : undefined);

    setFirmwareProgress({
      progress: clampProgress(progress),
      progressType,
      transferredBytes,
      totalBytes,
      rateBytesPerSecond,
      elapsedMs,
    });
    setFirmwareStatus(getFirmwareStatusFromProgressType(progressType));
  }, [
    appendLog,
    busyKey,
    finishFirmwareStage,
    hardwareUiState,
    selectedConnectId,
    startFirmwareStage,
  ]);

  const displayedFirmwareProgress = useMemo(() => {
    const progress = firmwareProgress?.progress;
    if (progress === undefined && busyKey !== 'firmwareUpdateV4') {
      return undefined;
    }
    const startedAt = firmwareStartedAtRef.current;
    const elapsedMs =
      firmwareProgress?.elapsedMs ??
      (startedAt ? (firmwareTick || Date.now()) - startedAt : undefined);
    const totalBytes =
      firmwareProgress?.totalBytes ?? PRO2_BLE_FIRMWARE_FILE_SIZE;
    const progressValue = clampProgress(progress ?? 0);
    const transferredBytes =
      firmwareProgress?.transferredBytes ?? (totalBytes * progressValue) / 100;
    const rateBytesPerSecond =
      firmwareProgress?.rateBytesPerSecond ??
      (elapsedMs && elapsedMs > 0
        ? (transferredBytes / elapsedMs) * 1000
        : undefined);

    return {
      progress: progressValue,
      progressType: firmwareProgress?.progressType,
      transferredBytes,
      totalBytes,
      rateBytesPerSecond,
      elapsedMs,
    };
  }, [busyKey, firmwareProgress, firmwareTick]);

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
                Protocol: V2 preset · File: {PRO2_DEMO_FILE_PATH}
              </SizableText>
              {actionGroups.map((group) => (
                <YStack key={group.key} gap="$2">
                  <SizableText size="$bodyMd">{group.title}</SizableText>
                  <XStack gap="$2" flexWrap="wrap">
                    {group.actions.map((action) => (
                      <Button
                        key={action.key}
                        size="small"
                        variant="secondary"
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
                </YStack>
              ))}
              <YStack gap="$2">
                <SizableText size="$bodyMd">Latest method response</SizableText>
                {lastMethodResult ? (
                  <>
                    <SizableText size="$bodySm" color="$textSubdued">
                      {lastMethodResult.label} · {lastMethodResult.method} ·{' '}
                      {lastMethodResult.pending
                        ? 'Running'
                        : formatDuration(lastMethodResult.durationMs)}{' '}
                      · {formatClock(lastMethodResult.updatedAt)}
                    </SizableText>
                    <ResultBlock
                      value={
                        lastMethodResult.error ??
                        lastMethodResult.response ??
                        'No response'
                      }
                    />
                  </>
                ) : (
                  <SizableText size="$bodySm" color="$textSubdued">
                    No method response yet
                  </SizableText>
                )}
              </YStack>
            </Section>

            <Section title="FirmwareUpdateV4">
              <SizableText size="$bodySm" color="$textSubdued">
                Protocol: V2 preset · BLE: {PRO2_BLE_FIRMWARE_FILE_NAME} ·{' '}
                {formatBytes(PRO2_BLE_FIRMWARE_FILE_SIZE)}
              </SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                Target: TARGET_BT(2) · {PRO2_FIRMWARE_STAGING_PATH} · chunk{' '}
                {PRO2_BLE_CHUNK_SIZE} B
              </SizableText>
              <YStack gap="$2">
                <XStack gap="$2" alignItems="center">
                  {busyKey === 'firmwareUpdateV4' ? (
                    <Spinner size="small" />
                  ) : null}
                  <SizableText size="$bodySm">
                    Status: {firmwareStatus}
                  </SizableText>
                </XStack>
                <Progress
                  size="medium"
                  value={displayedFirmwareProgress?.progress ?? 0}
                />
                <XStack gap="$3" flexWrap="wrap">
                  <SizableText size="$bodySm" color="$textSubdued">
                    Progress:{' '}
                    {displayedFirmwareProgress
                      ? `${displayedFirmwareProgress.progress.toFixed(1)}%`
                      : '-'}
                  </SizableText>
                  <SizableText size="$bodySm" color="$textSubdued">
                    Data:{' '}
                    {`${formatBytes(
                      displayedFirmwareProgress?.transferredBytes,
                    )} / ${formatBytes(displayedFirmwareProgress?.totalBytes)}`}
                  </SizableText>
                  <SizableText size="$bodySm" color="$textSubdued">
                    Speed:{' '}
                    {formatRate(displayedFirmwareProgress?.rateBytesPerSecond)}
                  </SizableText>
                  <SizableText size="$bodySm" color="$textSubdued">
                    Elapsed:{' '}
                    {formatDuration(displayedFirmwareProgress?.elapsedMs)}
                  </SizableText>
                  <SizableText size="$bodySm" color="$textSubdued">
                    Type: {displayedFirmwareProgress?.progressType || '-'}
                  </SizableText>
                </XStack>
                {firmwareTimingSummary ? (
                  <SizableText size="$bodySm" color="$textSubdued">
                    Summary: {firmwareTimingSummary.status} · total{' '}
                    {formatDuration(firmwareTimingSummary.totalDurationMs)}
                  </SizableText>
                ) : null}
                {firmwareTimings.length ? (
                  <YStack gap="$1">
                    {firmwareTimings.map((item) => (
                      <SizableText
                        key={`${item.key}-${item.startAt}`}
                        size="$bodySm"
                        color="$textSubdued"
                      >
                        {item.label}: {formatDuration(item.durationMs)}
                        {item.durationMs ? '' : ' running'}
                      </SizableText>
                    ))}
                  </YStack>
                ) : null}
                {firmwareResult ? <ResultBlock value={firmwareResult} /> : null}
              </YStack>
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
