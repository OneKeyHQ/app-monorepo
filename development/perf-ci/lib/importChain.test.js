const fs = require('fs');
const os = require('os');
const path = require('path');

const { createStaticImportChainReport } = require('./importChain');

function writeFile(repoRoot, filePath, source) {
  const fullPath = path.join(repoRoot, filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, source);
}

describe('createStaticImportChainReport', () => {
  it('uses only runtime sync edges for startup chains', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'import-chain-'));
    const root = 'apps/web/src/root.ts';
    const middle = 'apps/web/src/middle.ts';
    const target = 'apps/web/src/target.ts';
    const lazyTarget = 'apps/web/src/lazyTarget.ts';

    writeFile(
      repoRoot,
      root,
      [
        "import type { TargetType } from './target';",
        "export type { LazyType } from './lazyTarget';",
        "import('./lazyTarget');",
        "import { middle } from './middle';",
        'export const root = middle;',
      ].join('\n'),
    );
    writeFile(
      repoRoot,
      middle,
      [
        "import { target } from './target';",
        'export const middle = target;',
      ].join('\n'),
    );
    writeFile(
      repoRoot,
      target,
      'export const target = 1; export type TargetType = number;',
    );
    writeFile(
      repoRoot,
      lazyTarget,
      'export const lazyTarget = 1; export type LazyType = number;',
    );

    const report = createStaticImportChainReport({
      repoRoot,
      modules: [root, middle, target, lazyTarget],
      roots: [root],
      targets: [target, lazyTarget],
    });

    expect(report.chains).toEqual([
      {
        target,
        status: 'found',
        chain: [
          {
            from: root,
            to: middle,
            specifier: './middle',
            edgeType: 'sync',
          },
          {
            from: middle,
            to: target,
            specifier: './target',
            edgeType: 'sync',
          },
        ],
      },
      {
        target: lazyTarget,
        status: 'unreachable',
        chain: [],
      },
    ]);
  });

  it('resolves workspace package entries through package.json main', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'import-chain-'));
    const root = 'apps/web/src/root.ts';
    const kitEntry = 'packages/kit/src/index.tsx';
    const kitTarget = 'packages/kit/src/KitProvider.tsx';

    writeFile(repoRoot, root, "import { KitProvider } from '@onekeyhq/kit';");
    writeFile(
      repoRoot,
      'packages/kit/package.json',
      JSON.stringify({ main: 'src/index.tsx' }),
    );
    writeFile(
      repoRoot,
      kitEntry,
      "export { KitProvider } from './KitProvider';",
    );
    writeFile(repoRoot, kitTarget, 'export const KitProvider = null;');

    const report = createStaticImportChainReport({
      repoRoot,
      modules: [root, kitEntry, kitTarget],
      roots: [root],
      targets: [kitTarget],
    });

    expect(report.chains).toEqual([
      {
        target: kitTarget,
        status: 'found',
        chain: [
          {
            from: root,
            to: kitEntry,
            specifier: '@onekeyhq/kit',
            edgeType: 'sync',
          },
          {
            from: kitEntry,
            to: kitTarget,
            specifier: './KitProvider',
            edgeType: 'sync',
          },
        ],
      },
    ]);
  });

  it('resolves the QR wallet SDK workspace package and src submodules', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'import-chain-'));
    const root = 'apps/web/src/root.ts';
    const sdkEntry = 'packages/qr-wallet-sdk/src/index.ts';
    const requestDeviceQr =
      'packages/qr-wallet-sdk/src/OneKeyRequestDeviceQR.ts';

    writeFile(
      repoRoot,
      root,
      [
        "import { getAirGapSdk } from '@onekeyhq/qr-wallet-sdk';",
        "import { OneKeyRequestDeviceQR } from '@onekeyhq/qr-wallet-sdk/src/OneKeyRequestDeviceQR';",
        'export const root = [getAirGapSdk, OneKeyRequestDeviceQR];',
      ].join('\n'),
    );
    writeFile(
      repoRoot,
      'packages/qr-wallet-sdk/package.json',
      JSON.stringify({ main: 'src/index.ts' }),
    );
    writeFile(repoRoot, sdkEntry, 'export const getAirGapSdk = null;');
    writeFile(
      repoRoot,
      requestDeviceQr,
      'export const OneKeyRequestDeviceQR = null;',
    );

    const report = createStaticImportChainReport({
      repoRoot,
      modules: [root, sdkEntry, requestDeviceQr],
      roots: [root],
      targets: [sdkEntry, requestDeviceQr],
    });

    expect(report.chains).toEqual([
      {
        target: sdkEntry,
        status: 'found',
        chain: [
          {
            from: root,
            to: sdkEntry,
            specifier: '@onekeyhq/qr-wallet-sdk',
            edgeType: 'sync',
          },
        ],
      },
      {
        target: requestDeviceQr,
        status: 'found',
        chain: [
          {
            from: root,
            to: requestDeviceQr,
            specifier: '@onekeyhq/qr-wallet-sdk/src/OneKeyRequestDeviceQR',
            edgeType: 'sync',
          },
        ],
      },
    ]);
  });

  it('uses the shared web resolver extension order', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'import-chain-'));
    const root = 'apps/web/src/root.ts';
    const webOnlyTarget = 'apps/web/src/target.web-only.tsx';

    writeFile(repoRoot, root, "import { target } from './target';");
    writeFile(repoRoot, webOnlyTarget, 'export const target = 1;');

    const report = createStaticImportChainReport({
      repoRoot,
      modules: [root, webOnlyTarget],
      roots: [root],
      targets: [webOnlyTarget],
    });

    expect(report.chains).toEqual([
      {
        target: webOnlyTarget,
        status: 'found',
        chain: [
          {
            from: root,
            to: webOnlyTarget,
            specifier: './target',
            edgeType: 'sync',
          },
        ],
      },
    ]);
  });

  it('applies web resolver aliases before following package entries', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'import-chain-'));
    const root = 'apps/web/src/root.ts';
    const reactNativeWebEntry = 'node_modules/react-native-web/dist/index.js';
    const fastImageMock =
      'development/module-resolver/react-native-fast-image-mock/index.js';
    const reactAriaFocusEntry = 'node_modules/@react-aria/focus/src/index.ts';

    writeFile(
      repoRoot,
      root,
      [
        "import { View } from 'react-native';",
        "import FastImage from 'react-native-fast-image';",
        "import { FocusScope } from '@react-aria/focus';",
        'export const root = [View, FastImage, FocusScope];',
      ].join('\n'),
    );
    writeFile(
      repoRoot,
      'node_modules/react-native-web/package.json',
      JSON.stringify({ main: 'dist/index.js' }),
    );
    writeFile(repoRoot, reactNativeWebEntry, 'export const View = null;');
    writeFile(repoRoot, fastImageMock, 'module.exports = { default: null };');
    writeFile(repoRoot, reactAriaFocusEntry, 'export const FocusScope = null;');

    const report = createStaticImportChainReport({
      repoRoot,
      modules: [root, reactNativeWebEntry, fastImageMock, reactAriaFocusEntry],
      roots: [root],
      targets: [reactNativeWebEntry, fastImageMock, reactAriaFocusEntry],
    });

    expect(report.chains).toEqual([
      {
        target: reactNativeWebEntry,
        status: 'found',
        chain: [
          {
            from: root,
            to: reactNativeWebEntry,
            specifier: 'react-native',
            edgeType: 'sync',
          },
        ],
      },
      {
        target: fastImageMock,
        status: 'found',
        chain: [
          {
            from: root,
            to: fastImageMock,
            specifier: 'react-native-fast-image',
            edgeType: 'sync',
          },
        ],
      },
      {
        target: reactAriaFocusEntry,
        status: 'found',
        chain: [
          {
            from: root,
            to: reactAriaFocusEntry,
            specifier: '@react-aria/focus',
            edgeType: 'sync',
          },
        ],
      },
    ]);
  });

  it('resolves node_modules package exports and follows internal sync edges', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'import-chain-'));
    const root = 'apps/web/src/root.ts';
    const packageEntry = 'node_modules/pkg/esm/index.js';
    const packageInternal = 'node_modules/pkg/esm/internal.js';
    const packageSubpath = 'node_modules/pkg/jsx-runtime.js';

    writeFile(
      repoRoot,
      root,
      [
        "import { runtime } from 'pkg';",
        "import { jsx } from 'pkg/jsx-runtime';",
        'export const root = [runtime, jsx];',
      ].join('\n'),
    );
    writeFile(
      repoRoot,
      'node_modules/pkg/package.json',
      JSON.stringify({
        exports: {
          '.': {
            import: './esm/index.js',
            require: './cjs/index.js',
          },
          './jsx-runtime': './jsx-runtime.js',
        },
        main: './cjs/index.js',
        module: './esm/index.js',
      }),
    );
    writeFile(
      repoRoot,
      packageEntry,
      "export { runtime } from './internal.js';",
    );
    writeFile(repoRoot, packageInternal, 'export const runtime = 1;');
    writeFile(repoRoot, packageSubpath, 'export const jsx = 1;');

    const report = createStaticImportChainReport({
      repoRoot,
      modules: [root, packageEntry, packageInternal, packageSubpath],
      roots: [root],
      targets: [packageInternal, packageSubpath],
    });

    expect(report.chains).toEqual([
      {
        target: packageInternal,
        status: 'found',
        chain: [
          {
            from: root,
            to: packageEntry,
            specifier: 'pkg',
            edgeType: 'sync',
          },
          {
            from: packageEntry,
            to: packageInternal,
            specifier: './internal.js',
            edgeType: 'sync',
          },
        ],
      },
      {
        target: packageSubpath,
        status: 'found',
        chain: [
          {
            from: root,
            to: packageSubpath,
            specifier: 'pkg/jsx-runtime',
            edgeType: 'sync',
          },
        ],
      },
    ]);
  });
});
