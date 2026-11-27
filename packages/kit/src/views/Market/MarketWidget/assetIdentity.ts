import type {
  IMarketWidgetAsset,
  IMarketWidgetEditorState,
  IMarketWidgetKind,
  IMarketWidgetProfile,
  IMarketWidgetSource,
} from '@onekeyhq/shared/src/modules/MarketWidget/types';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

const defaultAssetNetworkIds: Record<string, string | undefined> = {
  btc: 'btc--0',
  eth: 'evm--1',
  sol: 'sol--101',
};

export function getMarketWidgetAssetKey(asset: IMarketWidgetAsset) {
  if (asset.kind === 'stock') return `stock:${asset.stockId}`;
  return asset.kind === 'asset'
    ? `asset:${asset.assetId}`
    : `token:${asset.chainId}|${asset.isNative === true}|${asset.contractAddress}`;
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
    [
      ...state.watchlist,
      ...state.hot,
      ...(state.searchAssets ?? []),
      ...(settings?.assets ?? []),
    ].find((item) => getMarketWidgetAssetKey(item) === key) ??
    (settings?.asset && getMarketWidgetAssetKey(settings.asset) === key
      ? settings.asset
      : undefined);
  // Enrichment may update the display, but never replace the user's draft selection.
  const display = latest
    ? {
        ...asset,
        symbol: latest.symbol.trim() ? latest.symbol : asset.symbol,
        name: latest.name.trim() ? latest.name : asset.name,
        logoURL: latest.logoURL || asset.logoURL,
      }
    : asset;
  // Public defaults can precede the native catalog's chain-specific identities.
  let networkId: string | undefined;
  if (asset.kind === 'asset') {
    networkId = defaultAssetNetworkIds[asset.assetId];
  } else if (asset.kind === 'token' && asset.isNative) {
    networkId = asset.chainId;
  }
  const logoURL =
    display.logoURL ||
    (networkId
      ? networkUtils.getLocalNetworkInfo(networkId)?.logoURI
      : undefined);
  return logoURL && logoURL !== display.logoURL
    ? { ...display, logoURL }
    : display;
}

export function getMarketWidgetAssetLogoUrls(
  params: Parameters<typeof getMarketWidgetDisplayAsset>[0],
): string[] {
  const display = getMarketWidgetDisplayAsset(params);
  if (!display) return [];
  return [
    ...new Set(
      [params.asset?.logoURL, display.logoURL]
        .map((uri) => uri?.trim())
        .filter((uri): uri is string => !!uri),
    ),
  ];
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
      ...(state.searchAssets ?? []),
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
  if (asset.kind === 'stock') return asset.stockId;
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

function shortContractAddress(address: string) {
  return accountUtils.shortenAddress({
    address,
    leadingLength: 6,
    trailingLength: 4,
  });
}

export function getMarketWidgetAddressCollisions(
  assets: (IMarketWidgetAsset | undefined)[],
) {
  const firstByLabel = new Map<string, string>();
  const collisions = new Set<string>();
  assets.forEach((asset) => {
    if (asset?.kind !== 'token' || asset.isNative) return;
    const label = JSON.stringify([
      asset.chainId,
      getMarketWidgetAssetTitle(asset).toUpperCase(),
      shortContractAddress(asset.contractAddress),
    ]);
    const key = getMarketWidgetAssetKey(asset);
    const first = firstByLabel.get(label);
    if (first && first !== key) {
      collisions.add(first);
      collisions.add(key);
    } else {
      firstByLabel.set(label, key);
    }
  });
  return collisions;
}

export function getMarketWidgetAssetSubtitle(
  asset: IMarketWidgetAsset,
  collisions?: ReadonlySet<string> | 'full',
) {
  if (asset.kind === 'token') {
    const network =
      networkUtils.getLocalNetworkInfo(asset.chainId)?.name ?? asset.chainId;
    let address = '';
    if (!asset.isNative) {
      address =
        collisions === 'full' || collisions?.has(getMarketWidgetAssetKey(asset))
          ? asset.contractAddress
          : shortContractAddress(asset.contractAddress);
    }
    const name = asset.name.trim();
    return [
      network,
      address,
      name && ![network, asset.chainId, asset.symbol].includes(name)
        ? name
        : '',
    ]
      .filter(Boolean)
      .join(' · ');
  }
  const fallback = asset.kind === 'stock' ? asset.stockId : asset.assetId;
  const subtitle = asset.name || fallback;
  return subtitle === getMarketWidgetAssetTitle(asset) ? undefined : subtitle;
}

export function getMarketWidgetAssetSearchText(asset: IMarketWidgetAsset) {
  let identity: string;
  if (asset.kind === 'stock') identity = asset.stockId;
  else if (asset.kind === 'asset') identity = asset.assetId;
  else
    identity = `${asset.chainId} ${asset.contractAddress} ${asset.requestTokenAddress}`;
  return [asset.symbol, asset.name, identity].join(' ').toLowerCase();
}

export function getMarketWidgetAssetSections({
  state,
  source,
  query,
  searchQuery,
}: {
  state: IMarketWidgetEditorState | undefined;
  source: IMarketWidgetSource;
  query: string;
  searchQuery: string | undefined;
}): { key: 'all' | 'stocks' | 'tokens'; data: IMarketWidgetAsset[] }[] {
  const normalized = query.trim();
  const search = normalized.toLowerCase();
  const remote =
    search && normalized === searchQuery ? state?.searchResults : undefined;
  const incomplete = normalized === searchQuery && state?.searchIncomplete;
  const candidates = [
    ...(state?.[source] ?? []),
    ...(search && source === 'hot' && (!remote || incomplete)
      ? (state?.searchAssets ?? [])
      : []),
  ].filter(
    (item) => !search || getMarketWidgetAssetSearchText(item).includes(search),
  );
  const seen = new Set<string>();
  // The server ranks search results; local suggestions must not take precedence.
  const assets = (
    remote ? [...remote, ...(incomplete ? candidates : [])] : candidates
  ).filter((item) => {
    const key = getMarketWidgetAssetKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!search) return assets.length ? [{ key: 'all', data: assets }] : [];
  return [
    {
      key: 'stocks' as const,
      data: assets.filter((item) => item.kind === 'stock'),
    },
    {
      key: 'tokens' as const,
      data: assets.filter((item) => item.kind !== 'stock'),
    },
  ].filter((section) => section.data.length > 0);
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
