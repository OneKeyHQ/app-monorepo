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

  it('accepts a verified production-root Trezor SDK result', () => {
    expect(
      verifyLocalMockDeviceClaimEvidence({
        vendor: 'trezor',
        authenticity: {
          vendor: 'trezor',
          verified: true,
          deviceId: 'trezor-device-id',
          usedDebugKey: false,
        },
      }),
    ).toEqual({
      deviceId: 'trezor-device-id',
      verificationMode: 'trezor-sdk-genuine-check',
    });
  });

  it('rejects an unverified or debug-key Trezor result with the SDK reason', () => {
    const validEvidence = {
      vendor: 'trezor' as const,
      verified: true,
      deviceId: 'trezor-device-id',
      usedDebugKey: false,
    };

    for (const authenticity of [
      {
        ...validEvidence,
        verified: false,
        error: 'INVALID_DEVICE_SIGNATURE',
      },
      { ...validEvidence, usedDebugKey: true },
    ]) {
      expect(() =>
        verifyLocalMockDeviceClaimEvidence({
          vendor: 'trezor',
          authenticity,
        }),
      ).toThrow('Trezor genuine check');
    }
  });

  it('surfaces the exact Trezor SDK verification failure', () => {
    expect(() =>
      verifyLocalMockDeviceClaimEvidence({
        vendor: 'trezor',
        authenticity: {
          vendor: 'trezor',
          verified: false,
          error: 'ROOT_PUBKEY_NOT_FOUND',
        },
      }),
    ).toThrow('Trezor genuine check failed: ROOT_PUBKEY_NOT_FOUND');
  });

  it('accepts only a genuine Ledger vendor result with a captured DSID', () => {
    expect(
      verifyLocalMockDeviceClaimEvidence({
        vendor: 'ledger',
        authenticity: {
          vendor: 'ledger',
          verified: true,
          deviceId: '12'.repeat(32),
          ledgerVerificationAuthority: 'onekey-local-dmk-server',
        },
      }),
    ).toEqual({
      deviceId: '12'.repeat(32),
      verificationMode: 'ledger-server-dmk-relay',
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
        ledgerVerificationAuthority: 'onekey-local-dmk-server' as const,
      },
      {
        vendor: 'ledger' as const,
        verified: true,
        deviceId: '12'.repeat(32),
      },
    ]) {
      expect(() =>
        verifyLocalMockDeviceClaimEvidence({
          vendor: 'ledger',
          authenticity,
        }),
      ).toThrow('Ledger DMK server');
    }
  });

  it('uses only the DEV voucher issued by the local Ledger DMK server', async () => {
    const result = await runTrustedLocalMockDeviceClaim({
      vendor: 'ledger',
      executeAuthenticityCheck: async () => ({
        vendor: 'ledger',
        verified: true,
        deviceId: '34'.repeat(32),
        ledgerVerificationAuthority: 'onekey-local-dmk-server',
        serverVoucherCode: 'DEV-LOCAL-LEDGER-A1B2C3D4',
      }),
    });

    expect(result).toMatchObject({
      status: 'issued',
      voucherCode: 'DEV-LOCAL-LEDGER-A1B2C3D4',
      deviceId: '34'.repeat(32),
      verificationMode: 'ledger-server-dmk-relay',
    });
  });

  it('runs the hardware check before issuing the local voucher', async () => {
    const executeAuthenticityCheck = jest.fn(async () => ({
      vendor: 'trezor' as const,
      verified: true,
      deviceId: 'trezor-device-id',
      usedDebugKey: false,
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
