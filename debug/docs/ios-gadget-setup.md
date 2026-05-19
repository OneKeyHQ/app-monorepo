# Real-iOS Frida Setup (gadget injection)

For real iOS devices, Frida can't `attach` directly without jailbreak. The
workaround is to embed `FridaGadget.dylib` into a Debug-signed `OneKey.app`
**after build** but **before install**. The gadget exposes a TCP listener
inside the app process that the host's `frida` connects to.

This is a one-time-per-build setup. The script does **not** modify the
OneKey monorepo — only patches the built `.app` bundle.

## Prerequisites

```bash
# One of these for Mach-O LC_LOAD_DYLIB patching:
brew install --HEAD insert-dylib
# or
brew install --HEAD optool

# (Xcode Command Line Tools provide codesign / otool / install_name_tool.)
```

Run `yarn native-debug-bridge:doctor` — it now reports whether `insert_dylib`
or `optool` is available.

## Usage

```bash
# After yarn app:ios builds the Debug variant:
yarn app:ios                                    # produces …/Debug-iphoneos/OneKey.app

# Inject + re-sign:
./debug/scripts/inject-gadget-ios.sh \
  ~/Library/Developer/Xcode/DerivedData/OneKey-*/Build/Products/Debug-iphoneos/OneKey.app

# Install on the device:
xcrun devicectl list devices                    # find your UDID
xcrun devicectl device install app \
  --device <UDID> \
  ~/Library/Developer/Xcode/DerivedData/OneKey-*/Build/Products/Debug-iphoneos/OneKey.app
```

After launching OneKey on the device, attach from the host:

```bash
frida -U -n OneKey
# or via the debug bridge:
yarn dev:native-debug-bridge &
node debug/bin/odb.js session attach -p ios -d <UDID>
node debug/bin/odb.js native-call $SID '-[UIApplication sharedApplication]'
```

## How it works

1. Resolves the main binary inside `OneKey.app/` (uses CFBundleExecutable).
2. Detects the binary's primary arch (`arm64` or `arm64e` for modern devices).
3. Downloads the matching `FridaGadget.dylib` from the frida release matching
   `--version` (defaults to a known-good build), caches under
   `~/.onekey-debug/cache/frida-gadget/<version>/`.
4. Copies the dylib to `OneKey.app/Frameworks/FridaGadget.dylib`.
5. Patches `LC_LOAD_DYLIB` in the main binary (`@executable_path/Frameworks/FridaGadget.dylib`).
6. Re-signs the dylib + the entire .app ad-hoc, preserving the app's
   original entitlements if any.
7. Verifies with `codesign --verify --deep --strict`.

## Customization

```bash
./debug/scripts/inject-gadget-ios.sh OneKey.app --arch arm64e
./debug/scripts/inject-gadget-ios.sh OneKey.app --version 16.5.0
```

## Troubleshooting

- **`download failed`** — your firewall may block the GitHub release. Set
  `HTTPS_PROXY` or manually drop the dylib at the cache path the error
  prints.
- **`codesign --verify` fails after patch** — usually means the .app already
  carries Apple-issued provisioning that ad-hoc resign can't fully replace.
  For Debug builds this is harmless; the install will still succeed because
  Xcode's free-provisioning flow accepts ad-hoc.
- **Frida attaches but rpc.exports are empty** — confirm `frida-gadget.dylib`
  is the same major version as the host `frida` CLI / npm package
  (16.x ↔ 16.x).
