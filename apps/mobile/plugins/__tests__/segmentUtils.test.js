const path = require('path');

const {
  deriveSegmentKey,
  deriveSharedSegmentKey,
  allocateSegmentIds,
  monorepoRoot,
} = require('../segmentUtils');

describe('deriveSegmentKey', () => {
  it('packages path → seg:pkg.path', () => {
    expect(
      deriveSegmentKey(
        path.join(monorepoRoot, 'packages/kit-bg/src/services/ServiceSwap.ts'),
      ),
    ).toBe('seg:kit-bg.services.ServiceSwap');
  });

  it('node_modules → seg:nm.pkgName', () => {
    expect(
      deriveSegmentKey(
        path.join(monorepoRoot, 'node_modules/ethers/lib/index.js'),
      ),
    ).toBe('seg:nm.ethers');
  });

  it('default path → seg:dotted.path', () => {
    expect(
      deriveSegmentKey(path.join(monorepoRoot, 'apps/mobile/src/App.tsx')),
    ).toBe('seg:apps.mobile.src.App');
  });

  it('handles nested packages', () => {
    expect(
      deriveSegmentKey(
        path.join(monorepoRoot, 'packages/kit/src/views/Market/index.tsx'),
      ),
    ).toBe('seg:kit.views.Market.index');
  });
});

describe('deriveSharedSegmentKey', () => {
  it('prefixes shared. inside seg: namespace for packages path', () => {
    expect(
      deriveSharedSegmentKey(
        path.join(
          monorepoRoot,
          'packages/kit/src/views/Market/MarketDetailV2/components/TokenSelector/constants.ts',
        ),
      ),
    ).toBe(
      'seg:shared.kit.views.Market.MarketDetailV2.components.TokenSelector.constants',
    );
  });

  it('prefixes shared. for node_modules path', () => {
    expect(
      deriveSharedSegmentKey(
        path.join(monorepoRoot, 'node_modules/lodash/index.js'),
      ),
    ).toBe('seg:shared.nm.lodash');
  });

  it('is deterministic for the same absolute path', () => {
    const p = path.join(monorepoRoot, 'packages/kit/src/utils/helper.ts');
    expect(deriveSharedSegmentKey(p)).toBe(deriveSharedSegmentKey(p));
  });

  it('produces a distinct key from the non-shared variant', () => {
    const p = path.join(monorepoRoot, 'packages/kit/src/utils/helper.ts');
    expect(deriveSharedSegmentKey(p)).not.toBe(deriveSegmentKey(p));
  });

  it('keeps the leading `seg:` marker so routing still works', () => {
    expect(
      deriveSharedSegmentKey(
        path.join(monorepoRoot, 'packages/shared/src/utils/x.ts'),
      ),
    ).toMatch(/^seg:shared\./);
  });
});

describe('allocateSegmentIds', () => {
  it('allocates sorted stable IDs from 1000', () => {
    const ids = allocateSegmentIds(['seg:b', 'seg:a', 'seg:c']);
    expect(ids.get('seg:a')).toBe(1000);
    expect(ids.get('seg:b')).toBe(1001);
    expect(ids.get('seg:c')).toBe(1002);
  });

  it('returns empty map for empty input', () => {
    const ids = allocateSegmentIds([]);
    expect(ids.size).toBe(0);
  });

  it('is deterministic regardless of input order', () => {
    const ids1 = allocateSegmentIds(['seg:z', 'seg:a', 'seg:m']);
    const ids2 = allocateSegmentIds(['seg:a', 'seg:m', 'seg:z']);
    expect(ids1.get('seg:a')).toBe(ids2.get('seg:a'));
    expect(ids1.get('seg:m')).toBe(ids2.get('seg:m'));
    expect(ids1.get('seg:z')).toBe(ids2.get('seg:z'));
  });
});
