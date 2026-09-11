/* eslint-disable onekey/no-raw-error */
import { Platform } from 'react-native';

import {
  LogLevel,
  NativeLogger,
} from '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger';

import { isSegmentLoaded } from '../splitBundle/installProdBundleLoader';
import {
  getSegmentEntry,
  getSegmentManifest,
} from '../splitBundle/segmentManifest';

import { captureMobileLockdownIntegrity } from './mobileLockdownReleaseProbe';

import type { ISplitBundleNativeLoader } from '../splitBundle/types';

const TIMEOUT_MS = 15_000;
let started = false;

export function writeMobileLockdownE2EReport(message: string, failed: boolean) {
  NativeLogger.write(failed ? LogLevel.Error : LogLevel.Info, message);
  if (Platform.OS === 'android') {
    // Release app-private logs cannot be read with adb run-as. This test-build
    // channel emits the same fixed, non-wallet fields to the app's native console.
    const hook = (
      globalThis as typeof globalThis & {
        nativeLoggingHook?: (text: string, level: number) => void;
      }
    ).nativeLoggingHook;
    hook?.(message, failed ? 3 : 1);
  }
}

export async function runMobileLockdownReleaseCheck(
  runtime: 'main' | 'background',
  nativeLoader: ISplitBundleNativeLoader,
) {
  const runId = process.env.ONEKEY_MOBILE_LOCKDOWN_E2E;
  if (!runId || !/^[a-f0-9]{32}$/.test(runId) || __DEV__) {
    throw new Error(
      'Mobile lockdown E2E requires an explicit Release test build.',
    );
  }
  if (started) throw new Error('Mobile lockdown Release E2E already started.');
  started = true;
  const identity = {
    runId,
    runtime,
    platform: Platform.OS,
    version: process.env.VERSION,
    bundleVersion: process.env.BUNDLE_VERSION,
    buildNumber: process.env.BUILD_NUMBER,
  };
  let stage = 'integrity';
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const integrity = captureMobileLockdownIntegrity(runtime);
    const check = async () => {
      stage = 'async';
      await Promise.all([
        Promise.resolve(),
        new Promise<void>((resolve) => setTimeout(resolve, 10)),
        new Promise<void>((resolve) => process.nextTick(resolve)),
      ]);
      stage = 'native-context';
      const context = await nativeLoader.getRuntimeBundleContext();
      if (!context.nativeVersion || context.sourceKind !== 'builtin') {
        throw new Error('Release E2E requires the built-in native bundle.');
      }
      stage = 'segment-discovery';
      const keys = Object.keys(getSegmentManifest().segments).filter((key) =>
        key.endsWith('.mobileLockdownReleaseMarker'),
      );
      if (keys.length !== 1) {
        throw new Error('Release E2E marker segment is missing or ambiguous.');
      }
      stage = 'segment-initial-state';
      if (isSegmentLoaded(keys[0])) {
        throw new Error(
          'Release E2E marker must be an unloaded native segment.',
        );
      }
      stage = 'segment-metadata';
      const segment = getSegmentEntry(keys[0], runtime);
      if (!segment || !/^[a-f0-9]{64}$/.test(segment.sha256)) {
        throw new Error('Release E2E marker integrity metadata is missing.');
      }
      stage = 'segment-native-load';
      const imported = await import('./mobileLockdownReleaseMarker');
      stage = 'segment-evaluation';
      const marker = imported.readMobileLockdownReleaseMarker();
      if (marker.marker !== 'onekey-mobile-lockdown-release-segment-v1') {
        throw new Error(
          'Release E2E native segment returned an invalid marker.',
        );
      }
      stage = 'segment-array';
      if (!marker.arrayFrozen) {
        throw new Error('Release E2E segment Array prototype is mutable.');
      }
      stage = 'segment-promise';
      if (!marker.promiseFrozen) {
        throw new Error('Release E2E segment Promise prototype is mutable.');
      }
      stage = 'segment-loaded-state';
      if (!isSegmentLoaded(keys[0])) {
        throw new Error(
          'Release E2E native segment did not execute in the hardened heap.',
        );
      }
      return {
        ...identity,
        status: 'passed',
        integrity,
        asyncDelivery: { promise: true, timer: true, nextTick: true },
        nativeVersion: context.nativeVersion,
        sourceKind: context.sourceKind,
        segment: {
          key: keys[0],
          sha256Prefix: segment.sha256.slice(0, 16),
          loaded: true,
        },
      };
    };
    const result = await Promise.race([
      check(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Release E2E timed out.')),
          TIMEOUT_MS,
        );
      }),
    ]);
    writeMobileLockdownE2EReport(
      `[MobileLockdownE2E] ${JSON.stringify(result)}`,
      false,
    );
  } catch (error: unknown) {
    const nativeCode =
      error && typeof error === 'object' && 'code' in error
        ? error.code
        : undefined;
    const code =
      typeof nativeCode === 'string' &&
      [
        'SPLIT_BUNDLE_NO_RUNTIME',
        'SPLIT_BUNDLE_TIMEOUT',
        'SPLIT_BUNDLE_EVAL_ERROR',
        'SPLIT_BUNDLE_IO_ERROR',
        'SPLIT_BUNDLE_NATIVE_UNAVAILABLE',
        'SPLIT_BUNDLE_SHA256_MISMATCH',
        'SPLIT_BUNDLE_NOT_FOUND',
        'SPLIT_BUNDLE_INVALID_PATH',
        'SPLIT_BUNDLE_RESOLVE_ERROR',
      ].includes(nativeCode)
        ? nativeCode
        : undefined;
    // Only fixed diagnostic fields are logged, never application error payloads.
    writeMobileLockdownE2EReport(
      `[MobileLockdownE2E] ${JSON.stringify({ ...identity, status: 'failed', stage, code })}`,
      true,
    );
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}
