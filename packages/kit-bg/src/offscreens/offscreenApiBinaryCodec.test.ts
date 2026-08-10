// cspell:ignore romloader
import {
  decodeOffscreenApiPayload,
  encodeOffscreenApiPayload,
} from './offscreenApiBinaryCodec';

function crossJsonOnlyBridge(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

describe('offscreenApiBinaryCodec', () => {
  test('preserves portfolio, wallpaper and NFT bytes across a JSON-only bridge', async () => {
    const portfolioBytes = new Uint8Array([1, 2, 3]).buffer;
    const wallpaperBacking = new Uint8Array([90, 4, 5, 6, 91]);
    const nftBacking = new Uint8Array([80, 7, 8, 9, 10, 81]);
    const payload = {
      portfolio: { packageBytes: portfolioBytes },
      wallpaper: { rgba: wallpaperBacking.subarray(1, 4) },
      nft: {
        image: { rgba: nftBacking.subarray(1, 3) },
        thumbnail: { rgba: nftBacking.subarray(3, 5) },
      },
    };

    const encoded = await encodeOffscreenApiPayload(payload);
    const decoded = decodeOffscreenApiPayload(
      crossJsonOnlyBridge(encoded),
    ) as typeof payload;

    expect(decoded.portfolio.packageBytes).toBeInstanceOf(ArrayBuffer);
    expect(Array.from(new Uint8Array(decoded.portfolio.packageBytes))).toEqual([
      1, 2, 3,
    ]);
    expect(decoded.wallpaper.rgba).toBeInstanceOf(Uint8Array);
    expect(Array.from(decoded.wallpaper.rgba)).toEqual([4, 5, 6]);
    expect(Array.from(decoded.nft.image.rgba)).toEqual([7, 8]);
    expect(Array.from(decoded.nft.thumbnail.rgba)).toEqual([9, 10]);
  });

  test('encodes Blob input as byte data', async () => {
    const encoded = await encodeOffscreenApiPayload(
      new Blob([new Uint8Array([11, 12])]),
    );
    const decoded = decodeOffscreenApiPayload(crossJsonOnlyBridge(encoded));

    expect(decoded).toBeInstanceOf(Uint8Array);
    expect(Array.from(decoded as Uint8Array)).toEqual([11, 12]);
  });

  test('preserves firmware update binaries across a JSON-only bridge', async () => {
    const binary = (...bytes: number[]) => Uint8Array.from(bytes).buffer;
    const payload = {
      firmwareUpdate: { binary: binary(1), updateType: 'firmware' },
      firmwareUpdateV2: { binary: binary(2), updateType: 'firmware' },
      firmwareUpdateV3: {
        bleBinary: binary(3),
        firmwareBinary: binary(4),
        bootloaderBinary: binary(5),
        resourceBinary: binary(6),
      },
      firmwareUpdateV4: {
        romloaderBinary: binary(7),
        bootloaderBinary: binary(8),
        applicationP1Binary: binary(9),
        applicationP2Binary: binary(10),
        coprocessorBinary: binary(11),
        se01Binary: binary(12),
        se02Binary: binary(13),
        se03Binary: binary(14),
        se04Binary: binary(15),
        resourceArchiveBinary: binary(16),
      },
      deviceUpdateBootloader: { binary: binary(17) },
      deviceFullyUploadResource: { binary: binary(18) },
    };

    const encoded = await encodeOffscreenApiPayload(payload);
    const decoded = decodeOffscreenApiPayload(
      crossJsonOnlyBridge(encoded),
    ) as typeof payload;

    const restoredBinaries = [
      decoded.firmwareUpdate.binary,
      decoded.firmwareUpdateV2.binary,
      decoded.firmwareUpdateV3.bleBinary,
      decoded.firmwareUpdateV3.firmwareBinary,
      decoded.firmwareUpdateV3.bootloaderBinary,
      decoded.firmwareUpdateV3.resourceBinary,
      decoded.firmwareUpdateV4.romloaderBinary,
      decoded.firmwareUpdateV4.bootloaderBinary,
      decoded.firmwareUpdateV4.applicationP1Binary,
      decoded.firmwareUpdateV4.applicationP2Binary,
      decoded.firmwareUpdateV4.coprocessorBinary,
      decoded.firmwareUpdateV4.se01Binary,
      decoded.firmwareUpdateV4.se02Binary,
      decoded.firmwareUpdateV4.se03Binary,
      decoded.firmwareUpdateV4.se04Binary,
      decoded.firmwareUpdateV4.resourceArchiveBinary,
      decoded.deviceUpdateBootloader.binary,
      decoded.deviceFullyUploadResource.binary,
    ];
    expect(
      restoredBinaries.map((value) => Array.from(new Uint8Array(value))),
    ).toEqual(Array.from({ length: 18 }, (_, index) => [index + 1]));
  });

  test('rejects malformed tagged binary data', () => {
    expect(() =>
      decodeOffscreenApiPayload({
        __onekey_offscreen_binary_payload__: 1,
        data: 'not-base64',
        type: 'uint8-array',
      }),
    ).toThrow('Invalid offscreen binary payload data');
  });
});
