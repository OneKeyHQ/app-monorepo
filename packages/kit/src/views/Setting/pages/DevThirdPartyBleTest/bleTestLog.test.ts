import { HardwareErrorCode as HwkCode } from '@onekeyfe/hwk-adapter-core';

import { describeFailure, formatCode, formatLogLine } from './bleTestLog';
import { BLE_TEST_SCENARIOS, judgeOutcome } from './scenarios';

const scenarios = Object.fromEntries(
  BLE_TEST_SCENARIOS.map((item) => [item.id, item]),
);
const scenario = (id: string) => scenarios[id];

describe('describeFailure', () => {
  it('reads an SDK failure payload', () => {
    expect(
      describeFailure({
        error: 'pairing did not complete',
        code: HwkCode.BlePairingTimeout,
        params: { phase: 'pairing' },
      }),
    ).toEqual({
      code: HwkCode.BlePairingTimeout,
      message: 'pairing did not complete',
      params: { phase: 'pairing' },
      className: undefined,
    });
  });

  it('prefers the SDK code a converted app error carries', () => {
    expect(
      describeFailure({
        className: 'ThirdPartyDeviceNotFound',
        code: -99_999,
        message: 'Device not found',
        payload: {
          code: HwkCode.DeviceNotFound,
          params: { notAdvertising: true },
        },
      }),
    ).toMatchObject({
      code: HwkCode.DeviceNotFound,
      params: { notAdvertising: true },
      className: 'ThirdPartyDeviceNotFound',
    });
  });

  it('keeps a numeric string code', () => {
    expect(describeFailure({ error: 'x', code: '10307' }).code).toBe(
      HwkCode.BleBondInvalid,
    );
  });
});

describe('judgeOutcome', () => {
  it('passes an expected failure code and flags anything else', () => {
    expect(
      judgeOutcome(scenario('P2'), {
        ok: false,
        code: HwkCode.BlePairingTimeout,
      }),
    ).toBe('pass');
    expect(
      judgeOutcome(scenario('P2'), {
        ok: false,
        code: HwkCode.BleConnectFailed,
      }),
    ).toBe('mismatch');
    expect(judgeOutcome(scenario('P2'), { ok: true })).toBe('mismatch');
  });

  it('passes success only where success is expected', () => {
    expect(judgeOutcome(scenario('P1'), { ok: true })).toBe('pass');
    expect(judgeOutcome(scenario('C1'), { ok: true })).toBe('mismatch');
  });
});

it('prints the code name, params and verdict in a log line', () => {
  expect(formatCode(HwkCode.BlePairingCancelled)).toBe(
    '10310 BlePairingCancelled',
  );
  const line = formatLogLine({
    id: 1,
    at: Date.now(),
    level: 'fail',
    scenarioId: 'C4',
    action: '扫描',
    text: '失败',
    durationMs: 1200,
    failure: {
      code: HwkCode.DevicePermissionDenied,
      message: 'Bluetooth is unavailable',
      params: { permissionDeniedReason: 'bluetoothTurnedOff' },
    },
    verdict: 'pass',
  });
  expect(line).toContain('[C4] 扫描 失败 1.2s 10303 DevicePermissionDenied');
  expect(line).toContain('"permissionDeniedReason":"bluetoothTurnedOff"');
  expect(line).toContain('✅');
});
