# Manual cancellation of a prepared macOS update

The non-MAS desktop app continues to stage verified updates through Electron's
Squirrel.Mac updater before displaying Ready. Only Settings' explicit update-cache
clear may revoke that preparation. Automatic quarantine must not revoke a valid
prepared update. An installation already handed off cannot be cancelled here.

`squirrel-cancel` is a small macOS executable built from source before the desktop
main build and included in the signed app's Resources/bin directory. It uses only
Foundation, Security, ServiceManagement and libproc; no npm dependency or custom
Electron binary is required. It accepts one bounded JSON request on stdin and
returns JSON on stdout. It is internal to the main process, never a renderer API.

After successful staging, `capture` records the exact launchd domain/job/PID/start
time, request bytes and staged bundle identity. The parent must be the sole
running instance of that application. The job executable must be that app's own
ShipIt, its request must target that app, and the staged app must match the
expected version and designated code-signing requirement. Ambiguous, foreign,
missing, timed-out or legacy preparations cannot be cancelled as known Ready.

`cancel` revalidates that snapshot while the original application still runs,
unregisters the matching job with SMJobRemove(wait=true), and verifies it stopped
before deleting the request and its exact direct-child update.\* directory. It
does not call abortInstallationCommand, kill arbitrary ShipIt processes, delete
the entire cache root, touch installer rollback state or treat a timeout as
success. System-domain staging is detected and refused before mutation: its root recovery
state and cross-user label ownership cannot be established by this user-domain
bridge. Existing privileged installation continues unchanged; no authorization
prompt or attempted system-domain removal occurs.

A native cancellation journal is written before unregistering and advanced after
the job stops. It remains as a stopped receipt until the caller commits OneKey's
pending-task/cache cleanup with `clearPackage({manual: true, complete: true})`.
Completion keeps an idempotent finished receipt; the next successfully captured
stage consumes it. A definite pre-removal failure removes the barrier and leaves
the existing preparation usable. Partial cleanup remains retryable and blocks restaging. A stopped
journal may be completed after relaunch if no replacement job exists. An
uncertain journal from a different parent process fails closed. Snapshot mismatch
or another running copy also fails closed. Capture is best effort: inability to
capture must not change normal update behavior, but cancellation is then refused.

The main process serializes clear/stage/install and normal quit, invalidates old
callbacks and pending tasks, and clears the cancelled build marker. A clear that
fails after revocation must not restore an install-ready state. New staging
creates a fresh native updater through setFeedURL and awaits a new native
update-downloaded event. An immediate background refresh must not recreate the
just-cleared preparation; later ordinary update checks retain their policy.
Renderer loss or a main-frame reload releases the quit wait only after an active
native operation settles. It keeps the disk receipt and barrier for a later
manual retry, so a lost caller cannot strand normal Quit indefinitely.

Verification includes focused service/API tests, real native compilation, and an
isolated, signed A-to-B Electron fixture with a unique bundle identifier and data
directory. Cover cancellation then quit/cold start on A; cancellation then a new
stage/install of B; no cancellation then normal quit installing B; denied/mismatched
requests; cleanup failure/retry; and clear versus stage/install races. Mocked
tests and native compilation alone are not signed update acceptance.

Local signed fixture (unique bundle IDs; creates disposable apps in /Applications
so Squirrel's install uses the normal local volume, with artifacts in the supplied
directory):

```sh
ONEKEY_CANCEL_SIGN_IDENTITY='<local signing identity>' node apps/desktop/scripts/test-squirrel-cancel.js /absolute/new/artifact-directory
```

The fixture uses the production prepare/clear paths and native helper. It replaces
UI/remote transport dependencies, supplies a prebuilt signed ZIP, and uses the
existing test-only GPG skip switch. Squirrel's native signature validation stays
enabled. It does not exercise the full OneKey renderer, remote feed or production
Developer ID/notarization. System-domain preparations are deliberately refused.
