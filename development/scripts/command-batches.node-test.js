const assert = require('node:assert/strict');
const test = require('node:test');

const {
  DEFAULT_MAX_COMMAND_LENGTH,
  splitArgumentsByLength,
} = require('./command-batches');

test('keeps small argument lists in one batch', () => {
  const values = ['one.ts', 'two.ts'];
  const batches = splitArgumentsByLength({
    command: process.execPath,
    fixedArgs: ['tool.js', '--fix'],
    values,
  });

  assert.deepEqual(batches, [values]);
});

test('splits large argument lists without dropping or reordering values', () => {
  const values = Array.from(
    { length: 1000 },
    (_, index) =>
      `packages/example/src/${String(index).padStart(4, '0')}-${'x'.repeat(40)}.ts`,
  );
  const batches = splitArgumentsByLength({
    command: process.execPath,
    fixedArgs: ['tool.js', '--fix'],
    values,
  });

  assert.ok(batches.length > 1);
  assert.deepEqual(batches.flat(), values);
  for (const batch of batches) {
    const estimatedLength = [
      process.execPath,
      'tool.js',
      '--fix',
      ...batch,
    ].reduce((length, argument) => length + String(argument).length * 2 + 3, 0);
    assert.ok(estimatedLength <= DEFAULT_MAX_COMMAND_LENGTH);
  }
});

test('rejects a single argument that cannot fit', () => {
  assert.throws(
    () =>
      splitArgumentsByLength({
        command: 'node',
        values: ['x'.repeat(DEFAULT_MAX_COMMAND_LENGTH)],
      }),
    /single command argument exceeds/u,
  );
});
