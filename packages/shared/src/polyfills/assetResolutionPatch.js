/* eslint-disable prefer-template */

/**
 * Asset resolution patch for native hot-updated JS bundles.
 *
 * When the app runs from a hot-updated bundle, image/asset URIs must
 * point to the bundle's local assets directory instead of the default
 * app bundle location.
 *
 * Extracted from polyfillsPlatform.js so the logic is independently testable.
 */
function patchNativeAssetResolution(assetsPath) {
  const { Platform, PixelRatio } = require('react-native');
  const AssetSourceResolver =
    require('react-native/Libraries/Image/AssetSourceResolver').default;
  const wrap = require('lodash/wrap');
  const { pickScale } = require('react-native/Libraries/Image/AssetUtils');

  let getAndroidResourceFolderName;
  let getAndroidResourceIdentifier;
  if (Platform.OS === 'android') {
    const pathSupport = require('@react-native/assets-registry/path-support');
    getAndroidResourceFolderName = pathSupport.getAndroidResourceFolderName;
    getAndroidResourceIdentifier = pathSupport.getAndroidResourceIdentifier;
  }

  function getAssetPathInDrawableFolder(asset) {
    const scale = pickScale(asset.scales, PixelRatio.get());
    const drawableFolder = getAndroidResourceFolderName(asset, scale);
    const fileName = getAndroidResourceIdentifier(asset);
    return drawableFolder + '/' + fileName + '.' + asset.type;
  }

  AssetSourceResolver.prototype.defaultAsset = wrap(
    AssetSourceResolver.prototype.defaultAsset,
    function (_func, ..._args) {
      const isLoadedFromServer = this.isLoadedFromServer();
      if (isLoadedFromServer) {
        const serverUrl = this.assetServerURL();
        return serverUrl;
      }
      if (Platform.OS === 'android') {
        const asset = this.fromSource(
          assetsPath + getAssetPathInDrawableFolder(this.asset),
        );
        asset.uri = asset.uri
          .replace('__packages', 'packages')
          .replace('__node_modules', 'node_modules');
        return asset;
      }
      if (Platform.OS === 'ios') {
        const iOSAsset = this.scaledAssetURLNearBundle();
        iOSAsset.uri = iOSAsset.uri
          .replace(this.jsbundleUrl, assetsPath)
          .replace('__packages', 'packages')
          .replace('__node_modules', 'node_modules');
        return iOSAsset;
      }
    },
  );
}

module.exports = { patchNativeAssetResolution };
