import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { loggerConfig } from '@onekeyhq/shared/src/logger/loggerConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const BLE_MTU_READY_LOG_EVENT = '[ReactNativeBleTransport] BLE MTU ready';

type IBleMtuReadyTelemetry = {
  transportType: 'ble';
  blePlatform: 'ios' | 'android';
  requestedMtu: number;
  actualMtu?: number;
  isDefaultMtu?: boolean;
};

function parsePositiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function parseBleMtuReadyLogPayload(
  payload: readonly unknown[],
): IBleMtuReadyTelemetry | undefined {
  const eventIndex = payload.indexOf(BLE_MTU_READY_LOG_EVENT);
  if (eventIndex < 0) {
    return undefined;
  }
  const serializedParams = payload[eventIndex + 1];
  if (typeof serializedParams !== 'string') {
    return undefined;
  }

  try {
    const params = JSON.parse(serializedParams) as Record<string, unknown>;
    const requestedMtu = parsePositiveNumber(params.requested);
    const actualMtu = parsePositiveNumber(params.actual);
    if (
      (params.platform !== 'ios' && params.platform !== 'android') ||
      requestedMtu === undefined
    ) {
      return undefined;
    }

    return {
      transportType: 'ble',
      blePlatform: params.platform,
      requestedMtu,
      actualMtu,
      isDefaultMtu: actualMtu === undefined ? undefined : actualMtu <= 23,
    };
  } catch {
    return undefined;
  }
}

function shouldReportBleMtuReadyTelemetry(
  reportedSignatures: Set<string>,
  telemetry: IBleMtuReadyTelemetry,
): boolean {
  const signature = `${telemetry.blePlatform}:${telemetry.requestedMtu}:${
    telemetry.actualMtu ?? 'unknown'
  }`;
  if (reportedSignatures.has(signature)) {
    return false;
  }
  reportedSignatures.add(signature);
  return true;
}

function hardwareLog(name: string, ...args: any[]) {
  try {
    defaultLogger.hardware.sdkLog.serviceEvent(
      name,
      args.length <= 1 ? args[0] : args,
    );
  } catch {
    // Logging must never break hardware flows.
  }
  // Keep the always-on dev console trace: the scene-gated transport above
  // mirrors to the console itself when enabled, so only fill the gap when
  // the hardware scene is off.
  if (platformEnv.isDev && !loggerConfig.shouldLog('hardware', 'sdkLog')) {
    console.log(`ServiceHardwareLog@${name}`, ...args);
  }
}

/**
 * Device identifiers (serial numbers, connect ids) must never enter
 * persisted logs in full; keep a short suffix for multi-device correlation.
 */
function maskLogIdentifier(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  return `***${value.slice(-4)}`;
}

export default {
  hardwareLog,
  maskLogIdentifier,
  parseBleMtuReadyLogPayload,
  shouldReportBleMtuReadyTelemetry,
};
