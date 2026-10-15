/* eslint-disable no-console */
/* eslint-disable onekey/no-raw-error -- standalone node script, cannot import shared errors */
/**
 * Golden-address check for the zcash derivation contract.
 *
 * Run from the repo root whenever bumping the OneKey Zcash keys package:
 *   node packages/core/src/chains/zcash/sdkZcash/scripts/verify-address-golden.js
 *
 * It derives the fixed public test mnemonic's UFVK and addresses with the
 * installed keys WASM and compares them against the release derivation contract.
 * Any output change must be investigated before updating these fixtures.
 */
const fs = require('fs');
const path = require('path');

const { mnemonicToSeedSync } = require('bip39');

const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

const golden = {
  unifiedAddress:
    'u1y2z9wqt9du4stq2keex78l4vvlkfh3c0n7le0pz80lc4ttcuz5h9qyts73awns77lkgw8zy67qwf0s86rauwg6e9wz7te7yf6vxjtk5g',
  transparentAddress: 't1XVXWCvpMgBvUaed4XDqWtgQgJSu1Ghz7F',
};

(async () => {
  const pkgDir = path.dirname(
    require.resolve('onekey-zcash-keys/package.json'),
  );
  const keys = await import(path.join(pkgDir, 'onekey_zcash_keys.js'));
  const wasmBytes = fs.readFileSync(
    path.join(pkgDir, 'onekey_zcash_keys_bg.wasm'),
  );
  await keys.default({ module_or_path: wasmBytes });

  const seed = mnemonicToSeedSync(TEST_MNEMONIC);
  let unifiedAddress;
  let transparentAddress;
  try {
    const ufvk = keys.ufvkFromSeed('main', seed, 0);
    unifiedAddress = keys.unifiedAddress('main', ufvk, 'orchard');
    transparentAddress = keys.transparentAddressFromUfvk('main', ufvk);
  } finally {
    seed.fill(0);
  }

  const failures = [];
  if (unifiedAddress !== golden.unifiedAddress) {
    failures.push(
      `UA mismatch\n  got:  ${unifiedAddress}\n  want: ${golden.unifiedAddress}`,
    );
  }
  if (transparentAddress !== golden.transparentAddress) {
    failures.push(
      `t-addr mismatch\n  got:  ${transparentAddress}\n  want: ${golden.transparentAddress}`,
    );
  }
  if (failures.length) {
    console.error(
      `FAIL — installed WASM changed the address derivation contract.\n` +
        `Investigate before updating these fixtures.\n\n${failures.join('\n')}`,
    );
    process.exit(1);
  }
  console.log('PASS — installed WASM matches address goldens (UA + t-addr)');
  process.exit(0);
})().catch((e) => {
  console.error('ERROR:', e);
  process.exit(1);
});
