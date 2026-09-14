import { readFileSync } from 'fs';
import { join } from 'path';

/*
yarn jest packages/kit/src/views/Home/components/DeFiListBlock/DeFiListBlock.cacheOnlyGate.test.ts
*/

describe('DeFiListBlock cache-only readiness producer', () => {
  it('lets the cache-only all-network hook run regardless of route focus', () => {
    // The cache-only instance is the only writer of the header's DeFi
    // readiness. Device logs showed sessions where its hook never started,
    // pinning the All Networks header to a stale persisted total.
    const source = readFileSync(join(__dirname, 'DeFiListBlock.tsx'), 'utf8');
    const hookStart = source.indexOf('} = useAllNetworkRequests<');
    const hookEnd = source.indexOf('});', hookStart);
    const hookConfig = source.slice(hookStart, hookEnd);

    expect(hookStart).toBeGreaterThan(0);
    expect(hookConfig).toContain('isDeFiRequests: true');
    expect(hookConfig).toContain('shouldAlwaysFetch: refreshCacheOnly');
  });
});
