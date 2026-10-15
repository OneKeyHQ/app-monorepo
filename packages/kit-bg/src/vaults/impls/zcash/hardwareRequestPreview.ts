import type {
  IZcashPcztReviewRequest,
  IZcashTransparentTxRequest,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';

import type { IBackgroundApi } from '../../../apis/IBackgroundApi';

// Dev-only. A software account built from the same mnemonic as a test device
// produces the same keys, so the PCZT below is exactly what the hardware
// keyring would ask the device to sign for this transaction. Firmware can be
// checked against it without a device on the app side. Mirrors
// KeyringHardware's zcashSignPczt calls; keep the two in sync.

// The preview stops the send: printing must not cost the tester real funds.
export const ZCASH_HW_PREVIEW_STOP_MESSAGE =
  'Zcash hardware request printed to the console. Nothing was signed or sent.';

type IAccountKeys = {
  seedFingerprintHex: string;
};

function memoPreview(memoHex: string | undefined) {
  if (!memoHex) return undefined;
  const bytes = Buffer.from(memoHex, 'hex');
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) end -= 1;
  const body = bytes.subarray(0, end);
  const printableAscii = body.every((b) => b >= 0x20 && b <= 0x7e);
  return {
    hex: memoHex,
    firstByte: `0x${bytes[0]?.toString(16).padStart(2, '0') ?? '00'}`,
    text: printableAscii ? body.toString('ascii') : undefined,
  };
}

// One block per send: the SDK call to make and what the device must show.
function print({
  flow,
  keys,
  pcztHex,
  expectedOnScreen,
}: {
  flow: 'shielded' | 'transparent';
  keys: IAccountKeys;
  pcztHex: string;
  expectedOnScreen: Record<string, unknown>;
}) {
  console.log(
    `[zcash-hw-preview] ${flow} send: sign test\n`,
    JSON.stringify(
      {
        method: 'zcashSignPczt',
        params: { pczt: pcztHex },
        expectedOnScreen,
        // A device holding another seed rejects with "Seed fingerprint mismatch".
        deviceSeedFingerprint: keys.seedFingerprintHex,
      },
      null,
      2,
    ),
  );
}

export async function isZcashHardwarePreviewEnabled(
  backgroundApi: IBackgroundApi,
): Promise<boolean> {
  const devSettings = await backgroundApi.serviceDevSetting.getDevSetting();
  return !!(
    devSettings.enabled && devSettings.settings?.zcashHardwareRequestPreview
  );
}

export function printZcashShieldedHardwarePreview({
  keys,
  unprovedPcztHex,
  review,
}: {
  keys: IAccountKeys;
  unprovedPcztHex: string;
  review: IZcashPcztReviewRequest;
}) {
  print({
    flow: 'shielded',
    keys,
    // The device signs the UNPROVED PCZT; proving happens after it returns.
    pcztHex: unprovedPcztHex,
    expectedOnScreen: {
      toAddress: review.toAddress,
      amountZat: review.amountZat,
      feeZat: review.feeZat,
      spendSource: review.spendSource,
      isMaxSend: review.isMaxSend,
      memo: memoPreview(review.memoHex),
    },
  });
}

export function printZcashTransparentHardwarePreview({
  keys,
  request,
  pcztHex,
}: {
  keys: IAccountKeys;
  request: IZcashTransparentTxRequest;
  pcztHex: string;
}) {
  print({
    flow: 'transparent',
    keys,
    pcztHex,
    expectedOnScreen: {
      inputs: request.selectedOutpoints,
      recipients: request.recipients.map((r) => ({
        address: r.address,
        amountZat: r.amountZat,
        memo: memoPreview(r.memoHex),
      })),
      change: request.change,
      sendMax: request.sendMax,
      expiryHeight: request.expiryHeight,
    },
  });
}
