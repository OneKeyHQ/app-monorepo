import { chacha20poly1305 } from '@noble/ciphers/chacha';

import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import {
  openXmrDeviceKeyImages,
  parseXmrKeyImageTransfers,
} from './deviceKeyImages';

describe('parseXmrKeyImageTransfers', () => {
  const item = {
    outputId: 7,
    outKey: 'aa'.repeat(32),
    txPubKey: 'bb'.repeat(32),
    additionalTxPubKey: null,
    internalOutputIndex: 1,
    subAddrMajor: 0,
    subAddrMinor: 2,
  };

  it('reads what the runtime exports', () => {
    expect(
      parseXmrKeyImageTransfers(JSON.stringify({ items: [item] })),
    ).toEqual([item]);
  });

  it('refuses malformed data before it can reach a device', () => {
    expect(() =>
      parseXmrKeyImageTransfers(
        JSON.stringify({ items: [{ ...item, outKey: 'aa' }] }),
      ),
    ).toThrow('malformed key image sync data');
  });
});

const key = new Uint8Array(32).fill(7);

function seal(plain: Uint8Array, nonceByte: number) {
  const iv = new Uint8Array(12).fill(nonceByte);
  return {
    iv: bufferUtils.bytesToHex(iv),
    blob: bufferUtils.bytesToHex(chacha20poly1305(key, iv).encrypt(plain)),
  };
}

describe('openXmrDeviceKeyImages', () => {
  it('splits each sealed entry into the key image and its signature, in order', () => {
    const first = new Uint8Array(96).map((_, i) => i);
    const second = new Uint8Array(96).fill(0xab);

    expect(
      openXmrDeviceKeyImages({
        encKey: bufferUtils.bytesToHex(key),
        keyImages: [seal(first, 1), seal(second, 2)],
      }),
    ).toEqual([
      {
        keyImage: bufferUtils.bytesToHex(first.subarray(0, 32)),
        signature: bufferUtils.bytesToHex(first.subarray(32)),
      },
      { keyImage: 'ab'.repeat(32), signature: 'ab'.repeat(64) },
    ]);
  });

  it('refuses an entry that fails authentication', () => {
    const sealed = seal(new Uint8Array(96), 1);
    const tampered = `${sealed.blob.slice(0, -2)}00`;

    expect(() =>
      openXmrDeviceKeyImages({
        encKey: bufferUtils.bytesToHex(key),
        keyImages: [{ iv: sealed.iv, blob: tampered }],
      }),
    ).toThrow('does not open');
  });

  it('refuses a key of the wrong size and an entry of the wrong size', () => {
    expect(() =>
      openXmrDeviceKeyImages({ encKey: '00', keyImages: [] }),
    ).toThrow('malformed key image sync key');
    expect(() =>
      openXmrDeviceKeyImages({
        encKey: bufferUtils.bytesToHex(key),
        keyImages: [seal(new Uint8Array(64), 1)],
      }),
    ).toThrow('malformed key image from the device');
  });
});
