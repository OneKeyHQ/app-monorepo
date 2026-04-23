const {
  allocationRules,
  forbiddenInStartup,
} = require('../bundle-groups.config');

function getAllocationLayer(relPath) {
  for (const rule of allocationRules) {
    if (rule.paths.some((p) => relPath.startsWith(p))) {
      return rule.layer;
    }
  }
  return 'feature.shared';
}

describe('bundle-groups.config', () => {
  describe('allocationRules', () => {
    it('maps index.ts to bootstrap.main', () => {
      expect(getAllocationLayer('apps/mobile/index.ts')).toBe('bootstrap.main');
    });
    it('maps background.ts to bootstrap.background', () => {
      expect(getAllocationLayer('apps/mobile/background.ts')).toBe(
        'bootstrap.background',
      );
    });
    it('maps polyfills to kernel.shared', () => {
      expect(getAllocationLayer('packages/shared/src/polyfills/index.ts')).toBe(
        'kernel.shared',
      );
    });
    it('maps splitBundle to kernel.shared', () => {
      expect(
        getAllocationLayer(
          'apps/mobile/src/splitBundle/installProdBundleLoader.ts',
        ),
      ).toBe('kernel.shared');
    });
    it('maps kit/src/views/ to feature.main', () => {
      expect(
        getAllocationLayer('packages/kit/src/views/Market/index.tsx'),
      ).toBe('feature.main');
    });
    it('maps kit-bg/src/vaults/ to feature.shared', () => {
      expect(
        getAllocationLayer('packages/kit-bg/src/vaults/impls/evm/Vault.ts'),
      ).toBe('feature.shared');
    });
    it('maps ServiceNotification to feature.background', () => {
      expect(
        getAllocationLayer(
          'packages/kit-bg/src/services/ServiceNotification.ts',
        ),
      ).toBe('feature.background');
    });
    it('defaults to feature.shared for unknown paths', () => {
      expect(getAllocationLayer('some/random/path.ts')).toBe('feature.shared');
    });
  });

  describe('forbiddenInStartup', () => {
    it('forbids vaults', () => {
      expect(
        forbiddenInStartup.some((p) =>
          'packages/kit-bg/src/vaults/impls/evm/Vault.ts'.startsWith(p),
        ),
      ).toBe(true);
    });
    it('forbids ServiceSwap', () => {
      expect(
        forbiddenInStartup.some((p) =>
          'packages/kit-bg/src/services/ServiceSwap.ts'.startsWith(p),
        ),
      ).toBe(true);
    });
    it('does not forbid ServiceBootstrap', () => {
      expect(
        forbiddenInStartup.some((p) =>
          'packages/kit-bg/src/services/ServiceBootstrap.ts'.startsWith(p),
        ),
      ).toBe(false);
    });
  });
});
