// cspell:ignore lockdown jsbi JSBI unpermitted
// Verifies how specific third-party libraries behave under a real SES
// `lockdown()`. `lockdown()` irreversibly freezes the realm's intrinsics, so
// every scenario runs in its own child node process.
//
// The app ships `overrideTaming: 'severe'` (web/desktop L2). It is the PRIMARY
// fix for the "override mistake": 'severe' enables override for all of
// Object.prototype, so libraries that assign `constructor` onto a plain object
// at init (axios, decimal.js) work even when loaded AFTER lockdown. These tests
// prove three things:
//   1. Those libraries DO throw under the SES default 'moderate' — i.e.
//      'severe' is load-bearing, not incidental.
//   2. The shipped 'severe' config fixes them without any warm-up.
//   3. The warm-up strategy (loading the offender BEFORE lockdown) is an
//      independent defense-in-depth that works even under 'moderate'.
import { execFileSync } from 'node:child_process';

import { getSesLockdownOptions } from '.';

// The exact options the app ships for web/desktop L2 (overrideTaming 'severe').
const SHIPPED_OPTIONS = getSesLockdownOptions('L2');
// The SES default; used only to prove the override mistake still exists there,
// so that 'severe' is demonstrably required.
const MODERATE_OPTIONS = {
  ...SHIPPED_OPTIONS,
  overrideTaming: 'moderate' as const,
};

function runUnderLockdown(
  snippet: string,
  options: typeof SHIPPED_OPTIONS = SHIPPED_OPTIONS,
): string {
  const source = `
const opts = JSON.parse(process.argv[1]);
${snippet}
`;
  return execFileSync(
    process.execPath,
    ['-e', source, JSON.stringify(options)],
    {
      encoding: 'utf8',
    },
  );
}

test('shipped web/desktop L2 lockdown uses overrideTaming "severe"', () => {
  expect(SHIPPED_OPTIONS?.overrideTaming).toBe('severe');
});

// --- The override mistake: proof that 'severe' is load-bearing -------------
// Under the SES default 'moderate', these libraries throw when loaded after
// lockdown. This is exactly why the app overrides the default to 'severe'.

test('decimal.js throws the override-mistake error under overrideTaming "moderate"', () => {
  // decimal.js `clone()` does `Decimal.prototype.constructor = Decimal` where
  // `Decimal.prototype` is a plain object literal (prototype chain goes straight
  // to the frozen Object.prototype), so module init fails.
  const out = runUnderLockdown(
    `
require('ses');
lockdown(opts);
try {
  const Decimal = require('decimal.js');
  process.stdout.write('OK:' + new Decimal(1.5).toString());
} catch (e) {
  process.stdout.write('ERR:' + e.message);
}
`,
    MODERATE_OPTIONS,
  );
  expect(out).toContain('ERR:');
  expect(out).toContain("Cannot assign to read only property 'constructor'");
});

test('axios throws the override-mistake error under overrideTaming "moderate"', () => {
  // axios runs a "reserved names hotfix" at module init: reduceDescriptors()
  // assigns `constructor` onto a fresh `{}` whose prototype is the frozen
  // Object.prototype. 'moderate' does not enable override for `constructor`, so
  // the strict-mode assignment throws. In production axios is pulled in lazily
  // by @ton/ton, so it initializes AFTER lockdown.
  const out = runUnderLockdown(
    `
require('ses');
lockdown(opts);
try {
  const axios = require('axios');
  process.stdout.write('OK:' + typeof axios.AxiosHeaders);
} catch (e) {
  process.stdout.write('ERR:' + e.message);
}
`,
    MODERATE_OPTIONS,
  );
  expect(out).toContain('ERR:');
  expect(out).toContain("Cannot assign to read only property 'constructor'");
});

test('axios browser build (the production culprit path) also throws under "moderate"', () => {
  // The reported error came from axios/dist/browser/axios.cjs (web bundle); pin
  // that exact path so a future axios bump that moves the hotfix is caught.
  const out = runUnderLockdown(
    `
require('ses');
lockdown(opts);
try {
  require('axios/dist/browser/axios.cjs');
  process.stdout.write('OK');
} catch (e) {
  process.stdout.write('ERR:' + e.message);
}
`,
    MODERATE_OPTIONS,
  );
  expect(out).toContain('ERR:');
  expect(out).toContain("Cannot assign to read only property 'constructor'");
});

// --- The shipped fix: 'severe' handles the offenders post-lockdown ---------
// No warm-up needed here; this is what actually protects production.

test('decimal.js works AFTER lockdown under the shipped "severe" config', () => {
  const out = runUnderLockdown(`
require('ses');
lockdown(opts);
try {
  const Decimal = require('decimal.js');
  process.stdout.write('OK:' + new Decimal(1.5).toString());
} catch (e) {
  process.stdout.write('ERR:' + e.message);
}
`);
  expect(out).toBe('OK:1.5');
});

test('axios (browser build) works AFTER lockdown under the shipped "severe" config', () => {
  const out = runUnderLockdown(`
require('ses');
lockdown(opts);
try {
  const axios = require('axios/dist/browser/axios.cjs');
  const headers = new axios.AxiosHeaders({ foo: 'bar' });
  process.stdout.write('OK:' + headers.get('foo'));
} catch (e) {
  process.stdout.write('ERR:' + e.message);
}
`);
  expect(out).toBe('OK:bar');
});

// --- Defense in depth: warm-up fixes the offenders even under 'moderate' ----
// The runtime warm-up (defaultWarmUpBeforeLockdown) loads these BEFORE lockdown
// so they are safe regardless of the override-taming setting. Kept even though
// 'severe' already covers them, so a future relax of overrideTaming can't
// silently reintroduce the crash.

test('decimal.js warmed up BEFORE lockdown works even under "moderate" (defense in depth)', () => {
  // Loading decimal.js before lockdown lets `clone()` install a writable own
  // `constructor` on Decimal.prototype while intrinsics are still mutable;
  // afterwards `new Decimal()` resolves `constructor` on that own property and
  // never reaches the frozen Object.prototype.constructor.
  const out = runUnderLockdown(
    `
const Decimal = require('decimal.js'); // warm-up: clone() runs before the freeze
require('ses');
lockdown(opts);
try {
  const d1 = new Decimal(1.5);
  const Decimal2 = require('decimal.js'); // cached module, same constructor
  const d2 = new Decimal2(2.5);
  process.stdout.write('OK:' + d1.toString() + ',' + d2.toString());
} catch (e) {
  process.stdout.write('ERR:' + e.message);
}
`,
    MODERATE_OPTIONS,
  );
  expect(out).toBe('OK:1.5,2.5');
});

test('axios warmed up BEFORE lockdown works even under "moderate" (defense in depth)', () => {
  // Loading axios before lockdown lets the reduceDescriptors() assignment land
  // while Object.prototype is still mutable; afterwards the cached module is
  // reused and never re-runs the hotfix.
  const out = runUnderLockdown(
    `
require('axios'); // warm-up: the reserved-names hotfix runs before the freeze
require('ses');
lockdown(opts);
try {
  const axios = require('axios'); // cached module, same AxiosHeaders
  const headers = new axios.AxiosHeaders({ foo: 'bar' });
  process.stdout.write('OK:' + headers.get('foo'));
} catch (e) {
  process.stdout.write('ERR:' + e.message);
}
`,
    MODERATE_OPTIONS,
  );
  expect(out).toBe('OK:bar');
});

// --- js-conflux-sdk: the jsbi shim must be self-contained (patch-package) ----
// Unlike axios/decimal.js (the "override mistake", fixed by 'severe'), the CFX
// jsbi shim originally did `module.exports = BigInt`, so it added its
// operations (BigInt, leftShift, ...) as OWN properties directly onto the
// native BigInt intrinsic. And because that export WAS the BigInt intrinsic,
// CONST.js' `JSBI.prototype.toJSON = ...` (jsbi.js never writes toJSON itself)
// also landed on BigInt.prototype. lockdown() REMOVES the own operations as
// "unpermitted intrinsics" (and freezes BigInt.prototype), so warm-up cannot
// save it (load order is irrelevant) and 'severe' does not apply.
// patches/js-conflux-sdk+2.3.0.patch makes the shim a self-contained module
// object with its OWN prototype, so both the operations and CONST.js' toJSON
// live off the BigInt intrinsic entirely and survive lockdown. Before the
// patch, requiring CONST.js after lockdown threw "JSBI.BigInt is not a
// function".

test('js-conflux-sdk jsbi shim works AFTER lockdown and never pollutes the BigInt intrinsic', () => {
  const out = runUnderLockdown(`
require('ses');
lockdown(opts);
try {
  const JSBI = require('js-conflux-sdk/src/util/jsbi');
  require('js-conflux-sdk/src/CONST.js'); // evaluates JSBI.leftShift(JSBI.BigInt(1), ...)
  // The shim's operations live on the module object itself, never on the
  // frozen BigInt intrinsic (so lockdown has nothing to strip).
  const works =
    typeof JSBI.BigInt === 'function' &&
    JSBI.leftShift(JSBI.BigInt(1), JSBI.BigInt(8)).toString() === '256' &&
    // CONST.js' \`JSBI.prototype.toJSON = ...\` succeeded post-lockdown: it
    // landed on the shim's OWN (unfrozen) prototype, not a frozen intrinsic.
    typeof JSBI.prototype.toJSON === 'function';
  const intrinsicUntouched =
    typeof BigInt.leftShift === 'undefined' &&
    typeof BigInt.BigInt === 'undefined' &&
    // ...and crucially never reached the native BigInt intrinsic, so the
    // intrinsic keeps no toJSON either (lockdown has nothing to strip).
    typeof BigInt.prototype.toJSON === 'undefined';
  process.stdout.write('OK:' + works + ',' + intrinsicUntouched);
} catch (e) {
  process.stdout.write('ERR:' + e.message);
}
`);
  expect(out).toBe('OK:true,true');
});

// --- bn.js / elliptic: NOT offenders (work fine post-lockdown) -------------

test('bn.js works even when loaded AFTER lockdown (not an offender)', () => {
  // bn.js' inline inherits() builds prototypes via `new TempCtor()` whose chain
  // keeps a writable own `constructor` at each level, so assigning it succeeds
  // even with a frozen Object.prototype. `toRed('k256')` exercises that chain.
  const out = runUnderLockdown(`
require('ses');
lockdown(opts);
try {
  const BN = require('bn.js');
  const reduced = new BN(255).toRed(BN.red('k256'));
  process.stdout.write('OK:' + reduced.fromRed().toString());
} catch (e) {
  process.stdout.write('ERR:' + e.message);
}
`);
  expect(out).toBe('OK:255');
});

test('elliptic secp256k1 + ed25519 work even when loaded AFTER lockdown (Tron/Solana curve path is not the offender)', () => {
  const out = runUnderLockdown(`
require('ses');
lockdown(opts);
try {
  const elliptic = require('elliptic');
  const ec = new elliptic.ec('secp256k1');
  const pub = ec.keyFromPrivate('11'.repeat(32)).getPublic().encodeCompressed('hex');
  // eslint-disable-next-line no-new
  new elliptic.eddsa('ed25519');
  process.stdout.write('OK:' + (pub.length === 66 ? 'compressed' : pub.length));
} catch (e) {
  process.stdout.write('ERR:' + e.message);
}
`);
  expect(out).toBe('OK:compressed');
});
