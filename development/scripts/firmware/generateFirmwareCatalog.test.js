const { spawnSync } = require('node:child_process');
const { join } = require('node:path');

test('passes the native ESM firmware catalog generator suite', () => {
  const result = spawnSync(
    process.execPath,
    ['--test', join(__dirname, 'generateFirmwareCatalog.test.mjs')],
    {
      encoding: 'utf8',
    },
  );

  if (result.status !== 0) {
    throw new Error(`${result.stdout}\n${result.stderr}`);
  }
});
