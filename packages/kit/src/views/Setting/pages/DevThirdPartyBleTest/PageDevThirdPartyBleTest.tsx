import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { HardwareErrorCode as HwkCode } from '@onekeyfe/hwk-adapter-core';
import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  Input,
  Page,
  SegmentControl,
  SizableText,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getThirdPartySearchTarget } from '@onekeyhq/kit/src/views/Onboardingv2/utils';
import type { IThirdPartyConnectedDevicePayload } from '@onekeyhq/kit-bg/src/services/ServiceHardware/adapters/types';
import { useThirdPartyHardwareUiStateAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  convertThirdPartyDeviceError,
  isThirdPartyHardwareCancelCode,
} from '@onekeyhq/shared/src/errors/utils/thirdPartyDeviceErrorUtils';
import type { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';
import type { IThirdPartyHardwareSearchTarget } from '@onekeyhq/shared/types/device';

import { showExportLogsDialog } from '../Tab/exportLogs/showExportLogsDialog';

import {
  describeFailure,
  formatClock,
  formatCode,
  formatLogLine,
  formatLogText,
} from './bleTestLog';
import {
  BLE_TEST_SCENARIOS,
  describeExpectation,
  judgeOutcome,
} from './scenarios';

import type { IBleTestFailure, IBleTestLogEntry } from './bleTestLog';
import type { IBleTestScenario, IBleTestVerdict } from './scenarios';
import type { SearchDevice } from '@onekeyfe/hd-core';

const EVM_PATH = "m/44'/60'/0'/0/0";
const SCAN_POLL_MS = 1500;
const SCAN_MAX_POLLS = 40;
const MAX_LOOP_COUNT = 50;
const MAX_VISIBLE_LOGS = 300;

const VENDOR_OPTIONS = [
  { label: 'Ledger', value: EHardwareVendor.ledger },
  { label: 'Trezor', value: EHardwareVendor.trezor },
];

const PLATFORM_NAMES: [boolean | undefined, string][] = [
  [platformEnv.isDesktopWin, 'Windows'],
  [platformEnv.isDesktopMac, 'macOS'],
  [platformEnv.isDesktopLinux, 'Linux'],
  [platformEnv.isNativeIOS, 'iOS'],
  [platformEnv.isNativeAndroid, 'Android'],
];
const PLATFORM_NAME =
  PLATFORM_NAMES.find(([matches]) => matches)?.[1] ??
  String(platformEnv.appPlatform ?? 'unknown');
const IS_BLE_SUPPORTED = Boolean(platformEnv.isNative || platformEnv.isDesktop);

const VERDICT_MARKS: Record<IBleTestVerdict, string> = {
  pass: ' ✅',
  mismatch: ' ❌',
};

const LOG_COLORS: Record<IBleTestLogEntry['level'], string> = {
  info: '$textSubdued',
  ok: '$textSuccess',
  fail: '$textCritical',
  event: '$textInfo',
};

type IScanTarget = IThirdPartyHardwareSearchTarget & { name?: string };

type IActiveConnection = {
  vendor: EHardwareVendor;
  device: IThirdPartyConnectedDevicePayload;
};

type ISavedDevice = {
  vendor: EHardwareVendor;
  connectId: string;
  deviceId: string;
  label: string;
};

type IStepResult<T> =
  | { ok: true; value: T }
  | { ok: false; failure: IBleTestFailure };

type IStepContext = {
  log: (entry: Omit<IBleTestLogEntry, 'id' | 'at' | 'scenarioId'>) => void;
  describeForUser: (failure: IBleTestFailure) => string;
  scenario: () => IBleTestScenario;
};

/** Carries an SDK `{ success: false, payload }` result out of a step. */
class BleStepFailure extends Error {
  constructor(readonly payload: unknown) {
    super('BLE test step failed');
  }
}

function unwrap<T>(
  result: { success: true; payload: T } | { success: false; payload: unknown },
): T {
  if (result.success) return result.payload;
  throw new BleStepFailure(result.payload);
}

async function runStep<T>(
  ctx: IStepContext,
  action: string,
  work: () => Promise<T>,
  options: { judge: boolean; summarize?: (value: T) => string },
): Promise<IStepResult<T>> {
  ctx.log({ level: 'info', action, text: '开始' });
  const startedAt = Date.now();
  try {
    const value = await work();
    ctx.log({
      level: 'ok',
      action,
      text: `成功 ${options.summarize?.(value) ?? ''}`.trim(),
      durationMs: Date.now() - startedAt,
      verdict: options.judge
        ? judgeOutcome(ctx.scenario(), { ok: true })
        : undefined,
    });
    return { ok: true, value };
  } catch (error) {
    const failure = describeFailure(
      error instanceof BleStepFailure ? error.payload : error,
    );
    ctx.log({
      level: 'fail',
      action,
      text: '失败',
      durationMs: Date.now() - startedAt,
      failure,
      userFacing: ctx.describeForUser(failure),
      verdict: options.judge
        ? judgeOutcome(ctx.scenario(), { ok: false, code: failure.code })
        : undefined,
    });
    return { ok: false, failure };
  }
}

const summarizeDevice = (device: IThirdPartyConnectedDevicePayload) =>
  [
    `model=${device.modelName ?? device.model ?? '-'}`,
    `label=${device.label ?? '-'}`,
    `connectId=${device.connectId}`,
    `deviceId=${device.deviceId || '-'}`,
    `operationId=${device.operationId}`,
  ].join(' ');

const truncate = (text: string, max = 600) =>
  text.length > max ? `${text.slice(0, max)}…` : text;

export default function PageDevThirdPartyBleTest() {
  const intl = useIntl();
  const { copyText } = useClipboard();
  const [uiState] = useThirdPartyHardwareUiStateAtom();
  const deviceScanner = useMemo(
    () => deviceUtils.getDeviceScanner({ backgroundApi: backgroundApiProxy }),
    [],
  );

  const [vendor, setVendor] = useState(EHardwareVendor.ledger);
  const vendorRef = useRef(vendor);
  const [scanning, setScanning] = useState(false);
  const scanGenerationRef = useRef(0);
  const [targets, setTargets] = useState<IScanTarget[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<IScanTarget>();
  const selectedTargetRef = useRef<IScanTarget | undefined>(undefined);
  const [active, setActive] = useState<IActiveConnection>();
  const activeRef = useRef<IActiveConnection | undefined>(undefined);
  const [saved, setSaved] = useState<ISavedDevice>();
  const savedRef = useRef<ISavedDevice | undefined>(undefined);
  const [busyAction, setBusyAction] = useState<string>();
  const busyRef = useRef(false);
  const stopLoopRef = useRef(false);
  const [loopCountText, setLoopCountText] = useState('5');
  const [scenarioId, setScenarioId] = useState(BLE_TEST_SCENARIOS[0].id);
  const scenarioIdRef = useRef(scenarioId);
  const [logs, setLogs] = useState<IBleTestLogEntry[]>([]);
  const logIdRef = useRef(0);
  const lastUiKeyRef = useRef<string | undefined>(undefined);

  const scenario =
    BLE_TEST_SCENARIOS.find((item) => item.id === scenarioId) ??
    BLE_TEST_SCENARIOS[0];

  const selectTarget = useCallback((target?: IScanTarget) => {
    selectedTargetRef.current = target;
    setSelectedTarget(target);
  }, []);

  const updateActive = useCallback((next?: IActiveConnection) => {
    activeRef.current = next;
    setActive(next);
  }, []);

  const updateSaved = useCallback((next: ISavedDevice) => {
    savedRef.current = next;
    setSaved(next);
  }, []);

  const appendLog = useCallback<IStepContext['log']>((entry) => {
    logIdRef.current += 1;
    const next: IBleTestLogEntry = {
      ...entry,
      id: logIdRef.current,
      at: Date.now(),
      scenarioId: scenarioIdRef.current,
    };
    setLogs((prev) => [...prev, next]);
  }, []);

  const describeForUser = useCallback(
    (failure: IBleTestFailure) => {
      if (isThirdPartyHardwareCancelCode(failure.code)) {
        return '静默，不提示（取消）';
      }
      const error = convertThirdPartyDeviceError(
        {
          error: failure.message,
          code: failure.code ?? HwkCode.UnknownError,
          params: failure.params,
        },
        { vendor: vendorRef.current, silentMode: true },
      );
      return error.key
        ? intl.formatMessage({ id: error.key as ETranslations }, error.info)
        : error.message;
    },
    [intl],
  );

  const stepContext = useMemo<IStepContext>(
    () => ({
      log: appendLog,
      describeForUser,
      scenario: () =>
        BLE_TEST_SCENARIOS.find((item) => item.id === scenarioIdRef.current) ??
        BLE_TEST_SCENARIOS[0],
    }),
    [appendLog, describeForUser],
  );

  // Log every device prompt the real flow raises (pairing, confirm, unlock).
  useEffect(() => {
    const key = uiState ? `${uiState.uiRequestId ?? ''}:${uiState.action}` : '';
    if (key === lastUiKeyRef.current) return;
    lastUiKeyRef.current = key;
    if (!uiState) return;
    const reason = uiState.payload?.reason
      ? ` reason=${uiState.payload.reason}`
      : '';
    appendLog({
      level: 'event',
      action: '设备/弹框状态',
      text: `${uiState.vendor} ${uiState.action}${reason}`,
    });
  }, [uiState, appendLog]);

  const stopScan = useCallback(async () => {
    scanGenerationRef.current += 1;
    setScanning(false);
    deviceScanner.stopScan();
    try {
      await deviceScanner.stopScanAndWait();
    } catch {
      deviceScanner.stopScan();
    }
  }, [deviceScanner]);

  const startScan = useCallback(() => {
    // The scanner is shared; never leave an earlier round polling.
    deviceScanner.stopScan();
    scanGenerationRef.current += 1;
    const generation = scanGenerationRef.current;
    const scanVendor = vendorRef.current;
    const seen = new Set<string>();
    const startedAt = Date.now();
    let polls = 0;
    const isCurrent = () => generation === scanGenerationRef.current;
    const finish = (text: string) => {
      scanGenerationRef.current += 1;
      setScanning(false);
      deviceScanner.stopScan();
      appendLog({ level: 'info', action: '扫描', text });
    };

    setScanning(true);
    setTargets([]);
    selectTarget(undefined);
    appendLog({
      level: 'info',
      action: '扫描',
      text: `开始（${scanVendor}，蓝牙）`,
    });
    deviceScanner.startDeviceScan(
      (response) => {
        if (!isCurrent() || !response.success) return;
        polls += 1;
        const found = response.payload.flatMap((device: SearchDevice) => {
          const target = getThirdPartySearchTarget(device);
          return target?.connectionType === 'ble'
            ? [{ ...target, name: device.name }]
            : [];
        });
        for (const target of found) {
          if (!seen.has(target.searchTargetId)) {
            seen.add(target.searchTargetId);
            appendLog({
              level: 'event',
              action: '扫描',
              text: `发现 ${target.name ?? target.label ?? '-'} id=${
                target.searchTargetId
              } 复用=${target.searchTargetReusePolicy ?? '-'}`,
            });
          }
        }
        setTargets(found);
        if (polls >= SCAN_MAX_POLLS) finish('结束（到时间了）');
      },
      () => undefined,
      1,
      SCAN_POLL_MS,
      SCAN_MAX_POLLS,
      scanVendor,
      {
        resetSession: true,
        discoveryMethod: 'searchDeviceTargets',
        transportType: 'ble',
        waitForAllTransports: true,
        onError: (error) => {
          if (!isCurrent()) return;
          scanGenerationRef.current += 1;
          setScanning(false);
          deviceScanner.stopScan();
          const failure = describeFailure(error);
          appendLog({
            level: 'fail',
            action: '扫描',
            text: '失败',
            durationMs: Date.now() - startedAt,
            failure,
            userFacing: describeForUser(failure),
            verdict: judgeOutcome(stepContext.scenario(), {
              ok: false,
              code: failure.code,
            }),
          });
        },
      },
    );
  }, [appendLog, describeForUser, deviceScanner, selectTarget, stepContext]);

  const runExclusive = useCallback(
    async (label: string, task: () => Promise<void>) => {
      if (busyRef.current) {
        appendLog({ level: 'info', action: label, text: '上一个操作还没结束' });
        return;
      }
      busyRef.current = true;
      setBusyAction(label);
      try {
        await task();
      } finally {
        busyRef.current = false;
        setBusyAction(undefined);
      }
    },
    [appendLog],
  );

  const connectStep = useCallback(async () => {
    const target = selectedTargetRef.current;
    if (!target) {
      appendLog({
        level: 'info',
        action: '连接/配对',
        text: '请先扫描并选择设备',
      });
      return { ok: false } as const;
    }
    await stopScan();
    return runStep(
      stepContext,
      '连接/配对',
      async () => {
        const device = unwrap(
          await backgroundApiProxy.serviceThirdPartyHardware.connectDevice({
            vendor: target.vendor,
            searchTargetId: target.searchTargetId,
          }),
        );
        updateActive({ vendor: target.vendor, device });
        updateSaved({
          vendor: target.vendor,
          connectId: device.connectId,
          deviceId: device.deviceId,
          label: device.label || target.name || device.connectId,
        });
        return device;
      },
      { judge: true, summarize: summarizeDevice },
    );
  }, [appendLog, stepContext, stopScan, updateActive, updateSaved]);

  const addressStep = useCallback(
    async (source: 'active' | 'saved') => {
      const action =
        source === 'active' ? '取地址（当前连接）' : '取地址（已保存的 ID）';
      let params:
        | { vendor: EHardwareVendor; connectId: string; deviceId: string }
        | undefined;
      const current = activeRef.current;
      const remembered = savedRef.current;
      if (source === 'active' && current) {
        // The open operation, as wallet creation reads it.
        params = {
          vendor: current.vendor,
          connectId: current.device.operationId,
          deviceId: current.device.deviceId,
        };
      }
      if (source === 'saved' && remembered) {
        // The stored device id, as a wallet reads it later.
        params = {
          vendor: remembered.vendor,
          connectId: remembered.connectId,
          deviceId: remembered.deviceId,
        };
      }
      if (!params) {
        appendLog({
          level: 'info',
          action,
          text:
            source === 'active'
              ? '当前没有连接，先点「连接/配对」'
              : '还没有连接成功过，先连一次',
        });
        return { ok: false } as const;
      }
      return runStep(
        stepContext,
        action,
        () =>
          backgroundApiProxy.serviceThirdPartyHardware.getEvmAddressByStandardWallet(
            { ...params, path: EVM_PATH },
          ),
        { judge: true, summarize: (address) => `address=${address ?? '(空)'}` },
      );
    },
    [appendLog, stepContext],
  );

  const releaseStep = useCallback(async () => {
    const current = activeRef.current;
    if (!current) {
      appendLog({ level: 'info', action: '释放连接', text: '当前没有连接' });
      return;
    }
    await runStep(
      stepContext,
      '释放连接',
      async () => {
        await backgroundApiProxy.serviceThirdPartyHardware.releaseOperation({
          vendor: current.vendor,
          operationId: current.device.operationId,
        });
      },
      { judge: false },
    );
    updateActive(undefined);
  }, [appendLog, stepContext, updateActive]);

  const deviceInfoStep = useCallback(async () => {
    const current = activeRef.current;
    if (!current) {
      appendLog({ level: 'info', action: '设备信息', text: '当前没有连接' });
      return;
    }
    if (current.vendor !== EHardwareVendor.ledger) {
      appendLog({
        level: 'info',
        action: '设备信息',
        text: `features=${truncate(JSON.stringify(current.device.features ?? {}))}`,
      });
      return;
    }
    await runStep(
      stepContext,
      '设备信息',
      async () =>
        unwrap(
          await backgroundApiProxy.serviceThirdPartyHardware.thirdPartyHardwareGetDeviceInfo(
            {
              vendor: current.vendor,
              connectId: current.device.operationId,
            },
          ),
        ),
      { judge: false, summarize: (info) => truncate(JSON.stringify(info)) },
    );
  }, [appendLog, stepContext]);

  const cancelCurrent = useCallback(async () => {
    const cancelVendor = activeRef.current?.vendor ?? vendorRef.current;
    stopLoopRef.current = true;
    appendLog({
      level: 'info',
      action: '取消当前操作',
      text: `已发送（${cancelVendor}）`,
    });
    await backgroundApiProxy.serviceThirdPartyHardware.thirdPartyHardwareCancel(
      {
        vendor: cancelVendor,
      },
    );
  }, [appendLog]);

  const runFullFlow = useCallback(async () => {
    const connected = await connectStep();
    if (!connected.ok) return false;
    const address = await addressStep('active');
    await releaseStep();
    return address.ok;
  }, [addressStep, connectStep, releaseStep]);

  const runLoop = useCallback(async () => {
    const parsed = Number.parseInt(loopCountText, 10);
    const total = Math.min(
      Math.max(Number.isNaN(parsed) ? 1 : parsed, 1),
      MAX_LOOP_COUNT,
    );
    stopLoopRef.current = false;
    let passed = 0;
    let finished = 0;
    for (let round = 1; round <= total; round += 1) {
      if (stopLoopRef.current) break;
      appendLog({
        level: 'info',
        action: '连续测试',
        text: `第 ${round}/${total} 次`,
      });
      // Rounds must run one after another against the same device.
      // eslint-disable-next-line no-await-in-loop
      const ok = await runFullFlow();
      finished = round;
      if (ok) passed += 1;
    }
    appendLog({
      level: passed === finished ? 'ok' : 'fail',
      action: '连续测试',
      text: `跑了 ${finished}/${total} 次，成功 ${passed}，失败 ${finished - passed}`,
    });
  }, [appendLog, loopCountText, runFullFlow]);

  const onVendorChange = useCallback(
    (value: string | number) => {
      const next = value as EHardwareVendor;
      vendorRef.current = next;
      setVendor(next);
      setTargets([]);
      selectTarget(undefined);
      void stopScan();
    },
    [selectTarget, stopScan],
  );

  const onScenarioChange = useCallback((id: string) => {
    scenarioIdRef.current = id;
    setScenarioId(id);
  }, []);

  const copyLogs = useCallback(() => {
    const header = [
      '第三方蓝牙测试日志',
      `平台: ${PLATFORM_NAME}`,
      `App: ${platformEnv.version ?? '-'} (${platformEnv.buildNumber ?? '-'})`,
      `导出时间: ${new Date().toISOString()}`,
    ];
    copyText(formatLogText(header, logs));
  }, [copyText, logs]);

  // Leave nothing scanning or connected behind when the page closes.
  useEffect(() => {
    const generationHolder = scanGenerationRef;
    const activeHolder = activeRef;
    return () => {
      generationHolder.current += 1;
      deviceScanner.stopScan();
      const current = activeHolder.current;
      if (current) {
        void backgroundApiProxy.serviceThirdPartyHardware
          .releaseOperation({
            vendor: current.vendor,
            operationId: current.device.operationId,
          })
          .catch(() => undefined);
      }
    };
  }, [deviceScanner]);

  const latestVerdicts = useMemo(() => {
    const byScenario = new Map<string, IBleTestLogEntry>();
    for (const entry of logs) {
      if (entry.verdict && entry.scenarioId) {
        byScenario.set(entry.scenarioId, entry);
      }
    }
    return byScenario;
  }, [logs]);

  const visibleLogs = logs.slice(-MAX_VISIBLE_LOGS);
  const isBusy = busyAction !== undefined;

  if (!IS_BLE_SUPPORTED) {
    return (
      <Page>
        <Page.Header title="第三方蓝牙测试" />
        <YStack p="$4">
          <SizableText>
            这个平台没有第三方蓝牙，只能在桌面端和手机上测。
          </SizableText>
        </YStack>
      </Page>
    );
  }

  return (
    <Page scrollEnabled>
      <Page.Header title="第三方蓝牙测试" />
      <YStack gap="$5" p="$4">
        <YStack gap="$2">
          <SizableText size="$bodySm" color="$textSubdued">
            {`平台 ${PLATFORM_NAME} · App ${platformEnv.version ?? '-'} (${
              platformEnv.buildNumber ?? '-'
            }) · 走的是跟引导页同一套后台流程`}
          </SizableText>
          <SegmentControl
            value={vendor}
            options={VENDOR_OPTIONS}
            onChange={onVendorChange}
          />
        </YStack>

        <YStack gap="$2">
          <SizableText size="$headingMd">1. 选场景</SizableText>
          <XStack flexWrap="wrap" gap="$2">
            {BLE_TEST_SCENARIOS.map((item) => {
              const verdict = latestVerdicts.get(item.id)?.verdict;
              const mark = verdict ? VERDICT_MARKS[verdict] : '';
              return (
                <Button
                  key={item.id}
                  testID={`dev-3p-ble-scenario-${item.id}`}
                  size="small"
                  variant={item.id === scenarioId ? 'primary' : 'secondary'}
                  onPress={() => onScenarioChange(item.id)}
                >
                  {`${item.id}${mark}`}
                </Button>
              );
            })}
          </XStack>
          <YStack gap="$1" p="$3" borderRadius="$3" bg="$bgSubdued">
            <SizableText size="$bodyMdMedium">{`${scenario.id} ${scenario.title}`}</SizableText>
            <SizableText size="$bodyMd">{scenario.steps}</SizableText>
            <SizableText size="$bodySm" color="$textSubdued">
              {`期望：${describeExpectation(scenario)}${
                scenario.expectNote ? `（${scenario.expectNote}）` : ''
              }`}
            </SizableText>
          </YStack>
        </YStack>

        <YStack gap="$2">
          <SizableText size="$headingMd">2. 扫描设备</SizableText>
          <XStack gap="$2">
            <Button
              size="small"
              testID="dev-3p-ble-scan"
              variant="primary"
              disabled={scanning || isBusy}
              onPress={startScan}
            >
              {scanning ? '扫描中…' : '扫描'}
            </Button>
            <Button
              size="small"
              testID="dev-3p-ble-stop-scan"
              disabled={!scanning}
              onPress={() => void stopScan()}
            >
              停止扫描
            </Button>
          </XStack>
          {targets.map((target) => (
            <Button
              key={target.searchTargetId}
              testID={`dev-3p-ble-target-${target.searchTargetId}`}
              size="small"
              variant={
                target.searchTargetId === selectedTarget?.searchTargetId
                  ? 'primary'
                  : 'secondary'
              }
              onPress={() => selectTarget(target)}
            >
              {`${target.name ?? target.label ?? '-'} · ${
                target.modelName ?? target.model ?? '-'
              } · ${target.searchTargetId}`}
            </Button>
          ))}
          {!scanning && targets.length === 0 ? (
            <SizableText size="$bodySm" color="$textSubdued">
              还没有设备，点「扫描」
            </SizableText>
          ) : null}
        </YStack>

        <YStack gap="$2">
          <SizableText size="$headingMd">3. 操作</SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            {`当前连接：${
              active
                ? `${active.vendor} ${summarizeDevice(active.device)}`
                : '无'
            }`}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            {`已保存设备：${
              saved ? `${saved.label} connectId=${saved.connectId}` : '无'
            }`}
          </SizableText>
          <XStack flexWrap="wrap" gap="$2">
            <Button
              size="small"
              variant="primary"
              testID="dev-3p-ble-connect"
              disabled={isBusy}
              onPress={() =>
                void runExclusive('连接/配对', async () => {
                  await connectStep();
                })
              }
            >
              连接/配对
            </Button>
            <Button
              size="small"
              testID="dev-3p-ble-address-active"
              disabled={isBusy}
              onPress={() =>
                void runExclusive('取地址', async () => {
                  await addressStep('active');
                })
              }
            >
              取地址（当前连接）
            </Button>
            <Button
              size="small"
              testID="dev-3p-ble-address-saved"
              disabled={isBusy}
              onPress={() =>
                void runExclusive('取地址', async () => {
                  await addressStep('saved');
                })
              }
            >
              取地址（已保存的 ID）
            </Button>
            <Button
              size="small"
              testID="dev-3p-ble-device-info"
              disabled={isBusy}
              onPress={() => void runExclusive('设备信息', deviceInfoStep)}
            >
              设备信息
            </Button>
            <Button
              size="small"
              testID="dev-3p-ble-release"
              disabled={isBusy}
              onPress={() => void runExclusive('释放连接', releaseStep)}
            >
              释放连接
            </Button>
            <Button
              size="small"
              testID="dev-3p-ble-cancel"
              variant="destructive"
              onPress={() => void cancelCurrent()}
            >
              取消当前操作
            </Button>
          </XStack>
          <XStack flexWrap="wrap" gap="$2" alignItems="center">
            <Button
              size="small"
              variant="primary"
              testID="dev-3p-ble-full-flow"
              disabled={isBusy}
              onPress={() =>
                void runExclusive('全流程', async () => {
                  await runFullFlow();
                })
              }
            >
              全流程：连接 → 取地址 → 释放
            </Button>
            <Input
              testID="dev-3p-ble-loop-count"
              size="small"
              width={64}
              keyboardType="number-pad"
              value={loopCountText}
              onChangeText={setLoopCountText}
            />
            <Button
              size="small"
              testID="dev-3p-ble-loop"
              disabled={isBusy}
              onPress={() => void runExclusive('连续测试', runLoop)}
            >
              连续 N 次
            </Button>
          </XStack>
          {busyAction ? (
            <SizableText size="$bodySm" color="$textInfo">
              {`进行中：${busyAction}`}
            </SizableText>
          ) : null}
        </YStack>

        <YStack gap="$2">
          <SizableText size="$headingMd">4. 结果汇总</SizableText>
          {BLE_TEST_SCENARIOS.filter((item) => latestVerdicts.has(item.id)).map(
            (item) => {
              const entry = latestVerdicts.get(item.id);
              if (!entry) return null;
              return (
                <SizableText
                  key={item.id}
                  size="$bodySm"
                  color={
                    entry.verdict === 'pass' ? '$textSuccess' : '$textCritical'
                  }
                >
                  {`${item.id} ${item.title}：${
                    entry.verdict ? VERDICT_MARKS[entry.verdict] : ''
                  } ${entry.action} ${
                    entry.failure ? formatCode(entry.failure.code) : '成功'
                  }（${formatClock(entry.at)}）`}
                </SizableText>
              );
            },
          )}
          {latestVerdicts.size === 0 ? (
            <SizableText size="$bodySm" color="$textSubdued">
              还没有结果
            </SizableText>
          ) : null}
        </YStack>

        <Divider />

        <YStack gap="$2">
          <XStack flexWrap="wrap" gap="$2" alignItems="center">
            <SizableText size="$headingMd">5. 日志</SizableText>
            <Button
              testID="dev-3p-ble-copy-logs"
              size="small"
              onPress={copyLogs}
            >
              复制日志
            </Button>
            <Button
              testID="dev-3p-ble-clear-logs"
              size="small"
              onPress={() => setLogs([])}
            >
              清空
            </Button>
            <Button
              testID="dev-3p-ble-export-logs"
              size="small"
              onPress={() => {
                void showExportLogsDialog({
                  title: '导出完整日志（含原生蓝牙日志）',
                });
              }}
            >
              导出完整日志
            </Button>
          </XStack>
          {visibleLogs.map((entry) => (
            <SizableText
              key={entry.id}
              size="$bodySm"
              color={LOG_COLORS[entry.level]}
            >
              {formatLogLine(entry)}
            </SizableText>
          ))}
        </YStack>
      </YStack>
    </Page>
  );
}
