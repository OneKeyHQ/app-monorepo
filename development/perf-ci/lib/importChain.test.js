const fs = require('fs');
const os = require('os');
const path = require('path');

const { createStaticImportChainReport } = require('./importChain');

function writeFile(repoRoot, filePath, source) {
  const fullPath = path.join(repoRoot, filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, source);
}

describe('createStaticImportChainReport', () => {
  it('uses only runtime sync edges for startup chains', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'import-chain-'));
    const root = 'apps/web/src/root.ts';
    const middle = 'apps/web/src/middle.ts';
    const target = 'apps/web/src/target.ts';
    const lazyTarget = 'apps/web/src/lazyTarget.ts';

    writeFile(
      repoRoot,
      root,
      [
        "import type { TargetType } from './target';",
        "export type { LazyType } from './lazyTarget';",
        "import('./lazyTarget');",
        "import { middle } from './middle';",
        'export const root = middle;',
      ].join('\n'),
    );
    writeFile(
      repoRoot,
      middle,
      ["import { target } from './target';", 'export const middle = target;'].join(
        '\n',
      ),
    );
    writeFile(
      repoRoot,
      target,
      'export const target = 1; export type TargetType = number;',
    );
    writeFile(
      repoRoot,
      lazyTarget,
      'export const lazyTarget = 1; export type LazyType = number;',
    );

    const report = createStaticImportChainReport({
      repoRoot,
      modules: [root, middle, target, lazyTarget],
      roots: [root],
      targets: [target, lazyTarget],
    });

    expect(report.chains).toEqual([
      {
        target,
        status: 'found',
        chain: [
          {
            from: root,
            to: middle,
            specifier: './middle',
            edgeType: 'sync',
          },
          {
            from: middle,
            to: target,
            specifier: './target',
            edgeType: 'sync',
          },
        ],
      },
      {
        target: lazyTarget,
        status: 'unreachable',
        chain: [],
      },
    ]);
  });
});
