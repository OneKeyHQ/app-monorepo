import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import ServiceThirdPartyDeviceReward, {
  THIRD_PARTY_DEVICE_REWARD_CAMPAIGN_ID,
} from './index';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

function createService() {
  const thirdPartyHardwareVerifyDeviceAuthenticity = jest.fn();
  const backgroundApi = {
    serviceThirdPartyHardware: {
      thirdPartyHardwareVerifyDeviceAuthenticity,
    },
  } as unknown as IBackgroundApi;
  const service = new ServiceThirdPartyDeviceReward({ backgroundApi });
  const post = jest.fn();
  jest.spyOn(service, 'getClient').mockResolvedValue({ post } as never);
  return {
    service,
    post,
    thirdPartyHardwareVerifyDeviceAuthenticity,
  };
}

function createClaim(status: 'issued' | 'already_claimed' = 'issued') {
  return {
    status,
    claimId: 'claim-1',
    voucher: {
      campaignId: THIRD_PARTY_DEVICE_REWARD_CAMPAIGN_ID,
      code: 'voucher-1',
      status: 'unused' as const,
      issuedAt: 1,
      expiresAt: 2,
    },
  };
}

describe('ServiceThirdPartyDeviceReward', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('runs the complete Trezor challenge, proof and claim flow', async () => {
    const { service, post, thirdPartyHardwareVerifyDeviceAuthenticity } =
      createService();
    const challengeHex = '12'.repeat(32);
    const mcuSignature = 'ab'.repeat(2420);
    const proof = {
      optiga_certificates: ['aa', 'bb'],
      optiga_signature: 'cc',
      tropic_certificates: [],
      mcu_certificates: ['dd'],
      mcu_signature: mcuSignature,
    };
    post
      .mockResolvedValueOnce({
        data: {
          data: {
            vendor: 'trezor',
            challengeId: 'challenge-1',
            challengeHex,
            expiresAt: Date.now() + 60_000,
          },
        },
      })
      .mockResolvedValueOnce({ data: { data: createClaim() } });
    thirdPartyHardwareVerifyDeviceAuthenticity.mockResolvedValue({
      success: true,
      payload: {
        vendor: 'trezor',
        verified: true,
        usedDebugKey: false,
        trezorProof: {
          challenge: challengeHex,
          deviceModel: 'T3W1',
          proof,
        },
      },
    });

    await expect(
      service.verifyAndClaimThirdPartyDeviceReward({
        vendor: 'trezor',
        connectId: 'trezor-connect-id',
        dbDeviceId: 'db-trezor',
      }),
    ).resolves.toEqual(createClaim());

    expect(post).toHaveBeenNthCalledWith(
      1,
      '/rebate/v1/device-rewards/challenges',
      {
        vendor: 'trezor',
        campaignId: THIRD_PARTY_DEVICE_REWARD_CAMPAIGN_ID,
      },
    );
    expect(thirdPartyHardwareVerifyDeviceAuthenticity).toHaveBeenCalledWith({
      vendor: EHardwareVendor.trezor,
      connectId: 'trezor-connect-id',
      dbDeviceId: 'db-trezor',
      challenge: challengeHex,
      ledgerGenuineCheckWebSocketUrl: undefined,
    });
    expect(post).toHaveBeenNthCalledWith(
      2,
      '/rebate/v1/device-rewards/claims',
      {
        challengeId: 'challenge-1',
        proof: {
          optiga_certificates: ['aa', 'bb'],
          optiga_signature: 'cc',
          tropic_certificates: undefined,
          tropic_signature: undefined,
          mcu_certificates: ['dd'],
          mcu_signature: mcuSignature,
        },
      },
    );
  });

  it('runs Ledger through the relay and claims with challengeId only', async () => {
    const { service, post, thirdPartyHardwareVerifyDeviceAuthenticity } =
      createService();
    const relayUrl =
      'wss://attestation.onekey.test/v1/ledger/session/opaque-token';
    post
      .mockResolvedValueOnce({
        data: {
          data: {
            vendor: 'ledger',
            challengeId: 'challenge-ledger',
            expiresAt: Date.now() + 60_000,
            ledgerRelay: { webSocketUrl: relayUrl },
          },
        },
      })
      .mockResolvedValueOnce({
        data: { data: createClaim('already_claimed') },
      });
    thirdPartyHardwareVerifyDeviceAuthenticity.mockResolvedValue({
      success: true,
      payload: {
        vendor: 'ledger',
        verified: true,
        deviceId: 'ab'.repeat(32),
      },
    });

    await expect(
      service.verifyAndClaimThirdPartyDeviceReward({
        vendor: 'ledger',
        connectId: '',
        dbDeviceId: 'db-ledger',
      }),
    ).resolves.toEqual(createClaim('already_claimed'));

    expect(thirdPartyHardwareVerifyDeviceAuthenticity).toHaveBeenCalledWith({
      vendor: EHardwareVendor.ledger,
      connectId: '',
      dbDeviceId: 'db-ledger',
      challenge: undefined,
      ledgerGenuineCheckWebSocketUrl: relayUrl,
    });
    expect(post).toHaveBeenNthCalledWith(
      2,
      '/rebate/v1/device-rewards/claims',
      { challengeId: 'challenge-ledger' },
    );
  });

  it('rejects an expired or vendor-mismatched challenge before hardware access', async () => {
    const { service, post, thirdPartyHardwareVerifyDeviceAuthenticity } =
      createService();
    post.mockResolvedValueOnce({
      data: {
        data: {
          vendor: 'ledger',
          challengeId: 'challenge-1',
          expiresAt: Date.now() - 1,
          ledgerRelay: { webSocketUrl: 'wss://example.test/session' },
        },
      },
    });

    await expect(
      service.verifyAndClaimThirdPartyDeviceReward({
        vendor: 'trezor',
        connectId: 'trezor-connect-id',
        dbDeviceId: 'db-trezor',
      }),
    ).rejects.toThrow('did not match');
    expect(thirdPartyHardwareVerifyDeviceAuthenticity).not.toHaveBeenCalled();
  });

  it('rejects a Trezor proof for another challenge', async () => {
    const { service, post, thirdPartyHardwareVerifyDeviceAuthenticity } =
      createService();
    post.mockResolvedValueOnce({
      data: {
        data: {
          vendor: 'trezor',
          challengeId: 'challenge-1',
          challengeHex: '12'.repeat(32),
          expiresAt: Date.now() + 60_000,
        },
      },
    });
    thirdPartyHardwareVerifyDeviceAuthenticity.mockResolvedValue({
      success: true,
      payload: {
        vendor: 'trezor',
        verified: true,
        trezorProof: {
          challenge: '34'.repeat(32),
          deviceModel: 'T3T1',
          proof: {
            optiga_certificates: ['aa', 'bb'],
            optiga_signature: 'cc',
          },
        },
      },
    });

    await expect(
      service.verifyAndClaimThirdPartyDeviceReward({
        vendor: 'trezor',
        connectId: 'trezor-connect-id',
        dbDeviceId: 'db-trezor',
      }),
    ).rejects.toThrow('did not match the server challenge');
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('rejects an incomplete optional proof layer before claim submission', async () => {
    const { service, post, thirdPartyHardwareVerifyDeviceAuthenticity } =
      createService();
    const challengeHex = '12'.repeat(32);
    post.mockResolvedValueOnce({
      data: {
        data: {
          vendor: 'trezor',
          challengeId: 'challenge-1',
          challengeHex,
          expiresAt: Date.now() + 60_000,
        },
      },
    });
    thirdPartyHardwareVerifyDeviceAuthenticity.mockResolvedValue({
      success: true,
      payload: {
        vendor: 'trezor',
        verified: true,
        trezorProof: {
          challenge: challengeHex,
          deviceModel: 'T3W1',
          proof: {
            optiga_certificates: ['aa', 'bb'],
            optiga_signature: 'cc',
            tropic_certificates: ['dd', 'ee'],
          },
        },
      },
    });

    await expect(
      service.verifyAndClaimThirdPartyDeviceReward({
        vendor: 'trezor',
        connectId: 'trezor-connect-id',
        dbDeviceId: 'db-trezor',
      }),
    ).rejects.toThrow('certificate/signature pair');
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('requires a selected database device for production claims', async () => {
    const { service, post } = createService();

    await expect(
      service.verifyAndClaimThirdPartyDeviceReward({
        vendor: 'ledger',
        connectId: '',
        dbDeviceId: undefined,
      }),
    ).rejects.toThrow('database device id');
    expect(post).not.toHaveBeenCalled();
  });
});
