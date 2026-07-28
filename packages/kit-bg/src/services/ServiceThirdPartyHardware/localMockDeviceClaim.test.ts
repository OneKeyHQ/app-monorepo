import {
  createLocalMockDeviceClaimChallenge,
  runTrustedLocalMockDeviceClaim,
  verifyLocalMockDeviceClaimEvidence,
} from './localMockDeviceClaim';

describe('verifyLocalMockDeviceClaimEvidence', () => {
  it('creates a fresh 32-byte Web Crypto challenge', () => {
    const first = createLocalMockDeviceClaimChallenge();
    const second = createLocalMockDeviceClaimChallenge();

    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(second).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toBe(second);
  });

  it('accepts a real Trezor SDK result bound to the fresh challenge', () => {
    const challengeHex = 'ab'.repeat(32);

    expect(
      verifyLocalMockDeviceClaimEvidence({
        vendor: 'trezor',
        challengeHex,
        authenticity: {
          vendor: 'trezor',
          verified: true,
          deviceId: 'trezor-device-id',
          usedDebugKey: false,
          trezorProof: {
            challenge: challengeHex,
          },
        },
      }),
    ).toEqual({
      deviceId: 'trezor-device-id',
      verificationMode: 'trezor-sdk-genuine-check',
    });
  });

  it('rejects an unverified, debug-key, or stale Trezor result', () => {
    const challengeHex = 'ab'.repeat(32);
    const validEvidence = {
      vendor: 'trezor' as const,
      verified: true,
      deviceId: 'trezor-device-id',
      usedDebugKey: false,
      trezorProof: {
        challenge: challengeHex,
      },
    };

    for (const authenticity of [
      { ...validEvidence, verified: false },
      { ...validEvidence, usedDebugKey: true },
      {
        ...validEvidence,
        trezorProof: {
          challenge: 'cd'.repeat(32),
        },
      },
    ]) {
      expect(() =>
        verifyLocalMockDeviceClaimEvidence({
          vendor: 'trezor',
          challengeHex,
          authenticity,
        }),
      ).toThrow('Trezor SDK genuine check');
    }
  });

  it('accepts only a genuine Ledger vendor result with a captured DSID', () => {
    expect(
      verifyLocalMockDeviceClaimEvidence({
        vendor: 'ledger',
        challengeHex: 'ab'.repeat(32),
        authenticity: {
          vendor: 'ledger',
          verified: true,
          deviceId: '12'.repeat(32),
        },
      }),
    ).toEqual({
      deviceId: '12'.repeat(32),
      verificationMode: 'ledger-vendor-genuine-check',
    });

    for (const authenticity of [
      {
        vendor: 'ledger' as const,
        verified: false,
        deviceId: '12'.repeat(32),
      },
      {
        vendor: 'ledger' as const,
        verified: true,
        deviceId: 'not-a-dsid',
      },
    ]) {
      expect(() =>
        verifyLocalMockDeviceClaimEvidence({
          vendor: 'ledger',
          challengeHex: 'ab'.repeat(32),
          authenticity,
        }),
      ).toThrow('Genuine Check');
    }
  });

  it('runs the hardware check before issuing the local voucher', async () => {
    const executeAuthenticityCheck = jest.fn(async (challengeHex: string) => ({
      vendor: 'trezor' as const,
      verified: true,
      deviceId: 'trezor-device-id',
      usedDebugKey: false,
      trezorProof: {
        challenge: challengeHex,
      },
    }));

    const result = await runTrustedLocalMockDeviceClaim({
      vendor: 'trezor',
      executeAuthenticityCheck,
    });

    expect(executeAuthenticityCheck).toHaveBeenCalledWith(result.challengeHex);
    expect(result).toMatchObject({
      status: 'issued',
      deviceId: 'trezor-device-id',
      verificationMode: 'trezor-sdk-genuine-check',
    });
    expect(result.voucherCode).toContain(
      result.challengeHex.slice(0, 8).toUpperCase(),
    );
  });
});
