export const PRIME_TRANSFER_CHUNK_SIZE = 64 * 1024;
// v1 uses fixed-size chunks. Reserve the relay's full packet allowance for the
// bridge envelope and Socket.IO framing before choosing chunked transport.
export const PRIME_TRANSFER_CHUNK_PACKET_SIZE =
  PRIME_TRANSFER_CHUNK_SIZE + 8 * 1024;
export const PRIME_TRANSFER_MAX_PAYLOAD_SIZE = 64 * 1024 * 1024;
export const PRIME_TRANSFER_MAX_CHUNKS = Math.ceil(
  PRIME_TRANSFER_MAX_PAYLOAD_SIZE / PRIME_TRANSFER_CHUNK_SIZE,
);
export const PRIME_TRANSFER_CHUNK_TIMEOUT = 120_000;

export type IPrimeTransferTransportMode = 'auto' | 'legacy';

export type IPrimeTransferNetworkProgress = {
  transferId: string;
  direction: 'sending' | 'receiving';
  transferredBytes: number;
  totalBytes: number;
};

export type IPrimeTransferChunkManifest = {
  transferId: string;
  totalBytes: number;
};

export type IPrimeTransferChunk = {
  transferId: string;
  index: number;
  data: string;
};

export type IPrimeTransferChunkAck = {
  transferId: string;
  index: number;
  receivedBytes: number;
};
