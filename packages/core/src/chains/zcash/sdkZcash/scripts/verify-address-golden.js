/* eslint-disable no-console */
/* eslint-disable onekey/no-raw-error -- standalone node script, cannot import shared errors */
/**
 * Golden-address check for the zcash derivation contract.
 *
 * Run from the repo root whenever bumping the OneKey Zcash keys package:
 *   node packages/core/src/chains/zcash/sdkZcash/scripts/verify-address-golden.js
 *
 * It derives the fixed public test mnemonic's UFVK and addresses with the
 * INSTALLED keys wasm and compares them against the goldens for the scheme version declared
 * in ../constants.ts. If the SDK changed the derivation output, this fails —
 * the same diff must then bump ZCASH_ADDRESS_SCHEME_VERSION and add the new
 * golden entry here.
 */
const fs = require('fs');
const path = require('path');

const { mnemonicToSeedSync } = require('bip39');

const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

// Our derivation contract per ZCASH_ADDRESS_SCHEME_VERSION (see constants.ts)
const GOLDENS = {
  1: {
    unifiedAddress:
      'u16sw4v6wy7f4jzdny55yzl020tp3yqg3c85dc6n7mmq0urfm6adqg79hxmyk85ufn4lun4pfh5q48cc3kvxhxm3w978eqqecdd260gkzjrkun6z7m9mcrt2zszaj0mvk6ufux2zteqwh57cq906hz3rkg63duaeqsvjelv9h5srct0zq8rvlv23wz5hed7zuatqd7p6p4ztugc4t4w2g',
    transparentAddress: 't1dUDJ62ANtmebE8drFg7g2MWYwXHQ6Xu3F',
  },
  2: {
    unifiedAddress:
      'u1vsrz6xamken473f0ls8mwyznlm8cpg6tusnc26ju7tng7m82jl9u20tf43rvd6e2czqt7jr0d0fl2prsdqzlcak2ucl6kfce3ux7eh6yh95c4j75z2305u346dsvj30k6djjk9rf66a',
    transparentAddress: 't1dUDJ62ANtmebE8drFg7g2MWYwXHQ6Xu3F',
  },
  3: {
    unifiedAddress:
      'u1y2z9wqt9du4stq2keex78l4vvlkfh3c0n7le0pz80lc4ttcuz5h9qyts73awns77lkgw8zy67qwf0s86rauwg6e9wz7te7yf6vxjtk5g',
    transparentAddress: 't1XVXWCvpMgBvUaed4XDqWtgQgJSu1Ghz7F',
  },
};

function readDeclaredSchemeVersion() {
  const constantsSrc = fs.readFileSync(
    path.join(__dirname, '..', 'constants.ts'),
    'utf8',
  );
  const m = constantsSrc.match(/ZCASH_ADDRESS_SCHEME_VERSION = (\d+)/);
  if (!m) throw new Error('cannot read ZCASH_ADDRESS_SCHEME_VERSION');
  return Number(m[1]);
}

(async () => {
  const version = readDeclaredSchemeVersion();
  const golden = GOLDENS[version];
  if (!golden) {
    throw new Error(
      `no golden entry for scheme version ${version} — add one to this script`,
    );
  }

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
      `UA mismatch for scheme v${version}\n  got:  ${unifiedAddress}\n  want: ${golden.unifiedAddress}`,
    );
  }
  if (transparentAddress !== golden.transparentAddress) {
    failures.push(
      `t-addr mismatch for scheme v${version}\n  got:  ${transparentAddress}\n  want: ${golden.transparentAddress}`,
    );
  }
  if (failures.length) {
    console.error(
      `FAIL — the installed wasm no longer matches scheme v${version}.\n` +
        `Either the SDK bump unintentionally changed derivation (bug), or the\n` +
        `change is intended: bump ZCASH_ADDRESS_SCHEME_VERSION and add the new\n` +
        `golden entry in the SAME diff.\n\n${failures.join('\n')}`,
    );
    process.exit(1);
  }
  console.log(
    `PASS — installed wasm matches scheme v${version} goldens (UA + t-addr)`,
  );
  process.exit(0);
})().catch((e) => {
  console.error('ERROR:', e);
  process.exit(1);
});
