import {
  BROWSER_LOG_EXPORT_PAGE_BYTES,
  BrowserLogExport,
} from './BrowserLogExport';

jest.mock('@onekeyhq/shared/src/errors', () => ({ OneKeyLocalError: Error }));
jest.mock('@onekeyhq/shared/src/utils/miscUtils', () => ({
  generateUUID: () => String(Math.random()),
}));

describe('browser log export snapshots', () => {
  afterEach(() => jest.useRealTimers());

  it('preserves UTF-8 bytes across bounded pages even when page boundaries split a character', async () => {
    const exporter = new BrowserLogExport();
    const text = `${'x'.repeat(BROWSER_LOG_EXPORT_PAGE_BYTES - 1)}日志🙂\r\n`;
    const snapshot = await exporter.begin(async () => new Blob([text]));
    const parts: Buffer[] = [];
    let offset = 0;
    while (offset < snapshot.sizeBytes) {
      const page = await exporter.read({ id: snapshot.id, offset });
      const bytes = Buffer.from(page.data, 'base64');
      expect(bytes.byteLength).toBeLessThanOrEqual(
        BROWSER_LOG_EXPORT_PAGE_BYTES,
      );
      parts.push(bytes);
      offset = page.nextOffset;
    }
    expect(Buffer.concat(parts).toString('utf8')).toBe(text);
    exporter.close();
  });

  it('reserves the only snapshot before async preparation and cancels a late result on reset', async () => {
    const exporter = new BrowserLogExport();
    let finish!: (blob: Blob) => void;
    const first = exporter.begin(
      () =>
        new Promise<Blob>((resolve) => {
          finish = resolve;
        }),
    );
    await expect(exporter.begin(async () => new Blob())).rejects.toThrow(
      'already in progress',
    );
    exporter.close();
    finish(new Blob(['old']));
    await expect(first).rejects.toThrow('cancelled');
    const next = await exporter.begin(async () => new Blob(['new']));
    expect(next.sizeBytes).toBe(3);
    exporter.close();
  });

  it('expires abandoned snapshots and rejects invalid offsets without affecting a new session', async () => {
    jest.useFakeTimers();
    const exporter = new BrowserLogExport();
    const first = await exporter.begin(async () => new Blob(['first']));
    await expect(exporter.read({ id: first.id, offset: -1 })).rejects.toThrow(
      'Invalid',
    );
    jest.advanceTimersByTime(120_001);
    await expect(exporter.read({ id: first.id, offset: 0 })).rejects.toThrow(
      'expired',
    );
    const next = await exporter.begin(async () => new Blob(['next']));
    exporter.close(first.id);
    expect((await exporter.read({ id: next.id, offset: 0 })).nextOffset).toBe(
      4,
    );
    exporter.close();
  });
});
