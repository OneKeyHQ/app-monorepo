# Reproducing a Firefox release

Use the exact source commit, Node version and bundled Yarn recorded in the release's
`firefox-build.json`. The release ZIP contains this file; it is also supplied beside
the ZIP. This entry builds the Firefox Manifest V3 package with public fallback
fonts and does not sign, submit or publish it.

## Create a release

Start from a clean committed checkout and run from the repository root. The
entry point installs dependencies using the bundled Yarn and an isolated build
environment:

```sh
node apps/ext/scripts/build-firefox.js --install
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

Verify the supplied source archive's SHA-256 against the independently supplied
checksum before extraction, or check out the recorded commit. A source package can
be produced from the clean release commit with `git archive --format=zip HEAD`.
Provide its SHA-256 beside the archive; it cannot authenticate itself.
Use the Node version recorded in the manifest. From the source root, run this with Node directly so it also works before dependency installation:

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

## Firefox runtime

Firefox 128 or newer is required for declarative MAIN-world provider injection.
The MV3 background is a non-persistent DOM event page. It hosts the web SDKs and
privacy-chain Workers directly; Chromium's service worker and offscreen proxies
are not used. Background SDK chunks load on demand from the packaged extension.
The UI and background have separate JS heaps and initialize independently.
Unloading the event page discards in-memory state; wallet secrets must never be
persisted to keep an unlocked session alive.

Firefox has no WebUSB/WebHID transport. Physical hardware flows require separate
validation of supported connection methods. Keyless flows use the existing
expand-tab fallback when Chrome's side-panel API is unavailable.

Before store submission, confirm `browser_specific_settings.gecko.id` against the
publisher's AMO listing and complete the data-collection permission declaration
and consent audit. The runtime migration does not claim AMO acceptance.

## Validation scope

The release/replay path has been verified on macOS ARM64 with Node 24.13.0 and
Yarn 4.18.1, including separate checkout paths and a source archive without Git
metadata or preinstalled dependencies. Linux reviewer-environment and Windows
validation remain separate release checks. Cache contents are not part of the
release metadata; package integrity is pinned by the immutable Yarn lockfile.
