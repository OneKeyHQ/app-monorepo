import {
  getFeaturedChangelogForVersion,
  normalizeFeaturedChangelog,
  MAX_FEATURED_CHANGELOG_VERSIONS,
  buildFeaturedChangelogs,
} from './featuredChangelog';

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

  test('keeps valid features after invalid entries while limiting the result to ten', () => {
    const result = normalizeFeaturedChangelog({
      version: '6.6.0',
      features: [
        ...Array.from({ length: 10 }, () => ({
          ...media,
          mediaUrl: 'http://example.com/invalid.png',
        })),
        ...Array.from({ length: 11 }, (_, index) => ({
          ...media,
          title: `Feature ${index}`,
        })),
      ],
    });
    expect(result?.features).toHaveLength(10);
    expect(result?.features[0].title).toBe('Feature 0');
    expect(result?.features[9].title).toBe('Feature 9');
  });
});

describe('versioned Featured Changelog storage', () => {
  const card = (version: string) => ({
    version,
    features: [
      {
        mediaUrl: `https://cdn.onekey.so/${version}.png`,
        mediaType: 'image' as const,
      },
    ],
  });

  it('reads the entry for the exact version', () => {
    const state = { featuredChangelogs: { '1.0.0': card('1.0.0') } };
    expect(getFeaturedChangelogForVersion(state, '1.0.0')).toEqual(
      card('1.0.0'),
    );
    expect(getFeaturedChangelogForVersion(state, '2.0.0')).toBeUndefined();
    expect(getFeaturedChangelogForVersion(state, undefined)).toBeUndefined();
  });

  it('falls back to the legacy slot only when its version matches', () => {
    const state = { featuredChangelog: card('1.0.0') };
    expect(getFeaturedChangelogForVersion(state, '1.0.0')).toEqual(
      card('1.0.0'),
    );
    expect(getFeaturedChangelogForVersion(state, '9906.15.1')).toBeUndefined();
  });

  it('treats an explicit null entry as removed, without legacy fallback', () => {
    const state = {
      featuredChangelog: card('1.0.0'),
      featuredChangelogs: { '1.0.0': null },
    };
    expect(getFeaturedChangelogForVersion(state, '1.0.0')).toBeUndefined();
  });

  it('migrates the legacy slot only for a priority version', () => {
    expect(
      buildFeaturedChangelogs({ featuredChangelog: card('1.0.0') }, {}, [
        '1.0.0',
      ]),
    ).toEqual({ '1.0.0': card('1.0.0') });
    expect(
      buildFeaturedChangelogs({ featuredChangelog: card('9906.15.1') }, {}, [
        '1.0.0',
      ]),
    ).toEqual({});
  });

  it('applies updates, including explicit null removals', () => {
    expect(
      buildFeaturedChangelogs(
        { featuredChangelogs: { '1.0.0': card('1.0.0') } },
        { '2.0.0': null },
        ['1.0.0', '2.0.0'],
      ),
    ).toEqual({ '1.0.0': card('1.0.0'), '2.0.0': null });
  });

  it(`caps the map at ${MAX_FEATURED_CHANGELOG_VERSIONS} versions, keeping priority versions first`, () => {
    const result = buildFeaturedChangelogs(
      {
        featuredChangelogs: {
          '1.0.0': card('1.0.0'),
          '1.1.0': card('1.1.0'),
          '1.2.0': card('1.2.0'),
          '9906.15.1': card('9906.15.1'),
        },
      },
      { '2.0.0': card('2.0.0') },
      ['1.0.0', '2.0.0', undefined, '1.0.0'],
    );
    expect(Object.keys(result)).toHaveLength(MAX_FEATURED_CHANGELOG_VERSIONS);
    // Priority versions first, then the newest remaining version.
    expect(result).toEqual({
      '1.0.0': card('1.0.0'),
      '2.0.0': card('2.0.0'),
      '9906.15.1': card('9906.15.1'),
    });
  });
});
