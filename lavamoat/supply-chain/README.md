# Dependency installation policy

The install policy applies to local development and CI before any application
bundle runs. Yarn 4.12 performs native dependency builds; the project plugin
checks which scripts it may execute. Mobile `main` and `bg` runtime lockdown is
configured separately. Installation runs in the host Node.js process and does
not share either application's JS heap or native storage resources.

## Enforcement

- `.yarnrc.yml` sets `enableScripts: false`.
- Root `dependenciesMeta` grants `built: true` only to reviewed, exact
  `package@version` selectors. Yarn retains its dependency ordering, platform
  selection, build cache and optional dependency failure handling.
- `install-scripts.json` records each package's resolution, version, lockfile
  checksum, literal lifecycle commands, implicit `node-gyp` behavior, decision
  and rationale. A missing decision fails installation even though Yarn has
  already disabled the unknown script.
- The Yarn plugin validates approvals before installation, checks the target
  package immediately before explicit lifecycle scripts and implicit
  `binding.gyp` builds, then checks every installed package location after
  linking. It uses Yarn's installation state, covering all workspaces and their
  development dependencies, including nested and virtual dependency instances.
- An incomplete installation state or missing package manifest fails closed.
- Git sources must use reviewed HTTPS GitHub URLs with full commit SHAs. Their
  packed artifact checksums are recorded separately. Dependency resolution also
  rejects new transitive Git sources before fetching them. The `arbundles/avsc`
  resolution fixes its upstream branch reference to the existing commit. Git
  shorthand, non-GitHub hosts, executable sources and Git wrapped in `patch:`
  are rejected; `patch:` only accepts npm registry sources.
- `afterInstall` runs `setup:dependencies` only after the complete policy check.
  The root has no automatic `postinstall` hook, avoiding premature or duplicate
  `patch-package` and injected-code setup. Manually invoking
  `yarn setup:dependencies` or `yarn after-install` also requires that full check.

Yarn omits lockfile checksums for some OS-conditional packages. For the existing
`@stoprocent/bluetooth-hci-socket` dependency, the policy instead records SHA-256
hashes for every file in the original cached package archive, plus its complete
archive SHA-512 for review. The execution check verifies those published paths,
including anything published under `build/`. It permits additional compiler
outputs without excluding any published source file from verification.

## Reviewing a dependency change

1. Run `yarn install --mode=skip-build` to resolve and link without running native
   builds. A newly introduced or changed script may make the final policy check
   fail; the completed installation state remains available for review. Existing
   approved source/checksum mismatches must be resolved before further installs.
2. Run `yarn supply-chain inventory > install-scripts.candidate.json`.
   This command only prints a proposal. New or changed packages start with
   `allow: false`; previous approval is retained only for unchanged entries.
   Never redirect directly into the policy file that the command reads. Delete
   the candidate after review and do not commit it.
3. Inspect the actual installer and its invoked files, native build inputs,
   downloads and telemetry. Record a concrete reason for every decision. Retain
   records needed on the other supported host platforms when incorporating the
   candidate. For a checksum-less package, derive `fileHashes` from the original
   package archive, including all published files; do not snapshot generated
   build outputs or exclude source directories.
4. Update `install-scripts.json` and the corresponding exact `dependenciesMeta`
   selector together. Do not add a package-wide `built: true` entry. New Git
   revisions require an isolated source review and a verified packed artifact
   checksum before admission to ordinary installs.
5. Run `yarn install --immutable`, `yarn supply-chain check`,
   `yarn lavamoat:supply-chain:test`, and
   `yarn lavamoat:git-dependencies:check`. Run
   `yarn lavamoat:supply-chain:binaries` to verify every installed esbuild and
   Sentry CLI instance resolves its locked platform binary and works without
   installer-generated files. The dedicated workflow repeats these checks on
   Linux, macOS and Windows.

The initial policy contains 38 decisions: 20 allowed native/setup hooks and 18
denied hooks. It preserves required native builds and binary preparation,
including hardware transports, Skia and Detox. It disables version/banner hooks,
unnecessary published-source rebuilds, the SWC fallback installer and Realm's
Node installer/analytics. SWC uses locked platform packages; Realm's mobile
native code is built by CocoaPods and Gradle.

All six esbuild versions and both Sentry CLI versions use their locked optional
platform packages directly. Their installers are disabled: esbuild can otherwise
run an independent npm install or download an archive without verifying its
checksum, and Sentry's cached fallback skips checksum verification before binary
execution. Disabling nested lifecycle scripts alone would not stop those binary
executions. Pristine package/archive fixtures confirmed that their CLI and API
paths work without running either installer.
The esbuild CLI check executes the locked platform binary directly, supporting
both fresh JS wrappers and existing installations whose old installer replaced
`bin/esbuild` with a native executable.

## Choice of tools

`@lavamoat/allow-scripts` 5 provides version-aware approvals, but its default
dependency walk does not enumerate independent workspace roots or their
development dependencies. Its runner also owns lifecycle ordering, replays root
hooks and does not preserve all Yarn optional-build behavior. This repository
therefore uses Yarn's native exact-version `dependenciesMeta` support with a
small admission checker, verified by real Yarn fixtures.

The newer `@lavamoat/harden` documentation requires Yarn 4.16 or newer and labels
the current 0.x releases as previews. Adopting it can be reassessed with a package
manager upgrade. See the official [allow-scripts guide](https://lavamoat.github.io/guides/allow-scripts/)
and [harden guide](https://lavamoat.github.io/guides/harden/).

The official `@lavamoat/git-safe-dependencies` 1.0.1 verifies GitHub commit
ownership in CI. Its small patch preserves scoped package names and normalizes
only complete Yarn `#commit=<40-character SHA>` selectors. It retains the
upstream provenance checks and has no ignored findings.

## Boundaries and rollback

Approved hooks retain host build privileges; this policy is an admission check,
not a process sandbox. Node/npm fallback installers inherit disabled lifecycle
scripts. Git source packing, explicitly invoked build tools, CocoaPods and
Gradle still require source and lockfile review. Runtime module permissions and
native resource access remain separate controls.

There is no permissive environment-variable fallback. Revert the configuration,
plugin, policy and root install-command changes together if the installation
integration must be rolled back. A missing or outdated approval should be
corrected through review instead of enabling all scripts.
