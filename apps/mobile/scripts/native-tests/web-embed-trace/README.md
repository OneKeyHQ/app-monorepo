# Native WebEmbed trace regression tests

Run on macOS with Xcode and the system `unifdef`. The default command compiles
and checks the installed native helper. It does not install or launch an app,
start a simulator, open a WebView, contact a server, or read a wallet profile.

```sh
python3 apps/mobile/scripts/native-tests/web-embed-trace/run.py \
  --output /path/to/new-native-trace-report
```

The output directory must be new. The runner creates synthetic public transport
bytes, including a 15.6 MB resource, and a synthetic native/compiler identity.
`TraceConfig.h`, fixture bundles, binaries and reports exist only in that output
directory; no real application run ID or build identity is stored in these tests.
Missing prerequisites and failed checks are errors, never silent skips.

The default run covers:

- The real helper file reader, serial read queue and main-queue delivery with
  fake `WKURLSchemeTask` callbacks: exact bytes, response/data/finish order,
  stop/invalidate before or during delivery, stale token replacement, reentrant
  callbacks and original synchronous exception identity.
- Exact compiled/native identity gates, strict asset filename classification,
  unrelated URL/header/body sentinel exclusion, and request/event quotas that
  leave resource delivery intact.
- Absent/zero/Debug source equivalence and compiler object marker/symbol absence;
  enabled Release compilation and rejection of incomplete compiler identity.
- Fixed C record publication, 90-second bounds, bounded counters, partial slots,
  one-shot flush and concurrent producers/readers. The same concurrency case
  runs under ThreadSanitizer. Harness-only clock and atomic-load scheduling hooks
  control late publication and late reservation without changing product code.
- A pure fixed-schema log parser: exact subsystem/category/PID/nonce/manifest,
  integer bounds, duplicate/missing records or summary, late output and events
  outside the absolute host-launch/flush time envelope. The parser queries no
  device and reads no log files.

An additional real scheduling test is explicit because it waits approximately
75 seconds. Two independent command-line fixture processes run in parallel: one
checks the original event timestamps with a harness sink; the other submits all
256 records through the actual `os_log_with_type` API. Neither is an installed
OneKey app or a WebKit process.

```sh
python3 apps/mobile/scripts/native-tests/web-embed-trace/run.py \
  --output /path/to/new-native-trace-timer-report \
  --real-timer
```

Without this option the report marks the timer test `not-requested`, not passed.
The test requires one utility timer and completion inside the existing 75-second
observation. The 65-second scheduled time is not an OS scheduling guarantee.
API submission does not prove unified-log persistence; an actual application
collector must also receive and validate the complete emitted record set.

## Source and artifact verification

`disabled-source-baseline.json` pins the reviewed native business code before
trace insertion. `unifdef` evaluates only the known trace/Debug conditions;
comparison ignores blank lines and line-edge indentation but preserves strings
and unrelated platform branches. Review legitimate native changes before
updating this baseline. Do not update it merely to silence a failure.

For additional exact public candidate resource bytes, supply all three inputs:

```sh
python3 apps/mobile/scripts/native-tests/web-embed-trace/run.py \
  --output /path/to/new-exact-resource-report \
  --artifact /path/to/protected-web-embed/artifact \
  --manifest /path/to/protected-web-embed/artifact-sha256.json \
  --manifest-sha256 REVIEWED_SHA256
```

This verifies the complete 43-file inventory, then reads the original Kaspa loader
and SDK resources through the native helper. It does not execute JavaScript,
validate browser compatibility or replace formal SRI/artifact verification.
`--source-directory` can explicitly select a proposed native source directory;
the default uses the installed dependency. Source, test and resource hashes are
recorded and checked for drift. Fixture executables use an internal bundle
identity and are invoked only by absolute path, never installed or registered.

## Diagnostic semantics and limits

Native tracing is absent from normal builds. An explicit E2E Release must supply
every compiled public identity field and matching native bundle metadata. Within
that gate, the native recorder keeps the first 256 reservations in fixed C slots.
Each writer fills its own slot once and publishes with release ordering; the
utility reader uses acquire ordering and never reads an unpublished slot.
The record function performs no Objective-C messaging, object/string allocation,
formatting, logging, locks or dispatch submission. Original caller/context/map
work remains, and lock-free atomics are not a wait-free or zero-cost guarantee.

A single utility task scheduled at 65 seconds samples a reservation prefix over
a start/end interval. It copies ready records before formatting or submitting
logs. A reserved writer can publish during that interval and be included; a
reservation after the prefix count was sampled is excluded even if it publishes
before the interval ends. Published/unpublished counts describe this sampled
prefix, not a linearizable whole-process snapshot. Unpublished slots are skipped
without waiting, and late reservations are not counted as unpublished prefix
slots. Drop counters are sampled near the start of the interval.

Each record keeps hook-admission monotonic elapsed time and the realtime timestamp
sampled while filling its reserved slot. Descheduling can separate those two
observations. The summary includes interval start/end, flush elapsed time,
original public identity and flush wall time. Nanosecond values remain decimal
strings in parser output to avoid JavaScript integer precision loss.

The original 90-second capture window, 256-event and 16-request-per-handler limits
remain. The one 65-second dump does not include later records; capture can
continue in bounded memory until its original limit. No complete history or
absence-of-events claim follows from the sampled prefix.

An application collector must retain the fixed subsystem/category and exact
PID/nonce/manifest filter, and pass the trusted original host launch timestamp to
the parser. It must reject missing/late output, a missing emitted prefix record,
an event older than this launch, clock rollback or flush outside launch +75
seconds. Handler-relative time alone does not establish that absolute deadline.
`prefixComplete` is only a diagnostic property: it does not change app acceptance,
RPC/E2E timeouts or imply that later reservations never occurred.

Logs contain only public identity, integer instance/request identifiers, closed
stage/asset classes, counts, timestamps and booleans. They contain no arbitrary
URL, header, message body, key, wallet value or error description.
`handler-init-start` precedes opening the resource root and does not prove that
opening succeeded. Trace budgets must never change resource delivery or any
security check.

In OneKey, native main/UI owns the RNC view/handler. Main and background JavaScript
run in independent Hermes heaps and communicate through shared native resources.
WK has another JavaScript environment/process. These tests cover native transport
and diagnostic contracts; they do not prove the actual two-Hermes/WK cold path,
wallet flows or the cause of a particular application timeout.
