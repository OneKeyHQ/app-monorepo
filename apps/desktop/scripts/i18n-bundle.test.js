const { execFileSync } = require('node:child_process');
const path = require('node:path');

test('desktop translation keys stay inline in the Node build runtime', () => {
  const output = execFileSync(
    process.execPath,
    [
      '--test',
      '--test-reporter=tap',
      path.join(__dirname, 'i18n-bundle.fixture.cjs'),
    ],
    { encoding: 'utf8' },
  );
  expect(output).toContain('# pass 1');
  expect(output).toContain('# fail 0');
});
