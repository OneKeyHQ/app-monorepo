import type {
  IMarketWidgetAsset,
  IMarketWidgetEditorState,
  IMarketWidgetKind,
  IMarketWidgetProfile,
  IMarketWidgetSource,
} from '@onekeyhq/shared/src/modules/MarketWidget/types';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

export function getMarketWidgetAssetKey(asset: IMarketWidgetAsset) {
  return asset.kind === 'asset'
    ? `asset:${asset.assetId}`
    : `token:${asset.chainId}|${String(asset.isNative)}|${asset.contractAddress}`;
}

export function getMarketWidgetDisplayAsset({
  asset,
  state,
  source,
  kind,
}: {
  asset: IMarketWidgetAsset | undefined;
  state: IMarketWidgetEditorState | undefined;
  source: IMarketWidgetSource;
  kind: IMarketWidgetKind;
}): IMarketWidgetAsset | undefined {
  if (state?.privacyMasked) return undefined;
  if (!asset || !state) return asset;
  const key = getMarketWidgetAssetKey(asset);
  const settings = state.settings?.find(
    (item) => item.kind === kind && (item.assets || item.source === source),
  );
  const latest =
    state[source].find((item) => getMarketWidgetAssetKey(item) === key) ??
    [...state.watchlist, ...state.hot, ...(settings?.assets ?? [])].find(
      (item) => getMarketWidgetAssetKey(item) === key,
    ) ??
    (settings?.asset && getMarketWidgetAssetKey(settings.asset) === key
      ? settings.asset
      : undefined);
  if (!latest) return asset;
  // Enrichment may update the display, but never replace the user's draft selection.
  return {
    ...asset,
    symbol: latest.symbol.trim() ? latest.symbol : asset.symbol,
    name: latest.name.trim() ? latest.name : asset.name,
    logoURL: latest.logoURL || asset.logoURL,
  };
}

export function isMarketWidgetManualAssetAvailable({
  state,
  asset,
  kind,
}: {
  state: IMarketWidgetEditorState;
  asset: IMarketWidgetAsset | undefined;
  kind: IMarketWidgetKind;
}) {
  if (state.privacyMasked) return false;
  const settings = state.settings?.find((item) => item.kind === kind);
  return containsMarketWidgetAsset(
    [
      ...state.watchlist,
      ...state.hot,
      ...(settings?.assets ?? []),
      ...(settings?.asset ? [settings.asset] : []),
    ],
    asset,
  );
}

export function getMarketWidgetAssetTitle(asset: IMarketWidgetAsset) {
  if (
    asset.kind === 'token' &&
    asset.isNative &&
    (!asset.symbol.trim() || asset.symbol === asset.chainId)
  ) {
    return networkUtils.getLocalNetworkInfo(asset.chainId)?.symbol ?? '—';
  }
  if (asset.symbol.trim()) return asset.symbol;
  if (asset.kind === 'asset') return asset.assetId;
  if (asset.isNative || !asset.contractAddress) return asset.chainId;
  return asset.contractAddress.length > 14
    ? `${asset.contractAddress.slice(0, 6)}…${asset.contractAddress.slice(-4)}`
    : asset.contractAddress;
}

export function getMarketWidgetProfileTitle(
  profile: Pick<IMarketWidgetProfile, 'kind' | 'source' | 'asset'>,
  copy: {
    hotCoins: string;
    watchlist: string;
    singleCoin: string;
    marketList: string;
  },
) {
  const source = profile.source === 'hot' ? copy.hotCoins : copy.watchlist;
  let content = copy.marketList;
  if (profile.kind === 'single') {
    content = profile.asset
      ? getMarketWidgetAssetTitle(profile.asset)
      : copy.singleCoin;
  }
  return `${source} · ${content}`;
}

export function getMarketWidgetAssetSubtitle(asset: IMarketWidgetAsset) {
  if (asset.kind === 'token' && (!asset.name || asset.name === asset.chainId)) {
    return networkUtils.getLocalNetworkInfo(asset.chainId)?.name;
  }
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
  kind,
}: {
  state: IMarketWidgetEditorState;
  source: IMarketWidgetSource;
  asset: IMarketWidgetAsset | undefined;
  profileId?: string;
  kind?: IMarketWidgetKind;
}) {
  if (containsMarketWidgetAsset(state[source], asset)) return true;
  const profile = kind
    ? state.settings?.find((item) => item.kind === kind)
    : state.profiles.find((item) => item.id === profileId);
  return (
    source === 'hot' &&
    profile?.source === 'hot' &&
    !!asset &&
    !!profile.asset &&
    getMarketWidgetAssetKey(profile.asset) === getMarketWidgetAssetKey(asset)
  );
}
