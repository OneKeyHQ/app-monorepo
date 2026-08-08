import { strFromU8, unzipSync } from 'fflate';

import appCrypto from '@onekeyhq/shared/src/appCrypto';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import type {
  IPro2FirmwareUpdateTarget,
  IProtocolV2ResourceArchive,
} from '@onekeyhq/shared/types/device';

import type {
  CoreApi,
  IProtocolV2ResourceManifest,
  ProtocolV2PreparedResourceFile,
} from '@onekeyfe/hd-core';

type IFetchResponse = {
  ok: boolean;
  status: number;
  headers?: {
    get: (name: string) => string | null;
  };
  body?: {
    getReader: () => {
      read: () => Promise<{
        done: boolean;
        value?: Uint8Array;
      }>;
      cancel?: () => Promise<void>;
    };
  } | null;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

type IFetcher = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<IFetchResponse>;

const PROTOCOL_V2_RESOURCE_DOWNLOAD_TIMEOUT_MS = 2 * 60 * 1000;
const MAX_PROTOCOL_V2_RESOURCE_ARCHIVE_BYTES = 64 * 1024 * 1024;
const MAX_PROTOCOL_V2_RESOURCE_FILE_COUNT = 512;
const MAX_PROTOCOL_V2_RESOURCE_FILE_BYTES = 128 * 1024 * 1024;
const MAX_PROTOCOL_V2_RESOURCE_EXTRACTED_BYTES = 256 * 1024 * 1024;
const MAX_PROTOCOL_V2_RESOURCE_MANIFEST_BYTES = 1024 * 1024;

function getManifestArchivePaths(manifest: unknown): string[] {
  if (!manifest || typeof manifest !== 'object') {
    throw new OneKeyLocalError('Invalid Protocol V2 resource manifest');
  }
  const files = (manifest as { files?: unknown }).files;
  if (!Array.isArray(files) || files.length === 0) {
    throw new OneKeyLocalError('Protocol V2 resource manifest has no files');
  }
  if (files.length > MAX_PROTOCOL_V2_RESOURCE_FILE_COUNT) {
    throw new OneKeyLocalError(
      'Protocol V2 resource manifest contains too many files',
    );
  }
  const archivePaths = files.map((file, index) => {
    const archivePath =
      file && typeof file === 'object'
        ? (file as { archive_path?: unknown }).archive_path
        : undefined;
    if (
      typeof archivePath !== 'string' ||
      archivePath.startsWith('/') ||
      archivePath.includes('\\') ||
      archivePath.includes(':') ||
      archivePath
        .split('/')
        .some((part) => !part || part === '.' || part === '..')
    ) {
      throw new OneKeyLocalError(
        `Invalid Protocol V2 resource archive path at files[${index}]`,
      );
    }
    return archivePath;
  });
  if (new Set(archivePaths).size !== archivePaths.length) {
    throw new OneKeyLocalError(
      'Protocol V2 resource manifest contains duplicate archive paths',
    );
  }
  return archivePaths;
}

function validateArchive(archive: IProtocolV2ResourceArchive | undefined) {
  if (!archive?.archiveUrl.startsWith('https://')) {
    throw new OneKeyLocalError(
      'Protocol V2 resource archive URL must use HTTPS',
    );
  }
  if (!/^[a-fA-F0-9]{64}$/u.test(archive.archiveSha256)) {
    throw new OneKeyLocalError('Invalid Protocol V2 resource archive SHA-256');
  }
  if (
    !Number.isSafeInteger(archive.archiveSize) ||
    archive.archiveSize <= 0 ||
    archive.archiveSize > MAX_PROTOCOL_V2_RESOURCE_ARCHIVE_BYTES
  ) {
    throw new OneKeyLocalError('Invalid Protocol V2 resource archive size');
  }
  return archive;
}

async function requireFetchResponse(response: IFetchResponse, url: string) {
  if (!response.ok) {
    throw new OneKeyLocalError(
      `Failed to download Protocol V2 resource (${response.status}): ${url}`,
    );
  }
  return response;
}

function getResponseContentLength(response: IFetchResponse): number | null {
  const header = response.headers?.get('content-length');
  if (!header || !/^\d+$/u.test(header)) {
    return null;
  }
  const length = Number(header);
  return Number.isSafeInteger(length) ? length : null;
}

async function readBoundedArchiveResponse({
  response,
  expectedSize,
}: {
  response: IFetchResponse;
  expectedSize: number;
}): Promise<ArrayBuffer> {
  const contentLength = getResponseContentLength(response);
  if (contentLength !== null && contentLength !== expectedSize) {
    throw new OneKeyLocalError('Protocol V2 resource archive size mismatch');
  }

  const reader = response.body?.getReader();
  if (reader) {
    const binary = new Uint8Array(expectedSize);
    let offset = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!value || offset + value.byteLength > expectedSize) {
        await reader.cancel?.().catch(() => undefined);
        throw new OneKeyLocalError(
          'Protocol V2 resource archive size mismatch',
        );
      }
      binary.set(value, offset);
      offset += value.byteLength;
    }
    if (offset !== expectedSize) {
      throw new OneKeyLocalError('Protocol V2 resource archive size mismatch');
    }
    return binary.buffer;
  }

  if (contentLength === null) {
    throw new OneKeyLocalError(
      'Protocol V2 resource archive response has no bounded body length',
    );
  }
  const binary = await response.arrayBuffer();
  if (binary.byteLength !== expectedSize) {
    throw new OneKeyLocalError('Protocol V2 resource archive size mismatch');
  }
  return binary;
}

async function downloadArchive({
  source,
  fetcher,
  timeoutMs,
}: {
  source: IProtocolV2ResourceArchive;
  fetcher: IFetcher;
  timeoutMs: number;
}): Promise<ArrayBuffer> {
  const abortController = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      abortController.abort();
      reject(
        new OneKeyLocalError('Protocol V2 resource archive download timed out'),
      );
    }, timeoutMs);
  });
  try {
    const downloadPromise = (async () => {
      const response = await requireFetchResponse(
        await fetcher(source.archiveUrl, {
          signal: abortController.signal,
        }),
        source.archiveUrl,
      );
      return readBoundedArchiveResponse({
        response,
        expectedSize: source.archiveSize,
      });
    })();
    return await Promise.race([downloadPromise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function extractResourceArchive(archiveBinary: ArrayBuffer): {
  manifest: unknown;
  archiveFiles: Record<string, Uint8Array>;
} {
  const archiveBytes = new Uint8Array(archiveBinary);
  let archiveFileCount = 0;
  let extractedSize = 0;
  let manifestFiles: Record<string, Uint8Array>;
  try {
    manifestFiles = unzipSync(archiveBytes, {
      filter: (file) => {
        archiveFileCount += 1;
        extractedSize += file.originalSize;
        if (archiveFileCount > MAX_PROTOCOL_V2_RESOURCE_FILE_COUNT) {
          throw new OneKeyLocalError(
            'Protocol V2 resource archive contains too many files',
          );
        }
        if (
          file.originalSize > MAX_PROTOCOL_V2_RESOURCE_FILE_BYTES ||
          extractedSize > MAX_PROTOCOL_V2_RESOURCE_EXTRACTED_BYTES
        ) {
          throw new OneKeyLocalError(
            'Protocol V2 resource archive extracted size exceeds the limit',
          );
        }
        if (
          file.name === 'manifest.json' &&
          file.originalSize > MAX_PROTOCOL_V2_RESOURCE_MANIFEST_BYTES
        ) {
          throw new OneKeyLocalError(
            'Protocol V2 resource manifest exceeds the size limit',
          );
        }
        return file.name === 'manifest.json';
      },
    });
  } catch (error) {
    throw new OneKeyLocalError(
      `Failed to inspect Protocol V2 resource archive: ${String(error)}`,
    );
  }
  const manifestBinary = manifestFiles['manifest.json'];
  if (!manifestBinary) {
    throw new OneKeyLocalError(
      'Protocol V2 resource archive has no manifest.json',
    );
  }

  let manifest: unknown;
  try {
    manifest = JSON.parse(strFromU8(manifestBinary));
  } catch (error) {
    throw new OneKeyLocalError(
      `Invalid Protocol V2 resource manifest JSON: ${String(error)}`,
    );
  }
  const requiredPaths = new Set(getManifestArchivePaths(manifest));
  let archiveFiles: Record<string, Uint8Array>;
  try {
    archiveFiles = unzipSync(archiveBytes, {
      filter: (file) => requiredPaths.has(file.name),
    });
  } catch (error) {
    throw new OneKeyLocalError(
      `Failed to extract Protocol V2 resource archive: ${String(error)}`,
    );
  }
  return { manifest, archiveFiles };
}

export async function prepareProtocolV2ResourceFiles({
  hardwareSDK,
  archive,
  targetsToUpdate,
  fetcher = fetch as IFetcher,
  downloadTimeoutMs = PROTOCOL_V2_RESOURCE_DOWNLOAD_TIMEOUT_MS,
}: {
  hardwareSDK: Pick<CoreApi, 'prepareProtocolV2ResourceFiles'>;
  archive: IProtocolV2ResourceArchive | undefined;
  targetsToUpdate: IPro2FirmwareUpdateTarget[];
  fetcher?: IFetcher;
  downloadTimeoutMs?: number;
}): Promise<ProtocolV2PreparedResourceFile[] | undefined> {
  if (!targetsToUpdate.includes('resource')) {
    return undefined;
  }

  const source = validateArchive(archive);
  const archiveBinary = await downloadArchive({
    source,
    fetcher,
    timeoutMs: downloadTimeoutMs,
  });
  const archiveSha256 = bufferUtils.bytesToHex(
    await appCrypto.hash.sha256(bufferUtils.toBuffer(archiveBinary)),
  );
  if (archiveSha256 !== source.archiveSha256.toLowerCase()) {
    throw new OneKeyLocalError('Protocol V2 resource archive SHA-256 mismatch');
  }

  const { manifest, archiveFiles } = extractResourceArchive(archiveBinary);
  const files = getManifestArchivePaths(manifest).map((archivePath) => {
    const binary = archiveFiles[archivePath];
    if (!binary) {
      throw new OneKeyLocalError(
        `Protocol V2 resource archive is missing ${archivePath}`,
      );
    }
    return {
      archivePath,
      binary: binary.slice().buffer,
    };
  });

  return hardwareSDK.prepareProtocolV2ResourceFiles({
    manifest: manifest as IProtocolV2ResourceManifest,
    files,
    targetsToUpdate,
  });
}
