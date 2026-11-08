// cspell:ignore lightd Zaino
import { privacyChainNodeRequest } from '@onekeyhq/core/src/utils/privacyChainNodeRequest';

// A lightweight gRPC-web probe without loading WASM.

const GET_LATEST_BLOCK_PATH =
  '/cash.z.wallet.sdk.rpc.CompactTxStreamer/GetLatestBlock';
const GET_LIGHTD_INFO_PATH =
  '/cash.z.wallet.sdk.rpc.CompactTxStreamer/GetLightdInfo';
const GET_BLOCK_PATH = '/cash.z.wallet.sdk.rpc.CompactTxStreamer/GetBlock';
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

function encodeVarint(value: number): number[] {
  const bytes: number[] = [];
  let rest = value;
  while (rest >= 128) {
    bytes.push((rest % 128) + 128);
    rest = Math.floor(rest / 128);
  }
  bytes.push(rest);
  return bytes;
}

// The varint field `fieldNumber` of a message, or null if absent.
function readVarintField(
  message: Uint8Array,
  fieldNumber: number,
): number | null {
  let cursor = 0;
  while (cursor < message.length) {
    const tag = readVarint(message, cursor);
    if (!tag) return null;
    cursor = tag.next;
    const wireType = tag.value % 8;
    if (wireType === 0) {
      const field = readVarint(message, cursor);
      if (!field) return null;
      cursor = field.next;
      if (
        Math.floor(tag.value / 8) === fieldNumber &&
        Number.isSafeInteger(field.value)
      ) {
        return field.value;
      }
    } else if (wireType === 1) {
      cursor += 8;
    } else if (wireType === 5) {
      cursor += 4;
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

// Returns the `height` field of a BlockID message, or null if absent.
export function parseZcashBlockIdHeight(message: Uint8Array): number | null {
  return readVarintField(message, 1);
}

// Returns the `time` field (5, seconds) of a CompactBlock message, or null if absent.
export function parseZcashCompactBlockTime(message: Uint8Array): number | null {
  return readVarintField(message, 5);
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

// Data frame of a unary call, or null on any failure. No `message` sends an empty request.
async function fetchGrpcWebUnaryFrame({
  lightwalletdUrl,
  path,
  timeoutMs,
  message = new Uint8Array(),
}: {
  lightwalletdUrl: string;
  path: string;
  timeoutMs: number;
  message?: Uint8Array;
}): Promise<Uint8Array | null> {
  const request = new Uint8Array(GRPC_WEB_FRAME_HEADER_BYTES + message.length);
  new DataView(request.buffer).setUint32(1, message.length);
  request.set(message, GRPC_WEB_FRAME_HEADER_BYTES);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await privacyChainNodeRequest(
      `${lightwalletdUrl.replace(/\/+$/, '')}${path}`,
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
    if (!response.ok) return null;
    const grpcStatus = response.headers?.get('grpc-status') ?? null;
    if (grpcStatus !== null && grpcStatus !== '0') return null;
    if (!grpcWebBodySucceeded(response.bytes)) return null;
    return extractGrpcWebDataFrame(response.bytes);
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
  const frame = await fetchGrpcWebUnaryFrame({
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
  const frame = await fetchGrpcWebUnaryFrame({
    lightwalletdUrl,
    path: GET_LIGHTD_INFO_PATH,
    timeoutMs,
  });
  if (!frame) return null;
  const chainName = parseZcashLightdInfoChainName(frame);
  return chainName ? { chainName } : null;
}

// Block time (seconds) of the block at `height`, or null when the node cannot answer.
export async function fetchZcashBlockTimeDirect({
  lightwalletdUrl,
  height,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  lightwalletdUrl: string;
  height: number;
  timeoutMs?: number;
}): Promise<number | null> {
  const frame = await fetchGrpcWebUnaryFrame({
    lightwalletdUrl,
    path: GET_BLOCK_PATH,
    timeoutMs,
    // BlockID { height }
    message: Uint8Array.from([0x08, ...encodeVarint(height)]),
  });
  if (!frame) return null;
  const time = parseZcashCompactBlockTime(frame);
  return time !== null && time > 0 ? time : null;
}

// A few interpolation steps land close on a near-even chain; bisection then
// bounds the rest, so a skewed range cannot stall the search.
const HEIGHT_AT_TIME_INTERPOLATION_STEPS = 4;
const HEIGHT_AT_TIME_MAX_REQUESTS = 40;

// The last block in [lowHeight, highHeight] whose time is at or before
// `timeSeconds`, placed by the chain's own block times rather than an assumed
// interval; null when the node cannot answer.
export async function findZcashHeightAtTimeDirect({
  lightwalletdUrl,
  timeSeconds,
  lowHeight,
  highHeight,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  lightwalletdUrl: string;
  timeSeconds: number;
  lowHeight: number;
  highHeight: number;
  timeoutMs?: number;
}): Promise<number | null> {
  if (highHeight <= lowHeight) return lowHeight;
  let requests = 0;
  const timeAt = (height: number) => {
    requests += 1;
    return requests > HEIGHT_AT_TIME_MAX_REQUESTS
      ? Promise.resolve(null)
      : fetchZcashBlockTimeDirect({ lightwalletdUrl, height, timeoutMs });
  };
  let low = lowHeight;
  let high = highHeight;
  let lowTime = await timeAt(low);
  if (lowTime === null) return null;
  if (timeSeconds <= lowTime) return low;
  let highTime = await timeAt(high);
  if (highTime === null) return null;
  if (timeSeconds >= highTime) return high;
  let interpolationSteps = 0;
  while (high - low > 1) {
    let probe = Math.floor((low + high) / 2);
    if (
      interpolationSteps < HEIGHT_AT_TIME_INTERPOLATION_STEPS &&
      highTime > lowTime
    ) {
      interpolationSteps += 1;
      probe =
        low +
        Math.round(
          ((timeSeconds - lowTime) / (highTime - lowTime)) * (high - low),
        );
    }
    probe = Math.min(high - 1, Math.max(low + 1, probe));
    // eslint-disable-next-line no-await-in-loop
    const probeTime = await timeAt(probe);
    if (probeTime === null) return null;
    if (probeTime <= timeSeconds) {
      low = probe;
      lowTime = probeTime;
    } else {
      high = probe;
      highTime = probeTime;
    }
  }
  return low;
}
