const assert = require('assert/strict');
const fs = require('fs');
const { test } = require('node:test');
const os = require('os');
const path = require('path');

const { getPostScriptName } = require('./font-file-utils');
const { SLOTS, readWeightSet, renderManifest } = require('./fonts-sync');

const fallbackDir = path.resolve(
  __dirname,
  '../../packages/components/src/hocs/Provider/fonts/fallback',
);

test('committed fallback covers every brand slot with open-source Inter', () => {
  const files = readWeightSet(fallbackDir);
  assert.deepEqual(
    SLOTS.map((slot) => getPostScriptName(files[slot.key])),
    ['Inter-Regular', 'Inter-Medium', 'Inter-SemiBold', 'Inter-Bold'],
  );
});

test('a source directory missing a weight is rejected', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fonts-sync-'));
  try {
    fs.copyFileSync(
      path.join(fallbackDir, 'Inter-Regular.ttf'),
      path.join(dir, 'Any-Name.ttf'),
    );
    assert.throws(() => readWeightSet(dir), /no font with weight 500/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('manifest records the source and native family per slot', () => {
  const manifest = renderManifest('fallback', {
    regular: 'Inter-Regular',
    medium: 'Inter-Medium',
    semibold: 'Inter-SemiBold',
    bold: 'Inter-Bold',
  });
  assert.match(manifest, /source: 'fallback',/);
  assert.match(manifest, /^ {4}semibold: 'Inter-SemiBold',$/m);
});
