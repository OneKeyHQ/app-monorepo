import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function logTradingViewNativeDataError(message: string, error: unknown) {
  defaultLogger.networkDoctor.log.error({
    info: `${message}: ${getErrorMessage(error)}`,
  });
}
