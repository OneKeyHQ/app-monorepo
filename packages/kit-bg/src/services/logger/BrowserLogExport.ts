import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

export const BROWSER_LOG_EXPORT_PAGE_BYTES = 256 * 1024;
const EXPORT_TTL_MS = 2 * 60 * 1000;

type IExportSession = { id: string; blob?: Blob; expiresAt: number };

/** One bounded snapshot per background runtime; never a live cursor across RPCs. */
export class BrowserLogExport {
  private session: IExportSession | undefined;

  private timer: ReturnType<typeof setTimeout> | undefined;

  private touch(session: IExportSession) {
    clearTimeout(this.timer);
    session.expiresAt = Date.now() + EXPORT_TTL_MS;
    this.timer = setTimeout(() => this.close(session.id), EXPORT_TTL_MS);
  }

  async begin(snapshot: (isCancelled: () => boolean) => Promise<Blob>) {
    if (this.session && this.session.expiresAt > Date.now()) {
      throw new OneKeyLocalError('Log export already in progress');
    }
    // Reserve before the first await, including while the snapshot is preparing.
    const session: IExportSession = { id: generateUUID(), expiresAt: 0 };
    this.session = session;
    this.touch(session);
    try {
      const blob = await snapshot(() => this.session !== session);
      if (this.session !== session)
        throw new OneKeyLocalError('Log export cancelled');
      session.blob = blob;
      this.touch(session);
      return { id: session.id, sizeBytes: blob.size };
    } catch (error) {
      this.close(session.id);
      throw error;
    }
  }

  async read({ id, offset }: { id: string; offset: number }) {
    const session = this.session;
    if (
      !session ||
      session.id !== id ||
      !session.blob ||
      session.expiresAt <= Date.now()
    ) {
      throw new OneKeyLocalError('Log export expired');
    }
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      offset > session.blob.size
    ) {
      throw new OneKeyLocalError('Invalid log export offset');
    }
    this.touch(session);
    const bytes = new Uint8Array(
      await session.blob
        .slice(offset, offset + BROWSER_LOG_EXPORT_PAGE_BYTES)
        .arrayBuffer(),
    );
    if (this.session !== session)
      throw new OneKeyLocalError('Log export cancelled');
    return {
      data: bufferUtils.bytesToBase64(bytes),
      nextOffset: offset + bytes.byteLength,
    };
  }

  close(id?: string) {
    if (id && this.session?.id !== id) return;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.session = undefined;
  }
}
