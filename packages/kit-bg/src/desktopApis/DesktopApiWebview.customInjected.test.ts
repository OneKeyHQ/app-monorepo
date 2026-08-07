import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { dialog, webContents } from 'electron';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import DesktopApiWebview from './DesktopApiWebview';

jest.mock('electron', () => ({
  dialog: {
    showOpenDialog: jest.fn(),
  },
  session: {
    defaultSession: {
      clearStorageData: jest.fn(),
    },
  },
  webContents: {
    fromId: jest.fn(),
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

jest.mock('./injectedDesktopCode.text-js', () => '', { virtual: true });

function registry(protocols: unknown[]) {
  return JSON.stringify({ protocols });
}

async function installWorkspaceCli(workspace: string): Promise<void> {
  const directory = path.join(
    workspace,
    'packages/connect-button-workbench/src/cli',
  );
  await fs.mkdir(directory, { recursive: true });
  await fs.copyFile(
    path.join(__dirname, '__fixtures__/customInjectedWorkspaceCli.mjs'),
    path.join(directory, 'custom-injected-workspace.mjs'),
  );
}

async function waitForFile(file: string): Promise<void> {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    try {
      await fs.access(file);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  throw new OneKeyLocalError(`Timed out waiting for ${file}`);
}

async function captureCodeCommand(
  temporaryRoot: string,
  action: () => Promise<void>,
): Promise<{ argumentCount: string; directory: string }> {
  const binDirectory = path.join(temporaryRoot, 'bin');
  const outputFile = path.join(temporaryRoot, 'code-command.txt');
  const commandFile = path.join(binDirectory, 'code');
  await fs.mkdir(binDirectory, { recursive: true });
  await fs.writeFile(
    commandFile,
    [
      '#!/bin/sh',
      `printf '%s\\n%s\\n' "$#" "$1" > ${JSON.stringify(outputFile)}`,
      '',
    ].join('\n'),
  );
  await fs.chmod(commandFile, 0o700);
  const previousPath = process.env.PATH;
  process.env.PATH = `${binDirectory}${path.delimiter}${previousPath || ''}`;
  try {
    await action();
    const [argumentCount = '', directory = ''] = (
      await fs.readFile(outputFile, 'utf8')
    )
      .trimEnd()
      .split('\n');
    return { argumentCount, directory };
  } finally {
    if (previousPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = previousPath;
    }
  }
}

describe('DesktopApiWebview custom injection', () => {
  test('toggles WebView DevTools without reloading the guest', async () => {
    const api = new DesktopApiWebview({ desktopApi: {} as never });
    const closeDevTools = jest.fn();
    const focus = jest.fn();
    const openDevTools = jest.fn();
    const guest = {
      closeDevTools,
      devToolsWebContents: {
        focus,
      },
      getType: jest.fn(() => 'webview'),
      isDestroyed: jest.fn(() => false),
      isDevToolsOpened: jest.fn(() => false),
      openDevTools,
    };
    jest.spyOn(webContents, 'fromId').mockReturnValue(guest as never);

    await expect(api.toggleDevTools(42, false)).rejects.toThrow(
      'WebView DevTools require enabled developer settings',
    );
    await expect(api.toggleDevTools(42, true)).resolves.toBe('opened');
    expect(openDevTools).toHaveBeenCalledWith({
      activate: true,
      mode: 'detach',
    });
    expect(closeDevTools).not.toHaveBeenCalled();
    expect(focus).toHaveBeenCalledTimes(1);

    guest.isDevToolsOpened.mockReturnValue(true);
    await expect(api.toggleDevTools(42, true)).resolves.toBe('closed');
    expect(openDevTools).toHaveBeenCalledTimes(1);
    expect(closeDevTools).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledTimes(1);
  });

  test('selects a workspace directory only when developer settings are enabled', async () => {
    const api = new DesktopApiWebview({ desktopApi: {} as never });
    await expect(
      api.selectCustomInjectedWorkspace('/workspace', false),
    ).rejects.toThrow('enabled developer settings');

    const showOpenDialog = jest.spyOn(dialog, 'showOpenDialog');
    showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/workspace'],
    });
    await expect(
      api.selectCustomInjectedWorkspace('/workspace', true),
    ).resolves.toBe('/workspace');
    expect(showOpenDialog).toHaveBeenCalledWith({
      title: 'Select cross-inpage-provider workspace',
      defaultPath: '/workspace',
      properties: ['openDirectory'],
    });
  });

  test('loads multiple protocol sources without collapsing duplicate IDs', async () => {
    const temporaryRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'onekey-custom-injected-sources-'),
    );
    const workspace = path.join(temporaryRoot, 'workspace');
    await fs.mkdir(workspace);
    const updater = 'update.mjs';
    const refresher = 'refresh.mjs';
    await Promise.all([
      fs.writeFile(
        path.join(workspace, 'defillama.json'),
        registry([
          {
            id: 'shared',
            name: 'Shared DeFiLlama',
            slug: 'shared',
            sourceUrl: 'https://defillama-shared.example',
          },
        ]),
      ),
      fs.writeFile(
        path.join(workspace, 'custom.json'),
        registry([
          {
            id: 'shared',
            name: 'Shared Custom',
            slug: 'shared',
            sourceUrl: 'https://custom-shared.example',
          },
        ]),
      ),
      fs.writeFile(path.join(workspace, updater), 'process.exit(0);'),
      fs.writeFile(path.join(workspace, refresher), 'process.exit(0);'),
      fs.writeFile(
        path.join(workspace, 'preload.js'),
        'console.log("preload");',
      ),
      fs.writeFile(
        path.join(workspace, 'onekey-app-custom-injected.json'),
        JSON.stringify({
          schemaVersion: 3,
          kind: 'onekey-app-custom-injected',
          protocolSources: [
            {
              source: 'defillama',
              protocolRegistry: 'defillama.json',
              registryUpdater: updater,
              registryRefresher: refresher,
            },
            {
              source: 'custom',
              protocolRegistry: 'custom.json',
              registryUpdater: updater,
            },
          ],
          desktopPreload: 'preload.js',
          dappsDirectory: 'dapps',
        }),
      ),
    ]);
    await installWorkspaceCli(workspace);

    try {
      const api = new DesktopApiWebview({ desktopApi: {} as never });
      const preview = await api.prepareCustomInjectedWorkspace(workspace, true);
      expect(preview.protocolSources).toEqual([
        {
          source: 'defillama',
          protocolRegistry: 'defillama.json',
          registryRefresher: refresher,
        },
        {
          source: 'custom',
          protocolRegistry: 'custom.json',
          registryRefresher: null,
        },
      ]);
      const session = await api.activateCustomInjectedWorkspace(
        preview.sessionId,
      );
      expect(session.sources).toEqual(['defillama', 'custom']);
      expect(session.protocols.map(({ key }) => key).toSorted()).toEqual([
        'custom:shared',
        'defillama:shared',
      ]);
      const controlledPreload = await api.prepareCustomInjectedE2EPreload({
        sessionId: session.sessionId,
        bundleSha256: session.bundleSha256,
        mode: 'disabled',
        token: 'clean-session-control-token',
      });
      const controlledPreloadFile = fileURLToPath(controlledPreload.preloadUrl);
      await expect(fs.readFile(controlledPreloadFile, 'utf8')).resolves.toContain(
        '__ONEKEY_CONNECT_BUTTON_HACK_PRELOAD_CONTROL__',
      );
      const focus = jest.fn();
      const guest = {
        focus,
        getType: jest.fn(() => 'webview'),
        getURL: jest.fn(() => 'https://custom-shared.example/connect'),
        isDestroyed: jest.fn(() => false),
        isFocused: jest.fn(() => true),
        session: {
          getPartition: jest.fn(() => 'onekey-custom-e2e-test123'),
          isPersistent: jest.fn(() => false),
        },
      };
      jest.spyOn(webContents, 'fromId').mockReturnValue(guest as never);
      await expect(
        api.focusCustomInjectedE2EWebView({
          sessionId: session.sessionId,
          protocolId: 'custom:shared',
          pageUrl: 'https://custom-shared.example/connect',
          webContentsId: 42,
        }),
      ).resolves.toEqual({ focused: true, webContentsId: 42 });
      expect(focus).toHaveBeenCalledTimes(1);
      await expect(
        api.prepareCustomInjectedE2EPreload({
          sessionId: session.sessionId,
          bundleSha256: session.bundleSha256,
          mode: 'disabled',
          token: 'short',
        }),
      ).rejects.toThrow('adapter control is invalid');
      await expect(
        api.getCustomInjectedE2EState(session.sessionId, 'shared'),
      ).rejects.toThrow('protocol not found');
      await expect(
        api.getCustomInjectedE2EState(session.sessionId, 'custom:shared'),
      ).resolves.toEqual({
        recording: null,
        e2e: null,
        adapter: null,
        canValidate: false,
      });
      await api.closeCustomInjectedWorkspace(session.sessionId);
      await expect(fs.access(controlledPreloadFile)).rejects.toThrow();
    } finally {
      await fs.rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  test('generates a validated E2E after saving a recording', async () => {
    const temporaryRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'onekey-custom-injected-generator-'),
    );
    const workspace = path.join(temporaryRoot, 'workspace');
    const generator = 'generate-e2e.mjs';
    await fs.mkdir(workspace);
    await Promise.all([
      fs.writeFile(
        path.join(workspace, 'protocols.json'),
        registry([
          {
            id: 'uniswap',
            name: 'Uniswap',
            slug: 'uniswap',
            sourceUrl: 'https://app.uniswap.org',
            manualReview: {
              state: 'processed',
              reviewedAt: '2026-08-05T00:00:00.000Z',
              reviewedUrl: 'https://app.uniswap.org',
              injectedBundleSha256: 'b'.repeat(64),
            },
          },
        ]),
      ),
      fs.writeFile(
        path.join(workspace, 'update.mjs'),
        [
          "import fs from 'node:fs';",
          'const arg = (name) => process.argv[process.argv.indexOf(name) + 1];',
          "const file = arg('--file');",
          "const value = JSON.parse(fs.readFileSync(file, 'utf8'));",
          "const protocol = value.protocols.find((item) => item.id === arg('--protocol-id'));",
          "protocol.manualReview = { state: arg('--state') };",
          "fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\\n');",
        ].join('\n'),
      ),
      fs.writeFile(
        path.join(workspace, 'preload.js'),
        'console.log("preload");',
      ),
      fs.writeFile(
        path.join(workspace, generator),
        [
          "import crypto from 'node:crypto';",
          "import fs from 'node:fs';",
          "import path from 'node:path';",
          "const protocol = JSON.parse(fs.readFileSync('protocols.json', 'utf8')).protocols[0];",
          "if (protocol.manualReview?.state !== 'pending') throw new Error('validation must start pending');",
          "const file = process.argv[process.argv.indexOf('--file') + 1];",
          'const content = fs.readFileSync(file);',
          "const recording = JSON.parse(content.toString('utf8'));",
          "const recordingSha256 = crypto.createHash('sha256').update(content).digest('hex');",
          "const relativeFile = path.join(path.dirname(file), 'e2e.mjs').split(path.sep).join('/');",
          'fs.writeFileSync(relativeFile, [',
          "  '// ../../../src/lib/desktop-recording-e2e.mjs',",
          '  "const testCase = { kind: \'onekey-connect-button-desktop-e2e\'," ,',
          "  \"  source: 'defillama', protocolId: 'uniswap', site: 'app.uniswap.org',\" ,",
          `  \`  recordingSha256: '\${recordingSha256}' };\`,`,
          "].join('\\n'));",
          "process.stdout.write(JSON.stringify({ schemaVersion: 1, kind: 'onekey-connect-button-e2e-generation-result', ok: true, source: recording.protocol.source, protocolId: recording.protocol.id, recordingSha256, actionCount: 2, validated: true, validationPasses: 2, relativeFile }));",
        ].join('\n'),
      ),
      fs.writeFile(
        path.join(workspace, 'onekey-app-custom-injected.json'),
        JSON.stringify({
          schemaVersion: 3,
          kind: 'onekey-app-custom-injected',
          protocolSources: [
            {
              source: 'defillama',
              protocolRegistry: 'protocols.json',
              registryUpdater: 'update.mjs',
            },
          ],
          desktopPreload: 'preload.js',
          dappsDirectory: 'dapps',
          recordingE2EGenerator: generator,
        }),
      ),
    ]);
    await installWorkspaceCli(workspace);

    try {
      const api = new DesktopApiWebview({ desktopApi: {} as never });
      const preview = await api.prepareCustomInjectedWorkspace(workspace, true);
      const session = await api.activateCustomInjectedWorkspace(
        preview.sessionId,
      );
      const guest = {
        getType: jest.fn(() => 'webview'),
        getURL: jest.fn(() => 'https://app.uniswap.org/swap'),
        isDestroyed: jest.fn(() => false),
        session: { isPersistent: jest.fn(() => false) },
      };
      jest.spyOn(webContents, 'fromId').mockReturnValue(guest as never);
      const saved = await api.saveCustomInjectedRecording({
        sessionId: session.sessionId,
        protocolId: 'uniswap',
        pageUrl: 'https://app.uniswap.org/swap',
        webContentsId: 42,
        bundleSha256: session.bundleSha256,
        expectedRegistrySha256: session.protocols[0]?.registrySha256 ?? '',
        devSettingsEnabled: true,
        customInjectionEnabled: true,
        recording: {
          schemaVersion: 1,
          kind: 'onekey-connect-button-recording-capture',
          startedAt: '2026-08-05T00:00:00.000Z',
          finishedAt: '2026-08-05T00:00:02.000Z',
          initialUrl: 'https://app.uniswap.org/',
          finalUrl: 'https://app.uniswap.org/swap',
          title: 'Uniswap',
          viewport: { width: 1280, height: 720, deviceScaleFactor: 1 },
          outcome: { kind: 'repository-wallet-icon', afterStep: 1 },
          steps: [
            {
              action: 'click',
              elapsedMs: 1000,
              pageUrl: 'https://app.uniswap.org/swap',
              target: {
                tag: 'button',
                text: 'Connect Wallet',
                role: 'button',
                ariaLabel: null,
                selectors: [
                  {
                    kind: 'testId',
                    value: 'connect-wallet',
                    unique: true,
                  },
                ],
              },
            },
          ],
        },
      });

      const generation = await api.generateCustomInjectedE2E(
        session.sessionId,
        'uniswap',
      );
      expect(generation).toEqual({
        ok: true,
        relativeFile: 'dapps/defillama/uniswap/e2e.mjs',
        recordingSha256: saved.sha256,
        actionCount: 2,
        validated: true,
        validationPasses: 2,
      });
      await expect(
        api.getCustomInjectedWorkspace(session.sessionId),
      ).resolves.toEqual(
        expect.objectContaining({
          protocols: [
            expect.objectContaining({
              manualReview: expect.objectContaining({ state: 'pending' }),
            }),
          ],
        }),
      );
      await expect(
        api.getCustomInjectedE2EState(session.sessionId, 'uniswap'),
      ).resolves.toEqual(
        expect.objectContaining({
          e2e: expect.objectContaining({
            current: true,
            recordingSha256: saved.sha256,
          }),
          canValidate: true,
        }),
      );
      const cancellationMarker = path.join(
        temporaryRoot,
        'generation-cancellation-ready',
      );
      await fs.writeFile(
        path.join(workspace, generator),
        [
          "import fs from 'node:fs';",
          `fs.writeFileSync(${JSON.stringify(cancellationMarker)}, 'ready');`,
          'setInterval(() => undefined, 1_000);',
          'await new Promise(() => undefined);',
        ].join('\n'),
      );
      const cancelledGeneration = api.generateCustomInjectedE2E(
        session.sessionId,
        'uniswap',
      );
      await waitForFile(cancellationMarker);
      await expect(
        api.stopCustomInjectedE2EGeneration(session.sessionId, 'uniswap'),
      ).resolves.toEqual({ stopped: true });
      await expect(cancelledGeneration).resolves.toEqual({
        ok: false,
        cancelled: true,
        error: 'E2E generation stopped by user',
      });
      await expect(
        api.stopCustomInjectedE2EGeneration(session.sessionId, 'uniswap'),
      ).resolves.toEqual({ stopped: false });
      await expect(
        api.getCustomInjectedRecentOperationLogs(session.sessionId),
      ).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            operation: 'e2e.generate.stop',
            status: 'error',
            result: expect.objectContaining({ stopped: false }),
          }),
        ]),
      );
      await api.closeCustomInjectedWorkspace(session.sessionId);
    } finally {
      await fs.rm(temporaryRoot, { force: true, recursive: true });
    }
  });

  test('previews and activates only files contained by the workspace', async () => {
    const temporaryRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'onekey-custom-injected-'),
    );
    const workspace = path.join(temporaryRoot, 'workspace');
    await fs.mkdir(workspace);

    const protocolRegistry = 'protocols.json';
    const registryUpdater = 'update.mjs';
    const registryRefresher = 'refresh.mjs';
    const desktopPreload = 'injectedDesktopPreload.js';
    const dappSource = 'defillama';
    const dappsDirectory = 'dapps';
    await Promise.all([
      fs.writeFile(
        path.join(workspace, protocolRegistry),
        registry([
          {
            id: 'uniswap',
            name: 'Uniswap',
            slug: 'uniswap',
            sourceUrl: 'https://app.uniswap.org',
            manualReview: { state: 'pending' },
          },
        ]),
      ),
      fs.writeFile(
        path.join(workspace, registryUpdater),
        [
          "import fs from 'node:fs';",
          'const arg = (name) => process.argv[process.argv.indexOf(name) + 1];',
          "const file = arg('--file');",
          "const value = JSON.parse(fs.readFileSync(file, 'utf8'));",
          "const protocol = value.protocols.find((item) => item.id === arg('--protocol-id'));",
          'protocol.manualReview = {',
          "  state: arg('--state'),",
          "  reviewedAt: '2026-07-31T00:00:00.000Z',",
          "  reviewedUrl: arg('--reviewed-url'),",
          "  injectedBundleSha256: arg('--bundle-sha256'),",
          '};',
          "fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\\n');",
        ].join('\n'),
      ),
      fs.writeFile(
        path.join(workspace, registryRefresher),
        [
          "import fs from 'node:fs';",
          "const fileIndex = process.argv.indexOf('--file');",
          'const file = process.argv[fileIndex + 1];',
          "const value = JSON.parse(fs.readFileSync(file, 'utf8'));",
          'value.protocols[0].totalTvl = 123;',
          "fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\\n');",
        ].join('\n'),
      ),
      fs.writeFile(
        path.join(workspace, desktopPreload),
        'console.log("preload");',
      ),
      fs.writeFile(
        path.join(workspace, 'onekey-app-custom-injected.json'),
        JSON.stringify({
          schemaVersion: 2,
          kind: 'onekey-app-custom-injected',
          protocolRegistry,
          registryUpdater,
          registryRefresher,
          desktopPreload,
          dappSource,
          dappsDirectory,
        }),
      ),
    ]);
    await installWorkspaceCli(workspace);

    try {
      const api = new DesktopApiWebview({ desktopApi: {} as never });
      await expect(
        api.prepareCustomInjectedWorkspace(workspace, false),
      ).rejects.toThrow('enabled developer settings');

      const preview = await api.prepareCustomInjectedWorkspace(workspace, true);
      expect(preview).toEqual(
        expect.objectContaining({
          protocolCount: 1,
          pendingCount: 1,
          protocolSources: [
            {
              source: dappSource,
              protocolRegistry,
              registryRefresher,
            },
          ],
          desktopPreload,
          dappsDirectory,
        }),
      );

      const session = await api.activateCustomInjectedWorkspace(
        preview.sessionId,
      );
      expect(session.sources).toEqual([dappSource]);
      expect(session.protocols[0]?.key).toBe('defillama:uniswap');
      expect(session.protocols[0]?.source).toBe(dappSource);
      expect(session.protocols[0]?.id).toBe('uniswap');
      expect(session.protocols[0]?.totalTvl).toBe(0);
      const uniswapDappDirectory = path.join(
        workspace,
        dappsDirectory,
        dappSource,
        'uniswap',
      );
      const resolvedDappDirectory = await api.getCustomInjectedDappDirectory(
        session.sessionId,
        'defillama:uniswap',
      );
      expect(resolvedDappDirectory).toBe(
        await fs.realpath(uniswapDappDirectory),
      );
      const codeCommand = await captureCodeCommand(temporaryRoot, () =>
        api.openCustomInjectedDappDirectory(
          session.sessionId,
          'defillama:uniswap',
        ),
      );
      expect(codeCommand).toEqual({
        argumentCount: '1',
        directory: await fs.realpath(uniswapDappDirectory),
      });
      expect(session.preloadUrl).toMatch(
        /^file:.*injectedDesktopPreload\.js\?sha256=[a-f0-9]{64}$/u,
      );
      const refreshed = await api.refreshCustomInjectedProtocols(
        preview.sessionId,
      );
      expect(refreshed.protocols[0]?.totalTvl).toBe(123);
      const guest = {
        getType: jest.fn(() => 'webview'),
        getURL: jest.fn(() => 'https://app.uniswap.org/swap'),
        isDestroyed: jest.fn(() => false),
        session: {
          isPersistent: jest.fn(() => false),
        },
      };
      jest.spyOn(webContents, 'fromId').mockReturnValue(guest as never);
      const recordingRequest = {
        sessionId: refreshed.sessionId,
        protocolId: 'uniswap',
        pageUrl: 'https://app.uniswap.org/swap',
        webContentsId: 42,
        bundleSha256: refreshed.bundleSha256,
        expectedRegistrySha256: refreshed.protocols[0]?.registrySha256 ?? '',
        devSettingsEnabled: true,
        customInjectionEnabled: true,
        recording: {
          schemaVersion: 1 as const,
          kind: 'onekey-connect-button-recording-capture' as const,
          startedAt: '2026-08-03T00:00:00.000Z',
          finishedAt: '2026-08-03T00:00:03.000Z',
          initialUrl: 'https://app.uniswap.org/',
          finalUrl: 'https://app.uniswap.org/swap',
          title: 'Uniswap',
          viewport: {
            width: 1440,
            height: 900,
            deviceScaleFactor: 2,
          },
          steps: [
            {
              action: 'click' as const,
              elapsedMs: 1000,
              pageUrl: 'https://app.uniswap.org/swap',
              target: {
                tag: 'button',
                text: 'Connect',
                role: 'button',
                ariaLabel: 'Connect wallet',
                selectors: [
                  {
                    kind: 'testId' as const,
                    value: 'navbar-connect-wallet',
                    unique: true,
                  },
                ],
              },
            },
          ],
        },
      };
      guest.session.isPersistent.mockReturnValue(true);
      await expect(
        api.saveCustomInjectedRecording(recordingRequest),
      ).rejects.toThrow('requires a private WebView session');
      guest.session.isPersistent.mockReturnValue(false);
      await fs.mkdir(uniswapDappDirectory, { recursive: true });
      await fs.writeFile(
        path.join(uniswapDappDirectory, 'recording-legacy.json'),
        '{}',
      );
      const savedRecording =
        await api.saveCustomInjectedRecording(recordingRequest);
      expect(savedRecording).toEqual(
        expect.objectContaining({
          stepCount: 1,
          relativeFile: 'dapps/defillama/uniswap/recording.json',
          sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
        }),
      );
      await expect(
        fs.access(path.join(uniswapDappDirectory, 'recording-legacy.json')),
      ).rejects.toThrow();
      const persistedRecording = JSON.parse(
        await fs.readFile(
          path.join(workspace, savedRecording.relativeFile),
          'utf8',
        ),
      ) as {
        kind: string;
        protocol: { source: string };
        runtime: { privateSession: boolean; bundleSha256: string };
        steps: unknown[];
      };
      expect(persistedRecording).toEqual(
        expect.objectContaining({
          kind: 'onekey-connect-button-recording',
          protocol: expect.objectContaining({ source: dappSource }),
          runtime: {
            privateSession: true,
            bundleSha256: refreshed.bundleSha256,
          },
          steps: expect.any(Array),
        }),
      );
      await expect(
        api.getCustomInjectedE2EState(refreshed.sessionId, 'uniswap'),
      ).resolves.toEqual({
        recording: expect.objectContaining({
          relativeFile: 'dapps/defillama/uniswap/recording.json',
          sha256: savedRecording.sha256,
          stepCount: 1,
        }),
        e2e: null,
        adapter: null,
        canValidate: false,
      });
      const generatedE2EFile = path.join(uniswapDappDirectory, 'e2e.mjs');
      await fs.writeFile(
        generatedE2EFile,
        [
          '// ../../../src/lib/desktop-recording-e2e.mjs',
          'const testCase = {',
          "  kind: 'onekey-connect-button-desktop-e2e',",
          "  source: 'defillama',",
          "  protocolId: 'uniswap',",
          "  site: 'app.uniswap.org',",
          `  recordingSha256: '${savedRecording.sha256}',`,
          '};',
          'const passes = [',
          "  { name: 'clean-session-1', freshWebView: true, passed: true, repositoryIconDetected: false, oneKeyWalletIdDetected: true, walletId: 'ethereum-onekey-wallet', iconKey: null, iconLabel: null },",
          "  { name: 'clean-session-2', freshWebView: true, passed: true, repositoryIconDetected: true, iconKey: 'onekey', iconLabel: 'OneKey' },",
          '];',
          'process.stdout.write(JSON.stringify({',
          '  schemaVersion: 1,',
          "  kind: 'onekey-connect-button-desktop-e2e-result',",
          '  passed: true,',
          "  verdict: 'deterministic-repository-icon-source',",
          '  source: testCase.source,',
          '  protocolId: testCase.protocolId,',
          '  site: testCase.site,',
          '  recordingSha256: testCase.recordingSha256,',
          '  passes,',
          '}));',
        ].join('\n'),
      );
      await expect(
        api.getCustomInjectedE2EState(refreshed.sessionId, 'uniswap'),
      ).resolves.toEqual({
        recording: expect.objectContaining({
          sha256: savedRecording.sha256,
        }),
        e2e: {
          relativeFile: 'dapps/defillama/uniswap/e2e.mjs',
          recordingSha256: savedRecording.sha256,
          current: true,
        },
        adapter: null,
        canValidate: true,
      });
      const generatedAdapterFile = path.join(
        uniswapDappDirectory,
        'adapter.ts',
      );
      await fs.writeFile(generatedAdapterFile, 'export default {} as const;');
      await expect(
        api.getCustomInjectedE2EState(refreshed.sessionId, 'uniswap'),
      ).resolves.toEqual(
        expect.objectContaining({
          adapter: {
            relativeFile: 'dapps/defillama/uniswap/adapter.ts',
          },
        }),
      );
      await expect(
        api.runCustomInjectedE2E(refreshed.sessionId, 'uniswap'),
      ).resolves.toEqual({
        ok: true,
        log: expect.stringContaining('--- stdout ---'),
        result: expect.objectContaining({
          passed: true,
          validationMode: 'native-then-adapter',
          classification: 'native-onekey',
          maximumAttempts: 6,
          maximumAttemptsPerPhase: 3,
          source: dappSource,
          protocolId: 'uniswap',
          recordingSha256: savedRecording.sha256,
          passes: [
            expect.objectContaining({
              name: 'clean-session-1',
              adapterMode: 'disabled',
              freshWebView: true,
              passed: true,
            }),
            expect.objectContaining({
              name: 'clean-session-2',
              adapterMode: 'disabled',
              freshWebView: true,
              passed: true,
            }),
          ],
        }),
      });
      await expect(
        api.getCustomInjectedE2EState(refreshed.sessionId, 'uniswap'),
      ).resolves.toEqual(
        expect.objectContaining({
          validation: {
            relativeFile: 'dapps/defillama/uniswap/e2e-result.json',
            recordingSha256: savedRecording.sha256,
            passed: true,
            current: true,
          },
        }),
      );
      await expect(
        api.getCustomInjectedE2EStates(refreshed.sessionId),
      ).resolves.toEqual({
        'defillama:uniswap': {
          adapter: true,
          recorded: true,
          generated: true,
          resultPresent: true,
          validated: true,
        },
      });
      const resultFile = path.join(uniswapDappDirectory, 'e2e-result.json');
      const legacyMixedResult = JSON.parse(
        await fs.readFile(resultFile, 'utf8'),
      ) as {
        passed: boolean;
        passes: Array<{
          passed: boolean;
          repositoryIconDetected: boolean;
          oneKeyWalletIdDetected?: boolean;
          iconKey: string | null;
          iconLabel: string | null;
        }>;
      };
      legacyMixedResult.passed = false;
      legacyMixedResult.passes[0] = {
        ...legacyMixedResult.passes[0],
        passed: false,
        repositoryIconDetected: false,
        oneKeyWalletIdDetected: false,
        iconKey: null,
        iconLabel: null,
      };
      await fs.writeFile(
        resultFile,
        `${JSON.stringify(legacyMixedResult, null, 2)}\n`,
      );
      await expect(
        api.getCustomInjectedE2EStates(refreshed.sessionId),
      ).resolves.toEqual({
        'defillama:uniswap': {
          adapter: true,
          recorded: true,
          generated: true,
          resultPresent: true,
          validated: true,
        },
      });
      const generatedE2ESource = await fs.readFile(generatedE2EFile, 'utf8');
      await fs.writeFile(
        generatedE2EFile,
        `${generatedE2ESource}\n// edited\n`,
      );
      await expect(
        api.getCustomInjectedE2EStates(refreshed.sessionId),
      ).resolves.toEqual({
        'defillama:uniswap': {
          adapter: true,
          recorded: true,
          generated: true,
          resultPresent: true,
          validated: false,
        },
      });
      const cancellationMarker = path.join(
        temporaryRoot,
        'e2e-cancellation-ready',
      );
      const hangingE2ESource = [
        "import fsForCancellationTest from 'node:fs';",
        `fsForCancellationTest.writeFileSync(${JSON.stringify(cancellationMarker)}, 'ready');`,
        'setInterval(() => undefined, 1_000);',
        'await new Promise(() => undefined);',
        generatedE2ESource,
      ].join('\n');
      await fs.writeFile(generatedE2EFile, hangingE2ESource);
      const cancelledValidation = api.runCustomInjectedE2E(
        refreshed.sessionId,
        'uniswap',
      );
      await waitForFile(cancellationMarker);
      await expect(
        api.stopCustomInjectedE2E(refreshed.sessionId, 'uniswap'),
      ).resolves.toEqual({
        stopped: true,
      });
      await expect(cancelledValidation).resolves.toEqual(
        expect.objectContaining({
          cancelled: true,
          error: 'E2E validation stopped by user',
          ok: false,
        }),
      );
      await expect(
        api.stopCustomInjectedE2E(refreshed.sessionId, 'uniswap'),
      ).resolves.toEqual({
        stopped: false,
      });
      await fs.writeFile(generatedE2EFile, generatedE2ESource);
      const failedE2ESource = generatedE2ESource
        .replaceAll('passed: true', 'passed: false')
        .replace('process.stdout.write', 'process.stderr.write')
        .replace(
          'process.stderr.write(JSON.stringify({',
          "process.stderr.write('runner warning\\n');\nprocess.stderr.write(JSON.stringify({",
        )
        .concat('\nprocess.exitCode = 4;\n');
      await fs.writeFile(generatedE2EFile, failedE2ESource);
      await expect(
        api.runCustomInjectedE2E(refreshed.sessionId, 'uniswap'),
      ).resolves.toEqual({
        ok: true,
        log: expect.stringContaining('runner warning'),
        result: expect.objectContaining({
          passed: false,
          passes: [
            expect.objectContaining({
              name: 'clean-session-1',
              passed: false,
            }),
            expect.objectContaining({
              name: 'clean-session-2',
              passed: false,
            }),
            expect.objectContaining({
              name: 'clean-session-3',
              passed: false,
            }),
            expect.objectContaining({
              name: 'clean-session-4',
              adapterMode: 'enabled',
              passed: false,
            }),
          ],
        }),
      });
      const failedValidationLog = (
        await api.getCustomInjectedRecentOperationLogs(refreshed.sessionId)
      )
        .toReversed()
        .find(
          (record) =>
            record.operation === 'e2e.validate' &&
            record.result?.passed === false,
        );
      expect(failedValidationLog).toEqual(
        expect.objectContaining({
          status: 'error',
          error: expect.objectContaining({
            message: 'E2E validation failed after 4 attempts',
          }),
          result: expect.objectContaining({
            passed: false,
            processLog: expect.stringContaining('runner warning'),
          }),
        }),
      );
      await expect(
        api.getCustomInjectedE2EStates(refreshed.sessionId),
      ).resolves.toEqual({
        'defillama:uniswap': {
          adapter: true,
          recorded: true,
          generated: true,
          resultPresent: true,
          validated: false,
        },
      });
      await fs.writeFile(generatedE2EFile, generatedE2ESource);
      await fs.writeFile(
        generatedE2EFile,
        generatedE2ESource.replace("source: 'defillama'", "source: 'custom'"),
      );
      await expect(
        api.getCustomInjectedE2EState(refreshed.sessionId, 'uniswap'),
      ).rejects.toThrow('does not match the selected protocol');
      await expect(
        api.getCustomInjectedE2EStates(refreshed.sessionId),
      ).resolves.toEqual({
        'defillama:uniswap': {
          adapter: false,
          recorded: false,
          generated: false,
          resultPresent: false,
          validated: false,
        },
      });
      await fs.writeFile(generatedE2EFile, generatedE2ESource);
      await fs.writeFile(
        generatedE2EFile,
        (await fs.readFile(generatedE2EFile, 'utf8')).replace(
          "name: 'clean-session-2', freshWebView: true",
          "name: 'clean-session-2', freshWebView: false",
        ),
      );
      await expect(
        api.runCustomInjectedE2E(refreshed.sessionId, 'uniswap'),
      ).resolves.toEqual(
        expect.objectContaining({
          ok: false,
          error: 'Generated E2E returned an invalid pass',
          log: expect.stringContaining('--- stdout ---'),
        }),
      );
      const replacedRecording = await api.saveCustomInjectedRecording({
        ...recordingRequest,
        recording: {
          ...recordingRequest.recording,
          finishedAt: '2026-08-03T00:00:04.000Z',
          title: 'Uniswap latest',
        },
      });
      expect(replacedRecording.relativeFile).toBe(
        'dapps/defillama/uniswap/recording.json',
      );
      expect(replacedRecording.sha256).not.toBe(savedRecording.sha256);
      await expect(
        api.getCustomInjectedE2EState(refreshed.sessionId, 'uniswap'),
      ).resolves.toEqual(
        expect.objectContaining({
          e2e: expect.objectContaining({ current: false }),
          canValidate: false,
        }),
      );
      await expect(
        api.getCustomInjectedE2EStates(refreshed.sessionId),
      ).resolves.toEqual({
        'defillama:uniswap': {
          adapter: true,
          recorded: true,
          generated: false,
          resultPresent: false,
          validated: false,
        },
      });
      await expect(
        api.runCustomInjectedE2E(refreshed.sessionId, 'uniswap'),
      ).rejects.toThrow('latest recording');
      const reviewRequest = {
        sessionId: refreshed.sessionId,
        protocolId: 'uniswap',
        pageUrl: 'https://app.uniswap.org/swap',
        webContentsId: 42,
        bundleSha256: refreshed.bundleSha256,
        expectedRegistrySha256: refreshed.registrySha256,
        devSettingsEnabled: true,
        customInjectionEnabled: true,
      };
      await expect(
        api.processCustomInjectedAutoReview({
          ...reviewRequest,
          devSettingsEnabled: false,
        }),
      ).rejects.toThrow('enabled developer settings');
      await expect(
        api.processCustomInjectedAutoReview({
          ...reviewRequest,
          customInjectionEnabled: false,
        }),
      ).rejects.toThrow('Custom injection is not enabled');
      await expect(
        api.processCustomInjectedAutoReview({
          ...reviewRequest,
          bundleSha256: '0'.repeat(64),
        }),
      ).rejects.toThrow('Custom injection bundle has changed');
      await expect(
        api.processCustomInjectedAutoReview({
          ...reviewRequest,
          pageUrl: 'https://malicious.example/fake',
        }),
      ).rejects.toThrow(
        'Custom injection review page hostname mismatch for "defillama:uniswap": actual="malicious.example" (reported page), expected="app.uniswap.org" (active WebView)',
      );
      guest.getURL.mockReturnValueOnce('https://www.satflow.com/');
      await expect(
        api.processCustomInjectedAutoReview({
          ...reviewRequest,
          pageUrl: 'https://www.satflow.com/',
        }),
      ).rejects.toThrow(
        'Custom injection review protocol hostname mismatch for "defillama:uniswap": actual="satflow.com" (active WebView and reported page), expected="app.uniswap.org" (selected protocol)',
      );
      await expect(
        api.updateCustomInjectedProtocol({
          action: 'set-review',
          sessionId: refreshed.sessionId,
          protocolId: 'uniswap',
          expectedRegistrySha256: refreshed.registrySha256,
          state: 'processed',
          reviewedUrl: 'https://app.uniswap.org/swap',
          bundleSha256: refreshed.bundleSha256,
        }),
      ).rejects.toThrow(
        'Processed review can only be set by OneKey icon auto-detection',
      );
      const autoReviewed =
        await api.processCustomInjectedAutoReview(reviewRequest);
      expect(autoReviewed.updated).toBe(true);
      expect(autoReviewed.session.protocols[0]?.manualReview).toEqual({
        state: 'processed',
        reviewedAt: '2026-07-31T00:00:00.000Z',
        reviewedUrl: 'https://app.uniswap.org/swap',
        injectedBundleSha256: refreshed.bundleSha256,
      });
      await expect(
        api.processCustomInjectedAutoReview(reviewRequest),
      ).resolves.toEqual(expect.objectContaining({ updated: false }));
      const unsupported = await api.updateCustomInjectedProtocol({
        action: 'set-review',
        sessionId: autoReviewed.session.sessionId,
        protocolId: 'uniswap',
        expectedRegistrySha256: autoReviewed.session.registrySha256,
        state: 'unsupported',
      });
      expect(unsupported.protocols[0]?.manualReview.state).toBe('unsupported');
      await expect(
        api.processCustomInjectedAutoReview(reviewRequest),
      ).rejects.toThrow(
        'Custom injection review registry changed before auto-review',
      );
      const autoReviewedUnsupported = await api.processCustomInjectedAutoReview(
        {
          ...reviewRequest,
          expectedRegistrySha256: unsupported.registrySha256,
        },
      );
      expect(autoReviewedUnsupported.updated).toBe(true);
      expect(
        autoReviewedUnsupported.session.protocols[0]?.manualReview.state,
      ).toBe('processed');
      await expect(
        api.processCustomInjectedAutoReview(reviewRequest),
      ).resolves.toEqual(expect.objectContaining({ updated: false }));
      await expect(api.getActiveCustomInjectedWorkspace()).resolves.toEqual(
        expect.objectContaining({
          sessionId: preview.sessionId,
          preloadUrl: session.preloadUrl,
        }),
      );
      const replacementPreview = await api.prepareCustomInjectedWorkspace(
        workspace,
        true,
      );
      await api.activateCustomInjectedWorkspace(replacementPreview.sessionId);
      await expect(
        api.getCustomInjectedWorkspace(preview.sessionId),
      ).rejects.toThrow('not active');
      await expect(api.getActiveCustomInjectedWorkspace()).resolves.toEqual(
        expect.objectContaining({
          sessionId: replacementPreview.sessionId,
        }),
      );

      await fs.rm(uniswapDappDirectory, { force: true, recursive: true });
      await fs.symlink(temporaryRoot, uniswapDappDirectory, 'dir');
      await expect(
        api.getCustomInjectedE2EState(replacementPreview.sessionId, 'uniswap'),
      ).rejects.toThrow('must be a regular directory');

      await fs.writeFile(
        path.join(workspace, 'onekey-app-custom-injected.json'),
        JSON.stringify({
          schemaVersion: 2,
          kind: 'onekey-app-custom-injected',
          protocolRegistry,
          registryUpdater,
          registryRefresher,
          desktopPreload,
          dappSource: '../custom',
          dappsDirectory,
        }),
      );
      await expect(
        api.prepareCustomInjectedWorkspace(workspace, true),
      ).rejects.toThrow('protocol source must be unique and normalized');

      await fs.writeFile(
        path.join(temporaryRoot, 'outside.json'),
        registry([]),
      );
      await fs.writeFile(
        path.join(workspace, 'onekey-app-custom-injected.json'),
        JSON.stringify({
          schemaVersion: 2,
          kind: 'onekey-app-custom-injected',
          protocolRegistry: '../outside.json',
          registryUpdater,
          registryRefresher,
          desktopPreload,
          dappSource,
          dappsDirectory,
        }),
      );
      await expect(
        api.prepareCustomInjectedWorkspace(workspace, true),
      ).rejects.toThrow('protocolRegistry escapes the selected workspace');
      const operationLogFile = path.join(
        workspace,
        'logs',
        'custom-injection',
        'operations.jsonl',
      );
      const operationLogBeforeRead = await fs.readFile(
        operationLogFile,
        'utf8',
      );
      const recentOperationLogs =
        await api.getCustomInjectedRecentOperationLogs(
          replacementPreview.sessionId,
        );
      expect(api.getCustomInjectedOperationLogAppStartedAt()).toEqual(
        expect.any(Number),
      );
      await api.getCustomInjectedRecentOperationLogs(
        replacementPreview.sessionId,
      );
      expect(await fs.readFile(operationLogFile, 'utf8')).toBe(
        operationLogBeforeRead,
      );
      expect(recentOperationLogs.length).toBeLessThanOrEqual(200);
      expect(
        recentOperationLogs.every(
          ({ operation }) => !operation.startsWith('logs.'),
        ),
      ).toBe(true);
      expect(recentOperationLogs.some(({ status }) => status === 'start')).toBe(
        true,
      );
      const logCodeCommand = await captureCodeCommand(temporaryRoot, () =>
        api.openCustomInjectedOperationLogFile(replacementPreview.sessionId),
      );
      expect(logCodeCommand).toEqual({
        argumentCount: '1',
        directory: path.join(
          await fs.realpath(workspace),
          'logs',
          'custom-injection',
          'operations.jsonl',
        ),
      });
      await api.closeCustomInjectedWorkspace(replacementPreview.sessionId);
      await expect(api.getActiveCustomInjectedWorkspace()).resolves.toBeNull();

      const operationEvents = (await fs.readFile(operationLogFile, 'utf8'))
        .trim()
        .split('\n')
        .map(
          (line) =>
            JSON.parse(line) as {
              operationId: string;
              operation: string;
              status: 'error' | 'result' | 'start';
            },
        );
      expect(operationEvents.map(({ operation }) => operation)).toEqual(
        expect.arrayContaining([
          'workspace.prepare',
          'workspace.activate',
          'dapp-directory.open',
          'protocols.refresh',
          'recording.save',
          'e2e.state.read',
          'e2e.validate',
          'auto-review.process',
          'protocol.update',
          'logs.open',
          'workspace.close',
        ]),
      );
      expect(operationEvents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            operation: 'e2e.state.read',
            status: 'error',
          }),
          expect.objectContaining({
            operation: 'e2e.validate.stop',
            status: 'error',
          }),
        ]),
      );
      for (const start of operationEvents.filter(
        ({ status }) => status === 'start',
      )) {
        expect(
          operationEvents.some(
            (event) =>
              event.operationId === start.operationId &&
              (event.status === 'result' || event.status === 'error'),
          ),
        ).toBe(true);
      }
    } finally {
      await fs.rm(temporaryRoot, { force: true, recursive: true });
    }
  });
});
