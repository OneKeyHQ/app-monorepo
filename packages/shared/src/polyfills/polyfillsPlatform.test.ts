// @ts-nocheck
/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */

/**
 * Tests for the native asset resolution polyfill (polyfillsPlatform.js lines 47-116).
 *
 * Core logic is in assetResolutionPatch.js — it does its own requires
 * for react-native / lodash / path-support, so we mock those via jest.doMock.
 */

let MockAssetSourceResolver: any;
let originalDefaultAsset: any;

function setup(platform: string) {
  jest.resetModules();

  originalDefaultAsset = jest.fn();
  MockAssetSourceResolver = function () {};
  MockAssetSourceResolver.prototype.defaultAsset = originalDefaultAsset;

  jest.doMock('react-native', () => ({
    Platform: { OS: platform },
    PixelRatio: { get: () => 2 },
  }));

  jest.doMock('react-native/Libraries/Image/AssetSourceResolver', () => ({
    __esModule: true,
    default: MockAssetSourceResolver,
  }));

  jest.doMock('react-native/Libraries/Image/AssetUtils', () => ({
    pickScale: (scales: number[], pixelRatio: number) =>
      scales.reduce((prev, curr) =>
        Math.abs(curr - pixelRatio) < Math.abs(prev - pixelRatio) ? curr : prev,
      ),
  }));

  jest.doMock('@react-native/assets-registry/path-support', () => ({
    getAndroidResourceFolderName: (_asset: any, scale: number) =>
      `drawable-${scale}x`,
    getAndroidResourceIdentifier: (asset: any) => asset.name,
  }));

  const { patchNativeAssetResolution } = require('./assetResolutionPatch');
  return patchNativeAssetResolution;
}

describe('patchNativeAssetResolution (polyfillsPlatform lines 47-116)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Android
  // -------------------------------------------------------------------------
  describe('Android', () => {
    const ASSETS_PATH =
      'file:///data/user/0/com.app/files/bundles/v1/b1/assets/';

    test('wraps AssetSourceResolver.prototype.defaultAsset', () => {
      const patch = setup('android');
      patch(ASSETS_PATH);
      expect(MockAssetSourceResolver.prototype.defaultAsset).not.toBe(
        originalDefaultAsset,
      );
    });

    test('rewrites asset URI with bundle assets path and drawable folder', () => {
      const patch = setup('android');
      patch(ASSETS_PATH);

      const result = MockAssetSourceResolver.prototype.defaultAsset.call({
        isLoadedFromServer: () => false,
        asset: { scales: [1, 2, 3], name: 'icon', type: 'png' },
        fromSource: (uri: string) => ({ uri }),
      });
      expect(result.uri).toBe(`${ASSETS_PATH}drawable-2x/icon.png`);
    });

    test('replaces __packages and __node_modules in asset URI simultaneously', () => {
      const patch = setup('android');
      patch(ASSETS_PATH);

      const result = MockAssetSourceResolver.prototype.defaultAsset.call({
        isLoadedFromServer: () => false,
        asset: { scales: [2], name: 'icon', type: 'png' },
        fromSource: (uri: string) => ({
          uri: `${uri}?from=__packages/__node_modules`,
        }),
      });
      expect(result.uri).toContain('from=packages/node_modules');
      expect(result.uri).not.toContain('__packages');
      expect(result.uri).not.toContain('__node_modules');
    });

    test('preserves URI when no __packages or __node_modules present', () => {
      const patch = setup('android');
      patch(ASSETS_PATH);

      const result = MockAssetSourceResolver.prototype.defaultAsset.call({
        isLoadedFromServer: () => false,
        asset: { scales: [2], name: 'normal_icon', type: 'png' },
        fromSource: (uri: string) => ({ uri }),
      });
      expect(result.uri).toBe(`${ASSETS_PATH}drawable-2x/normal_icon.png`);
    });

    test('returns server URL when loaded from dev server', () => {
      const patch = setup('android');
      patch(ASSETS_PATH);

      const result = MockAssetSourceResolver.prototype.defaultAsset.call({
        isLoadedFromServer: () => true,
        assetServerURL: () => 'http://localhost:8081/assets/icon.png',
      });
      expect(result).toBe('http://localhost:8081/assets/icon.png');
    });
  });

  // -------------------------------------------------------------------------
  // iOS
  // -------------------------------------------------------------------------
  describe('iOS', () => {
    const ASSETS_PATH = 'file:///var/containers/App/UUID/bundles/v1/b1/assets/';

    test('replaces jsbundleUrl with bundle assets path', () => {
      const patch = setup('ios');
      patch(ASSETS_PATH);

      const jsbundleUrl = 'file:///var/containers/App/UUID/OneKey.app/';
      const result = MockAssetSourceResolver.prototype.defaultAsset.call({
        isLoadedFromServer: () => false,
        jsbundleUrl,
        scaledAssetURLNearBundle: () => ({
          uri: `${jsbundleUrl}images/icon@2x.png`,
        }),
      });
      expect(result.uri).toBe(`${ASSETS_PATH}images/icon@2x.png`);
    });

    test('replaces __packages and __node_modules in asset URI', () => {
      const patch = setup('ios');
      patch(ASSETS_PATH);

      const jsbundleUrl = 'file:///original/';
      const result = MockAssetSourceResolver.prototype.defaultAsset.call({
        isLoadedFromServer: () => false,
        jsbundleUrl,
        scaledAssetURLNearBundle: () => ({
          uri: `${jsbundleUrl}__packages/kit/__node_modules/lib/icon.png`,
        }),
      });
      expect(result.uri).toContain('/packages/kit/');
      expect(result.uri).toContain('/node_modules/lib/');
      expect(result.uri).not.toContain('__packages');
      expect(result.uri).not.toContain('__node_modules');
    });

    test('preserves URI when no __packages or __node_modules present', () => {
      const patch = setup('ios');
      patch(ASSETS_PATH);

      const jsbundleUrl = 'file:///original/';
      const result = MockAssetSourceResolver.prototype.defaultAsset.call({
        isLoadedFromServer: () => false,
        jsbundleUrl,
        scaledAssetURLNearBundle: () => ({
          uri: `${jsbundleUrl}images/icon@2x.png`,
        }),
      });
      expect(result.uri).toBe(`${ASSETS_PATH}images/icon@2x.png`);
    });

    test('returns server URL when loaded from dev server', () => {
      const patch = setup('ios');
      patch(ASSETS_PATH);

      const result = MockAssetSourceResolver.prototype.defaultAsset.call({
        isLoadedFromServer: () => true,
        assetServerURL: () => 'http://localhost:8081/assets/icon.png',
      });
      expect(result).toBe('http://localhost:8081/assets/icon.png');
    });
  });

  // -------------------------------------------------------------------------
  // Unknown platform
  // -------------------------------------------------------------------------
  describe('unknown platform', () => {
    test('returns undefined for unsupported platform', () => {
      const patch = setup('windows');
      patch('file:///assets/');

      const result = MockAssetSourceResolver.prototype.defaultAsset.call({
        isLoadedFromServer: () => false,
      });
      expect(result).toBeUndefined();
    });
  });
});
