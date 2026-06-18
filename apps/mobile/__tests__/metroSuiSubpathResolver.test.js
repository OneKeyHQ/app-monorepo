const path = require('path');

const { resolveMystenSuiSubpathExport } = require('../metroSuiSubpathResolver');

describe('resolveMystenSuiSubpathExport', () => {
  const repoRoot = path.resolve(__dirname, '../../..');

  it('maps @mysten/sui subpath exports to built mjs entry files', () => {
    expect(resolveMystenSuiSubpathExport('@mysten/sui/utils', repoRoot)).toBe(
      path.join(repoRoot, 'node_modules/@mysten/sui/dist/utils/index.mjs'),
    );

    expect(
      resolveMystenSuiSubpathExport('@mysten/sui/transactions', repoRoot),
    ).toBe(
      path.join(
        repoRoot,
        'node_modules/@mysten/sui/dist/transactions/index.mjs',
      ),
    );
  });

  it('does not handle the bare package or unrelated packages', () => {
    expect(resolveMystenSuiSubpathExport('@mysten/sui', repoRoot)).toBeNull();
    expect(resolveMystenSuiSubpathExport('@mysten/bcs', repoRoot)).toBeNull();
  });
});
