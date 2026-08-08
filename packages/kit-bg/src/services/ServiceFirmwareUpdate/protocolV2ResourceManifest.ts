import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IPro2FirmwareUpdateTarget } from '@onekeyhq/shared/types/device';

import type {
  CoreApi,
  IProtocolV2ResourceManifest,
  ProtocolV2PreparedResourceFile,
} from '@onekeyfe/hd-core';

type IFetchResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
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
  manifestUrl,
  targetsToUpdate,
  fetcher = fetch as IFetcher,
}: {
  hardwareSDK: Pick<CoreApi, 'prepareProtocolV2ResourceFiles'>;
  manifestUrl: string;
  targetsToUpdate: IPro2FirmwareUpdateTarget[];
  fetcher?: IFetcher;
}): Promise<ProtocolV2PreparedResourceFile[] | undefined> {
  const hasResourceTarget = targetsToUpdate.some(
    (target) => target === 'resource' || target === 'boot_resources',
  );
  if (!hasResourceTarget) {
    return undefined;
  }
  if (!manifestUrl.startsWith('https://')) {
    throw new OneKeyLocalError(
      'Protocol V2 resource manifest URL must use HTTPS',
    );
  }

  const manifestResponse = await requireFetchResponse(
    await fetcher(manifestUrl),
    manifestUrl,
  );
  const manifest = await manifestResponse.json();
  const archivePaths = getManifestArchivePaths(manifest);
  const files = await Promise.all(
    archivePaths.map(async (archivePath) => {
      const fileUrl = new URL(archivePath, manifestUrl).toString();
      const response = await requireFetchResponse(
        await fetcher(fileUrl),
        fileUrl,
      );
      return {
        archivePath,
        binary: await response.arrayBuffer(),
      };
    }),
  );

  return hardwareSDK.prepareProtocolV2ResourceFiles({
    manifest: manifest as IProtocolV2ResourceManifest,
    files,
    targetsToUpdate,
  });
}
