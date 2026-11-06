import { servePrivacyChainWorker } from './privacyChainWorkerClient';

describe('privacy chain worker dispatch', () => {
  const scope = globalThis as unknown as {
    onmessage: ((event: { data: unknown }) => void) | null;
    postMessage: (message: unknown) => void;
  };
  const originalPostMessage = scope.postMessage;
  const scan = jest.fn(async (height: number) => height + 1);

  beforeEach(() => {
    servePrivacyChainWorker({
      label: 'test',
      methods: ['scan', 'version', 'toString', 'missing'],
      loadApi: async () => ({ scan, version: 1 }),
    });
  });

  afterEach(() => {
    scope.postMessage = originalPostMessage;
    scope.onmessage = null;
    scan.mockClear();
  });

  const call = (method: string, args: unknown[] = []) =>
    new Promise<{ ok: boolean; result?: unknown; error?: { message: string } }>(
      (resolve) => {
        scope.postMessage = (message) =>
          resolve(
            message as {
              ok: boolean;
              result?: unknown;
              error?: { message: string };
            },
          );
        scope.onmessage?.({ data: { id: 1, method, args } });
      },
    );

  it('calls an own function of the api', async () => {
    await expect(call('scan', [41])).resolves.toMatchObject({
      ok: true,
      result: 42,
    });
    expect(scan).toHaveBeenCalledWith(41);
  });

  it.each(['toString', 'version', 'missing'])(
    'rejects %s, which is listed but not an own function',
    async (method) => {
      await expect(call(method)).resolves.toMatchObject({
        ok: false,
        error: { message: `test worker: unknown method ${method}` },
      });
      expect(scan).not.toHaveBeenCalled();
    },
  );
});
