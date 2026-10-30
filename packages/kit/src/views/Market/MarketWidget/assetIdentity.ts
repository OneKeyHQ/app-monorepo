import type {
  IMarketWidgetAsset,
  IMarketWidgetEditorState,
  IMarketWidgetSource,
} from '@onekeyhq/shared/src/modules/MarketWidget/types';

export function getMarketWidgetAssetKey(asset: IMarketWidgetAsset) {
  return asset.kind === 'asset'
    ? `asset:${asset.assetId}`
    : `token:${asset.chainId}|${String(asset.isNative)}|${asset.contractAddress}`;
}

export function getMarketWidgetAssetTitle(asset: IMarketWidgetAsset) {
  if (asset.symbol.trim()) return asset.symbol;
  if (asset.kind === 'asset') return asset.assetId;
  if (asset.isNative || !asset.contractAddress) return asset.chainId;
  return asset.contractAddress.length > 14
    ? `${asset.contractAddress.slice(0, 6)}…${asset.contractAddress.slice(-4)}`
    : asset.contractAddress;
}

export function getMarketWidgetAssetSubtitle(asset: IMarketWidgetAsset) {
  const subtitle =
    asset.name || (asset.kind === 'asset' ? asset.assetId : asset.chainId);
  return subtitle === getMarketWidgetAssetTitle(asset) ? undefined : subtitle;
}

export function getMarketWidgetAssetSearchText(asset: IMarketWidgetAsset) {
  return [
    asset.symbol,
    asset.name,
    asset.kind === 'asset'
      ? asset.assetId
      : `${asset.chainId} ${asset.contractAddress} ${asset.requestTokenAddress}`,
  ]
    .join(' ')
    .toLowerCase();
}

export function containsMarketWidgetAsset(
  assets: IMarketWidgetAsset[],
  selected: IMarketWidgetAsset | undefined,
) {
  return (
    !!selected &&
    assets.some(
      (asset) =>
        getMarketWidgetAssetKey(asset) === getMarketWidgetAssetKey(selected),
    )
  );
}

export function isMarketWidgetAssetAvailable({
  state,
  source,
  asset,
  profileId,
}: {
  state: IMarketWidgetEditorState;
  source: IMarketWidgetSource;
  asset: IMarketWidgetAsset | undefined;
  profileId: string | undefined;
}) {
  if (containsMarketWidgetAsset(state[source], asset)) return true;
  const profile = state.profiles.find((item) => item.id === profileId);
  return (
    source === 'hot' &&
    profile?.source === 'hot' &&
    !!asset &&
    !!profile.asset &&
    getMarketWidgetAssetKey(profile.asset) === getMarketWidgetAssetKey(asset)
  );
}
