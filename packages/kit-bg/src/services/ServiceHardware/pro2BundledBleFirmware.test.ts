import {
  buildPro2CoprocessorFirmwareUpdateParams,
  decodePro2BleFirmwareBase64,
} from './pro2BundledBleFirmware';

function encodePackage(magic: string, packageType: string) {
  const bytes = Buffer.alloc(16);
  bytes.write(magic, 0, 'utf8');
  bytes.write(packageType, 8, 'utf8');
  return bytes.toString('base64');
}

describe('bundled Pro 2 Bluetooth firmware', () => {
  test('decodes a coprocessor package without extra buffer bytes', () => {
    const binary = decodePro2BleFirmwareBase64(encodePackage('OKPP', 'COPR'));

    expect(binary.byteLength).toBe(16);
    expect(new Uint8Array(binary).subarray(0, 4)).toEqual(
      Uint8Array.from(Buffer.from('OKPP')),
    );
  });

  test('rejects a raw Bluetooth image', () => {
    expect(() =>
      decodePro2BleFirmwareBase64(encodePackage('5283', 'COPR')),
    ).toThrow('signed coprocessor package');
  });

  test('asks firmwareUpdateV4 to install only the coprocessor', () => {
    const binary = new ArrayBuffer(4);

    expect(buildPro2CoprocessorFirmwareUpdateParams(binary)).toEqual({
      platform: 'native',
      targetsToUpdate: ['coprocessor'],
      coprocessorBinary: binary,
    });
  });
});
