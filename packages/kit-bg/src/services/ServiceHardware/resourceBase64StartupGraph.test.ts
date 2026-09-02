import fs from 'fs';
import path from 'path';

describe('hardware resource Base64 startup graph', () => {
  test.each([
    ['ServiceHardware.ts', ['imageJpegBase64', 'packageBase64']],
    ['DeviceSettingsManager.ts', ['jpegBase64: screenBase64']],
    [
      '../../offscreens/OffscreenApiProxyBase.ts',
      ['requestToOffscreen(message)'],
    ],
  ])(
    '%s keeps resource calls JSON-safe without a global codec',
    (file, tokens) => {
      const source = fs.readFileSync(path.resolve(__dirname, file), 'utf8');

      expect(source).not.toContain('jpegRgbaUtils');
      expect(source).not.toContain('offscreenApiBinaryCodec');
      for (const token of tokens) {
        expect(source).toContain(token);
      }
    },
  );
});
