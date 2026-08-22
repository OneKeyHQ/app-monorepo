import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { convertThirdPartyDeviceError } from '@onekeyhq/shared/src/errors/utils/thirdPartyDeviceErrorUtils';
import type {
  IThirdPartyDeviceRewardChallenge,
  IThirdPartyDeviceRewardClaimResult,
  IThirdPartyDeviceRewardClaimSuccess,
  IThirdPartyDeviceRewardTrezorProof,
  IThirdPartyDeviceRewardVendor,
} from '@onekeyhq/shared/src/hardware/thirdPartyDeviceReward';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import ServiceBase from '../ServiceBase';

import {
  type ILocalMockDeviceClaimRecord,
  runTrustedLocalMockDeviceClaim,
} from './localMockDeviceClaim';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

export const THIRD_PARTY_DEVICE_REWARD_CAMPAIGN_ID =
  'third-party-hardware-2026';

function copyRequiredString(
  value: unknown,
  fieldName: string,
  maxLength: number,
): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new OneKeyLocalError(`Invalid device reward ${fieldName}`);
  }
  return value;
}

function copyRequiredHex(
  value: unknown,
  fieldName: string,
  maxLength: number,
): string {
  const hex = copyRequiredString(value, fieldName, maxLength);
  if (hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) {
    throw new OneKeyLocalError(`Invalid device reward ${fieldName}`);
  }
  return hex;
}

function copyCertificateChain(
  value: unknown,
  fieldName: string,
  expectedLength: number,
  optional = false,
): string[] | undefined {
  if (
    optional &&
    (value === undefined || (Array.isArray(value) && value.length === 0))
  ) {
    return undefined;
  }
  if (!Array.isArray(value) || value.length !== expectedLength) {
    throw new OneKeyLocalError(`Invalid device reward ${fieldName}`);
  }
  return value.map((certificate) =>
    copyRequiredHex(certificate, fieldName, 24_000),
  );
}

function normalizeTrezorProof(
  input: IThirdPartyDeviceRewardTrezorProof,
): IThirdPartyDeviceRewardTrezorProof {
  const tropicCertificates = copyCertificateChain(
    input.tropic_certificates,
    'Tropic certificates',
    2,
    true,
  );
  const tropicSignature = input.tropic_signature
    ? copyRequiredHex(input.tropic_signature, 'Tropic signature', 4096)
    : undefined;
  const mcuCertificates = copyCertificateChain(
    input.mcu_certificates,
    'MCU certificates',
    1,
    true,
  );
  const mcuSignature = input.mcu_signature
    ? copyRequiredHex(input.mcu_signature, 'MCU signature', 8192)
    : undefined;
  if (
    Boolean(tropicCertificates) !== Boolean(tropicSignature) ||
    Boolean(mcuCertificates) !== Boolean(mcuSignature)
  ) {
    throw new OneKeyLocalError(
      'Invalid device reward certificate/signature pair',
    );
  }
  return {
    optiga_certificates: copyCertificateChain(
      input.optiga_certificates,
      'OPTIGA certificates',
      2,
    ) as string[],
    optiga_signature: copyRequiredHex(
      input.optiga_signature,
      'OPTIGA signature',
      4096,
    ),
    tropic_certificates: tropicCertificates,
    tropic_signature: tropicSignature,
    mcu_certificates: mcuCertificates,
    mcu_signature: mcuSignature,
  };
}

function normalizeClaimResult(
  input: unknown,
): IThirdPartyDeviceRewardClaimResult {
  if (!input || typeof input !== 'object') {
    throw new OneKeyLocalError('Invalid device reward claim response');
  }
  const claim = input as Record<string, unknown>;
  const failureStatuses = new Set([
    'challenge_expired',
    'challenge_consumed',
    'device_proof_invalid',
    'device_not_genuine',
    'ledger_session_incomplete',
    'not_eligible',
    'campaign_unavailable',
  ]);
  if (typeof claim.status === 'string' && failureStatuses.has(claim.status)) {
    return { status: claim.status } as IThirdPartyDeviceRewardClaimResult;
  }
  if (claim.status !== 'issued' && claim.status !== 'already_claimed') {
    throw new OneKeyLocalError('Invalid device reward claim response');
  }
  if (!claim.voucher || typeof claim.voucher !== 'object') {
    throw new OneKeyLocalError('Invalid device reward voucher response');
  }
  const voucher = claim.voucher as Record<string, unknown>;
  const voucherStatuses = new Set(['unused', 'used', 'expired', 'revoked']);
  if (
    voucher.campaignId !== THIRD_PARTY_DEVICE_REWARD_CAMPAIGN_ID ||
    typeof voucher.status !== 'string' ||
    !voucherStatuses.has(voucher.status) ||
    typeof voucher.issuedAt !== 'number' ||
    !Number.isFinite(voucher.issuedAt) ||
    typeof voucher.expiresAt !== 'number' ||
    !Number.isFinite(voucher.expiresAt) ||
    (voucher.usedAt !== undefined &&
      (typeof voucher.usedAt !== 'number' || !Number.isFinite(voucher.usedAt)))
  ) {
    throw new OneKeyLocalError('Invalid device reward voucher response');
  }
  return {
    status: claim.status,
    claimId: copyRequiredString(claim.claimId, 'claim id', 128),
    voucher: {
      campaignId: THIRD_PARTY_DEVICE_REWARD_CAMPAIGN_ID,
      code: copyRequiredString(voucher.code, 'voucher code', 512),
      status: voucher.status as 'unused' | 'used' | 'expired' | 'revoked',
      issuedAt: voucher.issuedAt as number,
      expiresAt: voucher.expiresAt as number,
      ...(voucher.usedAt === undefined
        ? {}
        : { usedAt: voucher.usedAt as number }),
    },
  };
}

@backgroundClass()
class ServiceThirdPartyDeviceReward extends ServiceBase {
  private localMockDeviceClaims = new Map<
    string,
    ILocalMockDeviceClaimRecord
  >();

  constructor({ backgroundApi }: { backgroundApi: IBackgroundApi }) {
    super({ backgroundApi });
  }

  private assertVendor(
    vendor: unknown,
  ): asserts vendor is IThirdPartyDeviceRewardVendor {
    if (vendor !== 'trezor' && vendor !== 'ledger') {
      throw new OneKeyLocalError('Invalid third-party reward vendor');
    }
  }

  private async createChallenge(
    vendor: IThirdPartyDeviceRewardVendor,
  ): Promise<IThirdPartyDeviceRewardChallenge> {
    const client = await this.getClient(EServiceEndpointEnum.Rebate);
    const response = await client.post<{
      data: IThirdPartyDeviceRewardChallenge;
    }>('/rebate/v1/device-rewards/challenges', {
      vendor,
      campaignId: THIRD_PARTY_DEVICE_REWARD_CAMPAIGN_ID,
    });
    const challenge = response.data.data;
    if (!challenge || challenge.vendor !== vendor) {
      throw new OneKeyLocalError(
        'The reward challenge did not match the selected device vendor.',
      );
    }
    copyRequiredString(challenge.challengeId, 'challenge id', 128);
    if (
      !Number.isFinite(challenge.expiresAt) ||
      challenge.expiresAt <= Date.now()
    ) {
      throw new OneKeyLocalError('The device reward challenge has expired');
    }
    if (
      challenge.vendor === 'trezor' &&
      !/^[0-9a-f]{64}$/.test(challenge.challengeHex)
    ) {
      throw new OneKeyLocalError('Invalid device reward challenge');
    }
    if (challenge.vendor === 'ledger') {
      copyRequiredString(
        challenge.ledgerRelay?.webSocketUrl,
        'Ledger relay URL',
        2048,
      );
    }
    return challenge;
  }

  private async claim(params: {
    challengeId: string;
    proof?: IThirdPartyDeviceRewardTrezorProof;
  }): Promise<IThirdPartyDeviceRewardClaimResult> {
    const challengeId = copyRequiredString(
      params.challengeId,
      'challenge id',
      128,
    );
    const proof = params.proof ? normalizeTrezorProof(params.proof) : undefined;
    const client = await this.getClient(EServiceEndpointEnum.Rebate);
    const response = await client.post<{
      data: IThirdPartyDeviceRewardClaimResult;
    }>('/rebate/v1/device-rewards/claims', {
      challengeId,
      ...(proof ? { proof } : {}),
    });
    return normalizeClaimResult(response.data.data);
  }

  @backgroundMethod()
  async verifyAndClaimThirdPartyDeviceReward(params: {
    vendor: IThirdPartyDeviceRewardVendor;
    connectId: string;
    dbDeviceId: string | undefined;
  }): Promise<IThirdPartyDeviceRewardClaimSuccess> {
    this.assertVendor(params.vendor);
    const dbDeviceId = copyRequiredString(
      params.dbDeviceId,
      'database device id',
      256,
    );
    const connectId = params.connectId
      ? copyRequiredString(params.connectId, 'connect id', 256)
      : '';
    if (params.vendor === 'trezor' && !connectId) {
      throw new OneKeyLocalError(
        'Reconnect the hardware wallet to verify this device.',
      );
    }

    const challenge = await this.createChallenge(params.vendor);
    const hardwareVendor =
      params.vendor === 'ledger'
        ? EHardwareVendor.ledger
        : EHardwareVendor.trezor;
    const authenticity =
      await this.backgroundApi.serviceThirdPartyHardware.thirdPartyHardwareVerifyDeviceAuthenticity(
        {
          vendor: hardwareVendor,
          connectId,
          dbDeviceId,
          challenge:
            challenge.vendor === 'trezor' ? challenge.challengeHex : undefined,
          ledgerGenuineCheckWebSocketUrl:
            challenge.vendor === 'ledger'
              ? challenge.ledgerRelay.webSocketUrl
              : undefined,
        },
      );
    if (!authenticity.success) {
      throw convertThirdPartyDeviceError(authenticity.payload, {
        vendor: params.vendor === 'trezor' ? 'Trezor' : 'Ledger',
      });
    }
    const result = authenticity.payload;
    if (
      !result.verified ||
      result.vendor !== params.vendor ||
      (params.vendor === 'trezor' && result.usedDebugKey)
    ) {
      throw new OneKeyLocalError(
        'The connected device could not be verified as genuine.',
      );
    }

    let proof: IThirdPartyDeviceRewardTrezorProof | undefined;
    if (challenge.vendor === 'trezor') {
      const trezorProof = result.trezorProof;
      if (!trezorProof || trezorProof.challenge !== challenge.challengeHex) {
        throw new OneKeyLocalError(
          'The Trezor proof did not match the server challenge.',
        );
      }
      proof = trezorProof.proof;
    }

    const claim = await this.claim({
      challengeId: challenge.challengeId,
      proof,
    });
    if (claim.status !== 'issued' && claim.status !== 'already_claimed') {
      throw new OneKeyLocalError(
        `Device reward was not issued: ${claim.status}`,
      );
    }
    return claim;
  }

  @backgroundMethod()
  async runLocalMockThirdPartyDeviceClaim(params: {
    vendor: EHardwareVendor;
    connectId: string;
    dbDeviceId: string;
  }) {
    if (!(await this.isDevModeEnabled())) {
      throw new OneKeyLocalError('Developer mode is required');
    }
    if (
      params.vendor !== EHardwareVendor.trezor &&
      params.vendor !== EHardwareVendor.ledger
    ) {
      throw new OneKeyLocalError('本地设备验真测试仅支持 Trezor 和 Ledger');
    }
    const vendor: IThirdPartyDeviceRewardVendor =
      params.vendor === EHardwareVendor.trezor ? 'trezor' : 'ledger';
    return runTrustedLocalMockDeviceClaim({
      campaignId: THIRD_PARTY_DEVICE_REWARD_CAMPAIGN_ID,
      vendor,
      claims: this.localMockDeviceClaims,
      executeAuthenticityCheck: async (challengeHex) => {
        const response =
          await this.backgroundApi.serviceThirdPartyHardware.thirdPartyHardwareVerifyDeviceAuthenticity(
            {
              vendor: params.vendor,
              connectId: params.connectId,
              dbDeviceId: params.dbDeviceId,
              challenge:
                params.vendor === EHardwareVendor.trezor
                  ? challengeHex
                  : undefined,
            },
          );
        if (!response.success) {
          throw convertThirdPartyDeviceError(response.payload, {
            vendor:
              params.vendor === EHardwareVendor.trezor ? 'Trezor' : 'Ledger',
          });
        }
        return response.payload;
      },
    });
  }
}

export default ServiceThirdPartyDeviceReward;
