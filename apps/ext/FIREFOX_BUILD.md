# Reproducing a Firefox release

Use the exact source commit, Node version and bundled Yarn recorded in the release's
`firefox-build.json`. The release ZIP contains this file; it is also supplied beside
the ZIP. This entry builds the Firefox Manifest V2 package with public fallback
fonts and does not sign, submit or publish it.

## Create a release

Start from a clean committed checkout. Install dependencies, then run from the
repository root:

```sh
GITHUB_SHA=$(git rev-parse HEAD) ONEKEY_FONTS_FORCE_FALLBACK=1 ONEKEY_REQUIRE_PRIVATE_FONTS=0 yarn install --immutable
yarn app:ext:build:firefox
```

`BUILD_TIME` can override the Unix timestamp in milliseconds. `BUILD_NUMBER` and
`BUNDLE_VERSION` can override their release defaults (`1`). `VERSION` normally
comes from `.env.version`. Pass any public runtime configuration explicitly in the
environment. The reproducible entry ignores `.env` and `.env.expo`;
`.env.version` supplies the default app version. Private fonts are never fetched.

Output in `apps/ext/build/_dist/firefox/`:

- `OneKey-Wallet-<version>-firefox.zip`: unsigned release with normalized ZIP metadata.
- `firefox-build.json`: effective public build parameters, source commit, lockfile
  hash and exact Node/Yarn versions. Authentication tokens are not included.
- `firefox-files.sha256`: SHA-256 for every unpacked file, including the build manifest.
- `<zip-name>.sha256`: SHA-256 for the unsigned ZIP.

## Reproduce a submitted version

Verify the supplied source archive's checksum before extraction, or check out the
recorded commit. Use the Node version recorded in the manifest. From the source
root, run this with Node directly so it also works before dependency installation:

```sh
node apps/ext/scripts/build-firefox.js --manifest /absolute/path/firefox-build.json --install
```

The script checks the source commit when Git metadata is present, the lockfile and
tool versions, then restores the recorded public environment before installation.
For a source archive without `.git`, the externally verified source archive is the
source-of-truth; the declared commit alone cannot authenticate arbitrary sources.
Parameters must be provided before installation because postinstall generates
injected scripts and fonts. The build removes previous extension output and
compiler caches. Build in separate source directories to check path independence.

Compare the unpacked file checksums first, then the unsigned ZIP checksum. Signed
XPI files contain signing metadata and are not the unsigned ZIP comparison target.
The JSON is an allowlisted record of client-visible environment variables; do not
add build credentials or a complete process environment to it. Preserve null
values because a missing value differs from an empty string in emitted JavaScript.

Reproducible output does not establish browser functionality or AMO acceptance.
Validate the release in Firefox and run AMO validation separately, including wallet
creation/import, DApp signing and the supported hardware connection methods.
