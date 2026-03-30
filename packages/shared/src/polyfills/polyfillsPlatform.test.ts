// @ts-nocheck
/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
/* eslint-disable import/first */

/**
 * Tests for the native asset resolution polyfill (polyfillsPlatform.js lines 47-116).
 *
 * Core logic is in assetResolutionPatch.js — it does its own requires
 * for react-native / lodash / path-support at call time (not module load time),
 * so we mock those modules upfront and change Platform.OS per test case.
 */

// In the harness, react-native is the real module — don't mock it.
// In Node.js Jest, we need to provide mocks for RN internals.
const isHarnessEnv = (() => {
  try {
    const pe = require('@onekeyhq/shared/src/platformEnv');
    return (pe?.default ?? pe)?.isHarness === true;
  } catch {
    return false;
  }
})();

const mockPlatform = { OS: 'android' };

if (!isHarnessEnv) {
  jest.mock('react-native', () => ({
    Platform: mockPlatform,
    PixelRatio: { get: () => 2 },
  }));
}

const MockAssetSourceResolver = function () {};
MockAssetSourceResolver.prototype.defaultAsset = jest.fn();

jest.mock('react-native/Libraries/Image/AssetSourceResolver', () => ({
  __esModule: true,
  default: MockAssetSourceResolver,
}));

// These helpers are always mocked — the test passes simplified asset objects
// that don't match the real API signatures.
jest.mock('react-native/Libraries/Image/AssetUtils', () => ({
  pickScale: (scales: number[], pixelRatio: number) =>
    scales.reduce((prev, curr) =>
      Math.abs(curr - pixelRatio) < Math.abs(prev - pixelRatio) ? curr : prev,
    ),
}));

jest.mock('@react-native/assets-registry/path-support', () => ({
  getAndroidResourceFolderName: (_asset: any, scale: number) =>
    `drawable-${scale}x`,
  getAndroidResourceIdentifier: (asset: any) => asset.name,
}));

import { patchNativeAssetResolution } from './assetResolutionPatch';

// In harness, Platform is the real RN Platform object — mutate OS directly.
// In Node.js Jest, Platform is our mockPlatform object.
const setPlatformOS = (os: string) => {
  if (isHarnessEnv) {
    const { Platform } = require('react-native');
    Platform.OS = os;
  } else {
    mockPlatform.OS = os;
  }
};

// In harness, use real device PixelRatio; in Node.js Jest, mock returns 2.
const getDevicePixelRatio = (): number => {
  if (isHarnessEnv) {
    const { PixelRatio } = require('react-native');
    return PixelRatio.get();
  }
  return 2;
};

describe('patchNativeAssetResolution (polyfillsPlatform lines 47-116)', () => {
  let savedOS: string;

  beforeEach(() => {
    // Save original Platform.OS in harness so we can restore it
    if (isHarnessEnv) {
      const { Platform } = require('react-native');
      savedOS = Platform.OS;
    }
    // Restore the prototype to a fresh fn before each test so patches don't leak
    MockAssetSourceResolver.prototype.defaultAsset = jest.fn();
  });

  afterEach(() => {
    // Restore Platform.OS in harness
    if (isHarnessEnv) {
      const { Platform } = require('react-native');
      Platform.OS = savedOS;
    }
  });

  // -------------------------------------------------------------------------
  // Android
  // -------------------------------------------------------------------------
  describe('Android', () => {
    const ASSETS_PATH =
      'file:///data/user/0/com.app/files/bundles/v1/b1/assets/';

    beforeEach(() => {
      setPlatformOS('android');
    });

    test('wraps AssetSourceResolver.prototype.defaultAsset', () => {
      const prePatched = MockAssetSourceResolver.prototype.defaultAsset;
      patchNativeAssetResolution(ASSETS_PATH);
      expect(MockAssetSourceResolver.prototype.defaultAsset).not.toBe(
        prePatched,
      );
    });

    test('rewrites asset URI with bundle assets path and drawable folder', () => {
      const pr = getDevicePixelRatio();
      // pickScale picks the closest scale to devicePixelRatio
      const expectedScale = [1, 2, 3].reduce((prev, curr) =>
        Math.abs(curr - pr) < Math.abs(prev - pr) ? curr : prev,
      );
      patchNativeAssetResolution(ASSETS_PATH);

      const result = MockAssetSourceResolver.prototype.defaultAsset.call({
        isLoadedFromServer: () => false,
        asset: { scales: [1, 2, 3], name: 'icon', type: 'png' },
        fromSource: (uri: string) => ({ uri }),
      });
      expect(result.uri).toBe(
        `${ASSETS_PATH}drawable-${expectedScale}x/icon.png`,
      );
    });

    test('replaces __packages and __node_modules in asset URI simultaneously', () => {
      patchNativeAssetResolution(ASSETS_PATH);

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
      const pr = getDevicePixelRatio();
      const expectedScale = [2].reduce((prev, curr) =>
        Math.abs(curr - pr) < Math.abs(prev - pr) ? curr : prev,
      );
      patchNativeAssetResolution(ASSETS_PATH);

      const result = MockAssetSourceResolver.prototype.defaultAsset.call({
        isLoadedFromServer: () => false,
        asset: { scales: [2], name: 'normal_icon', type: 'png' },
        fromSource: (uri: string) => ({ uri }),
      });
      expect(result.uri).toBe(
        `${ASSETS_PATH}drawable-${expectedScale}x/normal_icon.png`,
      );
    });

    test('returns server URL when loaded from dev server', () => {
      patchNativeAssetResolution(ASSETS_PATH);

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

    beforeEach(() => {
      setPlatformOS('ios');
    });

    test('replaces jsbundleUrl with bundle assets path', () => {
      patchNativeAssetResolution(ASSETS_PATH);

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
      patchNativeAssetResolution(ASSETS_PATH);

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
      patchNativeAssetResolution(ASSETS_PATH);

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
      patchNativeAssetResolution(ASSETS_PATH);

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
    beforeEach(() => {
      setPlatformOS('windows');
    });

    test('returns undefined for unsupported platform', () => {
      patchNativeAssetResolution('file:///assets/');

      const result = MockAssetSourceResolver.prototype.defaultAsset.call({
        isLoadedFromServer: () => false,
      });
      expect(result).toBeUndefined();
    });
  });
});
