import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  PRIME_TRANSFER_CHUNK_PACKET_SIZE,
  PRIME_TRANSFER_CHUNK_SIZE,
  PRIME_TRANSFER_CHUNK_TIMEOUT,
  PRIME_TRANSFER_MAX_PAYLOAD_SIZE,
} from '@onekeyhq/shared/types/prime/primeTransferNetworkTypes';
import type {
  IPrimeTransferChunk,
  IPrimeTransferChunkAck,
  IPrimeTransferChunkManifest,
  IPrimeTransferTransportMode,
} from '@onekeyhq/shared/types/prime/primeTransferNetworkTypes';

export function isValidPrimeTransferChunkData(data: unknown): data is string {
  if (
    typeof data !== 'string' ||
    data.length === 0 ||
    data.length > PRIME_TRANSFER_CHUNK_SIZE ||
    data.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(data)
  ) {
    return false;
  }
  // Chunk boundaries are multiples of four. Canonical Base64 requires zero
  // unused bits in the final sextet; check them without decoding/copying data.
  if (data.endsWith('==')) return /[AQgw]==$/.test(data);
  if (data.endsWith('=')) return /[AEIMQUYcgkosw048]=$/.test(data);
  return true;
}

export function waitForTransferRequest<T>(
  request: Promise<T>,
  signal: AbortSignal,
  timeout = PRIME_TRANSFER_CHUNK_TIMEOUT,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timerRef: { current?: ReturnType<typeof setTimeout> } = {};
    const onAbort = () => {
      clearTimeout(timerRef.current);
      signal.removeEventListener('abort', onAbort);
      reject(new OneKeyLocalError('Transfer cancelled'));
    };
    const cleanup = () => {
      clearTimeout(timerRef.current);
      signal.removeEventListener('abort', onAbort);
    };
    timerRef.current = setTimeout(() => {
      cleanup();
      reject(new OneKeyLocalError('Transfer timed out'));
    }, timeout);
    signal.addEventListener('abort', onAbort);
    if (signal.aborted) {
      onAbort();
    }
    void request.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error: unknown) => {
        cleanup();
        reject(error);
      },
    );
  });
}

export async function supportsPrimeTransferChunks({
  transportMode = 'auto',
  serverSupportsChunkedTransfer,
  serverMaxMessageSize = Number.POSITIVE_INFINITY,
  getTransferType,
  signal,
}: {
  transportMode?: IPrimeTransferTransportMode;
  serverSupportsChunkedTransfer: boolean;
  serverMaxMessageSize?: number;
  getTransferType: () => Promise<{ chunkedTransferVersion?: number }>;
  signal: AbortSignal;
}): Promise<boolean> {
  if (
    transportMode === 'legacy' ||
    !serverSupportsChunkedTransfer ||
    serverMaxMessageSize < PRIME_TRANSFER_CHUNK_PACKET_SIZE
  ) {
    return false;
  }
  try {
    const capabilities = await waitForTransferRequest(
      getTransferType(),
      signal,
    );
    return capabilities.chunkedTransferVersion === 1;
  } catch (error) {
    // Peers predating getTransferType return this exact RemoteApiProxyBase
    // error without a code. It may cross a bridge as a plain object.
    if (
      !signal.aborted &&
      error !== null &&
      typeof error === 'object' &&
      'message' in error &&
      typeof error.message === 'string' &&
      error.message.trim() ===
        'callRemoteApiMethod not found: e2eeClientToClientApi.api.getTransferType()'
    ) {
      return false;
    }
    throw error;
  }
}

// The wire payload is Base64, so its ASCII string length is its byte count.
export class PrimeTransferChunkReceiver {
  private readonly chunks = new Map<number, string>();

  receivedBytes = 0;

  constructor(readonly manifest: IPrimeTransferChunkManifest) {
    if (
      typeof manifest.transferId !== 'string' ||
      !/^[a-zA-Z0-9-]{1,64}$/.test(manifest.transferId) ||
      !Number.isSafeInteger(manifest.totalBytes) ||
      manifest.totalBytes <= 0 ||
      manifest.totalBytes % 4 !== 0 ||
      manifest.totalBytes > PRIME_TRANSFER_MAX_PAYLOAD_SIZE
    ) {
      throw new OneKeyLocalError('Invalid transfer manifest');
    }
  }

  receive(chunk: IPrimeTransferChunk): IPrimeTransferChunkAck {
    const { index, data, transferId } = chunk;
    const count = Math.ceil(
      this.manifest.totalBytes / PRIME_TRANSFER_CHUNK_SIZE,
    );
    const expectedSize = Math.min(
      PRIME_TRANSFER_CHUNK_SIZE,
      this.manifest.totalBytes - index * PRIME_TRANSFER_CHUNK_SIZE,
    );
    if (
      transferId !== this.manifest.transferId ||
      !Number.isSafeInteger(index) ||
      index < 0 ||
      index >= count ||
      !isValidPrimeTransferChunkData(data) ||
      data.length !== expectedSize ||
      (index < count - 1 && data.endsWith('='))
    ) {
      throw new OneKeyLocalError('Invalid transfer chunk');
    }
    const previous = this.chunks.get(index);
    if (previous !== undefined && previous !== data) {
      throw new OneKeyLocalError('Conflicting transfer chunk');
    }
    if (previous === undefined) {
      this.chunks.set(index, data);
      this.receivedBytes += data.length;
    }
    return { transferId, index, receivedBytes: this.receivedBytes };
  }

  complete(): string {
    if (this.receivedBytes !== this.manifest.totalBytes) {
      throw new OneKeyLocalError('Transfer is incomplete');
    }
    const count = Math.ceil(
      this.manifest.totalBytes / PRIME_TRANSFER_CHUNK_SIZE,
    );
    const orderedChunks: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const chunk = this.chunks.get(index);
      if (chunk === undefined) {
        throw new OneKeyLocalError('Transfer chunk is missing');
      }
      orderedChunks.push(chunk);
    }
    this.chunks.clear();
    return orderedChunks.join('');
  }
}

export async function sendPrimeTransferChunks({
  rawData,
  transferId,
  sendChunk,
  onProgress,
  signal,
}: {
  rawData: string;
  transferId: string;
  sendChunk: (chunk: IPrimeTransferChunk) => Promise<IPrimeTransferChunkAck>;
  onProgress: (transferredBytes: number) => void;
  signal: AbortSignal;
}): Promise<void> {
  let nextIndex = 0;
  let transferredBytes = 0;
  let stopped = false;
  const count = Math.ceil(rawData.length / PRIME_TRANSFER_CHUNK_SIZE);
  const assertActive = () => {
    if (signal.aborted || stopped) {
      throw new OneKeyLocalError('Transfer cancelled');
    }
  };
  const worker = async () => {
    while (nextIndex < count) {
      assertActive();
      const index = nextIndex;
      nextIndex += 1;
      const data = rawData.slice(
        index * PRIME_TRANSFER_CHUNK_SIZE,
        (index + 1) * PRIME_TRANSFER_CHUNK_SIZE,
      );
      const ack = await sendChunk({ transferId, index, data });
      assertActive();
      if (ack.transferId !== transferId || ack.index !== index) {
        throw new OneKeyLocalError('Invalid transfer acknowledgement');
      }
      transferredBytes += data.length;
      onProgress(transferredBytes);
      // Bound message frequency even on a local relay; four workers remain
      // in flight to avoid one full round trip per chunk on slow networks.
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(4, count) }, worker));
  } finally {
    stopped = true;
  }
}
