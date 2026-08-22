import {
  createLocalMockDeviceClaimChallenge,
  runTrustedLocalMockDeviceClaim,
  verifyLocalMockDeviceClaimEvidence,
} from './localMockDeviceClaim';

describe('local mock third-party device claims', () => {
  it('creates a fresh 32-byte Web Crypto challenge', () => {
    const first = createLocalMockDeviceClaimChallenge();
    const second = createLocalMockDeviceClaimChallenge();

    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(second).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toBe(second);
  });

  it('accepts only verified production Trezor evidence', () => {
    expect(
      verifyLocalMockDeviceClaimEvidence({
        vendor: 'trezor',
        authenticity: {
          vendor: 'trezor',
          verified: true,
          deviceId: 'ab'.repeat(32),
          usedDebugKey: false,
        },
      }),
    ).toEqual({
      deviceId: 'ab'.repeat(32),
      verificationMode: 'trezor-sdk-genuine-check',
    });

    expect(() =>
      verifyLocalMockDeviceClaimEvidence({
        vendor: 'trezor',
        authenticity: {
          vendor: 'trezor',
          verified: true,
          deviceId: 'ab'.repeat(32),
          usedDebugKey: true,
        },
      }),
    ).toThrow('调试或预发布根密钥');
  });

  it('rejects a vendor mismatch or malformed device identifier', () => {
    expect(() =>
      verifyLocalMockDeviceClaimEvidence({
        vendor: 'ledger',
        authenticity: {
          vendor: 'trezor',
          verified: true,
          deviceId: 'ab'.repeat(32),
        },
      }),
    ).toThrow('其他厂商');

    expect(() =>
      verifyLocalMockDeviceClaimEvidence({
        vendor: 'ledger',
        authenticity: {
          vendor: 'ledger',
          verified: true,
          deviceId: 'not-a-device-id',
        },
      }),
    ).toThrow('Ledger 原厂验真');
  });

  it('returns the original voucher after re-verifying the same campaign device', async () => {
    const claims = new Map();
    const executeAuthenticityCheck = jest.fn(async () => ({
      vendor: 'ledger' as const,
      verified: true,
      deviceId: '56'.repeat(32),
    }));
    const params = {
      campaignId: 'campaign-1',
      vendor: 'ledger' as const,
      claims,
      executeAuthenticityCheck,
    };

    const first = await runTrustedLocalMockDeviceClaim(params);
    const second = await runTrustedLocalMockDeviceClaim(params);

    expect(executeAuthenticityCheck).toHaveBeenCalledTimes(2);
    expect(second.challengeHex).not.toBe(first.challengeHex);
    expect(second).toMatchObject({
      status: 'already_claimed',
      claimId: first.claimId,
      voucher: first.voucher,
    });

    const key = `campaign-1:ledger:${'56'.repeat(32)}`;
    const existing = claims.get(key);
    expect(existing).toBeDefined();
    claims.set(key, {
      ...existing!,
      voucher: {
        ...existing!.voucher,
        status: 'used',
        usedAt: 123,
      },
    });
    await expect(runTrustedLocalMockDeviceClaim(params)).resolves.toMatchObject(
      {
        status: 'already_claimed',
        voucher: { status: 'used', usedAt: 123 },
      },
    );
  });

  it('allows the same device to claim in a different campaign', async () => {
    const claims = new Map();
    const executeAuthenticityCheck = async (challenge: string) => ({
      vendor: 'trezor' as const,
      verified: true,
      deviceId: 'cd'.repeat(32),
      usedDebugKey: false,
      trezorProof: {
        challenge,
        deviceModel: 'T3T1',
        proof: {
          optiga_certificates: ['aa', 'bb'],
          optiga_signature: 'cc',
        },
      },
    });

    const first = await runTrustedLocalMockDeviceClaim({
      campaignId: 'campaign-1',
      vendor: 'trezor',
      claims,
      executeAuthenticityCheck,
    });
    const second = await runTrustedLocalMockDeviceClaim({
      campaignId: 'campaign-2',
      vendor: 'trezor',
      claims,
      executeAuthenticityCheck,
    });

    expect(first.status).toBe('issued');
    expect(second.status).toBe('issued');
    expect(second.claimId).not.toBe(first.claimId);
  });

  it('rejects a Trezor proof replayed from another challenge', async () => {
    await expect(
      runTrustedLocalMockDeviceClaim({
        campaignId: 'campaign-1',
        vendor: 'trezor',
        claims: new Map(),
        executeAuthenticityCheck: async () => ({
          vendor: 'trezor',
          verified: true,
          deviceId: 'cd'.repeat(32),
          usedDebugKey: false,
          trezorProof: {
            challenge: '00'.repeat(32),
            deviceModel: 'T3T1',
            proof: {
              optiga_certificates: ['aa', 'bb'],
              optiga_signature: 'cc',
            },
          },
        }),
      }),
    ).rejects.toThrow('challenge 不匹配');
  });
});
