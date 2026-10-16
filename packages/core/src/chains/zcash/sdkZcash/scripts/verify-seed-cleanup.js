/* eslint-disable no-console */
/* eslint-disable onekey/no-raw-error -- standalone verification of synthetic inputs */
// Verify the installed WASM wipes the account-scoped secrets it receives (the
// seed itself never crosses into it), not a mock of the JS-side fill(0).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const { deriveAccountKeys } = require('./accountKeysFixture');

const cases = [
  [
    'derive',
    (keys, k) => keys.ufvkFromAccountKeys('main', k.sk, k.accountXpub, 0),
    false,
  ],
  [
    'invalid network',
    (keys, k) => keys.ufvkFromAccountKeys('test', k.sk, k.accountXpub, 0),
    true,
  ],
  [
    'sign failure',
    (keys, k) =>
      keys.pcztSignWithAccountKeys(
        'main',
        k.sk,
        k.accountXprv,
        0,
        new Uint8Array(),
        '{}',
      ),
    true,
  ],
  [
    'transparent failure',
    (keys, k) => keys.transparentTxBuildWithAccountXprv('{}', k.accountXprv),
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
    const keys = await import(`${moduleUrl.href}?secret-cleanup=${index}`);
    const wasm = await keys.default({ module_or_path: wasmBytes });
    const seed = Uint8Array.from({ length: 64 }, (_, i) => (i * 37 + 19) % 256);
    const derived = deriveAccountKeys(seed, 0);
    seed.fill(0);
    const sk = derived.orchardSk.slice();
    try {
      const k = {
        sk,
        accountXpub: derived.accountXpub,
        accountXprv: derived.accountXprv,
      };
      if (throws) {
        assert.throws(() => call(keys, k), name);
      } else {
        call(keys, k);
      }
    } finally {
      sk.fill(0);
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
    // The inputs crossing the boundary must be wiped.
    const markers = [
      ['Orchard sk', derived.orchardSk],
      ['account xprv string', Buffer.from(derived.accountXprv, 'utf8')],
    ];
    for (const [label, marker] of markers) {
      assert.equal(
        memory.indexOf(marker),
        -1,
        `${name}: WASM retains ${label}`,
      );
      assert.equal(
        memory.indexOf(marker.subarray(8)),
        -1,
        `${name}: WASM retains ${label} suffix`,
      );
    }
    // Upstream AccountPrivKey is not wiped on drop (documented limit of the
    // keys crate), so the decoded scalar is reported, not enforced.
    if (memory.indexOf(derived.accountPrivateKey) !== -1) {
      console.warn(
        `NOTE — ${name}: decoded transparent private key left in WASM memory`,
      );
    }
    derived.orchardSk.fill(0);
    console.log(`PASS — installed WASM account-key cleanup: ${name}`);
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
