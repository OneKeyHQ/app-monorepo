import { authenticateDeviceFromProof } from '@onekeyfe/hwk-trezor-adapter';

import {
  createLocalMockDeviceClaimChallenge,
  runTrustedLocalMockDeviceClaim,
  verifyLocalMockDeviceClaimEvidence,
} from './localMockDeviceClaim';

// cspell:ignore optiga
jest.mock('@onekeyfe/hwk-trezor-adapter', () => ({
  authenticateDeviceFromProof: jest.fn(),
}));

const verifyTrezorProof = jest.mocked(authenticateDeviceFromProof);

describe('verifyLocalMockDeviceClaimEvidence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a fresh 32-byte mock-server challenge', () => {
    const first = createLocalMockDeviceClaimChallenge();
    const second = createLocalMockDeviceClaimChallenge();

    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(second).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toBe(second);
  });

  it('independently verifies a Trezor raw proof against the mock-server challenge', () => {
    verifyTrezorProof.mockReturnValue({
      verified: true,
      deviceId: 'trezor-device-id',
      usedDebugKey: false,
    });
    const challengeHex = 'ab'.repeat(32);
    const proof = {
      optiga_certificates: ['certificate'],
      optiga_signature: 'signature',
    };

    expect(
      verifyLocalMockDeviceClaimEvidence({
        vendor: 'trezor',
        challengeHex,
        authenticity: {
          vendor: 'trezor',
          verified: true,
          trezorProof: {
            challenge: challengeHex,
            deviceModel: 'T3W1',
            proof,
          },
        },
      }),
    ).toEqual({
      deviceId: 'trezor-device-id',
      verificationMode: 'trezor-independent-proof',
      serverPortable: true,
    });
    expect(verifyTrezorProof).toHaveBeenCalledWith({
      proof,
      challenge: Buffer.from(challengeHex, 'hex'),
      deviceModel: 'T3W1',
    });
  });

  it('rejects a Trezor proof bound to another challenge', () => {
    expect(() =>
      verifyLocalMockDeviceClaimEvidence({
        vendor: 'trezor',
        challengeHex: 'ab'.repeat(32),
        authenticity: {
          vendor: 'trezor',
          verified: true,
          trezorProof: {
            challenge: 'cd'.repeat(32),
            deviceModel: 'T3W1',
            proof: {
              optiga_certificates: ['certificate'],
              optiga_signature: 'signature',
            },
          },
        },
      }),
    ).toThrow('challenge');
    expect(verifyTrezorProof).not.toHaveBeenCalled();
  });

  it('accepts only a real Ledger vendor verdict with a captured DSID', () => {
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
      serverPortable: false,
    });

    expect(() =>
      verifyLocalMockDeviceClaimEvidence({
        vendor: 'ledger',
        challengeHex: 'ab'.repeat(32),
        authenticity: {
          vendor: 'ledger',
          verified: false,
          deviceId: '12'.repeat(32),
        },
      }),
    ).toThrow('Genuine Check');
  });

  it('owns the challenge and runs the real Trezor executor before issuing', async () => {
    verifyTrezorProof.mockReturnValue({
      verified: true,
      deviceId: 'trezor-device-id',
      usedDebugKey: false,
    });
    const executeAuthenticityCheck = jest.fn(async (challengeHex: string) => ({
      vendor: 'trezor' as const,
      verified: true,
      trezorProof: {
        challenge: challengeHex,
        deviceModel: 'T3W1',
        proof: {
          optiga_certificates: ['certificate'],
          optiga_signature: 'signature',
        },
      },
    }));

    const result = await runTrustedLocalMockDeviceClaim({
      vendor: 'trezor',
      executeAuthenticityCheck,
    });

    expect(executeAuthenticityCheck).toHaveBeenCalledTimes(1);
    expect(executeAuthenticityCheck).toHaveBeenCalledWith(result.challengeHex);
    expect(result).toMatchObject({
      status: 'issued',
      deviceId: 'trezor-device-id',
      verificationMode: 'trezor-independent-proof',
      serverPortable: true,
    });
    expect(result.voucherCode).toContain(
      result.challengeHex.slice(0, 8).toUpperCase(),
    );
  });

  it('does not issue a Ledger voucher when the vendor session is not genuine', async () => {
    const executeAuthenticityCheck = jest.fn(async () => ({
      vendor: 'ledger' as const,
      verified: false,
      deviceId: '12'.repeat(32),
    }));

    await expect(
      runTrustedLocalMockDeviceClaim({
        vendor: 'ledger',
        executeAuthenticityCheck,
      }),
    ).rejects.toThrow('Genuine Check');
    expect(executeAuthenticityCheck).toHaveBeenCalledTimes(1);
  });
});
