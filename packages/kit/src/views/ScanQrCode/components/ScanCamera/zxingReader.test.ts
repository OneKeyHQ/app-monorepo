// cspell:ignore zxing ZXING
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

type IZXingModuleOverrides = {
  instantiateWasm: (
    imports: WebAssembly.Imports,
    receiveInstance: (instance: WebAssembly.Instance) => void,
  ) => WebAssembly.Exports | undefined;
};

describe('bundled zxing reader', () => {
  it('matches the wasm build the barcode-detector polyfill expects', () => {
    const { ZXING_WASM_SHA256, ZXING_WASM_VERSION } = jest.requireActual<
      typeof import('barcode-detector/ponyfill')
    >('barcode-detector/ponyfill');
    const wasmPath = require.resolve('zxing-wasm/reader/zxing_reader.wasm');
    const packageJson = JSON.parse(
      fs.readFileSync(
        path.join(path.dirname(wasmPath), '../../package.json'),
        'utf8',
      ),
    ) as { version: string };

    expect(
      createHash('sha256').update(fs.readFileSync(wasmPath)).digest('hex'),
    ).toBe(ZXING_WASM_SHA256);
    expect(packageJson.version).toBe(ZXING_WASM_VERSION);
  });

  it('configures the same barcode-detector copy that expo-camera loads', () => {
    const expoCameraDir = path.dirname(
      require.resolve('expo-camera/package.json'),
    );
    expect(
      require.resolve('barcode-detector', { paths: [expoCameraDir] }),
    ).toBe(require.resolve('barcode-detector'));
  });
});

describe('prepareZXingReader', () => {
  const setZXingModuleOverrides = jest.fn();
  const instance = {} as WebAssembly.Instance;
  const originalFetch = globalThis.fetch;
  const originalXHR = globalThis.XMLHttpRequest;
  let instantiateSpy: jest.SpyInstance;

  function loadReader(wasmUrl: string) {
    let reader: typeof import('./zxingReader') | undefined;
    jest.isolateModules(() => {
      jest.doMock('zxing-wasm/reader/zxing_reader.wasm', () => wasmUrl);
      jest.doMock('barcode-detector/ponyfill', () => ({
        setZXingModuleOverrides,
      }));
      reader =
        jest.requireActual<typeof import('./zxingReader')>('./zxingReader');
    });
    if (!reader) {
      throw new OneKeyLocalError('zxingReader failed to load');
    }
    return reader;
  }

  function setPageUrl(url: string) {
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: new URL(url),
    });
  }

  async function instantiateWithOverride() {
    const overrides = setZXingModuleOverrides.mock
      .calls[0][0] as IZXingModuleOverrides;
    return new Promise<WebAssembly.Instance>((resolve) => {
      overrides.instantiateWasm({}, resolve);
    });
  }

  beforeEach(() => {
    setZXingModuleOverrides.mockReset();
    instantiateSpy = jest.spyOn(WebAssembly, 'instantiate').mockResolvedValue({
      instance,
      module: {} as WebAssembly.Module,
    } as unknown as WebAssembly.Instance);
  });

  afterEach(() => {
    instantiateSpy.mockRestore();
    globalThis.fetch = originalFetch;
    globalThis.XMLHttpRequest = originalXHR;
    delete (globalThis as { BarcodeDetector?: unknown }).BarcodeDetector;
    delete (globalThis as { location?: unknown }).location;
  });

  it('leaves the native BarcodeDetector alone', async () => {
    (globalThis as { BarcodeDetector?: unknown }).BarcodeDetector = {};
    const reader = loadReader('/static/zxing/zxing_reader.wasm');

    expect(reader.isZXingReaderPrepared()).toBe(true);
    await reader.prepareZXingReader();
    expect(setZXingModuleOverrides).not.toHaveBeenCalled();
  });

  it('instantiates the bundled wasm fetched from the app origin', async () => {
    const binary = new ArrayBuffer(8);
    const fetchMock = jest.fn(
      async () =>
        ({
          ok: true,
          arrayBuffer: async () => binary,
        }) as unknown as Response,
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    // Bundlers emit root-relative asset URLs; they resolve against the page.
    setPageUrl('https://app.onekey.so/market');
    const reader = loadReader('/static/zxing/zxing_reader.wasm');

    expect(reader.isZXingReaderPrepared()).toBe(false);
    await reader.prepareZXingReader();
    expect(reader.isZXingReaderPrepared()).toBe(true);

    await expect(instantiateWithOverride()).resolves.toBe(instance);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://app.onekey.so/static/zxing/zxing_reader.wasm',
    );
    expect(instantiateSpy).toHaveBeenCalledWith(binary, {});
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
    const reader = loadReader('/static/zxing/zxing_reader.wasm');

    await reader.prepareZXingReader();
    await expect(instantiateWithOverride()).resolves.toBe(instance);
    expect(opened).toEqual(['file:///static/zxing/zxing_reader.wasm']);
    expect(instantiateSpy).toHaveBeenCalledWith(binary, {});
  });
});
