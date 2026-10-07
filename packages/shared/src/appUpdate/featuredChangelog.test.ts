import { normalizeFeaturedChangelog } from './featuredChangelog';

const media = { mediaUrl: 'https://cdn.onekey.so/a.png', mediaType: 'image' };

describe('Featured Changelog action normalization', () => {
  test('next drops any stale label and jump so the final page can only finish', () => {
    const result = normalizeFeaturedChangelog(
      {
        version: '6.6.0',
        features: [
          {
            ...media,
            ctaAction: 'next',
            ctaText: 'Try it',
            href: 'https://onekey.so',
            mode: 3,
            payload: 'https://onekey.so',
          },
        ],
      },
      '6.6.0',
    );
    expect(result?.features).toEqual([
      { ...media, ctaAction: 'next', title: undefined, description: undefined },
    ]);
  });
  test('legacy features retain their label and link; invalid media is excluded', () => {
    const result = normalizeFeaturedChangelog({
      version: '6.6.0',
      features: [
        { ...media, href: 'https://onekey.so', ctaText: 'Visit' },
        { ...media, mediaUrl: 'http://example.com/a.png', ctaAction: 'next' },
      ],
    });
    expect(result?.features).toHaveLength(1);
    expect(result?.features[0]).toMatchObject({
      href: 'https://onekey.so',
      ctaText: 'Visit',
    });
    expect(result?.features[0].ctaAction).toBeUndefined();
  });
});
