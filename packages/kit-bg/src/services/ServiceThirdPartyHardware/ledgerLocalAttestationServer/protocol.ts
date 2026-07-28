/* eslint-disable no-restricted-syntax */
export const LEDGER_ATTESTATION_RELAY_PROTOCOL_VERSION = 1 as const;
export const MAX_LEDGER_RELAY_APDU_BYTES = 8 * 1024;
export const MAX_LEDGER_RELAY_APDU_EXCHANGES = 256;
export const DEFAULT_LEDGER_RELAY_SESSION_TTL_MS = 5 * 60_000;

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const HEX_PATTERN = /^[0-9a-f]*$/i;
const LEDGER_MODEL_IDS = new Set([
  'nanoS',
  'nanoSP',
  'nanoX',
  'stax',
  'flex',
  'apexp',
]);

export type ILedgerRelayDevice = {
  id: string;
  modelId: 'nanoS' | 'nanoSP' | 'nanoX' | 'stax' | 'flex' | 'apexp';
  name?: string;
  connectionType?: 'USB' | 'BLE';
};

export type ILedgerRelayHelloMessage = {
  type: 'hello';
  protocolVersion: typeof LEDGER_ATTESTATION_RELAY_PROTOCOL_VERSION;
  device: ILedgerRelayDevice;
};

export type ILedgerRelayApduResponseMessage = {
  type: 'apdu-response';
  requestId: string;
  dataHex: string;
  statusCodeHex: string;
};

export type ILedgerRelayApduErrorMessage = {
  type: 'apdu-error';
  requestId: string;
  message: string;
};

export type ILedgerRelayClientMessage =
  | ILedgerRelayHelloMessage
  | ILedgerRelayApduResponseMessage
  | ILedgerRelayApduErrorMessage;

export type ILedgerRelayServerMessage =
  | {
      type: 'ready';
      protocolVersion: typeof LEDGER_ATTESTATION_RELAY_PROTOCOL_VERSION;
    }
  | {
      type: 'apdu-request';
      requestId: string;
      apduHex: string;
      timeoutMs: number;
    }
  | {
      type: 'interaction';
      requiredUserInteraction: string;
    }
  | {
      type: 'result';
      isGenuine: boolean;
      deviceId?: string;
    }
  | {
      type: 'error';
      code: string;
      message: string;
    };

const assertHex = ({
  value,
  field,
  exactBytes,
  maxBytes,
}: {
  value: unknown;
  field: string;
  exactBytes?: number;
  maxBytes?: number;
}): string => {
  if (
    typeof value !== 'string' ||
    value.length % 2 !== 0 ||
    !HEX_PATTERN.test(value) ||
    (exactBytes !== undefined && value.length !== exactBytes * 2)
  ) {
    throw new Error(`Invalid Ledger relay ${field}`);
  }
  if (maxBytes !== undefined && value.length / 2 > maxBytes) {
    throw new Error(`Ledger relay ${field} is too large`);
  }
  return value.toLowerCase();
};

const assertRequestId = (value: unknown): string => {
  if (typeof value !== 'string' || !REQUEST_ID_PATTERN.test(value)) {
    throw new Error('Invalid Ledger relay requestId');
  }
  return value;
};

const parseDevice = (value: unknown): ILedgerRelayDevice => {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid Ledger relay device');
  }
  const device = value as Record<string, unknown>;
  if (
    typeof device.id !== 'string' ||
    device.id.length < 1 ||
    device.id.length > 128 ||
    typeof device.modelId !== 'string' ||
    !LEDGER_MODEL_IDS.has(device.modelId)
  ) {
    throw new Error('Invalid Ledger relay device metadata');
  }
  if (
    device.name !== undefined &&
    (typeof device.name !== 'string' || device.name.length > 128)
  ) {
    throw new Error('Invalid Ledger relay device name');
  }
  if (
    device.connectionType !== undefined &&
    device.connectionType !== 'USB' &&
    device.connectionType !== 'BLE'
  ) {
    throw new Error('Invalid Ledger relay connection type');
  }
  return device as ILedgerRelayDevice;
};

export const parseLedgerRelayClientMessage = (
  raw: string,
): ILedgerRelayClientMessage => {
  if (Buffer.byteLength(raw, 'utf8') > MAX_LEDGER_RELAY_APDU_BYTES * 2 + 4096) {
    throw new Error('Ledger relay message is too large');
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('Invalid Ledger relay JSON');
  }
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid Ledger relay message');
  }
  const message = value as Record<string, unknown>;
  if (message.type === 'hello') {
    if (message.protocolVersion !== LEDGER_ATTESTATION_RELAY_PROTOCOL_VERSION) {
      throw new Error('Unsupported Ledger relay protocol version');
    }
    return {
      type: 'hello',
      protocolVersion: LEDGER_ATTESTATION_RELAY_PROTOCOL_VERSION,
      device: parseDevice(message.device),
    };
  }
  if (message.type === 'apdu-response') {
    return {
      type: 'apdu-response',
      requestId: assertRequestId(message.requestId),
      dataHex: assertHex({
        value: message.dataHex,
        field: 'dataHex',
        maxBytes: MAX_LEDGER_RELAY_APDU_BYTES,
      }),
      statusCodeHex: assertHex({
        value: message.statusCodeHex,
        field: 'statusCodeHex',
        exactBytes: 2,
      }),
    };
  }
  if (message.type === 'apdu-error') {
    if (
      typeof message.message !== 'string' ||
      message.message.length < 1 ||
      message.message.length > 512
    ) {
      throw new Error('Invalid Ledger relay APDU error');
    }
    return {
      type: 'apdu-error',
      requestId: assertRequestId(message.requestId),
      message: message.message,
    };
  }
  throw new Error('Unsupported Ledger relay message');
};
