import { copyWalletSessionUiMetadata } from './hardwareUiPayloadUtils';

describe('copyWalletSessionUiMetadata', () => {
  test('保留旧字段并透传钱包会话协调器元数据', () => {
    const target = {
      passphraseState: 'state-a',
    } as any;

    expect(
      copyWalletSessionUiMetadata(target, {
        existsAttachPinUser: true,
        source: 'wallet-session-coordinator',
        reason: 'session-recovery',
        expectedPassphraseState: 'state-a',
      }),
    ).toMatchObject({
      passphraseState: 'state-a',
      existsAttachPinUser: true,
      source: 'wallet-session-coordinator',
      reason: 'session-recovery',
      expectedPassphraseState: 'state-a',
    });
  });
});
