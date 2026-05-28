// Regression tests for the BUILD_HASH fallback used by the cold-start
// hydration gate. The helper must prefer the per-commit SHA over the
// coarser version/buildNumber pair, and must return undefined only when
// no signal is available — anything else would silently disable the
// schema-invalidation gate across deploys.

import { computeEffectiveBuildHash } from '../hydrate';

describe('computeEffectiveBuildHash', () => {
  it('prefers githubSHA when present', () => {
    expect(computeEffectiveBuildHash('abc123', '5.0.0', '1234')).toBe('abc123');
  });

  it('prefers githubSHA even if version/buildNumber are also set', () => {
    // The per-commit SHA bumps on every push, so it must win over the
    // release-only version/buildNumber pair whenever it is available.
    expect(computeEffectiveBuildHash('deadbeef', '5.0.0', '42')).toBe(
      'deadbeef',
    );
  });

  it('falls back to v:<version>:<buildNumber> when githubSHA is missing', () => {
    expect(computeEffectiveBuildHash(undefined, '5.0.0', '1234')).toBe(
      'v:5.0.0:1234',
    );
  });

  it('keeps buildNumber slot empty when only version is available', () => {
    expect(computeEffectiveBuildHash(undefined, '5.0.0', undefined)).toBe(
      'v:5.0.0:',
    );
  });

  it('treats empty-string githubSHA as missing', () => {
    expect(computeEffectiveBuildHash('', '5.0.0', '1')).toBe('v:5.0.0:1');
  });

  it('returns undefined when both githubSHA and version are absent', () => {
    expect(
      computeEffectiveBuildHash(undefined, undefined, undefined),
    ).toBeUndefined();
  });

  it('returns undefined when version is empty and githubSHA is absent', () => {
    // No usable signal — we must NOT manufacture a placeholder hash, or
    // every deploy with empty env would share the same marker and the
    // invalidation gate would never trigger.
    expect(computeEffectiveBuildHash(undefined, '', '1234')).toBeUndefined();
  });
});
