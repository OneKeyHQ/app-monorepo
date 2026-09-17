import { copyWalletSessionUiMetadata } from './hardwareUiPayloadUtils';

describe('copyWalletSessionUiMetadata', () => {
  test('保留旧字段并透传钱包会话协调器元数据', () => {
    const target = {
      passphraseState: 'state-a',
    } as any;

    expect(
      copyWalletSessionUiMetadata(target, {
        existsAttachPinUser: true,
        deviceOnly: true,
        source: 'wallet-session-coordinator',
        reason: 'session-recovery',
        expectedPassphraseState: 'state-a',
      }),
    ).toMatchObject({
      passphraseState: 'state-a',
      existsAttachPinUser: true,
      deviceOnly: true,
      source: 'wallet-session-coordinator',
      reason: 'session-recovery',
      expectedPassphraseState: 'state-a',
    });
  });

  test('为 Pro2 Host 输入保留 deviceOnly=false', () => {
    const target = {} as any;

    expect(
      copyWalletSessionUiMetadata(target, {
        existsAttachPinUser: true,
        deviceOnly: false,
        source: 'wallet-session-coordinator',
        reason: 'open-wallet',
      }),
    ).toMatchObject({
      existsAttachPinUser: true,
      deviceOnly: false,
      source: 'wallet-session-coordinator',
      reason: 'open-wallet',
    });
  });

  test('透传 Session 恢复的钱包标识和原因', () => {
    const target = {} as any;

    expect(
      copyWalletSessionUiMetadata(target, {
        deviceOnly: false,
        source: 'wallet-session-coordinator',
        reason: 'session-recovery',
        expectedPassphraseState: 'expected-state',
      }),
    ).toMatchObject({
      deviceOnly: false,
      source: 'wallet-session-coordinator',
      reason: 'session-recovery',
      expectedPassphraseState: 'expected-state',
    });
  });
});
