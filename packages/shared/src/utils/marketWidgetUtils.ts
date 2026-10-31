import type { IMarketWatchListItemV2 } from '../../types/market';
import type {
  IMarketWidgetAsset,
  IMarketWidgetConfiguration,
  IMarketWidgetKind,
} from '../modules/MarketWidget/types';

export const MARKET_WIDGET_MAX_ASSETS = 20;
const MARKET_WIDGET_QUERY_KEYS = new Set([
  'stockId',
  'assetId',
  'chainId',
  'contractAddress',
  'isNative',
]);
const MARKET_WIDGET_EDITOR_QUERY_KEYS = new Set([
  'profileId',
  'kind',
  'editorSession',
]);

const validAssetId = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9._:-]{1,128}$/u.test(value);
const validStockId = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value);
const validChainId = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9._:-]{1,64}$/u.test(value);
const validAddress = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9._:/~-]{0,256}$/u.test(value);

export function buildMarketWidgetAssets(
  watchlist: IMarketWatchListItemV2[],
  { includeStocks = true }: { includeStocks?: boolean } = {},
): IMarketWidgetAsset[] {
  const assets: IMarketWidgetAsset[] = [];
  const seen = new Set<string>();
  watchlist.forEach((item) => {
    if (
      assets.length === MARKET_WIDGET_MAX_ASSETS ||
      item.perpsCoin !== undefined
    )
      return;
    let asset: IMarketWidgetAsset;
    let key: string;
    if (item.stockId !== undefined && !item.chainId && !item.assetId) {
      if (!includeStocks || !validStockId(item.stockId)) return;
      const stockId = item.stockId.toUpperCase();
      asset = { kind: 'stock', stockId, symbol: stockId, name: '' };
      key = `stock:${stockId}`;
    } else if (item.assetId !== undefined) {
      if (!validAssetId(item.assetId)) return;
      asset = { kind: 'asset', assetId: item.assetId, symbol: '', name: '' };
      key = `asset:${item.assetId}`;
    } else {
      if (!validChainId(item.chainId) || !validAddress(item.contractAddress)) {
        return;
      }
      const isNative = item.isNative ?? item.contractAddress === '';
      if (!isNative && !item.contractAddress) return;
      asset = {
        kind: 'token',
        chainId: item.chainId,
        contractAddress: item.contractAddress,
        requestTokenAddress: item.contractAddress,
        isNative,
        symbol: '',
        name: '',
      };
      key = `token:${item.chainId}:${item.contractAddress}`;
    }
    if (seen.has(key)) return;
    seen.add(key);
    assets.push(asset);
  });
  return assets;
}

export type IMarketWidgetLinkTarget =
  | { kind: 'home' }
  | {
      kind: 'editor';
      profileId?: string;
      widgetKind?: IMarketWidgetKind;
      editorSession?: string;
    }
  | Pick<Extract<IMarketWidgetAsset, { kind: 'asset' }>, 'kind' | 'assetId'>
  | Pick<Extract<IMarketWidgetAsset, { kind: 'stock' }>, 'kind' | 'stockId'>
  | Pick<
      Extract<IMarketWidgetAsset, { kind: 'token' }>,
      'kind' | 'chainId' | 'contractAddress' | 'isNative'
    >;

export function parseMarketWidgetLink(
  query: Record<string, unknown> | null | undefined,
): IMarketWidgetLinkTarget | undefined {
  const params = query ?? {};
  if (Object.keys(params).length === 0) return { kind: 'home' };
  if (Object.keys(params).some((key) => !MARKET_WIDGET_QUERY_KEYS.has(key))) {
    return undefined;
  }
  if (params.stockId !== undefined) {
    return Object.keys(params).length === 1 && validStockId(params.stockId)
      ? { kind: 'stock', stockId: params.stockId.toUpperCase() }
      : undefined;
  }
  if (params.assetId !== undefined) {
    return Object.keys(params).length === 1 && validAssetId(params.assetId)
      ? { kind: 'asset', assetId: params.assetId }
      : undefined;
  }
  if (
    !validChainId(params.chainId) ||
    !validAddress(params.contractAddress) ||
    (params.isNative !== undefined &&
      params.isNative !== 'true' &&
      params.isNative !== 'false')
  ) {
    return undefined;
  }
  const isNative = params.isNative === 'true';
  if (!isNative && !params.contractAddress) return undefined;
  return {
    kind: 'token',
    chainId: params.chainId,
    contractAddress: params.contractAddress,
    isNative,
  };
}

export function parseMarketWidgetLinkUrl(url: string): {
  matches: boolean;
  target?: IMarketWidgetLinkTarget;
} {
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== 'onekey-wallet:' ||
      !['market_widget', 'market_widget_config'].includes(parsed.hostname)
    ) {
      return { matches: false };
    }
    if (
      parsed.username ||
      parsed.password ||
      parsed.port ||
      parsed.hash ||
      (parsed.pathname !== '' && parsed.pathname !== '/')
    ) {
      return { matches: true };
    }
    const params: Record<string, string> = {};
    const isEditor = parsed.hostname === 'market_widget_config';
    const allowedKeys = isEditor
      ? MARKET_WIDGET_EDITOR_QUERY_KEYS
      : MARKET_WIDGET_QUERY_KEYS;
    for (const [key, value] of parsed.searchParams.entries()) {
      if (!allowedKeys.has(key) || Object.hasOwn(params, key)) {
        return { matches: true };
      }
      params[key] = value;
    }
    if (isEditor) {
      if (Object.keys(params).length === 0) {
        return { matches: true, target: { kind: 'editor' } };
      }
      if (Object.keys(params).length !== 1) return { matches: true };
      if (
        params.editorSession &&
        /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(
          params.editorSession,
        )
      ) {
        return {
          matches: true,
          target: {
            kind: 'editor',
            editorSession: params.editorSession.toLowerCase(),
          },
        };
      }
      if (
        params.profileId &&
        /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(
          params.profileId,
        )
      ) {
        return {
          matches: true,
          target: { kind: 'editor', profileId: params.profileId.toLowerCase() },
        };
      }
      if (params.kind === 'single' || params.kind === 'list') {
        return {
          matches: true,
          target: { kind: 'editor', widgetKind: params.kind },
        };
      }
      return { matches: true };
    }
    return { matches: true, target: parseMarketWidgetLink(params) };
  } catch {
    return { matches: false };
  }
}

export function createMarketWidgetConfigurationSync({
  write,
  onError,
}: {
  write: (configuration: IMarketWidgetConfiguration) => Promise<void>;
  onError: () => void;
}) {
  let revision = 0;
  let pendingRead: (() => Promise<IMarketWidgetConfiguration>) | undefined;
  let running: Promise<void> | undefined;

  async function drain() {
    try {
      while (pendingRead) {
        const read = pendingRead;
        const currentRevision = revision;
        pendingRead = undefined;
        try {
          const configuration = await read();
          if (currentRevision === revision) {
            // Native writes are serialized too: an earlier bridge promise must
            // settle before the next configuration can reach the shared store.
            await write(configuration);
          }
        } catch {
          onError();
        }
      }
    } finally {
      running = undefined;
    }
  }

  return {
    request(read: () => Promise<IMarketWidgetConfiguration>) {
      revision += 1;
      pendingRead = read;
      running ??= drain();
      return running;
    },
    cancel() {
      revision += 1;
      pendingRead = undefined;
    },
  };
}
