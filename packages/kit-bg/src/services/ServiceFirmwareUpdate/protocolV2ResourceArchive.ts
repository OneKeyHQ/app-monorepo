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
  arrayBuffer: () => Promise<ArrayBuffer>;
};

type IFetcher = (url: string) => Promise<IFetchResponse>;

function getManifestArchivePaths(manifest: unknown): string[] {
  if (!manifest || typeof manifest !== 'object') {
    throw new OneKeyLocalError('Invalid Protocol V2 resource manifest');
  }
  const files = (manifest as { files?: unknown }).files;
  if (!Array.isArray(files) || files.length === 0) {
    throw new OneKeyLocalError('Protocol V2 resource manifest has no files');
  }
  return files.map((file, index) => {
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
  if (!Number.isSafeInteger(archive.archiveSize) || archive.archiveSize <= 0) {
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

export async function prepareProtocolV2ResourceFiles({
  hardwareSDK,
  archive,
  targetsToUpdate,
  fetcher = fetch as IFetcher,
}: {
  hardwareSDK: Pick<CoreApi, 'prepareProtocolV2ResourceFiles'>;
  archive: IProtocolV2ResourceArchive | undefined;
  targetsToUpdate: IPro2FirmwareUpdateTarget[];
  fetcher?: IFetcher;
}): Promise<ProtocolV2PreparedResourceFile[] | undefined> {
  if (!targetsToUpdate.includes('resource')) {
    return undefined;
  }

  const source = validateArchive(archive);
  const response = await requireFetchResponse(
    await fetcher(source.archiveUrl),
    source.archiveUrl,
  );
  const archiveBinary = await response.arrayBuffer();
  if (archiveBinary.byteLength !== source.archiveSize) {
    throw new OneKeyLocalError('Protocol V2 resource archive size mismatch');
  }
  const archiveSha256 = bufferUtils.bytesToHex(
    await appCrypto.hash.sha256(bufferUtils.toBuffer(archiveBinary)),
  );
  if (archiveSha256 !== source.archiveSha256.toLowerCase()) {
    throw new OneKeyLocalError('Protocol V2 resource archive SHA-256 mismatch');
  }

  let archiveFiles: Record<string, Uint8Array>;
  try {
    archiveFiles = unzipSync(new Uint8Array(archiveBinary));
  } catch (error) {
    throw new OneKeyLocalError(
      `Failed to extract Protocol V2 resource archive: ${String(error)}`,
    );
  }
  const manifestBinary = archiveFiles['manifest.json'];
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
