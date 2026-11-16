import { HardwareErrorCode as HwkCode } from '@onekeyfe/hwk-adapter-core';

export type IBleTestScenario = {
  id: string;
  title: string;
  /** How to set the scenario up on the device and the system. */
  steps: string;
  expectSuccess: boolean;
  expectCodes: number[];
  expectNote?: string;
};

export const BLE_TEST_SCENARIOS: IBleTestScenario[] = [
  {
    id: 'P1',
    title: '首次配对',
    steps:
      '先在系统蓝牙设置里忽略这台设备，设备保持解锁。扫描 → 选设备 → 连接/配对，在设备和电脑（手机）上确认配对码。',
    expectSuccess: true,
    expectCodes: [],
  },
  {
    id: 'P2',
    title: '在设备上拒绝配对',
    steps: '同 P1，出现配对码时在设备上拒绝。',
    expectSuccess: false,
    expectCodes: [HwkCode.BlePairingTimeout],
  },
  {
    id: 'P3',
    title: '在电脑/手机上取消配对',
    steps: '同 P1，出现配对弹框时在电脑或手机上点取消。',
    expectSuccess: false,
    expectCodes: [HwkCode.BlePairingCancelled, HwkCode.BlePairingTimeout],
    expectNote: 'Mac / iOS 系统配对框取消会报 10304',
  },
  {
    id: 'P4',
    title: '配对超时',
    steps: '同 P1，出现配对码后两边都不操作，等它自己结束（30–60 秒）。',
    expectSuccess: false,
    expectCodes: [HwkCode.BlePairingTimeout],
  },
  {
    id: 'P5',
    title: '配对后再次连接',
    steps:
      'P1 成功后点「释放连接」，再点「连接/配对」和「取地址」，不应再弹配对码。',
    expectSuccess: true,
    expectCodes: [],
  },
  {
    id: 'D1',
    title: '设备端删除配对',
    steps:
      '在设备上删除这台电脑（手机）的配对或重置设备，系统里保留配对，再点「连接/配对」。',
    expectSuccess: false,
    expectCodes: [HwkCode.BleBondInvalid, HwkCode.DeviceNotFound],
    expectNote: 'Ledger 应报 10307；Trezor 不在配对模式时可能报 10100',
  },
  {
    id: 'D2',
    title: '电脑/手机端删除配对',
    steps: '在系统蓝牙设置里忽略设备，设备上保留配对，再点「连接/配对」。',
    expectSuccess: true,
    expectCodes: [HwkCode.BlePairingTimeout],
    expectNote: '能重新配对成功最好；Trezor 可能报 10304',
  },
  {
    id: 'C1',
    title: '设备锁屏/休眠/关机',
    steps:
      '已配对的设备锁屏、休眠或关机，点「连接/配对」或「用已保存的 ID 取地址」。',
    expectSuccess: false,
    expectCodes: [HwkCode.DeviceNotFound],
  },
  {
    id: 'C2',
    title: '使用中断开',
    steps: '连接成功后把设备关机或拿远，再点「取地址（当前连接）」。',
    expectSuccess: false,
    expectCodes: [HwkCode.DeviceDisconnected],
  },
  {
    id: 'C3',
    title: '被别的 App 或电脑占用',
    steps:
      '设备先连上 Ledger Live / Trezor Suite 或另一台电脑，再点「连接/配对」。',
    expectSuccess: false,
    expectCodes: [HwkCode.DeviceNotFound, HwkCode.DeviceBusy],
  },
  {
    id: 'C4',
    title: '蓝牙关闭/没有权限',
    steps: '关掉系统蓝牙，或撤销 App 的蓝牙权限，再点「扫描」或「连接/配对」。',
    expectSuccess: false,
    expectCodes: [HwkCode.DevicePermissionDenied],
    expectNote:
      'params.permissionDeniedReason 应为 bluetoothTurnedOff 或 permissionDenied',
  },
  {
    id: 'C5',
    title: 'App 内中途取消',
    steps: '点「连接/配对」后，在连接或配对过程中点「取消当前操作」。',
    expectSuccess: false,
    expectCodes: [HwkCode.BlePairingCancelled, HwkCode.UserAborted],
  },
  {
    id: 'R',
    title: '回归：连续多次',
    steps:
      '先扫描并选好设备，填次数后点「连续 N 次」，每次都是连接 → 取地址 → 释放。',
    expectSuccess: true,
    expectCodes: [],
  },
];

export type IBleTestOutcome = { ok: true } | { ok: false; code?: number };

export type IBleTestVerdict = 'pass' | 'mismatch';

export function judgeOutcome(
  scenario: IBleTestScenario,
  outcome: IBleTestOutcome,
): IBleTestVerdict {
  if (outcome.ok) return scenario.expectSuccess ? 'pass' : 'mismatch';
  return outcome.code !== undefined &&
    scenario.expectCodes.includes(outcome.code)
    ? 'pass'
    : 'mismatch';
}

export function describeExpectation(scenario: IBleTestScenario): string {
  const parts = scenario.expectCodes.map((code) =>
    `${code} ${HwkCode[code] ?? ''}`.trim(),
  );
  if (scenario.expectSuccess) parts.unshift('成功');
  return parts.join(' / ');
}
