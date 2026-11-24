# CI EAS CLI

This standalone Yarn project locks EAS and its transitive dependencies without
adding release tooling to the app workspace. Install it before supplying any
Expo or signing credentials:

```sh
cd .github/tools/eas-cli
node ../../../.yarn/releases/yarn-4.18.1.cjs install --immutable
node node_modules/eas-cli/bin/run --version
```

To update, change the exact version in `package.json`, run the same install
without `--immutable`, and review the manifest and lockfile together. Install
scripts and the parent app's postinstall hook are disabled. Newly resolved npm
versions must be at least seven days old. Use `.github/scripts/mobile-release.sh`
for builds so credentials are written just before use and removed on exit.

The five scoped resolutions replace vulnerable exact pins in EAS with compatible
patched versions. Run the EAS compatibility tests and `yarn npm audit --all
--recursive --severity high` when updating this lockfile. The compatibility
tests validate the real mobile profiles and signing-credential import, including
rejection of a zero PKCS#12 MAC/KDF iteration count.
