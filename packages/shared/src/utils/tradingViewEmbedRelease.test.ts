import { TRADING_VIEW_EMBED_PINNED_RELEASES } from './tradingViewEmbedPinnedReleases';
import {
  computeTradingViewEmbedIntegrity,
  getTradingViewEmbedRelease,
  getTradingViewEmbedReleaseForManifestUrl,
  getTradingViewEmbedReleaseManifestUrl,
  isTradingViewEmbedManifestIntegrityValid,
} from './tradingViewEmbedRelease';

const TEST_ORIGIN = 'https://tradingview.onekeytest.com';

describe('tradingViewEmbedRelease', () => {
  test('pins only trusted chart origins with full SHA-384 digests', () => {
    Object.entries(TRADING_VIEW_EMBED_PINNED_RELEASES).forEach(
      ([origin, release]) => {
        expect([
          'https://tradingview.onekey.so',
          'https://tradingview.onekeytest.com',
        ]).toContain(origin);
        if (release) {
          expect(release.version).toMatch(/^[0-9a-f]{40}$/);
          expect(release.manifestIntegrity).toMatch(
            /^sha384-[A-Za-z0-9+/]{64}$/,
          );
        }
      },
    );
  });

  test('builds the immutable manifest URL of a pinned release', () => {
    const release = getTradingViewEmbedRelease(TEST_ORIGIN);
    const manifestUrl = getTradingViewEmbedReleaseManifestUrl(TEST_ORIGIN);

    expect(release).toBeDefined();
    expect(manifestUrl).toBe(
      `${TEST_ORIGIN}/${release?.version ?? ''}/embed/embed-manifest.json`,
    );
    expect(getTradingViewEmbedReleaseForManifestUrl(manifestUrl ?? '')).toBe(
      release,
    );
  });

  test.each([
    `${TEST_ORIGIN}/embed/latest.json`,
    `${TEST_ORIGIN}/0000000000000000000000000000000000000000/embed/embed-manifest.json`,
    `${getTradingViewEmbedReleaseManifestUrl(TEST_ORIGIN) ?? ''}?v=1`,
    `https://evil.example/${
      getTradingViewEmbedRelease(TEST_ORIGIN)?.version ?? ''
    }/embed/embed-manifest.json`,
    'not a url',
  ])('does not treat %s as a pinned manifest', (manifestUrl) => {
    expect(getTradingViewEmbedReleaseForManifestUrl(manifestUrl)).toBe(
      undefined,
    );
  });

  test.each([
    'https://tradingview.onekey.so',
    'https://evil.example',
    '__proto__',
    'constructor',
  ])('has no release for %s', (origin) => {
    expect(getTradingViewEmbedRelease(origin)).toBe(undefined);
  });

  test('computes SRI digests over the exact bytes', async () => {
    const bytes = new TextEncoder().encode('abc');
    const release = {
      manifestIntegrity:
        'sha384-ywB1P0WjXou1oD1pmsZQBycsMqsO3tFjGotgWkP/W+2AhgcroefMI1i67KE0yCWn',
      version: 'test',
    };

    await expect(computeTradingViewEmbedIntegrity(bytes)).resolves.toBe(
      release.manifestIntegrity,
    );
    await expect(
      isTradingViewEmbedManifestIntegrityValid(bytes, release),
    ).resolves.toBe(true);
    await expect(
      isTradingViewEmbedManifestIntegrityValid(
        new TextEncoder().encode('abc\n'),
        release,
      ),
    ).resolves.toBe(false);
  });
});
