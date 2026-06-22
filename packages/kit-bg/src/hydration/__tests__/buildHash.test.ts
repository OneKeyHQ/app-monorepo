// Regression tests for the BUILD_HASH fallback used by the cold-start
// hydration gate. The helper must prefer the per-commit SHA over the
// coarser version/buildNumber pair, and must return undefined only when
// no signal is available — anything else would silently disable the
// schema-invalidation gate across deploys.

import {
  computeEffectiveBuildHash,
  countNonMetaEntries,
  shouldProceedAfterReset,
} from '../hydrate';

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

// Regression tests for the post-reset IDB recheck gate. resetColdStartCache
// in webColdStartStorage swallows db.clear failures (best-effort
// semantics), so a successful await does NOT prove the store is empty.
// hydrate.ts uses shouldProceedAfterReset to gate the prime + marker-refresh
// step on a fresh recheck — if non-meta entries survived the wipe we must
// surface as 'error' to avoid writing the new BUILD_HASH on top of stale
// data, which would silently match on the next boot and prime data written
// under a different schema.

describe('shouldProceedAfterReset', () => {
  it('proceeds when recheck returns an empty map', () => {
    expect(shouldProceedAfterReset(new Map())).toBe(true);
  });

  it('proceeds when recheck contains only __meta:* entries', () => {
    // Meta-only is indistinguishable from a brand-new DB to downstream
    // consumers (countNonMetaEntries == 0).
    const recheck = new Map<string, unknown>([
      ['__meta:buildHash', 'abc'],
      ['__meta:other', 'def'],
    ]);
    expect(shouldProceedAfterReset(recheck)).toBe(true);
  });

  it('refuses to proceed when recheck still contains a non-meta entry', () => {
    // db.clear must have failed (silently swallowed by resetColdStartCache);
    // writing the new marker now would falsely vouch for stale entries.
    const recheck = new Map<string, unknown>([
      ['__meta:buildHash', 'abc'],
      ['onekey_jotai_context_atoms_snapshot', '{"stale":true}'],
    ]);
    expect(shouldProceedAfterReset(recheck)).toBe(false);
  });

  it('refuses to proceed when recheck is undefined (timeout / throw)', () => {
    // No proof the wipe succeeded → must NOT proceed.
    expect(shouldProceedAfterReset(undefined)).toBe(false);
  });
});

describe('countNonMetaEntries', () => {
  it('returns 0 for an empty map', () => {
    expect(countNonMetaEntries(new Map())).toBe(0);
  });

  it('ignores __meta:* keys', () => {
    const m = new Map<string, unknown>([
      ['__meta:buildHash', 'x'],
      ['__meta:other', 'y'],
    ]);
    expect(countNonMetaEntries(m)).toBe(0);
  });

  it('counts payload keys but skips meta keys mixed in', () => {
    const m = new Map<string, unknown>([
      ['__meta:buildHash', 'x'],
      ['onekey_jotai_context_atoms_snapshot', '{}'],
      ['swr:cache', '{}'],
    ]);
    expect(countNonMetaEntries(m)).toBe(2);
  });
});
