const { execFileSync } = require('child_process');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../../../../..');
const generatedPaths = [
  'packages/components/src/primitives/Icon/Icons.tsx',
  'packages/components/src/primitives/Icon/react',
];
const status = execFileSync(
  'git',
  ['status', '--porcelain', '--untracked-files=all', '--', ...generatedPaths],
  {
    cwd: repoRoot,
    encoding: 'utf8',
  },
);

if (status.trim()) {
  console.error('Generated icons are not up to date:');
  console.error(status.trimEnd());
  process.exitCode = 1;
}
