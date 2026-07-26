#!/usr/bin/env node

const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const { _electron: electron } = require('playwright-core');

const desktopDir = path.resolve(__dirname, '..');
const electronEntry = path.join(__dirname, 'firmware-sdk.electron.js');
const sdkRootDir = path.join(desktopDir, 'public', 'static', 'js-sdk');
const sdkBundlePath = path.join(sdkRootDir, 'onekey-js-sdk.js');

const sdkConnectSrc = `${pathToFileURL(sdkRootDir).href}/`;

async function run() {
  const electronApp = await electron.launch({
    args: [electronEntry],
    cwd: desktopDir,
    env: {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
    },
  });

  try {
    const page = await electronApp.firstWindow();
    const pageErrors = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    const result = await page.evaluate(
      async ({ connectSrc, sdkBundlePathValue }) => {
        const sdkNamespace =
          globalThis['onekey-js-sdk'] ?? require(sdkBundlePathValue);
        const sdk = sdkNamespace?.default ?? sdkNamespace;
        if (!sdk?.HardwareSDKTopLevel || !sdk?.HardwareSDKLowLevel) {
          throw new Error('Local hd-web-sdk bundle did not expose its runtime');
        }

        const originalCreateElement = document.createElement.bind(document);
        let iframeCreateCount = 0;
        document.createElement = (tagName, options) => {
          if (tagName.toLowerCase() === 'iframe') {
            iframeCreateCount += 1;
          }
          return originalCreateElement(tagName, options);
        };

        const bridgeInitialized = await sdk.HardwareSDKTopLevel.init(
          {
            connectSrc,
            debug: false,
            env: 'bridge',
            fetchConfig: false,
            firmwareManifestMode: { kind: 'external-only' },
          },
          sdk.HardwareSDKLowLevel,
        );
        if (!bridgeInitialized) {
          throw new Error('Local Bridge iframe initialization failed');
        }

        const binding = {
          artifactReader: {
            open: async () => ({
              readerId: 'desktop-e2e-reader',
              size: 1,
            }),
            read: async () => ({
              bytesRead: 1,
              data: Uint8Array.from([0x5a]).buffer,
              eof: true,
            }),
            close: async () => undefined,
            cancel: async () => undefined,
          },
          checkpointSink: {
            commit: async () => undefined,
          },
        };

        const iframe = document.getElementById('onekey-connect');
        const localIframeSrc = iframe?.getAttribute('src') ?? '';
        const bridgeChannelState =
          await sdk.registerFirmwareHostChannelBinding(binding);

        await sdk.unregisterFirmwareHostChannelBinding();
        await sdk.HardwareSDKTopLevel.dispose();

        return {
          bridgeChannelState,
          bridgeInitialized,
          iframeCreateCount,
          localIframeSrc,
        };
      },
      {
        connectSrc: sdkConnectSrc,
        sdkBundlePathValue: sdkBundlePath,
      },
    );

    assert.equal(result.bridgeInitialized, true);
    assert.equal(result.bridgeChannelState.connected, true);
    assert.equal(result.iframeCreateCount, 1);
    assert.equal(result.localIframeSrc, `${sdkConnectSrc}iframe.html`);
    assert.deepEqual(pageErrors, []);

    console.log(
      'Verified offline Desktop Bridge iframe initialization and MessageChannel handshake.',
    );
  } finally {
    await electronApp.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
