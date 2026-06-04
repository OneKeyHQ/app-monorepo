import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

const LOG_PREFIX = '[OK-55747][ScanCamera]';

function stringifyLogValue(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return JSON.stringify({
      stringifyError: error instanceof Error ? error.message : String(error),
    });
  }
}

export function debugScanCameraLog(label: string, value?: unknown) {
  const logLabel = `${LOG_PREFIX} ${label}`;
  const valueText = value === undefined ? '' : stringifyLogValue(value);

  defaultLogger.scanQrCode.readQrCode.debugCameraState(logLabel, valueText);

  // eslint-disable-next-line no-console
  console.log(`${logLabel}${valueText ? ` ${valueText}` : ''}`);
}
