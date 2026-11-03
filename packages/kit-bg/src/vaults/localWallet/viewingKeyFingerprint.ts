import { sha256 } from '@noble/hashes/sha256';

import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

const VIEWING_KEY_FINGERPRINT_DOMAIN = 'onekey:privacy-chain:vkfp:v1:';

// Names a viewing key without revealing it: one-way, never leaves the device.
// Changing the format re-identifies every stored key.
export function getViewingKeyFingerprint({
  networkId,
  viewingKey,
}: {
  networkId: string;
  viewingKey: string;
}): string {
  return bufferUtils
    .bytesToHex(
      sha256(
        bufferUtils.toBuffer(
          `${VIEWING_KEY_FINGERPRINT_DOMAIN}${networkId}:${viewingKey}`,
          'utf8',
        ),
      ),
    )
    .slice(0, 32);
}
