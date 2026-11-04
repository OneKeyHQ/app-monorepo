import { chacha20poly1305 } from '@noble/ciphers/chacha';
import { z } from 'zod';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

// Per output the device seals: key image ‖ ring signature c ‖ r.
const SEALED_KEY_IMAGE_BYTES = 96;

const hex32 = z.string().regex(/^[0-9a-f]{64}$/);
const index = z.number().int().nonnegative();
const transfersSchema = z.object({
  items: z.array(
    z.object({
      outputId: index,
      outKey: hex32,
      txPubKey: hex32,
      additionalTxPubKey: hex32.nullable(),
      internalOutputIndex: index,
      subAddrMajor: index,
      subAddrMinor: index,
    }),
  ),
});

// One output as the runtime exports it for a device key image sync.
export type IXmrKeyImageTransfer = z.infer<
  typeof transfersSchema
>['items'][number];

export function parseXmrKeyImageTransfers(raw: string): IXmrKeyImageTransfer[] {
  const parsed = transfersSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new OneKeyLocalError('xmr: malformed key image sync data');
  }
  return parsed.data.items;
}

export type IXmrDeviceKeyImage = {
  keyImage: string;
  // c ‖ r of the one-member ring signature over the key image.
  signature: string;
};

// The device hands out the key only after the whole committed set went through
// it. Opening proves nothing about the content: the runtime checks each
// signature before using a key image.
export function openXmrDeviceKeyImages({
  encKey,
  keyImages,
}: {
  encKey: string;
  keyImages: { iv: string; blob: string }[];
}): IXmrDeviceKeyImage[] {
  const key = bufferUtils.hexToBytes(encKey);
  if (key.length !== 32) {
    throw new OneKeyLocalError('xmr: malformed key image sync key');
  }
  return keyImages.map(({ iv, blob }) => {
    let plain: Uint8Array;
    try {
      plain = chacha20poly1305(key, bufferUtils.hexToBytes(iv)).decrypt(
        bufferUtils.hexToBytes(blob),
      );
    } catch {
      throw new OneKeyLocalError(
        'xmr: key image from the device does not open',
      );
    }
    if (plain.length !== SEALED_KEY_IMAGE_BYTES) {
      throw new OneKeyLocalError('xmr: malformed key image from the device');
    }
    return {
      keyImage: bufferUtils.bytesToHex(plain.subarray(0, 32)),
      signature: bufferUtils.bytesToHex(plain.subarray(32)),
    };
  });
}
