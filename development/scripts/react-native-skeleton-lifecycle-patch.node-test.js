const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../..');
const packageRoot = path.join(
  repoRoot,
  'node_modules/@onekeyfe/react-native-skeleton',
);
const patchPath = path.join(
  repoRoot,
  'patches/@onekeyfe+react-native-skeleton+3.0.78.patch',
);

const specPaths = [
  'nitrogen/generated/android/kotlin/com/margelo/nitro/skeleton/HybridSkeletonSpec.kt',
  'lib/nitrogen/generated/android/kotlin/com/margelo/nitro/skeleton/HybridSkeletonSpec.kt',
];
const managerPaths = [
  'nitrogen/generated/android/kotlin/com/margelo/nitro/skeleton/views/HybridSkeletonManager.kt',
  'lib/nitrogen/generated/android/kotlin/com/margelo/nitro/skeleton/views/HybridSkeletonManager.kt',
];

function readPackageFile(relativePath) {
  return fs.readFileSync(path.join(packageRoot, relativePath), 'utf8');
}

test('drops every Android Skeleton in dispose-before-HybridData order', () => {
  for (const managerPath of managerPaths) {
    const source = readPackageFile(managerPath);
    const removeIndex = source.indexOf('views.remove(view)');
    const disposeIndex = source.indexOf('hybridView?.dispose()');
    const destroyIndex = source.indexOf('hybridView?.destroyNativeState()');
    const superDropIndex = source.indexOf('super.onDropViewInstance(view)');

    assert.ok(removeIndex >= 0, `${managerPath} must remove the retained view`);
    assert.ok(
      disposeIndex > removeIndex,
      `${managerPath} must dispose after removal`,
    );
    assert.ok(
      destroyIndex > disposeIndex,
      `${managerPath} must release HybridData after stopping UI work`,
    );
    assert.ok(
      superDropIndex > destroyIndex,
      `${managerPath} must finish native teardown before delegating the drop`,
    );
  }
});

test('resets generated HybridData exactly once per native lifetime', () => {
  for (const specPath of specPaths) {
    const source = readPackageFile(specPath);

    assert.match(
      source,
      /private var isNativeStateDestroyed: Boolean = false/u,
    );
    assert.match(source, /internal fun destroyNativeState\(\)/u);
    assert.match(source, /if \(isNativeStateDestroyed\) return/u);
    assert.match(source, /mHybridData\.resetNative\(\)/u);
    assert.equal(
      source.match(/mHybridData\.resetNative\(\)/gu)?.length,
      1,
      `${specPath} must expose one manager-owned HybridData reset`,
    );
  }
});

test('makes shimmer disposal idempotent and cancels pending UI work', () => {
  const source = readPackageFile(
    'android/src/main/java/com/margelo/nitro/skeleton/Skeleton.kt',
  );
  const disposeStart = source.indexOf('override fun dispose()');
  const disposeEnd = source.indexOf('class SkeletonNativeView', disposeStart);
  const disposeBody = source.slice(disposeStart, disposeEnd);

  assert.match(disposeBody, /if \(isDisposed\) return/u);
  assert.match(disposeBody, /stopShimmer\(\)/u);
  assert.match(source, /view\.removeCallbacks\(it\)/u);
  assert.match(source, /removeAllUpdateListeners\(\)/u);
  assert.doesNotMatch(disposeBody, /destroyNativeState|resetNative/u);
});

test('keeps the patch scoped to lifecycle sources and excludes build outputs', () => {
  const patch = fs.readFileSync(patchPath, 'utf8');
  const changedFiles = Array.from(
    patch.matchAll(/^diff --git a\/(.+?) b\/(.+)$/gmu),
    (match) => match[1],
  );
  const expectedFiles = [
    'node_modules/@onekeyfe/react-native-skeleton/android/src/main/java/com/margelo/nitro/skeleton/Skeleton.kt',
    'node_modules/@onekeyfe/react-native-skeleton/ios/Skeleton.swift',
    'node_modules/@onekeyfe/react-native-skeleton/lib/nitrogen/generated/android/kotlin/com/margelo/nitro/skeleton/HybridSkeletonSpec.kt',
    'node_modules/@onekeyfe/react-native-skeleton/lib/nitrogen/generated/android/kotlin/com/margelo/nitro/skeleton/views/HybridSkeletonManager.kt',
    'node_modules/@onekeyfe/react-native-skeleton/nitrogen/generated/android/kotlin/com/margelo/nitro/skeleton/HybridSkeletonSpec.kt',
    'node_modules/@onekeyfe/react-native-skeleton/nitrogen/generated/android/kotlin/com/margelo/nitro/skeleton/views/HybridSkeletonManager.kt',
  ];

  assert.deepEqual(changedFiles.toSorted(), expectedFiles.toSorted());
  assert.doesNotMatch(patch, /android\/(?:build|\.cxx)\//u);
});
