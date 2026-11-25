// cspell:ignore zxing
import fs from 'fs';
import path from 'path';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

type IConfig = { loadZXingWasm: () => Promise<ArrayBuffer> };

const mockConfigure = jest.fn<void, [IConfig]>();

function loadModule(wasmUrl: string) {
  let loaded: typeof import('./webQrScanner') | undefined;
  jest.isolateModules(() => {
    jest.doMock('zxing-wasm/reader/zxing_reader.wasm', () => wasmUrl);
    jest.doMock('@onekeyfe/react-native-qr-scanner/web', () => ({
      configureWebQrScanner: mockConfigure,
    }));
    loaded =
      jest.requireActual<typeof import('./webQrScanner')>('./webQrScanner');
  });
  if (!loaded) {
    throw new OneKeyLocalError('webQrScanner failed to load');
  }
  return loaded;
}

function setPageUrl(url: string) {
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: new URL(url),
  });
}

describe('bundled zxing reader', () => {
  it('is the zxing-wasm build the scanner SDK expects', () => {
    const sdkPackage = JSON.parse(
      fs.readFileSync(
        require.resolve('@onekeyfe/react-native-qr-scanner/package.json'),
        'utf8',
      ),
    ) as { dependencies: Record<string, string> };
    const wasmPath = require.resolve('zxing-wasm/reader/zxing_reader.wasm');
    const zxingPackage = JSON.parse(
      fs.readFileSync(
        path.join(path.dirname(wasmPath), '../../package.json'),
        'utf8',
      ),
    ) as { version: string };

    expect(zxingPackage.version).toBe(sdkPackage.dependencies['zxing-wasm']);
  });
});

describe('ensureWebQrScannerConfigured', () => {
  const originalFetch = globalThis.fetch;
  const originalXHR = globalThis.XMLHttpRequest;

  afterEach(() => {
    mockConfigure.mockReset();
    globalThis.fetch = originalFetch;
    globalThis.XMLHttpRequest = originalXHR;
    delete (globalThis as { location?: unknown }).location;
  });

  it('configures once and loads nothing until the fallback asks', async () => {
    const binary = new ArrayBuffer(8);
    const fetchMock = jest.fn(
      async () =>
        ({ ok: true, arrayBuffer: async () => binary }) as unknown as Response,
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    // Bundlers emit root-relative asset URLs; they resolve against the page.
    setPageUrl('https://app.onekey.so/market');
    const scanner = loadModule('/static/zxing/zxing_reader.wasm');

    scanner.ensureWebQrScannerConfigured();
    scanner.ensureWebQrScannerConfigured();
    expect(mockConfigure).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();

    await expect(mockConfigure.mock.calls[0][0].loadZXingWasm()).resolves.toBe(
      binary,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://app.onekey.so/static/zxing/zxing_reader.wasm',
    );
  });

  it('reads file:// wasm through XHR for the desktop renderer', async () => {
    const binary = new ArrayBuffer(8);
    const opened: string[] = [];
    class FakeXHR {
      onerror: (() => void) | null = null;

      onload: (() => void) | null = null;

      response: ArrayBuffer = binary;

      responseType = '';

      status = 0;

      open(_method: string, url: string) {
        opened.push(url);
      }

      send() {
        this.onload?.();
      }
    }
    globalThis.XMLHttpRequest = FakeXHR as unknown as typeof XMLHttpRequest;
    setPageUrl('file:///Applications/OneKey.app/Contents/Resources/index.html');
    const scanner = loadModule('/static/zxing/zxing_reader.wasm');

    scanner.ensureWebQrScannerConfigured();
    await expect(mockConfigure.mock.calls[0][0].loadZXingWasm()).resolves.toBe(
      binary,
    );
    expect(opened).toEqual(['file:///static/zxing/zxing_reader.wasm']);
  });
});
