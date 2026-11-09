# CI EAS CLI

This standalone Yarn project locks EAS and its transitive dependencies without
adding release tooling to the app workspace. Install it before supplying any
Expo or signing credentials:

```sh
cd .github/tools/eas-cli
node ../../../.yarn/releases/yarn-4.12.0.cjs install --immutable
node node_modules/eas-cli/bin/run --version
```

To update, change the exact version in `package.json`, run the same install
without `--immutable`, and review the manifest and lockfile together. Install
scripts and the parent app's postinstall hook are disabled. Newly resolved npm
versions must be at least seven days old. Use `.github/scripts/mobile-release.sh`
for builds so credentials are written just before use and removed on exit.
