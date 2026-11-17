const { execFileSync } = require('node:child_process');
const path = require('node:path');

// Build tooling runs in Node, outside Jest's module loader and transforms.
test.each([
  'extracts only public instance callables',
  'fails closed for inheritance',
  'the committed policy is reproducible',
])('%s in the desktop build runtime', (pattern) => {
  const output = execFileSync(
    process.execPath,
    [
      '--test',
      '--test-reporter=tap',
      `--test-name-pattern=${pattern}`,
      path.join(__dirname, 'generate-desktop-api-methods.fixture.cjs'),
    ],
    { encoding: 'utf8' },
  );
  expect(output).toContain('# pass 1');
  expect(output).toContain('# fail 0');
});
