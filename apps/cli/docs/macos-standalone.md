# macOS Standalone CLI Packaging

This document covers the macOS command-line standalone distribution for
`onekey`. The output is a signed Mach-O CLI executable, not a `.app` bundle,
and it runs directly from Terminal without LaunchAgent or background service
installation.

## Why This Exists

The regular npm CLI entry starts through the user's `node` executable. On
macOS, Keychain access control is tied to the accessing executable identity, so
that path makes the Keychain caller effectively `node`.

The standalone macOS package embeds the CLI into a signed `onekey` executable.
When this executable creates or reads Keychain items, macOS can bind access to
the OneKey CLI binary identity instead of the user's shared Node runtime.

The binary also embeds the macOS `@napi-rs/keyring` native binding as a Node SEA
asset. At runtime the CLI verifies the asset by content hash, extracts it under
the system temp directory, and loads that native binding directly. This keeps
Keychain access working when the binary is copied outside the repository or
installed as the npm package.

The packaging step also patches the final Node SEA executable so it does not
consume `NODE_OPTIONS`. This prevents environment-level preloads or inspector
flags from running before the CLI code under the OneKey CLI Keychain identity.
The CLI bootstrap additionally clears `NODE_OPTIONS`, `NODE_PATH`, and Node
global module search paths before bundled code runs.

## Build

```bash
yarn workspace @onekeyfe/cli package:macos-standalone
```

The script produces:

- `apps/cli/build/macos-standalone/darwin-${arch}/onekey`
- `apps/cli/build/macos-standalone/darwin-${arch}/onekey-cli-darwin-${arch}.zip`
- `apps/cli/build/macos-standalone/darwin-${arch}/npm-tarball/*.tgz`

The GitHub Actions workflow is:

```text
.github/workflows/cli-macos-standalone.yml
```

It builds separate `arm64` and `x64` packages. The current workflow reuses the
desktop Developer ID and notarization secrets:

- `DESKTOP_KEYS_SECRET`
- `CSC_KEY_PASSWORD`
- `APPLEID`
- `APPLEIDPASS`
- `ASC_PROVIDER`

The CLI package does not need the desktop provisioning profile. It does not use
CloudKit, App Sandbox, or a Keychain access group.

## Local Development

The packaging script must run with a Node.js binary that contains the SEA fuse.
Some Homebrew or locally built Node.js binaries do not include it. When that
happens, download and use an official Node.js macOS binary:

```bash
yarn workspace @onekeyfe/cli build
/path/to/official-node/bin/node apps/cli/scripts/package-macos-standalone.js
```

The resulting binary can be run directly from Terminal:

```bash
apps/cli/build/macos-standalone/darwin-arm64/onekey --version
apps/cli/build/macos-standalone/darwin-arm64/onekey auth status --json
```

The generated npm package can also be installed from the local tarball:

```bash
npm install -g apps/cli/build/macos-standalone/darwin-arm64/npm-tarball/*.tgz
```

After publishing from CI, install the platform package directly:

```bash
npm install -g @onekeyfe/cli-darwin-arm64@next
```

This standalone package is opt-in. The existing `@onekeyfe/cli` package keeps
its current Node.js entry until we explicitly switch the default distribution.

The single copied binary embeds the Keychain native binding. Hardware-wallet
commands still depend on the HD SDK and USB packages declared by the npm package,
so use the npm-installed package for hardware-wallet flows rather than copying
only the binary to an arbitrary directory.

## Notarization Policy

Notarization is not required for npm-only distribution.

The GitHub Actions workflow notarizes the standalone macOS CLI zip by default
because workflow artifacts and direct downloads can receive the
`com.apple.quarantine` attribute and be assessed by Gatekeeper. For npm
distribution, the important security property is still the signed Mach-O
executable identity used for Keychain access. Users install through npm and run
the CLI from Terminal, so Gatekeeper quarantine checks are usually not the main
distribution blocker.

Keep notarization enabled when distributing the same binary through channels
outside npm, for example:

- GitHub Releases
- Website downloads
- Slack or other direct file sharing
- ZIP, PKG, or DMG artifacts

Notarization lets Apple scan the signed software and issue a ticket that
Gatekeeper can verify when the downloaded file is first opened or executed. It
improves first-run trust and reduces quarantine/Gatekeeper friction. It is not
what gives the CLI its Keychain access identity; code signing does that.

The standalone CLI is a plain Mach-O executable, not a `.app` bundle. Apple
creates notarization tickets for standalone binaries, but the ticket cannot be
stapled directly to the binary. ZIP files also cannot be stapled directly. The
workflow therefore submits the ZIP for notarization and verifies the resulting
online ticket with:

```bash
codesign --verify --check-notarization --verbose=4 path/to/onekey
```

The workflow does not treat `spctl --assess --type execute` as the standalone
binary pass/fail check because current macOS runners reject plain Mach-O tools
with `the code is valid but does not seem to be an app`, even after Apple
accepts the notarization submission. Instead, it verifies notarization with
`codesign --check-notarization` and executes a copied binary after applying
`com.apple.quarantine`, which is the Gatekeeper path that direct downloads use.

## CI Notarization Steps

The workflow does the following when `notarize` is enabled:

1. Enable Hardened Runtime during signing:

   ```bash
   CLI_MACOS_HARDENED_RUNTIME=true
   ```

2. Sign the `@napi-rs/keyring` native `.node` file copy before embedding it
   into the SEA executable. The CLI executable uses these Hardened Runtime
   entitlements:

   ```xml
   <key>com.apple.security.cs.allow-jit</key>
   <true/>
   <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
   <true/>
   <key>com.apple.security.cs.disable-library-validation</key>
   <true/>
   ```

   The JIT entitlements keep the Node/V8 runtime functional. Library validation
   is disabled because CLI flows may load native Node addons.

3. Package the signed CLI into a notarizable ZIP.

4. Submit the ZIP with `notarytool` using the same Apple credentials already
   used by desktop releases:

   ```bash
   xcrun notarytool submit path/to/onekey-cli.zip \
     --apple-id "$APPLEID" \
     --password "$APPLEIDPASS" \
     --team-id "$ASC_PROVIDER" \
     --wait
   ```

5. Verify on CI and on a clean macOS machine or VM:

   ```bash
   codesign --verify --check-notarization --verbose=4 path/to/onekey
   QUARANTINE_TS="$(printf '%x' "$(date +%s)")"
   xattr -w com.apple.quarantine \
     "0081;$QUARANTINE_TS;onekey-ci;https://github.com/OneKeyHQ/app-monorepo" \
     path/to/onekey
   path/to/onekey --version
   ```

For offline first-run support, distribute a `.pkg` or `.dmg` wrapper and staple
that container. A plain standalone binary should be treated as an online-ticket
notarized artifact.

## Apple Account Setup

No new App ID, provisioning profile, iCloud capability, App Sandbox setting, or
Keychain access group is needed for the CLI. Keep the signing identifier as
`so.onekey.cli`; it is only a code-signing identifier for this Mach-O binary.

Required Apple-side material:

- A valid `Developer ID Application` certificate in the OneKey Apple Developer
  team. The existing desktop `DESKTOP_KEYS_SECRET` and `CSC_KEY_PASSWORD` can be
  reused if that P12 contains `Developer ID Application: ...`.
- An Apple ID that has access to that developer team and an app-specific
  password stored as `APPLEIDPASS`.
- The Apple Developer Team ID stored as `ASC_PROVIDER`, matching the desktop
  notarization workflow.

Only add a `Developer ID Installer` certificate if we later choose to ship a
stapled `.pkg` installer.
