# Checked MMKV sync

The native migration bridges use `syncExisting` to report flush failures through
the existing `MMKV_SYNC_FAILED` Promise rejection. Both native JS runtimes share
the same MMKV Core; the check holds Core's registry/lifetime lock, instance write
lock and applicable process lock through both data/CRC flushes. A bridge-only
mutex would not exclude writers in NitroMmkv or other native consumers.

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
initialization, writer exclusion, matching data/CRC snapshots and concurrent
creation/close. Host tests do not replace platform App builds or device tests,
and captured syscall snapshots do not simulate a physical power cut.

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
