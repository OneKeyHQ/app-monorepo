// cspell:ignore lightd Zaino
import { createFetchStream } from '@onekeyhq/shared/src/utils/fetchStreamClient';
import { hostFetchStream } from '@onekeyhq/shared/src/utils/hostFetchStream';

const hostFetch = hostFetchStream
  ? createFetchStream(hostFetchStream)
  : undefined;

// A lightweight gRPC-web probe without loading WASM. Desktop and extension
// use the same host transport as scanning; native background fetch already
// uses native networking. Plain web retains browser Fetch/CORS.

const GET_LATEST_BLOCK_PATH =
  '/cash.z.wallet.sdk.rpc.CompactTxStreamer/GetLatestBlock';
const GET_LIGHTD_INFO_PATH =
  '/cash.z.wallet.sdk.rpc.CompactTxStreamer/GetLightdInfo';
// LightdInfo.chainName values reported by lightwalletd and Zaino.
export const ZCASH_LIGHTD_CHAIN_NAMES: readonly string[] = [
  'main',
  'test',
  'regtest',
];
const GRPC_WEB_FRAME_HEADER_BYTES = 5;
const GRPC_WEB_TRAILER_FLAG = 0x80;
const DEFAULT_TIMEOUT_MS = 10_000;

function readVarint(bytes: Uint8Array, offset: number) {
  let value = 0;
  let shift = 0;
  let cursor = offset;
  while (cursor < bytes.length) {
    const byte = bytes[cursor];
    cursor += 1;
    value += (byte % 128) * 2 ** shift;
    if (byte < 128) {
      return { value, next: cursor };
    }
    shift += 7;
    if (shift > 63) break;
  }
  return null;
}

// Returns the `height` field of a BlockID message, or null if absent.
export function parseZcashBlockIdHeight(message: Uint8Array): number | null {
  let cursor = 0;
  while (cursor < message.length) {
    const tag = readVarint(message, cursor);
    if (!tag) return null;
    cursor = tag.next;
    const fieldNumber = Math.floor(tag.value / 8);
    const wireType = tag.value % 8;
    if (wireType === 0) {
      const field = readVarint(message, cursor);
      if (!field) return null;
      cursor = field.next;
      if (fieldNumber === 1 && Number.isSafeInteger(field.value)) {
        return field.value;
      }
    } else if (wireType === 2) {
      const length = readVarint(message, cursor);
      if (!length) return null;
      cursor = length.next + length.value;
    } else {
      return null;
    }
  }
  return null;
}

// Returns the `chainName` field (4) of a LightdInfo message, or null if absent.
export function parseZcashLightdInfoChainName(
  message: Uint8Array,
): string | null {
  let cursor = 0;
  while (cursor < message.length) {
    const tag = readVarint(message, cursor);
    if (!tag) return null;
    cursor = tag.next;
    const fieldNumber = Math.floor(tag.value / 8);
    const wireType = tag.value % 8;
    if (wireType === 0) {
      const field = readVarint(message, cursor);
      if (!field) return null;
      cursor = field.next;
    } else if (wireType === 1) {
      cursor += 8;
    } else if (wireType === 5) {
      cursor += 4;
    } else if (wireType === 2) {
      const length = readVarint(message, cursor);
      if (!length) return null;
      const end = length.next + length.value;
      if (end > message.length) return null;
      if (fieldNumber === 4) {
        return new TextDecoder().decode(message.subarray(length.next, end));
      }
      cursor = end;
    } else {
      return null;
    }
  }
  return null;
}

// First data frame of a grpc-web body, or null when the reply is trailers-only
// (the server's way of returning an error status).
export function extractGrpcWebDataFrame(body: Uint8Array): Uint8Array | null {
  let cursor = 0;
  while (cursor + GRPC_WEB_FRAME_HEADER_BYTES <= body.length) {
    const flag = body[cursor];
    const length =
      body[cursor + 1] * 2 ** 24 +
      body[cursor + 2] * 2 ** 16 +
      body[cursor + 3] * 2 ** 8 +
      body[cursor + 4];
    const start = cursor + GRPC_WEB_FRAME_HEADER_BYTES;
    const end = start + length;
    if (end > body.length) return null;
    if (flag < GRPC_WEB_TRAILER_FLAG) {
      return body.subarray(start, end);
    }
    cursor = end;
  }
  return null;
}

function grpcWebBodySucceeded(body: Uint8Array): boolean {
  let cursor = 0;
  while (cursor + GRPC_WEB_FRAME_HEADER_BYTES <= body.length) {
    const flag = body[cursor];
    const length = new DataView(
      body.buffer,
      body.byteOffset + cursor + 1,
      4,
    ).getUint32(0);
    const start = cursor + GRPC_WEB_FRAME_HEADER_BYTES;
    const end = start + length;
    if (end > body.length) return false;
    if (flag === GRPC_WEB_TRAILER_FLAG) {
      const trailers = new TextDecoder().decode(body.subarray(start, end));
      return (
        end === body.length &&
        /(?:^|\r\n)grpc-status:\s*0\s*(?:\r\n|$)/i.test(trailers)
      );
    }
    if (flag !== 0) return false;
    cursor = end;
  }
  return cursor === body.length;
}

// Data frame of a unary call with an empty request, or null on any failure.
async function fetchGrpcWebEmptyRequestFrame({
  lightwalletdUrl,
  path,
  timeoutMs,
}: {
  lightwalletdUrl: string;
  path: string;
  timeoutMs: number;
}): Promise<Uint8Array | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await (hostFetch ?? fetch)(
      `${lightwalletdUrl.replace(/\/+$/, '')}${path}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/grpc-web+proto',
          'x-grpc-web': '1',
        },
        body: new Uint8Array(GRPC_WEB_FRAME_HEADER_BYTES),
        signal: controller.signal,
      },
    );
    if (!response.ok) return null;
    const grpcStatus = response.headers.get('grpc-status');
    if (grpcStatus !== null && grpcStatus !== '0') return null;
    const body = new Uint8Array(await response.arrayBuffer());
    if (!grpcWebBodySucceeded(body)) return null;
    return extractGrpcWebDataFrame(body);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchZcashChainTipDirect({
  lightwalletdUrl,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  lightwalletdUrl: string;
  timeoutMs?: number;
}): Promise<number | null> {
  const frame = await fetchGrpcWebEmptyRequestFrame({
    lightwalletdUrl,
    path: GET_LATEST_BLOCK_PATH,
    timeoutMs,
  });
  if (!frame) return null;
  const height = parseZcashBlockIdHeight(frame);
  return height !== null && height > 0 ? height : null;
}

// Null when the call fails or the reply carries no chain name.
export async function fetchZcashLightdInfoDirect({
  lightwalletdUrl,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  lightwalletdUrl: string;
  timeoutMs?: number;
}): Promise<{ chainName: string } | null> {
  const frame = await fetchGrpcWebEmptyRequestFrame({
    lightwalletdUrl,
    path: GET_LIGHTD_INFO_PATH,
    timeoutMs,
  });
  if (!frame) return null;
  const chainName = parseZcashLightdInfoChainName(frame);
  return chainName ? { chainName } : null;
}

// Only an explicit NOT_FOUND is absence evidence. Transport failures and
// malformed replies must keep the signed journal available for reconciliation.
export async function fetchZcashTransactionMissingDirect({
  lightwalletdUrl,
  txid,
}: {
  lightwalletdUrl: string;
  txid: string;
}): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/i.test(txid)) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    // TxFilter.hash is field 3 and uses the internal byte order.
    const message = Uint8Array.from([
      0x1a,
      32,
      ...Buffer.from(txid, 'hex').toReversed(),
    ]);
    const request = new Uint8Array(
      GRPC_WEB_FRAME_HEADER_BYTES + message.length,
    );
    request[4] = message.length;
    request.set(message, GRPC_WEB_FRAME_HEADER_BYTES);
    const response = await (hostFetch ?? fetch)(
      `${lightwalletdUrl.replace(/\/+$/, '')}/cash.z.wallet.sdk.rpc.CompactTxStreamer/GetTransaction`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/grpc-web+proto',
          'x-grpc-web': '1',
        },
        body: request,
        signal: controller.signal,
      },
    );
    if (!response.ok) return false;
    if (response.headers.get('grpc-status') === '5') return true;
    const body = new Uint8Array(await response.arrayBuffer());
    if (extractGrpcWebDataFrame(body)) return false;
    if (body[0] !== GRPC_WEB_TRAILER_FLAG) return false;
    const length = new DataView(
      body.buffer,
      body.byteOffset,
      body.byteLength,
    ).getUint32(1);
    if (length !== body.length - GRPC_WEB_FRAME_HEADER_BYTES) return false;
    const trailers = new TextDecoder().decode(
      body.subarray(GRPC_WEB_FRAME_HEADER_BYTES),
    );
    return /(?:^|\r\n)grpc-status:\s*5\s*(?:\r\n|$)/i.test(trailers);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
