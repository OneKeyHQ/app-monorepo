import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { captureLoggerUtmParamsFromUrl } from '@onekeyhq/shared/src/logger/utmParams';

export function captureAndReportLoggerUtmParamsFromUrl(
  url: string | undefined | null,
) {
  const captured = captureLoggerUtmParamsFromUrl(url);
  if (captured?.shouldReport) {
    defaultLogger.app.router.utmParamsCaptured(captured.params);
  }
  return captured;
}
