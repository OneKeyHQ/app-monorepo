# Checked MMKV sync and App-storage integrity

The native migration bridges use `syncExisting` to report flush failures through
the existing `MMKV_SYNC_FAILED` Promise rejection. Both native JS runtimes share
the same MMKV Core. The check finds the cached instance under the registry lock
and acquires its instance write lock and applicable process lock before releasing
the registry lock. It holds the instance/process locks through both data/CRC
flushes without keeping the registry locked during I/O. Existing close/remove
paths still wait for the instance lock before destroying it, and may themselves
hold the registry lock while waiting. A bridge-only mutex would not exclude
writers in NitroMmkv or other native consumers.

The check only accepts an already initialized default-root instance. It does not
invoke a creating factory or reload missing files. It checks the mapped file's
identity and size, opens without `O_CREAT`, checks `msync` and `fsync` results and
rechecks both paths. Normal initialization remains the responsibility of the
existing MMKV creation APIs. A missing or closed instance rejects conservatively.

This detects failures observed by this call. It does not recover missing data,
identify why earlier data was lost, prove that an earlier write succeeded, or
guarantee survival of arbitrary power loss. It cannot infer deletion followed by
recreation that happened before this call. Existing JS migration markers, ledger
transitions and legacy data retention remain necessary and unchanged.

## App-storage integrity

For `onekey-app-storage-v1`, the factory checks an existing data/CRC pair before
constructing memory mappings, because mapping initialization can extend files.
A CRC/length validation failure, unsupported metadata or an incomplete existing
pair rejects opening without rewriting the records or CRC metadata. Core does
not fall back to an older checkpoint, greedily decode or discard this durable
store. The existing independent migration ledger and bridge error handling
remain necessary. No C++ exception is thrown from reads, because NitroMmkv also
reads sizes from a `noexcept` memory callback.

A valid empty store and healthy explicit clearing remain supported. Other MMKV
IDs retain upstream recovery behavior. Corruption without a valid native undo
journal remains unavailable until explicitly repaired; the policy cannot recover
already zeroed metadata, explicit deletion or media failure. Never reset an
existing wallet to exercise it. Regression fixtures contain only synthetic data.

### Native app-storage transactions

Before the first mutation after a successful business `syncExisting`, Core writes
one `.onekey-undo.tmp` container next to the canonical data file. It contains the
original allocated lengths and inode identities, the complete CRC metadata file,
and the active data prefix including its original four-byte header. The format
has a version and a checksum covering its header, metadata and data. The native
journal contains sensitive store contents: it is a regular, single-link file
created with mode 0600. On iOS it receives protection at least as restrictive as
both canonical files and is excluded from device backups before publication.
No journal values or keys are logged. iOS Simulator does not expose hardware
Data Protection attributes, so its compile-time branch skips only those attribute
reads and writes. File permissions, link rejection and successful backup exclusion
remain required. Simulator tests do not validate hardware Data Protection.

Core fully writes and fsyncs the container, renames it to `.onekey-undo`, then
fsyncs its parent directory before changing either canonical file. Append,
single-key overwrite, full rewrite, growth, trim, clear, rekey and expiry metadata
changes share that same pending group. The canonical files retain their inodes.
The transaction owner and sticky I/O error state survive `clearMemoryCache`.
Publication or later mutation failures stop subsequent mutations and prevent a
successful checked sync; an inner writer never reloads a dictionary while its
callers still hold iterators.

Only the existing business `syncExisting` boundary commits the group: checked
flushes and path checks for both canonical files succeed, the matching published
journal is removed, and its parent directory is fsynced before returning success.
An ordinary `sync`, `close`, cache eviction, snapshot read or backup does not
commit. A flush or cleanup failure cannot be ACKed later by retrying that failed
instance. Close/reopen or a new process performs recovery. A trim after an ACK
starts a new group whose baseline already contains every previously ACKed value.

Before constructing a new instance, a valid pending journal is rolled back even
if the current canonical pair happens to pass CRC validation: the process could
have stopped between mutations in an unacknowledged group. Recovery restores the
active prefix, metadata and original allocated lengths in place, flushes both
files, verifies the result and removes the journal durably. The journal remains
available until both restores complete, so another interruption can retry.
Unused data-file slack is outside the recorded active prefix and need not return
to its previous byte pattern. Unknown, truncated, corrupted or identity-mismatched
published journals fail closed and preserve the files. An unpublished temporary
can be replaced only after validating the healthy canonical baseline.

This protocol supports the App's single-process native Core instance, shared by
the independently initialized main and background JS runtimes. The background
storage executor owns business writes. Multi-process and ashmem modes are
rejected for this ID. Read-only opening cannot recover or commit a pending group.
Backup refuses a pending/error group and cannot replace another live protected
instance as its destination. The generic native `removeStorage`,
`restoreOneFromDirectory` and `restoreAllFromDirectory` APIs refuse this protected
ID: physical removal can race a writer and the two-file restore copy does not
implement this protocol. These APIs are separate from the App's wallet
delete/backup/import/reset flows, which are unchanged.

A first-ever process interruption between creating the two empty files can leave
an incomplete pair with no previously ACKed data; opening that unknown pair
fails closed rather than guessing it is empty. External file replacement,
concurrent old native binaries and downgrading while a journal is pending are
unsupported. A clean committed pair keeps the upstream on-disk format. An OTA
JavaScript update cannot add this protection to an older native binary.
The guarantee relies on successful filesystem fsync semantics; host process-kill
tests do not establish survival of arbitrary physical power loss or media damage.

The initial implementation copies the current active prefix and metadata once per
dirty business group. Clean checked sync calls create no journal. Measure dirty
group counts, snapshot bytes and latency on devices before release readiness;
repeated sync calls alone are not a measure of copied bytes.

### Temporary local diagnostics

The current diagnostic patch writes `[STORAGE-CRC]` records only when `DEBUG=1`.
Non-Debug builds do not create a trace. Only `onekey-app-storage-v1` is traced;
records contain fixed phase names, timestamps, process/thread numbers, sequence,
version/flags, sizes, CRCs and error numbers. Keys and values are excluded.

The files are next to the store, with `.integrity.trace` and
`.integrity.trace.previous` suffixes. Each is bounded to 128 KiB plus one line,
uses mode 0600, and is excluded from iOS backups when created. Symbolic/hard
links are rejected. Repeated identical records are suppressed. Diagnostic
failures do not change the storage result or the caller's errno.

A durable `rewrite-begin` is written before in-place changes. There is no
additional diagnostic I/O between rewriting records and updating CRC metadata.
`rewrite-return` means the native operation returned, not that arbitrary power
loss is safe. `sync-ok` follows the checked data/metadata flush and path checks;
`sync-error-*` identifies the failed stage. `load-rejected` preserves the expected
and computed CRC/length evidence before the in-memory cache is invalidated.
Space-triggered and trim-triggered rewrites have separate entry records.

This is temporary investigation code: remove the helper and its call sites
before publishing a general fix. Do not manufacture faults in a user's store.
For host trace tests, configure CMake with `-DCMAKE_BUILD_TYPE=Debug
-DCMAKE_CXX_FLAGS=-DDEBUG=1`; the normal non-Debug test also verifies no trace is
created. Fault, privacy, bounded rotation, symlink/hardlink and write/sync
continuity checks all use synthetic stores.

## Source and integration

`source.lock.json` pins the public `margelo/MMKV` source commit, archive SHA256 and
patched source-tree SHA256. The baseline Android artifact is
`io.github.zhongwuzw:mmkv:2.4.1`, whose POM identifies this repository. Its Java
sources match this commit (excluding generated BuildConfig); its Core sources
match Tencent MMKV v2.4.0, apart from a Windows project file. The Maven POM does
not uniquely identify the commit used to build its binary.

`react-native-mmkv@4.3.2` remains unchanged. iOS retains the MMKV/MMKVCore 2.4.0
pod versions required by NitroMmkv and the OneKey bundle-update module, while
building their patched sources as development pods. Android substitutes every
`io.github.zhongwuzw:mmkv` dependency with the app-owned `:mmkv` source module.
NitroMmkv links its prefab library, so the bridge and ordinary writes use the
same shared Core. No separate npm, Maven or CocoaPods publication is required.

Pod installation and Gradle call `development/scripts/prepare-mmkv-source.js`.
The script verifies the archive before extraction, applies the generated patch
in a private staging tree and verifies the resulting tree against the tracked
pin. A reused cache is checked against the tracked pin, including the exact
generated header export. Modified sources, extra headers, symlinks or an
inapplicable patch fail preparation; there is no fallback to an unchecked binary.
The first build requires access to the pinned public archive. Later builds can
reuse the verified archive/source cache in `node_modules/.cache`.

The source pin, patch, preparation script and Android module participate in the
mobile shell input keys, so native shell caches invalidate when they change.

## Verification

The Android `mmkv` target explicitly links with 16 KB maximum and common page
sizes, including on NDK r27. Library targets do not inherit React Native's
application-only configuration. After `:mmkv:assembleRelease`, check each ABI's
`libmmkv.so` with `llvm-readelf -lW`: every `LOAD` alignment must be at least
`0x4000`, and each `GNU_RELRO` virtual address plus memory size must end on a
16 KB boundary. Check the packaged APK separately with `zipalign -c -P 16 4`;
ZIP alignment alone does not validate ELF segment alignment.

From the repository root:

```sh
node --test development/scripts/prepare-mmkv-source.node-test.js
MMKV_TEST_SOURCE="$(node development/scripts/prepare-mmkv-source.js)"
cmake -S apps/mobile/native/mmkv/tests -B /tmp/onekey-mmkv-tests \
  -DMMKV_SOURCE_DIR="$MMKV_TEST_SOURCE"
cmake --build /tmp/onekey-mmkv-tests
ctest --test-dir /tmp/onekey-mmkv-tests --output-on-failure
```

The C++ tests use the actual patched Core with syscall fault injection and
temporary fixture stores. They cover both flush stages, interruption retries,
descriptor cleanup, cold/warm missing files, replaced inodes, ordinary empty
initialization, writer exclusion, matching data/CRC snapshots, unrelated cached
lookups during a paused flush, and concurrent creation/close. Host tests do not
replace platform App builds or device tests,
and captured syscall snapshots do not simulate a physical power cut.

`transaction_regression` forks isolated synthetic workers and kills them at
journal publication, canonical flush, commit cleanup and recovery boundaries. It
checks rollback of acknowledged active bytes, all active keys, full metadata and
allocated lengths; publication failures preserve both complete canonical files.
It also covers failed void/bulk mutations, sticky errors, cache ownership,
unsupported modes, damaged journals, replaced inodes, read-only opening,
short writes/EINTR and dirty-group copying costs. No test signals the App or a
user's device. The original mmap-rewrite-before-CRC window additionally requires
an independent test-source build with test-only interruption points; product
sources contain no fault hook.

`apps/mobile/e2e/native-storage-sync.native-harness.ts` exercises the real NitroMmkv
instance and native Promise on a dedicated empty simulator/emulator. It checks
healthy sync, a cold absent store and unsupported IDs. It imports the real
package subpath to bypass the harness's usual in-memory facade. Run only that
suite on a fresh test installation; do not reset a user's wallet to satisfy its
cold-store precondition.

From `apps/mobile`, start `node scripts/test-native-storage-sync.mjs --platform
ios` (or `android`) and wait for its manual-launch message. The script never
starts or restarts the App. On a dedicated empty test device, install the rebuilt
App, set the repository's harness-mode flag and launch it once. Android uses the
exported `.StandardLauncher`, with `adb reverse` for ports 8081, 3001 and 3002.
The runner uses a separate background bridge on Android because the migration
module is registered only in the background ReactHost. It fails if the test
runtime does not connect; it never changes module registration or retries an App
launch. Stop the test App afterward. General main-runtime harness discovery does
not include this dedicated suite.

## Updating the source patch

Check out the pinned upstream commit in a separate source checkout. Edit the
native sources there, then generate `checked-sync.patch` with `git diff --binary`
against that commit; do not hand-edit the patch or include generated/build files.
Verify `git apply --check` against pristine source. If changing the upstream
commit, update its archive URL and SHA256 as well.

Extract the same paths listed in `SOURCE_PATHS` in the preparation script, apply
the generated patch and calculate `sourceTreeDigest` (exported by the script).
Update `treeSha256` in the tracked lock. Rerun the preparation/cache tests, Core
regressions, JS migration tests, both native App builds and repository agent
checks. Regenerate `Podfile.lock` with `pod install` for the new patch-keyed
development-pod path. Do not change any `@onekeyfe` native package as a patch.
