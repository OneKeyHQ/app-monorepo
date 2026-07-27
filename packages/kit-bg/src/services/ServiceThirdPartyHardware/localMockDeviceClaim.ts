import {
  type AuthenticityProof,
  authenticateDeviceFromProof,
} from '@onekeyfe/hwk-trezor-adapter';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

type ILocalMockAuthenticityResult = {
  vendor: 'trezor' | 'ledger';
  verified: boolean;
  deviceId?: string;
  usedDebugKey?: boolean;
  trezorProof?: {
    challenge: string;
    deviceModel: string;
    proof: AuthenticityProof;
  };
};

export type ILocalMockDeviceClaimVerification = {
  deviceId: string;
  verificationMode: 'trezor-independent-proof' | 'ledger-vendor-genuine-check';
  serverPortable: boolean;
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
      !envelope ||
      envelope.challenge.toLowerCase() !== challengeHex.toLowerCase()
    ) {
      throw new OneKeyLocalError(
        'Trezor proof does not match the local mock-server challenge',
      );
    }
    const independentlyVerified = authenticateDeviceFromProof({
      proof: envelope.proof,
      challenge: Buffer.from(challengeHex, 'hex'),
      deviceModel: envelope.deviceModel,
    });
    if (
      !independentlyVerified.verified ||
      independentlyVerified.usedDebugKey ||
      !independentlyVerified.deviceId
    ) {
      throw new OneKeyLocalError(
        independentlyVerified.error ||
          'Local mock backend rejected the Trezor proof',
      );
    }
    return {
      deviceId: independentlyVerified.deviceId,
      verificationMode: 'trezor-independent-proof',
      serverPortable: true,
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
    // Ledger's public DMK verdict is real, but is not an offline proof a future
    // backend can trust. Production must witness the same session via relay.
    serverPortable: false,
  };
}

/**
 * Local stand-in for the future trusted backend. The caller supplies an
 * executor, not an attestation DTO: this function owns the fresh challenge,
 * invokes the real device/vendor session, verifies its result, and only then
 * issues the development voucher. A renderer cannot submit `verified: true`.
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
