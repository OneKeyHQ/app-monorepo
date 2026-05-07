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
- `apps/cli/build/macos-standalone/darwin-${arch}/npm-tarball/*.tgz`

The GitHub Actions workflow is:

```text
.github/workflows/cli-macos-standalone.yml
```

It builds separate `arm64` and `x64` packages. The current workflow reuses the
desktop Developer ID certificate secrets:

- `DESKTOP_KEYS_SECRET`
- `CSC_KEY_PASSWORD`

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

For npm distribution, the important security property is the signed Mach-O
executable identity used for Keychain access. Users install through npm and run
the CLI from Terminal, so Gatekeeper quarantine checks are usually not the main
distribution blocker.

Notarization is recommended when distributing the same binary through channels
outside npm, for example:

- GitHub Releases
- Website downloads
- Slack or other direct file sharing
- ZIP, PKG, or DMG artifacts

Notarization lets Apple scan the signed software and issue a ticket that
Gatekeeper can verify when the downloaded file is first opened or executed. It
improves first-run trust and reduces quarantine/Gatekeeper friction. It is not
what gives the CLI its Keychain access identity; code signing does that.

## Future Notarization Steps

When we decide to distribute the macOS CLI outside npm, add a notarization phase
to the standalone CLI workflow:

1. Enable Hardened Runtime during signing:

   ```bash
   CLI_MACOS_HARDENED_RUNTIME=true
   ```

2. Decide how native addons are handled under Hardened Runtime. The CLI embeds
   and extracts the `@napi-rs/keyring` native `.node` file, so either sign that
   native file with the same Developer ID identity before embedding it, or add
   the entitlement below if library validation must be disabled:

   ```xml
   <key>com.apple.security.cs.disable-library-validation</key>
   <true/>
   ```

3. Package the signed CLI into a notarizable container, usually ZIP or PKG.

4. Submit it with `notarytool` using the same Apple credentials already used by
   desktop releases:

   ```bash
   xcrun notarytool submit path/to/onekey-cli.zip \
     --apple-id "$APPLEID" \
     --password "$APPLEIDPASS" \
     --team-id "$ASC_PROVIDER" \
     --wait
   ```

5. Staple the ticket when the artifact type supports stapling:

   ```bash
   xcrun stapler staple path/to/onekey-cli.zip
   ```

6. Verify on a clean macOS machine or VM:

   ```bash
   spctl --assess --type execute --verbose path/to/onekey
   path/to/onekey --version
   ```

Keep notarization opt-in until a non-npm distribution channel requires it.
