/* eslint-disable no-console */
/* eslint-disable onekey/no-raw-error -- standalone verification of synthetic inputs */
// Verify the installed WASM, not a mock of the JS-side seed.fill(0).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const cases = [
  ['fingerprint', (keys, seed) => keys.seedFingerprint(seed), false],
  ['derive', (keys, seed) => keys.ufvkFromSeed('main', seed, 0), false],
  [
    'invalid network',
    (keys, seed) => keys.ufvkFromSeed('invalid', seed, 0),
    true,
  ],
  [
    'sign failure',
    (keys, seed) => keys.pcztSignWithSeed('main', seed, 0, new Uint8Array()),
    true,
  ],
  [
    'transparent failure',
    (keys, seed) => keys.transparentTxBuildWithSeed('{}', seed),
    true,
  ],
];

(async () => {
  const pkgDir = path.dirname(
    require.resolve('onekey-zcash-keys/package.json'),
  );
  const wasmBytes = fs.readFileSync(
    path.join(pkgDir, 'onekey_zcash_keys_bg.wasm'),
  );
  const moduleUrl = pathToFileURL(path.join(pkgDir, 'onekey_zcash_keys.js'));
  for (const [index, [name, call, throws]] of cases.entries()) {
    // Each instance contains only this synthetic fixture, never wallet data.
    const keys = await import(`${moduleUrl.href}?seed-cleanup=${index}`);
    const wasm = await keys.default({ module_or_path: wasmBytes });
    const marker = Uint8Array.from(
      { length: 64 },
      (_, i) => (i * 37 + 19) % 256,
    );
    const seed = marker.slice();
    try {
      if (throws) {
        assert.throws(() => call(keys, seed), name);
      } else {
        call(keys, seed);
      }
    } finally {
      seed.fill(0);
      // Same host contract as carrier.getKeys: after the synchronous glue has
      // copied its result, wipe the linker-defined inactive stack too.
      const low = wasm.__stack_low?.value;
      const high = wasm.__stack_high?.value;
      assert.ok(Number.isSafeInteger(low) && Number.isSafeInteger(high));
      assert.ok(
        0 <= low && low < high && high <= wasm.memory.buffer.byteLength,
      );
      new Uint8Array(wasm.memory.buffer).fill(0, low, high);
    }
    // Allocators can overwrite a freed block's prefix with metadata. Check a
    // long suffix too so a freed-but-not-wiped input cannot pass this test.
    const memory = Buffer.from(wasm.memory.buffer);
    assert.equal(memory.indexOf(marker), -1, `${name}: WASM retains the seed`);
    assert.equal(
      memory.indexOf(marker.subarray(8)),
      -1,
      `${name}: WASM retains the seed suffix`,
    );
    console.log(`PASS — installed WASM seed cleanup: ${name}`);
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
