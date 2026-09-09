import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { ILoggerConfig } from '@onekeyhq/shared/src/logger/loggerConfig';
import { loggerConfig } from '@onekeyhq/shared/src/logger/loggerConfig';

/**
 * Persist a logger config to every runtime. On native, main and bg hold
 * separate LoggerConfigManager singletons in isolated JS heaps: bg saves and
 * persists first (it emits most logs), then the main-runtime singleton is
 * mirrored without a second storage write. On single-context platforms both
 * steps hit the same singleton, which is harmless.
 */
export async function saveLoggerConfigToAllRuntimes(config: ILoggerConfig) {
  await backgroundApiProxy.serviceLogger.updateLoggerConfig(config);
  loggerConfig.updateRuntimeConfig(config);
}
