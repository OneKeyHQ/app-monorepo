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
  const valueText = value === undefined ? '' : stringifyLogValue(value);

  defaultLogger.scanQrCode.readQrCode.debugCameraState(label, valueText);

  if (process.env.NODE_ENV === 'production') {
    return;
  }

  // eslint-disable-next-line no-console
  console.log(`${LOG_PREFIX} ${label}${valueText ? ` ${valueText}` : ''}`);
}
