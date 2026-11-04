import { xmrHostFetch } from './hostFetch.desktop';

const desktopGlobal = globalThis as unknown as {
  desktopApi?: Pick<typeof globalThis.desktopApi, 'privacyChainNodeRequest'>;
};
const originalApi = desktopGlobal.desktopApi;

afterEach(() => {
  if (originalApi) desktopGlobal.desktopApi = originalApi;
  else delete desktopGlobal.desktopApi;
  jest.restoreAllMocks();
});

it('relays the binary request and reconstructs returned bytes', async () => {
  const privacyChainNodeRequest = jest.fn(async () => ({
    ok: true as const,
    bytes: new Uint8Array([7, 8]),
  }));
  desktopGlobal.desktopApi = { privacyChainNodeRequest };
  const body = new Uint8Array([1, 2]);
  await expect(
    xmrHostFetch(
      'http://node.example/get_blocks.bin',
      'application/octet-stream',
      body,
    ),
  ).resolves.toEqual(new Uint8Array([7, 8]));
  expect(privacyChainNodeRequest).toHaveBeenCalledWith({
    url: 'http://node.example/get_blocks.bin',
    contentType: 'application/octet-stream',
    body,
  });
});

it('reports a missing shell relay without falling back to renderer fetch', async () => {
  delete desktopGlobal.desktopApi;
  const rendererFetch = jest.spyOn(globalThis, 'fetch');
  await expect(
    xmrHostFetch(
      'https://node.example/get_height',
      'application/json',
      new Uint8Array(),
    ),
  ).rejects.toThrow('main-process request channel');
  expect(rendererFetch).not.toHaveBeenCalled();
});

it('reports the main-process network failure without retrying elsewhere', async () => {
  desktopGlobal.desktopApi = {
    privacyChainNodeRequest: jest.fn(async () => ({
      ok: false as const,
      error: 'TLS failure',
    })),
  };
  const rendererFetch = jest.spyOn(globalThis, 'fetch');
  await expect(
    xmrHostFetch(
      'https://node.example/get_height',
      'application/json',
      new Uint8Array(),
    ),
  ).rejects.toThrow('TLS failure');
  expect(rendererFetch).not.toHaveBeenCalled();
});
