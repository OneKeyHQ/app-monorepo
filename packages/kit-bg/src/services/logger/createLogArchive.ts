import { Zip, ZipDeflate } from 'fflate';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

const COMPRESSION_PAGE_BYTES = 64 * 1024;

/** Yield between small inputs so background writes can continue during compression. */
export async function createLogArchive(
  source: Blob,
  isCancelled: () => boolean = () => false,
): Promise<Blob> {
  const parts: Blob[] = [];
  const state: { finished: boolean; failure?: Error } = { finished: false };
  const archive = new Zip((error, bytes, final) => {
    if (error) {
      state.failure = error;
      return;
    }
    parts.push(new Blob([new Uint8Array(bytes)]));
    state.finished = final;
  });
  const file = new ZipDeflate('OneKeyLogs.txt', { level: 1 });
  archive.add(file);
  try {
    for (
      let offset = 0;
      offset < source.size;
      offset += COMPRESSION_PAGE_BYTES
    ) {
      const bytes = new Uint8Array(
        await source
          .slice(offset, offset + COMPRESSION_PAGE_BYTES)
          .arrayBuffer(),
      );
      if (isCancelled()) throw new OneKeyLocalError('Log export cancelled');
      file.push(bytes);
      if (state.failure) throw state.failure;
    }
    if (isCancelled()) throw new OneKeyLocalError('Log export cancelled');
    file.push(new Uint8Array(), true);
    archive.end();
    if (state.failure) throw state.failure;
    if (!state.finished) throw new OneKeyLocalError('Log archive incomplete');
    return new Blob(parts, { type: 'application/zip' });
  } finally {
    archive.terminate();
  }
}
