const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../../../..');

function readPatch(name) {
  return fs.readFileSync(path.join(repoRoot, 'patches', name), 'utf8');
}

function readPatchSequence(packagePrefix) {
  return fs
    .readdirSync(path.join(repoRoot, 'patches'))
    .filter((name) => name.startsWith(packagePrefix) && name.endsWith('.patch'))
    .toSorted()
    .map(readPatch)
    .join('\n');
}

describe('native dev-vendor lifecycle patches', () => {
  const backgroundThreadPatch = readPatchSequence(
    '@onekeyfe+react-native-background-thread+3.0.90+',
  );
  const splitBundleLoaderPatch = readPatchSequence(
    '@onekeyfe+react-native-split-bundle-loader+3.0.90+',
  );
  const backgroundManagerSource = fs.readFileSync(
    path.join(
      repoRoot,
      'node_modules/@onekeyfe/react-native-background-thread/android/src/main/java/com/backgroundthread/BackgroundThreadManager.kt',
    ),
    'utf8',
  );
  const backgroundAdapterSource = fs.readFileSync(
    path.join(
      repoRoot,
      'node_modules/@onekeyfe/react-native-background-thread/android/src/main/cpp/cpp-adapter.cpp',
    ),
    'utf8',
  );
  const splitBundleLoaderSource = fs.readFileSync(
    path.join(
      repoRoot,
      'node_modules/@onekeyfe/react-native-split-bundle-loader/ios/SplitBundleLoader.mm',
    ),
    'utf8',
  );

  it('starts an Android background replacement only after clean teardown', () => {
    const restartStart = backgroundManagerSource.indexOf(
      'private fun restartBackgroundForHMR(',
    );
    const restartEnd = backgroundManagerSource.indexOf(
      '\n    /**',
      restartStart,
    );
    const restartSource = backgroundManagerSource.slice(
      restartStart,
      restartEnd,
    );

    expect(restartStart).toBeGreaterThan(-1);
    expect(restartEnd).toBeGreaterThan(restartStart);
    expect(restartSource).toContain('destroyTask.waitForCompletion()');
    expect(restartSource).not.toContain(
      'waitForCompletion(15, TimeUnit.SECONDS)',
    );
    expect(restartSource).toContain(
      'destroyTask.isFaulted() || destroyTask.isCancelled()',
    );
    expect(
      restartSource.indexOf('destroyTask.waitForCompletion()'),
    ).toBeLessThan(
      restartSource.indexOf(
        'runnerState.compareAndSet(\n                            BackgroundRunnerState.DESTROYING,',
      ),
    );
    expect(restartSource.indexOf('BackgroundRunnerState.IDLE')).toBeLessThan(
      restartSource.indexOf(
        'ensureBackgroundRunner(context, entryURL, config)',
      ),
    );
  });

  it('restores the Android retry state only after failed-host cleanup', () => {
    const failureStart = backgroundManagerSource.indexOf(
      'private fun markBackgroundRunnerFailed(',
    );
    const failureEnd = backgroundManagerSource.indexOf(
      'fun scheduleOnJSThread(',
      failureStart,
    );
    const failureSource = backgroundManagerSource.slice(
      failureStart,
      failureEnd,
    );

    expect(failureStart).toBeGreaterThan(-1);
    expect(failureEnd).toBeGreaterThan(failureStart);
    expect(failureSource).toContain('destroyTask.waitForCompletion()');
    expect(failureSource).toContain(
      'BackgroundRunnerState.FAILED,\n                        BackgroundRunnerState.DESTROYING,',
    );
    expect(
      failureSource.indexOf('destroyTask.waitForCompletion()'),
    ).toBeLessThan(
      failureSource.lastIndexOf('runnerState.set(BackgroundRunnerState.IDLE)'),
    );
    expect(failureSource).not.toContain(
      'bgReactHost = null\n        val destroyTask',
    );
  });

  it('releases Android timer callbacks on the outgoing background JS thread', () => {
    const nativeInvalidation = 'nativeInvalidateBackgroundRuntimeOnJSThread';
    const nativeStart = backgroundAdapterSource.indexOf(nativeInvalidation);
    const nativeEnd = backgroundAdapterSource.indexOf(
      '\n// ── nativeDestroy',
      nativeStart,
    );
    const nativeSource = backgroundAdapterSource.slice(nativeStart, nativeEnd);

    expect(nativeStart).toBeGreaterThan(-1);
    expect(nativeEnd).toBeGreaterThan(nativeStart);
    expect(nativeSource).toContain('gTimerWorkerThread.join()');
    expect(nativeSource).toContain(
      'timerCallbacks.push_back(std::move(entry.second.callback))',
    );
    expect(nativeSource).toContain('queuedWork.swap(queue.items)');
    expect(backgroundManagerSource).toContain(
      'outgoingContext?.runOnJSQueueThread',
    );
    expect(backgroundManagerSource).toContain(
      'nativeInvalidateSharedRpc("background", invalidatedGeneration)',
    );
    expect(backgroundManagerSource).toContain(
      'if (!runtimeInvalidationSucceeded.get())',
    );
  });

  it('lets iOS Metro download completion govern cold main-delta loading', () => {
    expect(splitBundleLoaderSource).toContain(
      'dispatch_semaphore_wait(downloadReady, DISPATCH_TIME_FOREVER)',
    );
    expect(splitBundleLoaderSource).toContain(
      'dispatch_semaphore_wait(hostRegistrationReady, DISPATCH_TIME_FOREVER)',
    );
    expect(splitBundleLoaderSource).not.toContain(
      'kDevVendorLoadTimeoutSeconds',
    );
    expect(splitBundleLoaderSource).not.toContain(
      'Timed out loading dev-vendor main delta',
    );
  });

  it('does not include generated Android artifacts', () => {
    for (const patch of [backgroundThreadPatch, splitBundleLoaderPatch]) {
      expect(patch).not.toContain('/android/.cxx/');
      expect(patch).not.toContain('/android/build/');
    }
  });
});
