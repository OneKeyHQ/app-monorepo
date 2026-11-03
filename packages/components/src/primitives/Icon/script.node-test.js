const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { collectIcons, generateRegistry, buildIcons } = require('./script');

test('preserves every existing name and all RTL partners without SVG JavaScript', async () => {
  const names = collectIcons();
  const root = path.resolve(__dirname, '../../../svg');
  const sourceCount = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .reduce(
      (total, entry) =>
        total +
        fs
          .readdirSync(path.join(root, entry.name))
          .filter((name) => name.endsWith('.svg')).length,
      0,
    );
  assert.equal(names.length, sourceCount);
  const source = await generateRegistry(names);
  assert.equal(
    source
      .split('const rtlIcons:')[1]
      .split('export const resolveIconName')[0]
      .match(/: '/g).length,
    76,
  );
  assert.equal(source.includes('import('), false);
  assert.equal(source.includes('<path'), false);
  const file = path.join(__dirname, 'Icons.tsx');
  const before = fs.statSync(file).mtimeMs;
  await buildIcons({ check: true });
  assert.equal(fs.statSync(file).mtimeMs, before);
  assert.equal(await generateRegistry(names), source);
});

test('rejects ambiguous names before writing any output', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-icon-names-'));
  try {
    fs.mkdirSync(path.join(root, 'outline'));
    for (const name of ['foo-bar.svg', 'foo_bar.svg'])
      fs.writeFileSync(path.join(root, 'outline', name), '<svg/>');
    assert.throws(() => collectIcons(root), /unique/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
