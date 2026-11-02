import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import type { IBreezSdkSparkModule } from './types';

// Caps one SDK log line in the app log.
const SDK_LOG_LINE_MAX_LENGTH = 1000;

let loadPromise: Promise<IBreezSdkSparkModule> | undefined;

// Sends the SDK's own warnings and errors to the app log. The SDK accepts one
// logger per runtime, so this runs once, right after the wasm init.
function forwardSdkLogs(mod: IBreezSdkSparkModule) {
  return mod.initLogging(
    {
      log: ({ level, line }) => {
        const params = { line: line.slice(0, SDK_LOG_LINE_MAX_LENGTH) };
        if (level.toUpperCase() === 'ERROR') {
          defaultLogger.lightning.spark.sdkError(params);
        } else {
          defaultLogger.lightning.spark.sdkWarning(params);
        }
      },
    },
    'warn',
  );
}

/**
 * Loads the Breez SDK Spark web build and initializes its wasm once per JS
 * runtime. Web and the Desktop renderer both run kit-bg in the page, so they
 * share this loader.
 */
export function loadBreezSdk(): Promise<IBreezSdkSparkModule> {
  loadPromise ??= (async () => {
    const mod = await import('@breeztech/breez-sdk-spark');
    await mod.default();
    // Losing the SDK's own log lines must not stop the SDK from loading.
    await forwardSdkLogs(mod).catch(() => undefined);
    return mod;
  })().catch((error: unknown) => {
    loadPromise = undefined;
    throw error;
  });
  return loadPromise;
}
