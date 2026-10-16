# Browser diagnostic logs

The extension background runtime is the sole writer. UI and background have
separate JS heaps and initialize independently. UI runtimes send already
filtered, deduplicated and truncated messages through `ServiceLogger`; they do
not restore another copy of history. The browser owns persistent storage shared
by the extension origin. Web reuses the same persistence and export modules.
Each Web tab runs UI/background services in one JS runtime with one queue and
one database connection; same-origin tabs share the browser-owned database.
Desktop/mobile retain their existing file loggers.

## Storage and retention

Logs use the dedicated Storage Bucket `diagnostic-logs_onekey-bucket`, containing
the IndexedDB database `OneKeyDiagnosticLogs`. Its `chunks` store contains
immutable committed batches, and `meta` stores sequence and retention accounting.
Browsers without Storage Buckets use the same separate database name in the
default bucket. A bucket-open failure does not fall back to another location.

Retention is 40 MiB of UTF-8 content plus 128 bytes of accounting per chunk,
not a 1000-message limit. Actual database disk usage includes browser-managed
metadata and other engine overhead. Oldest chunks are removed as needed. Insert,
retention and metadata updates share one strict-durability transaction; a write
is considered committed only after the transaction completes. Invalid metadata
or chunk accounting fails without clearing or rebuilding unread history.
Cross-tab readwrite transactions serialize sequence allocation and accounting,
so concurrent Web writers cannot overwrite each other. Export follows commit
order, preserving each tab's own sequence, not a global timestamp sort.

Writes start immediately and merge messages that arrive while a write is busy
into batches of at most 64 KiB. Startup does not read historical messages into
memory. Pending messages use a 1 MiB budget, plus one in-flight batch; under
storage failure or overload the oldest pending messages can be dropped. Failed
writes retry on the next add/export after a one-second cooldown. Logging errors
never report through the logger itself.

Completed transactions survive worker, extension and browser restarts. Abrupt
termination can still lose messages in the existing scheduled logger queue,
IPC, an unfinished transaction, or the in-memory repeat counter. This is a
best-effort diagnostic log, not an audit journal.

## Export and reset

Default export/upload selects the newest 10 MiB of original UTF-8 log content.
The Web/extension dialog also offers an explicit full-history scope, capped at
40 MiB of original content. These are byte limits, not time windows. Pending
messages share the same budget. The oldest partial line is dropped at the
cutoff, preserving UTF-8 and CRLF boundaries and chronological order.

Reads start at the newest key and use descending 32-ID windows with getAll in
one read transaction. They stop as soon as the byte budget is filled; they do
not scan all retained history to select the recent suffix. Empty ID windows
jump to the next older key. The read transaction temporarily queues writes;
it does not lock the separate wallet database.

After releasing the read queue, the background builds a standard ZIP containing
OneKeyLogs.txt using streaming fflate ZipDeflate at level 1. Each 64 KiB Blob read
await yields between compression inputs, allowing new writes to proceed. There
is no dynamic worker, CSP change, or full-history JS string/ArrayBuffer. Reset
and session expiration cancel compression between pages.

A single export session reserves the snapshot before reading, expires after two
minutes of inactivity, and transfers 256 KiB base64 pages of the completed ZIP.
The UI hashes ZIP bytes incrementally and builds the download/upload Blob. Token
size/hash and MIME describe the final ZIP, including its central directory.
Web/extension upload retries and download fallback reuse this same digest; they do
not recapture a shifting window or compress again. Download URLs are revoked.
The 40 MiB budget applies to retention and original export content, not the
final ZIP upload. Archives can exceed that budget after packaging and still
proceed through the existing token/upload flow. The server enforces its upload
limit; failed uploads retain the existing retry and download fallback.
The server rejected an 80 MiB token request
on 2026-10-16 with a declared maximum of 52,428,800 bytes (50 MiB).
During compression, source and output Blobs can coexist temporarily; history
is not permanently loaded in either JS heap.

UI and background flush their own repeat tails. Export read failures are surfaced
instead of silently producing a partial history. App reset invalidates export
sessions, stops collection, waits for active operations, and explicitly deletes
the log database before the general storage reset. Late writes and prepared
snapshots cannot recreate old records after reset.
Web registers a reset BroadcastChannel when its proxy loads, before idle or
dynamic background initialization, and remembers resets until services exist.
A reset stops sibling queues and invalidates
their exports until reload. Database deletion also permanently closes existing
connections, preventing them from reopening and restoring stale pending logs.

## Validation

Run the logger, export collector and dedup regression suites with Jest. For
actual MV3 lifecycle coverage, build an unpacked development extension with
`E2E_MODE=true` and `EXT_MANIFEST_V3=1`, then run:

```sh
EXT_E2E_BROWSER_EXECUTABLE=/path/to/testing-chromium \
  node apps/ext/e2e/diagnostic-log-persistence.e2e.js
```

Add `EXT_LOG_PERF=1` to measure durable UI RPC latency, write 120,000 messages of
512 bytes with 128 concurrent calls, verify retention, and download the resulting
ZIP files through Settings, checks default/full selection and uncompressed byte
budgets, and simulates failed token requests to verify retry/fallback reuse without
uploading any logs. The runner also seeds 160,000 small chunks to measure
export with fragmented history; fixture seeding is excluded from write metrics.
Results are written to `.tmp/ext-log-performance/result.json`. These local
measurements are not a throughput guarantee under real application workloads.

The runner enables Developer mode in a temporary browser profile and removes
that profile afterward. It checks UI/background writes, worker termination and
restart, extension reload, full browser restart, chronological restoration,
independent bucket placement, storage bounds, and actual diagnostic downloads.
It does not access a user's wallet profile or upload logs.

For Web, start an `E2E_MODE=true` development server and run:

```sh
WEB_E2E_RENDERER_URL=http://127.0.0.1:3217 \
  WEB_E2E_BROWSER_EXECUTABLE=/path/to/testing-chromium \
  node apps/web/e2e/diagnostic-log-persistence.e2e.js
```

The Web runner checks more than 1000 retained messages, concurrent tabs, page
reload and browser restart, recent/full ZIP downloads, retry/fallback ZIP hashes,
sibling reset cancellation, and IndexedDB fallback without Storage Buckets.
It uses isolated temporary profiles and simulates upload failures locally.
