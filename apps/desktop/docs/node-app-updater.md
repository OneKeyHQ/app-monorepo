# Desktop app-shell updater without `electron-updater`

## Goal and ownership

Replace the runtime `electron-updater` dependency with a Node-based app-shell
downloader and platform-specific install handoff. Keep the existing OneKey
`AppUpdate` contract and UI flow. The Utility app-update response remains the
authority for whether a user may update and which target version is selected.
The existing `electron-feed-url?version=<selected version>` endpoint remains the
source of platform artifacts and checksums. Do not implement the feed's
`stagingPercentage`, updater ID, prerelease channel, differential download, or
other `electron-updater` rollout policy.

Desktop main and background code runs in one JS runtime. The Electron main
process owns download files, cache metadata, the local macOS feed, and install
handoff. The renderer receives progress and completion over the existing IPC
events; it never chooses an installer path or invokes an OS installer directly.

## Public API alignment with Android APK updates

Keep the shared `AppUpdate` interface so `ServiceAppUpdate` and its UI continue
to call the same functions on Android and Desktop. Android delegates to the
native `ReactNativeAppUpdate`; Desktop delegates to the Electron main process.

| Shared function | Android APK operation | Desktop app-shell operation |
| --- | --- | --- |
| `downloadPackage` | `downloadAPK` from the Utility-selected URL | Resolve the Utility-selected version through the existing Electron feed, then download the OS artifact in Node |
| `downloadASC`, `verifyASC`, `verifyPackage` | Native ASC download, GPG check, and APK check | Fetch `.SHA256SUMS.asc`, verify GPG, and hash the cached installer |
| `checkPackageAvailability` | Currently returns `notApplicable`; native install checks existence | Check the canonical, verified main-process cache record |
| `installPackage` | `installAPK` | Native confirmation followed by Squirrel.Mac, NSIS, or AppImage handoff |
| `manualInstallPackage` | Platform fallback | Open the verified installer directory |
| `clearPackage` | Clear native update cache | Cancel the active Node transfer and clear its cache |
| `clearApkCache` | Clear the separate APK cache | No-op, since Desktop has no APK cache |

The Android native method names do not become new Desktop IPC methods. Desktop
continues to expose `checkForUpdates`, `downloadUpdate`, and the existing
verification/install methods through `desktopApiProxy.appUpdate`.

Desktop API visibility is enforced in the shared main-process dispatcher used
by both invoke IPC and the legacy JsBridge. Before every main build,
`scripts/generate-desktop-api-methods.js` reads the registered API classes with
the TypeScript compiler API and regenerates the frozen public-method metadata.
Public instance methods and function fields are remote-callable; internal helpers
must be private or protected. Constructors, accessors, static members, private
identifiers, and prototype methods are not exposed. Unsupported inheritance or
dynamic names fail the build, and missing module/method metadata denies calls.
Both IPC entrances require the current main window's main frame.

## Current behavior to preserve

- `AppUpdate.downloadPackage`, `downloadASC`, `verifyASC`, `verifyPackage`,
  `checkPackageAvailability`, `installPackage`, `manualInstallPackage`, and
  `clearPackage` retain their shared signatures and error/status behavior.
- `/utility/v1/app-update` and `ServiceAppUpdate` choose the eligible version,
  strategy, and app-shell versus JS-bundle path. Only a selected app-shell
  update invokes the desktop package downloader.
- Query the current `electron-feed-url` endpoint with the selected version and
  the current custom user-agent/request headers. The feed is artifact metadata,
  not a second rollout decision. Reject a feed version that differs from the
  selected version. Select the artifact matching OS and architecture: macOS ZIP
  (not the website DMG), Windows NSIS EXE, Linux AppImage. Reject missing or
  ambiguous artifacts and non-HTTPS remote URLs/redirects.
- Keep progress/error/downloaded IPC, window progress, the native install
  confirmation dialog, manual-install fallback, ASC/GPG verification, and
  a second integrity check immediately before install. Store-channel builds
  remain outside self-install.

## Download and cache

- Reuse the Node downloader in `DesktopApiBundleUpdate` by extracting only its
  transport, range, and resume mechanism into an internal reusable unit. Both
  JS bundles and app-shell packages must retain their existing public APIs.
- Large range-capable objects use the existing eight concurrent byte ranges,
  positioned writes, durable `.partial` progress manifest, transient retry,
  cancellation, and range validation. Use a single stream when range is
  unavailable or the concurrent path cannot safely continue. Preserve partial
  bytes on transient interruption, including across app restart.
- HTTP 416 triggers bounded retries and a fresh object/range probe before
  deciding whether to reset a partial file. Matching metadata preserves the
  single-stream offset or completed parallel segments. Changed metadata resets
  incompatible bytes; failed recovery retains the manifest for another attempt.
- Retry delays in probe, segment, and single-stream paths observe cancellation.
  Server-provided Retry-After delays are capped at 60 seconds. Hash reads also
  observe cancellation, including verified-cache reuse; cancellation must reject
  before a partial file is promoted or a successful download is published.
- Accept request headers for feed and artifact requests. Do not forward secrets
  to a redirect on a different origin. Recheck redirect scheme and response
  ranges. Bind a resume manifest to the selected version, OS, architecture,
  artifact identity, size, and checksum so a changed URL/object cannot mix
  bytes with the old package.
- Verify the feed checksum (SHA-512) before promoting a partial file. Continue
  to fetch and verify the existing `.SHA256SUMS.asc` sidecar and compare its
  SHA-256 with the downloaded file. Stream hashes instead of reading a full
  installer into memory. Revalidate the selected version, canonical cache
  path, file identity, and checksum at install handoff.
- An old `electron-updater` cache is not install-ready in the new flow. Treat
  it as missing and download once into the new cache; do not trust a persisted
  renderer path. Cache clearing must cancel the active transfer before removing
  files. A fully verified new cache may be reused after a cold start.

## Install handoff

All platforms acquire one main-process installation lock before showing the
confirmation dialog. Concurrent calls return false without another dialog or
installer. Cache clearing and new update operations are blocked while installation
is pending. Cancellation, verification/launch failure, and manual-folder fallback
release the lock; successful native/installer/relaunch handoff keeps it until exit.

| Target | Required behavior |
| --- | --- |
| macOS (non-MAS) | Keep Squirrel.Mac via Electron's built-in `autoUpdater`. Node download alone emits the package-ready event. Fetch and verify ASC/GPG/SHA-256, then ask for native installation confirmation. Only after confirmation, serve the verified ZIP through an authenticated loopback JSON feed, call native `checkForUpdates`, wait for native `update-downloaded`, and immediately call native `quitAndInstall`. Keep the loopback server alive until Squirrel has staged the ZIP. Squirrel may apply a staged update on the next launch even without `quitAndInstall`, so no further cancellation or deferred verification may occur after staging. Verify native exit, relaunch, and installed version; retain a delayed quit fallback if normal quit is blocked. |
| Windows NSIS (non-Store) | Launch only the verified EXE with the equivalent non-silent NSIS update arguments and current install-directory behavior. Handle spawn/elevation failure without claiming success. Preserve the native confirmation and manual folder-opening fallback. Electron's built-in Windows `autoUpdater` is not an NSIS installer. |
| Linux AppImage | For a usable writable `APPIMAGE` path, copy and replace the verified executable while retaining the old package, then queue `app.relaunch({ execPath })` and quit so the old process releases its single-instance lock first. The handoff response means restart was queued; it does not prove installation. On the next startup, confirm the selected version and `APPIMAGE` path before recording the build number and cleaning up the old package. A restart on the old version restores/removes the candidate through a pending handoff marker. If the runtime path is absent, read-only, or unsuitable, open the verified download directory for manual installation. Snap/Flatpak remain store-managed. |

## Integration and removal

- Replace `DesktopApiAppUpdate`'s `electron-updater` check/download/install
  state. The desktop `AppUpdate` adapter continues to expose the shared API.
  Keep the existing service retry and persisted update states. Remove the
  `isUpdaterRehydrated`/`notPrepared` path only when cold-start cached-package
  reconciliation works with the new verified cache.
- Keep `electron-builder` and its macOS ZIP, Windows NSIS, Linux AppImage, and
  `latest*.yml` publication. Remove `electron-updater` from both desktop
  manifests and lockfiles, its patch and patch-only tests, build external,
  runtime harness assumptions, and obsolete comments. Ensure feed parsing
  dependencies are available in the packaged main process.
- Keep package boundaries: `kit-bg` main-process code may use Node/Electron;
  `shared` remains a typed adapter and must not import upward into `kit-bg`.

## Reproduction and acceptance

Known failure to prevent: a cached macOS ZIP can pass GPG/SHA verification and
the frontend can receive `success: true` while Squirrel never stages the file,
the process does not exit, and the app reopens on the old version. Another
non-passing condition is an old or wrong-version cache being considered ready.

Focused checks must cover feed version/architecture selection, headers and
redirects, no-range fallback, interrupted eight-way and single-stream resume,
changed ETag/checksum/URL, corrupt cache, cancel/clear, GPG failure, and
renderer-supplied path rejection. Test platform handoff decisions without
running installers in unit tests. Run the repository's required check profiles.

Full acceptance requires signed packaged update tests on macOS x64 and arm64,
Windows NSIS, and Linux AppImage: download, interrupt and relaunch, resume,
verify, confirm install, process exit, installer/native events, automatic
reopen, and the installed version. Exercise manual fallback and store channels.
Include a system-proxy download check for feed, ASC, app-shell package, and JS
bundle range probes and segments through the shared Electron network transport
and Node Range/resume core;
packaged network verification is still required before rollout.
Report source checks, packaged-runtime checks, and each OS outcome separately;
an IPC `true`, file existence, or signature alone is not an installed update.
