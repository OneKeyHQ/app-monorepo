import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

type ILocalMockAuthenticityResult = {
  vendor: 'trezor' | 'ledger';
  verified: boolean;
  deviceId?: string;
  usedDebugKey?: boolean;
  trezorProof?: {
    challenge: string;
  };
};

export type ILocalMockDeviceClaimVerification = {
  deviceId: string;
  verificationMode: 'trezor-sdk-genuine-check' | 'ledger-vendor-genuine-check';
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
  challengeHex,
  authenticity,
}: {
  vendor: 'trezor' | 'ledger';
  challengeHex: string;
  authenticity: ILocalMockAuthenticityResult;
}): ILocalMockDeviceClaimVerification {
  if (authenticity.vendor !== vendor) {
    throw new OneKeyLocalError(
      'Local mock claim received evidence for another vendor',
    );
  }

  if (vendor === 'trezor') {
    const envelope = authenticity.trezorProof;
    if (
      !authenticity.verified ||
      authenticity.usedDebugKey ||
      !authenticity.deviceId ||
      !envelope ||
      envelope.challenge.toLowerCase() !== challengeHex.toLowerCase()
    ) {
      throw new OneKeyLocalError(
        'Trezor SDK genuine check did not verify this challenge',
      );
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
    throw new OneKeyLocalError(
      'Ledger Genuine Check did not return a verified physical-device DSID',
    );
  }
  return {
    deviceId: authenticity.deviceId.toLowerCase(),
    verificationMode: 'ledger-vendor-genuine-check',
  };
}

/**
 * Minimal local UI-flow check. The fresh challenge and hardware call happen in
 * the background service; a future backend must own an equivalent remote flow.
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
    challengeHex,
    authenticity,
  });

  return {
    status: 'issued',
    voucherCode: `DEV-LOCAL-${vendor.toUpperCase()}-${challengeHex
      .slice(0, 8)
      .toUpperCase()}`,
    challengeHex,
    ...verification,
  };
}
