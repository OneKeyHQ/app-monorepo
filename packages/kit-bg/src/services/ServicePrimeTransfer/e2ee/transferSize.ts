import { Buffer } from 'buffer';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import type {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

export function getTransferMessageLimit(value?: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? value
    : undefined;
}

export function assertTransferSize(size: number, limit: number): void {
  if (size <= limit) return;
  const formatSize = (bytes: number) =>
    `${Math.ceil((bytes * 100) / (1024 * 1024)) / 100} MiB`;
  throw new OneKeyLocalError(
    appLocale.intl.formatMessage(
      { id: ETranslations.transfer_data_too_large__msg },
      { size: formatSize(size), limit: formatSize(limit) },
    ),
  );
}

export function assertLegacyTransferPacketSize({
  roomId,
  payload,
  maxMessageSize,
}: {
  roomId: string;
  payload: IJsBridgeMessagePayload;
  maxMessageSize?: number;
}): void {
  // Legacy relays can have custom limits without advertising them. Preserve
  // their existing send behavior instead of guessing a client-side limit.
  if (maxMessageSize === undefined) return;
  const request = payload.data as IJsonRpcRequest | undefined;
  if (request?.method !== 'sendTransferData') return;
  const params = request.params;
  if (!Array.isArray(params)) return;
  const first = params[0] as { rawData?: unknown } | undefined;
  if (!first || typeof first.rawData !== 'string') return;
  const rawData = first.rawData;
  assertTransferSize(rawData.length, maxMessageSize);
  // Base64 needs no JSON escaping. Serialize only the small envelope, including
  // the event and Engine.IO/Socket.IO prefixes, before emitting any wallet data.
  const emptyPayload = {
    ...payload,
    data: {
      ...request,
      params: [{ ...first, rawData: '' }, ...params.slice(1)],
    },
  };
  const envelopeBytes = Buffer.byteLength(
    JSON.stringify(['e2ee-c2c-request', { roomId, payload: emptyPayload }]),
  );
  const dataBytes = /^[A-Za-z0-9+/]*={0,2}$/.test(rawData)
    ? rawData.length
    : Buffer.byteLength(JSON.stringify(rawData)) - 2;
  assertTransferSize(envelopeBytes + dataBytes + 2, maxMessageSize);
}
