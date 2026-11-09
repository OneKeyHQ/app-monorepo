import { createHash } from 'crypto';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { createLogArchive } from '@onekeyhq/kit-bg/src/services/logger/createLogArchive';

import { collectBrowserLogDigest } from './collectBrowserLogDigest';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceLogger: {
      beginLogExport: jest.fn(),
      readLogExportPage: jest.fn(),
      closeLogExport: jest.fn(),
    },
  },
}));
jest.mock('@onekeyhq/shared/src/errors', () => ({ OneKeyLocalError: Error }));

describe('browser diagnostic log digest', () => {
  const service = backgroundApiProxy.serviceLogger;
  const begin = jest.spyOn(service, 'beginLogExport');
  const read = jest.spyOn(service, 'readLogExportPage');
  const close = jest.spyOn(service, 'closeLogExport');

  beforeEach(() => {
    jest.clearAllMocks();
    close.mockResolvedValue(undefined);
  });

  it('hashes and exports the final ZIP bytes, including its directory and footer', async () => {
    const archive = await createLogArchive(
      new Blob(['old\r\n日志🙂\r\nnew\r\n'.repeat(100)]),
    );
    const bytes = Buffer.from(await archive.arrayBuffer());
    begin.mockResolvedValue({ id: 'snapshot', sizeBytes: bytes.length });
    read.mockImplementation(async ({ offset }) => {
      const page = bytes.subarray(offset, offset + 17);
      return {
        data: page.toString('base64'),
        nextOffset: offset + page.length,
      };
    });
    const digest = await collectBrowserLogDigest('test');
    expect(digest.sha256).toBe(
      createHash('sha256').update(bytes).digest('hex'),
    );
    expect(digest.sizeBytes).toBe(bytes.length);
    if (digest.bundle.type !== 'blob')
      throw new TypeError('Expected blob bundle');
    expect(digest.bundle.fileName).toBe('test.zip');
    expect(digest.bundle.mimeType).toBe('application/zip');
    expect(Buffer.from(await digest.bundle.blob.arrayBuffer())).toEqual(bytes);
    expect(digest.bundle).not.toHaveProperty('content');
    expect(close).toHaveBeenCalledWith({ id: 'snapshot' });
    expect(begin).toHaveBeenCalledWith({ scope: 'recent' });
    await collectBrowserLogDigest('test-full', 'full');
    expect(begin).toHaveBeenLastCalledWith({ scope: 'full' });
  });

  it('closes the snapshot on a failed page and preserves the original failure', async () => {
    begin.mockResolvedValue({ id: 'snapshot', sizeBytes: 100 });
    read.mockRejectedValue(new Error('worker stopped'));
    close.mockRejectedValue(new Error('worker unavailable'));
    await expect(collectBrowserLogDigest('test')).rejects.toThrow(
      'worker stopped',
    );
    expect(close).toHaveBeenCalledWith({ id: 'snapshot' });
  });
});
