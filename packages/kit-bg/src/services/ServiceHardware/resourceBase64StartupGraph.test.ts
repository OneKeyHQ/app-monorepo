import fs from 'fs';
import path from 'path';

// Exempt from the test-integrity source-text rule, see
// development/lint/test-integrity.allowlist.json. On iOS, Android and the
// extension, main and bg are isolated JS runtimes and hardware resources cross
// between them as JSON. A binary codec anywhere on that path breaks the
// crossing, and that is a property of the module graph rather than of any
// single call, so no invocation can demonstrate its absence.
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
