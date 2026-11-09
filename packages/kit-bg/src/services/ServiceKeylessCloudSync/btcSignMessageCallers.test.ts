import fs from 'fs';
import path from 'path';

// Every Bitcoin message signature must pass the reserved Cloud-key message
// guard in a keyring or the developer path tester. The internal Cloud-key
// adapter signs the reserved message; other callers must add the guard.
const ALLOWED_CALLERS = [
  'packages/kit-bg/src/services/ServiceDevSetting/hardwareDerivationPathTest.ts',
  'packages/kit-bg/src/services/ServiceKeylessCloudSync/hardwareCloudSyncSdk.ts',
  'packages/kit-bg/src/vaults/impls/btc/KeyringHardwareBtcBase.ts',
  'packages/kit-bg/src/vaults/impls/btc/KeyringHardwareKeystone.ts',
  'packages/kit-bg/src/vaults/impls/btc/KeyringHardwareLedger.ts',
  'packages/kit-bg/src/vaults/impls/btc/KeyringHardwareTrezor.ts',
  'packages/kit-bg/src/vaults/impls/lightning/KeyringHardware.ts',
];

const repoRoot = path.resolve(__dirname, '../../../../..');
const SOURCE_DIRS = ['packages', 'apps'];
const SKIPPED_DIRS = new Set(['node_modules', 'build', 'dist', '.git']);

function collectSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIPPED_DIRS.has(entry.name)) {
      // eslint-disable-next-line no-continue
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(fullPath, files);
    } else if (
      /\.tsx?$/.test(entry.name) &&
      !/\.test\.tsx?$/.test(entry.name)
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

test('only guarded callers and the Cloud-key adapter call btcSignMessage', () => {
  const callers = SOURCE_DIRS.flatMap((dir) =>
    collectSourceFiles(path.join(repoRoot, dir)),
  )
    .filter((file) =>
      /\.btcSignMessage\s*\(/.test(fs.readFileSync(file, 'utf8')),
    )
    .map((file) => path.relative(repoRoot, file).split(path.sep).join('/'))
    .toSorted();
  expect(callers).toEqual(ALLOWED_CALLERS.toSorted());
});
