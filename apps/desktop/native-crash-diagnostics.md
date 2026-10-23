# Desktop native crash diagnostics

The native shell starts Electron Crashpad before loading app dependencies, with
`uploadToServer: false` and no submission URL. Sentry's minidump integration
remains excluded. Reports are added only to the existing ZIP generated for a
user's manual download or confirmed log upload; this adds no background upload.
Desktop UI/background app code shares one JS runtime. Crashpad and the parser
are separate OS processes owned by the native Electron shell.

## Data boundary

The project-owned parser runs in an Electron Utility Process with a 64 MB V8
heap, no inherited environment, ignored stdout/stderr, and a five-second timeout.
It accepts at most 32 MB per dump and validates stream counts, file ranges,
thread/module counts, platform, architecture, and context flags before reading.
The parser allows at most 4,096 modules and 1,024 threads; real macOS processes
can load more than 1,000 system images. These limits do not enlarge the exported
32-frame/module allowlist.
It reads fixed diagnostic fields and linked frame-pointer slots, never scans
memory for plausible addresses and never decodes strings or annotations.

The JSON allowlist contains a fixed source/schema, collection time, platform,
architecture, numeric exception code, hashed binary module identifiers, numeric
module versions/sizes, and up to 32 module-relative frame offsets with their
trust method. It excludes memory, full registers, absolute addresses, module/PDB
paths, names, command lines, environment, comments, and exception parameters.
IPC results and stored JSON are reconstructed through the same allowlist; the
ZIP receives these reconstructed bytes rather than raw files/directories.

## Processing and retention

On app ready, after process crashes, every minute while running, and before log
export, a serialized sweep inspects `.dmp` files beneath Electron's crash dump
directory (up to two subdirectory levels). Symlinks/hard links are excluded.
Files receive a five-second write-settling window. At most five settled dumps
are parsed per sweep; expired (24 hours), oversized, excess, unsupported,
malformed, and failed/timed-out reports are discarded without a raw fallback.
Successful JSON is atomically written with mode `0600`, then its raw dump is
deleted. The old unconditional 60-second deletion no longer races parsing.
Deletion is best-effort for locked files, retried on a subsequent sweep. Raw
files cannot be deleted by this application while it is not running; the next
launch performs the sweep. Crashpad's auxiliary database is not recursively
deleted while its handler is active.

Only five JSON reports from the last seven days are retained/exported. A
diagnostic failure leaves ordinary `.log` export available. A sweep can delay
export by up to five parser timeouts (25 seconds), plus file I/O. Local dumps
temporarily contain sensitive process memory even though they are never sent.

## Support and release validation

The supported layouts are standard little-endian MINIDUMP system, module,
exception and thread streams for x64 and the current ARM64 context on Windows,
macOS and Linux. Synthetic fixtures cover all six platform/architecture pairs.
Unknown layouts/architectures fail closed. Frame-pointer walking may return
only the crashing frame when the chain is absent, invalid, pointer-authenticated
or compiled without frame pointers. This is not full CFI unwinding or
symbolication; no function names or source lines are claimed. Module identifiers
are hashed rather than exposing PDB paths or arbitrary build-ID bytes.

Electron disables `crashReporter` in Mac App Store builds, so this pipeline is
not enabled there. Before release, verify real Crashpad layouts and frame quality
on Windows/macOS/Linux, packaging (including ASAR and signing), restart-after-
crash processing, locked-file retry, and normal manual/confirmed upload flows.
No real crash, memory dump, symbol download, production log or upload is needed
for the automated tests. Synthetic test success is not device acceptance.

Local macOS ARM64 / Electron 43.1.1 verification also used `process.crash()` in
an empty, isolated Utility Process with an empty environment, dedicated app/data
directories, and upload disabled. After restarting the isolated test host, the
real collector produced four frames from its Crashpad dump, deleted the raw
input, and the real ZIP collector exported only ordinary test logs and allowlisted
JSON with a valid size/SHA-256 digest. Unrelated wallet error, Desktop dedup/config/
store/network, and custom-UA dependencies were stubbed to keep the host free of
accounts and wallet state. This does not verify the signed wallet app, Windows/
Linux, all crash types, symbolication, or production Settings/upload UI.

References: [Electron crashReporter](https://www.electronjs.org/docs/latest/api/crash-reporter),
[Utility Process](https://www.electronjs.org/docs/latest/api/utility-process),
[MINIDUMP exception stream](https://learn.microsoft.com/en-us/windows/win32/api/minidumpapiset/ns-minidumpapiset-minidump_exception_stream),
[MINIDUMP module](https://learn.microsoft.com/en-us/windows/win32/api/minidumpapiset/ns-minidumpapiset-minidump_module),
[Breakpad CPU layouts](https://github.com/google/breakpad/tree/main/src/google_breakpad/common).
