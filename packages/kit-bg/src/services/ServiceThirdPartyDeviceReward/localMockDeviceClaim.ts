import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IThirdPartyDeviceAuthenticityResult } from '@onekeyhq/shared/src/hardware/thirdPartyDeviceAuthenticity';
import type {
  IThirdPartyDeviceRewardVoucher,
  IThirdPartyDeviceRewardVendor,
} from '@onekeyhq/shared/src/hardware/thirdPartyDeviceReward';

export type ILocalMockDeviceClaimVerification = {
  deviceId: string;
  verificationMode: 'trezor-sdk-genuine-check' | 'ledger-sdk-genuine-check';
};

export type ILocalMockDeviceClaimRecord = {
  claimId: string;
  voucher: IThirdPartyDeviceRewardVoucher;
};

export type ILocalMockDeviceClaimStore = Map<
  string,
  ILocalMockDeviceClaimRecord
>;

export type ILocalMockDeviceClaimResult = ILocalMockDeviceClaimVerification & {
  status: 'issued' | 'already_claimed';
  challengeHex: string;
} & ILocalMockDeviceClaimRecord;

export function createLocalMockDeviceClaimChallenge(): string {
  const challenge = globalThis.crypto.getRandomValues(new Uint8Array(32));
  return [...challenge]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

export function verifyLocalMockDeviceClaimEvidence({
  vendor,
  authenticity,
}: {
  vendor: IThirdPartyDeviceRewardVendor;
  authenticity: IThirdPartyDeviceAuthenticityResult;
}): ILocalMockDeviceClaimVerification {
  if (authenticity.vendor !== vendor) {
    throw new OneKeyLocalError({
      message: '本地测试领取收到了其他厂商的设备证明',
    });
  }

  if (vendor === 'trezor') {
    if (!authenticity.verified) {
      throw new OneKeyLocalError({
        message: `Trezor 原厂验真失败：${
          authenticity.error || '设备接口返回验真未通过'
        }`,
      });
    }
    if (authenticity.usedDebugKey) {
      throw new OneKeyLocalError({
        message: 'Trezor 原厂验真拒绝了调试或预发布根密钥',
      });
    }
    if (
      !authenticity.deviceId ||
      !/^[0-9a-f]{64}$/i.test(authenticity.deviceId)
    ) {
      throw new OneKeyLocalError({
        message: 'Trezor 原厂验真未返回由验真公钥派生的设备标识',
      });
    }
    return {
      deviceId: authenticity.deviceId.toLowerCase(),
      verificationMode: 'trezor-sdk-genuine-check',
    };
  }

  if (
    !authenticity.verified ||
    !authenticity.deviceId ||
    !/^[0-9a-f]{64}$/i.test(authenticity.deviceId)
  ) {
    throw new OneKeyLocalError({
      message: 'Ledger 原厂验真未返回已验证的物理设备验真标识',
    });
  }
  return {
    deviceId: authenticity.deviceId.toLowerCase(),
    verificationMode: 'ledger-sdk-genuine-check',
  };
}

export async function runTrustedLocalMockDeviceClaim({
  campaignId,
  vendor,
  claims,
  executeAuthenticityCheck,
}: {
  campaignId: string;
  vendor: IThirdPartyDeviceRewardVendor;
  claims: ILocalMockDeviceClaimStore;
  executeAuthenticityCheck: (
    challengeHex: string,
  ) => Promise<IThirdPartyDeviceAuthenticityResult>;
}): Promise<ILocalMockDeviceClaimResult> {
  const challengeHex = createLocalMockDeviceClaimChallenge();
  const authenticity = await executeAuthenticityCheck(challengeHex);
  if (
    vendor === 'trezor' &&
    authenticity.trezorProof?.challenge !== challengeHex
  ) {
    throw new OneKeyLocalError({
      message: 'Trezor 本地证明与本次 challenge 不匹配',
    });
  }
  const verification = verifyLocalMockDeviceClaimEvidence({
    vendor,
    authenticity,
  });
  const deviceClaimKey = `${campaignId}:${vendor}:${verification.deviceId}`;
  const existingClaim = claims.get(deviceClaimKey);
  if (existingClaim) {
    return {
      status: 'already_claimed',
      challengeHex,
      ...verification,
      ...existingClaim,
    };
  }

  const voucherCode = `DEV-LOCAL-${vendor.toUpperCase()}-${challengeHex
    .slice(0, 8)
    .toUpperCase()}`;
  const issuedAt = Date.now();
  const claim: ILocalMockDeviceClaimRecord = {
    claimId: `local-${challengeHex}`,
    voucher: {
      campaignId,
      code: voucherCode,
      status: 'unused',
      issuedAt,
      expiresAt: issuedAt + 30 * 24 * 60 * 60 * 1000,
    },
  };
  claims.set(deviceClaimKey, claim);

  return {
    status: 'issued',
    challengeHex,
    ...verification,
    ...claim,
  };
}
