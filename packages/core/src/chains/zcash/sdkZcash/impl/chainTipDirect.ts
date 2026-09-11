// lightwalletd GetLatestBlock over grpc-web with plain fetch, no wasm and no
// proto codegen. The wasm runtime asks the same RPC, but on native it runs in
// a file:// WebView whose null origin cannot pass CORS; the background JS
// runtime has no such restriction. The request is an empty ChainSpec and the
// reply is BlockID { uint64 height = 1; bytes hash = 2 }.

const GET_LATEST_BLOCK_PATH =
  '/cash.z.wallet.sdk.rpc.CompactTxStreamer/GetLatestBlock';
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

export async function fetchZcashChainTipDirect({
  lightwalletdUrl,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  lightwalletdUrl: string;
  timeoutMs?: number;
}): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      `${lightwalletdUrl.replace(/\/+$/, '')}${GET_LATEST_BLOCK_PATH}`,
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
    const frame = extractGrpcWebDataFrame(body);
    if (!frame) return null;
    const height = parseZcashBlockIdHeight(frame);
    return height !== null && height > 0 ? height : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
