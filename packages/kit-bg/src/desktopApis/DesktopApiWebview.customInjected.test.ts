import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import DesktopApiWebview, {
  parseCustomInjectedProtocols,
} from './DesktopApiWebview';

jest.mock('electron', () => ({
  session: {
    defaultSession: {
      clearStorageData: jest.fn(),
    },
  },
}));

jest.mock('electron-is-dev', () => ({
  __esModule: true,
  default: true,
}));

jest.mock('electron-log/main', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
  },
}));

jest.mock('@onekeyhq/desktop/app/bundle', () => ({
  checkFileHash: jest.fn(),
  getBundleDirPath: jest.fn(),
  getDriveLetter: jest.fn(),
  getMetadata: jest.fn(),
}));

jest.mock('@onekeyhq/desktop/app/libs/store', () => ({
  getUpdateBundleData: jest.fn(() => ({})),
}));

jest.mock('@onekeyhq/desktop/app/resoucePath', () => ({
  getStaticPath: jest.fn(() => '/static'),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  devSettingsPersistAtom: {
    get: jest.fn(async () => ({ enabled: true, settings: {} })),
  },
}));

jest.mock('./injectedDesktopCode.text-js', () => '', { virtual: true });

function registry(protocols: unknown[]) {
  return JSON.stringify({ protocols });
}

describe('DesktopApiWebview custom injection', () => {
  test('filters CEX and unsafe URLs, deduplicates hostnames, and prefers URL overrides', () => {
    const protocols = parseCustomInjectedProtocols(
      registry([
        {
          id: 'uniswap',
          name: 'Uniswap',
          slug: 'uniswap',
          active: true,
          category: 'Dexes',
          totalTvl: 10,
          sourceUrl: 'https://uniswap.org',
          target: {
            resolvedDappUrl: 'https://app.uniswap.org/swap',
            urlOverride: 'https://app.uniswap.org/#/swap',
          },
        },
        {
          id: 'uniswap-duplicate',
          active: true,
          category: 'Dexes',
          sourceUrl: 'https://www.app.uniswap.org/duplicate',
        },
        {
          id: 'cex',
          active: true,
          category: 'CEX',
          sourceUrl: 'https://cex.example',
        },
        {
          id: 'unsafe',
          active: true,
          category: 'Dexes',
          sourceUrl: 'http://127.0.0.1/admin',
        },
        {
          id: '',
          active: true,
          category: 'Dexes',
          sourceUrl: 'https://missing-id.example',
        },
      ]),
    );

    expect(protocols).toHaveLength(1);
    expect(protocols[0]).toEqual(
      expect.objectContaining({
        id: 'uniswap',
        url: 'https://app.uniswap.org/#/swap',
        urlSource: 'override',
      }),
    );
  });

  test('previews and activates only files contained by the workspace', async () => {
    const temporaryRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'onekey-custom-injected-'),
    );
    const workspace = path.join(temporaryRoot, 'workspace');
    await fs.mkdir(workspace);

    const protocolRegistry = 'protocols.json';
    const registryUpdater = 'update.mjs';
    const desktopPreload = 'injectedDesktopPreload.js';
    await Promise.all([
      fs.writeFile(
        path.join(workspace, protocolRegistry),
        registry([
          {
            id: 'uniswap',
            name: 'Uniswap',
            slug: 'uniswap',
            active: true,
            category: 'Dexes',
            sourceUrl: 'https://app.uniswap.org',
            manualReview: { state: 'pending' },
          },
        ]),
      ),
      fs.writeFile(path.join(workspace, registryUpdater), 'console.log("{}");'),
      fs.writeFile(
        path.join(workspace, desktopPreload),
        'console.log("preload");',
      ),
      fs.writeFile(
        path.join(workspace, 'onekey-app-custom-injected.json'),
        JSON.stringify({
          schemaVersion: 1,
          kind: 'onekey-app-custom-injected',
          protocolRegistry,
          registryUpdater,
          desktopPreload,
        }),
      ),
    ]);

    try {
      const api = new DesktopApiWebview({ desktopApi: {} as never });
      const preview = await api.prepareCustomInjectedWorkspace(workspace);
      expect(preview).toEqual(
        expect.objectContaining({
          protocolCount: 1,
          pendingCount: 1,
          protocolRegistry,
          desktopPreload,
        }),
      );

      const session = await api.activateCustomInjectedWorkspace(
        preview.sessionId,
      );
      expect(session.protocols[0]?.id).toBe('uniswap');
      expect(session.preloadUrl).toMatch(
        /^file:.*injectedDesktopPreload\.js\?sha256=[a-f0-9]{64}$/u,
      );

      await fs.writeFile(
        path.join(temporaryRoot, 'outside.json'),
        registry([]),
      );
      await fs.writeFile(
        path.join(workspace, 'onekey-app-custom-injected.json'),
        JSON.stringify({
          schemaVersion: 1,
          kind: 'onekey-app-custom-injected',
          protocolRegistry: '../outside.json',
          registryUpdater,
          desktopPreload,
        }),
      );
      await expect(
        api.prepareCustomInjectedWorkspace(workspace),
      ).rejects.toThrow('protocolRegistry escapes the selected workspace');
    } finally {
      await fs.rm(temporaryRoot, { force: true, recursive: true });
    }
  });
});
