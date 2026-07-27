import { authenticateDeviceFromProof } from '@onekeyfe/hwk-trezor-adapter';

import {
  createLocalMockDeviceClaimChallenge,
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
});
