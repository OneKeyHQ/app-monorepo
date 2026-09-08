# Mobile LavaMoat lockdown

The mobile integration is an opt-in intrinsic integrity layer for the iOS and Android Hermes runtimes. It does not yet implement LavaMoat package compartments or per-package permissions. Dependencies retain access to ambient application capabilities such as networking and native modules.

## Build and rollback

Set `ONEKEY_MOBILE_LOCKDOWN=true` for the Metro process and the native/OTA bundle build. The default, or `ONEKEY_MOBILE_LOCKDOWN=false`, disables both SES injection and final hardening. Other values are rejected to catch deployment mistakes.

Restart Metro after changing the option. Its transform cache is separated by mode. Development vendor fingerprints also include the mode, the adapter configuration, and the finalization source; rebuild the vendor common bundle and rerun the official development-shell launcher to refresh its session resources when changing modes. An enabled delta must never run against a disabled vendor common bundle.

Lockdown cannot be undone in a running JavaScript realm. Rollback means distributing a build with the option disabled and restarting **both** runtimes. A hardening exception deliberately aborts startup; the app does not silently continue with partial protection.

The adapter is pinned to `@lavamoat/react-native-lockdown@1.0.0`, which pins `ses@1.15.0`. Version 2.0.0 changes only the Node.js engine requirement. The adapter's own dependency tree resolves `ses/hermes`; the separate web SES version must not be loaded into the same mobile realm.

Babel ignores the security preludes. In enabled builds, the existing mobile transformer returns a parse-only AST for exactly the adapter's two resolved real paths. This prevents Expo's ignored-file fallback from reloading application Babel transforms without a filename; unrelated dependencies still use their normal transformer. The developer vendor serializer composes its module selection with the configured SES guard.

The shared SES diagnostic code uses a platform-specific loader. Its native variant refuses late loading instead of pulling the vanilla web SES bundle into a lazy native segment. The vanilla bundle contains syntax that Hermes cannot compile when correctly excluded from Babel, and loading it would create a second SES instance.

## Initialization order and runtime ownership

Both production runtimes live in the same native process but have independent JavaScript heaps. The common bundle is evaluated separately in `main` and `background`; a successful lockdown in one is not proof of lockdown in the other. Each runtime independently follows this order:

1. Metro loads the untransformed Hermes SES shim and the official React Native repair prelude.
2. Metro polyfills and React Native `InitializeCore` install their vetted shims.
3. The entry sets its runtime identity and synchronously loads OneKey's shared polyfills.
4. `finishMobileLockdown` hardens the intrinsics, checks the result, and publishes an immutable diagnostic state before wallet bootstrap.

Code executed during the vetted-shim window is trusted bootstrap code. Freezing cannot undo malicious changes made before finalization, so those dependencies remain part of the trusted computing base.

The official `lockdownSerializer` hardcodes entry module ID `0`. OneKey's persisted module registry assigns positive IDs, and union, vendor, and segment serialization use multiple entries. The integration therefore reuses the official SES/repair sources through `getPolyfills`, preserves all existing serializer hooks, and finalizes explicitly in both entry modules. No entry ID or load-order assumption links the two realms.

Union builds place the SES prelude in common and finalization in each runtime's startup dependency graph. Segments register modules into an already hardened realm. Development vendor builds similarly carry repair in common while the workspace entry finalizes after loading its shared polyfills. HMR does not rerun hardening; changing runtime identity or build mode within an existing realm is rejected.

Native resources such as native storage and module singletons may be process-shared. Lockdown does not freeze those native objects or alter their ownership. Each runtime owns its own SES functions, intrinsic objects, and diagnostic state; native initialization remains independent and must preserve the existing storage launch gates.

The official repair uses `evalTaming: 'unsafe-eval'` because Hermes does not provide the direct-eval semantics needed for SES safe evaluation. This integration must not be presented as `L2` safe-eval confinement. Its diagnostic state is separate from the existing web/extension SES hardening page:

```js
globalThis.__ONEKEY_MOBILE_LOCKDOWN_STATE__;
// { enabled: true, runtime: 'main', lockdownApplied: true, evalTaming: 'unsafe-eval' }
```

Read this value in **each** runtime. An enabled build must also report frozen `Object.prototype`, `Array.prototype`, and `Function.prototype` and a callable `harden`. Absence of the repair prelude causes an error before wallet bootstrap.

## Automated verification

From the repository root, using a supported Node.js version:

```sh
yarn jest --runInBand --runTestsByPath apps/mobile/plugins/__tests__/mobileLockdown.test.js --coverage=false
ONEKEY_MOBILE_LOCKDOWN=true NODE_ENV=production node apps/mobile/scripts/check-mobile-lockdown.js
ONEKEY_MOBILE_LOCKDOWN=false NODE_ENV=production node apps/mobile/scripts/check-mobile-lockdown.js
```

The Jest suite executes the real SES/repair sources in separate Node VM realms. It checks intrinsic tamper resistance, independent main/background state, exactly-once initialization, missing-prelude failure, disabled behavior, serializer preservation, vendor fingerprints, and entry ordering.

The compiler check runs the actual mobile Babel configuration and the Expo script worker in debug and release modes, verifies that SES and repair are ignored by application transforms and gain no Metro dependencies, executes the resulting main/background fixtures in Node VM realms, and compiles them using this repository's pinned Hermes compiler. It writes artifacts to a temporary directory and prints their paths. **Compilation and Node VM tests do not prove native Hermes runtime compatibility.** The compiler package does not contain an executable Hermes VM.

## Validation record (2026-09-08)

Validation used React Native 0.86.2, Expo 57.0.14, the repository's `hermes-compiler@250829098.0.16`, and Node.js 24. Artifact checks and native execution are recorded separately below. Both main and background own their own JavaScript heaps; these checks do not establish shared native storage or native module behavior.

| Check                                                   | Result                                                                                                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Actual mobile Babel configuration, enabled and disabled | Main and background fixtures executed in separate Node VM realms and compiled to Hermes bytecode; SES and repair were not transformed |
| iOS production union and segment build, enabled         | Common, main, background, and segments generated; all generated bundles compiled to Hermes bytecode                                   |
| Android production union and segment build, enabled     | Same complete bundle and Hermes compilation checks passed                                                                             |
| Split-bundle integrity, both platforms                  | Scanned 2,611 main, 6 background, and 286 background-shared segments; zero main or background violations                              |
| Native SES resolution                                   | Shared native loader selected; the serializer rejects any second/vanilla SES instance before emitting a bundle                        |

The iOS compiler emitted 1,111 host-global warning lines and Android emitted 1,110, such as references to native-installed globals. Both union builds also reported existing forbidden-common-startup graph entries, including `ServiceCloudBackup`. These warnings require separate startup-graph work; this validation does not claim a warning-free build. Android native runtime verification was not performed in this session.

### iOS Debug runtime smoke

An isolated, empty iPhone 17 simulator running iOS 26.5 started successfully with `ONEKEY_MOBILE_LOCKDOWN=true` through the official development-shell launcher. The Debug shell was built locally with CocoaPods 1.17.0 in deployment mode, then signed, packaged, and verified by the official tooling. After the root manifest was finalized, the final session reused the exact signed archive and WebEmbed caches. The vendor cache fingerprint changed, so the official launcher rebuilt the JavaScript vendor locally after the remote OCI lookup returned HTTP 404; the regenerated vendor passed strict validation before launch.

The checked vendor fingerprint was `67d78026f3a579dc23a577d21e451f4e7bfebb5f020d8f028f85cb054e7064ef` (9,087 common modules). The signed shell archive SHA-256 was `1419a537ce3ac92f6f9bca6e88d137a31a2808e53507f7895a6a7e05c1aded21`. Both live runtimes reported that same vendor fingerprint.

| Native Debug check                                                        | main                                                        | background                                                                                |
| ------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Independent immutable diagnostic state                                    | `enabled: true`, `lockdownApplied: true`, `runtime: 'main'` | `enabled: true`, `lockdownApplied: true`, `runtime: 'background'`                         |
| `Object.prototype`, `Array.prototype`, `Function.prototype`               | All frozen                                                  | All frozen                                                                                |
| Callable `harden`; strict same-value assignment to `Array.prototype.push` | Function present; assignment rejected                       | Function present; assignment rejected                                                     |
| Promise, timer, and `process.nextTick` delivery                           | All delivered                                               | All delivered                                                                             |
| Existing LogBox entries, without clearing or disabling it                 | None                                                        | One warning placeholder: `Open debugger to view warnings.`; no error/fatal/syntax entries |

The wallet onboarding screen rendered and remained visible without creating/importing a wallet, unlocking, or signing. Inspector diagnostics selected both runtimes of the isolated simulator. The warning placeholder is not proof of a warning-free startup.

This smoke confirms enabled Debug startup and the listed JavaScript checks in both heaps. It does not verify the native release segment loader, disabled native startup/OTA rollback, hardware or storage concurrency, wallet operations, startup timing, or heap overhead. The same native process can share resources even though these two diagnostic states and their hardened intrinsics are separate JavaScript copies.

## Native acceptance matrix

Complete this matrix before enabling the option by default or using it in a release. Use both enabled and disabled builds and record the exact native/JS versions.

| Platform | Build                      | Runtime coverage    | Required evidence                                                                                  |
| -------- | -------------------------- | ------------------- | -------------------------------------------------------------------------------------------------- |
| iOS      | Debug with vendor common   | main and background | Enabled isolated simulator smoke passed as recorded above; disabled native startup remains pending |
| Android  | Debug with vendor common   | main and background | Same checks, including background timers and `process.nextTick`                                    |
| iOS      | Release union and segments | main and background | Common prelude present, each entry finalized, segments load, final HBC integrity passes            |
| Android  | Release union and segments | main and background | Same checks with Android Hermes bytecode and native segment loader                                 |
| Both     | OTA enabled to disabled    | main and background | Both runtimes restart; disabled bundle has no SES prelude and mutable intrinsics                   |

For each enabled runtime, verify a strict-mode attempt to replace `Array.prototype.push` throws. Then exercise cold startup, unlock, account derivation, signing with test-only credentials, hardware-wallet transport in background, WalletConnect, and lazy chain/feature segment loading. Verify Promise/timer delivery and error reporting remain functional. Capture startup duration and JavaScript heap changes separately for each runtime; do not confuse one shared native allocation with two JavaScript copies.

The integration remains opt-in until the native acceptance matrix is complete. The iOS Debug simulator result above is the only native execution evidence recorded here; compiler fixtures and bytecode builds do not imply the remaining device checks passed.

## References

- [LavaMoat React Native integration and Babel requirements](https://github.com/LavaMoat/LavaMoat/tree/react-native-lockdown-v1.0.0/packages/react-native-lockdown)
- [Upstream serializer and its entry ID assumption](https://github.com/LavaMoat/LavaMoat/blob/react-native-lockdown-v1.0.0/packages/react-native-lockdown/src/index.js)
- [Official React Native repair options and Hermes Promise repair](https://github.com/LavaMoat/LavaMoat/blob/react-native-lockdown-v1.0.0/packages/react-native-lockdown/src/repair.js)
- [Endo vetted-shim model](https://github.com/endojs/endo/blob/master/packages/ses/docs/guide.md#using-hardenedjs-with-vetted-shims)
