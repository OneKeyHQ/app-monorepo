import { sha256 } from '@noble/hashes/sha256';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  ILogDigest,
  ILogExportScope,
} from '@onekeyhq/shared/src/logger/types';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

export async function collectBrowserLogDigest(
  fileBaseName: string,
  scope: ILogExportScope = 'recent',
): Promise<ILogDigest> {
  const service = backgroundApiProxy.serviceLogger;
  const snapshot = await service.beginLogExport({ scope });
  const hash = sha256.create();
  const parts: Blob[] = [];
  let offset = 0;
  try {
    while (offset < snapshot.sizeBytes) {
      const page = await service.readLogExportPage({ id: snapshot.id, offset });
      const bytes = new Uint8Array(bufferUtils.base64ToBytes(page.data));
      if (
        !bytes.byteLength ||
        page.nextOffset !== offset + bytes.byteLength ||
        page.nextOffset > snapshot.sizeBytes
      ) {
        throw new OneKeyLocalError('Invalid log export page');
      }
      hash.update(bytes);
      parts.push(new Blob([bytes]));
      offset = page.nextOffset;
    }
    return {
      sizeBytes: offset,
      sha256: bufferUtils.bytesToHex(hash.digest()),
      bundle: {
        type: 'blob',
        fileName: `${fileBaseName}.zip`,
        mimeType: 'application/zip',
        blob: new Blob(parts, { type: 'application/zip' }),
      },
    };
  } finally {
    hash.destroy();
    // Losing the worker during export must not mask the original error.
    await service.closeLogExport({ id: snapshot.id }).catch(() => {});
  }
}
