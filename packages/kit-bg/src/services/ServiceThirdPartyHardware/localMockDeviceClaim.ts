import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

type ILocalMockAuthenticityResult = {
  vendor: 'trezor' | 'ledger';
  verified: boolean;
  deviceId?: string;
  usedDebugKey?: boolean;
  error?: string;
};

export type ILocalMockDeviceClaimVerification = {
  deviceId: string;
  verificationMode: 'trezor-sdk-genuine-check' | 'ledger-sdk-genuine-check';
};

export type ILocalMockDeviceClaimResult = ILocalMockDeviceClaimVerification & {
  status: 'issued';
  voucherCode: string;
  challengeHex: string;
};

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
  vendor: 'trezor' | 'ledger';
  authenticity: ILocalMockAuthenticityResult;
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
    if (!authenticity.deviceId) {
      throw new OneKeyLocalError({
        message: 'Trezor 原厂验真未返回物理设备的验真标识',
      });
    }
    return {
      deviceId: authenticity.deviceId,
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

/**
 * App-local mock for the future claim service. The async executor is the seam:
 * today it calls the hardware SDK directly; production replaces it with a
 * backend challenge/session API without changing the UI contract.
 */
export async function runTrustedLocalMockDeviceClaim({
  vendor,
  executeAuthenticityCheck,
}: {
  vendor: 'trezor' | 'ledger';
  executeAuthenticityCheck: (
    challengeHex: string,
  ) => Promise<ILocalMockAuthenticityResult>;
}): Promise<ILocalMockDeviceClaimResult> {
  const challengeHex = createLocalMockDeviceClaimChallenge();
  const authenticity = await executeAuthenticityCheck(challengeHex);
  const verification = verifyLocalMockDeviceClaimEvidence({
    vendor,
    authenticity,
  });
  const voucherCode = `DEV-LOCAL-${vendor.toUpperCase()}-${challengeHex
    .slice(0, 8)
    .toUpperCase()}`;
  if (
    !voucherCode ||
    !new RegExp(`^DEV-LOCAL-${vendor.toUpperCase()}-[0-9A-F]{8}$`).test(
      voucherCode,
    )
  ) {
    throw new OneKeyLocalError({
      message: '可信验真服务未签发本地测试券',
    });
  }

  return {
    status: 'issued',
    voucherCode,
    challengeHex,
    ...verification,
  };
}
