export type IMarketWidgetAsset =
  | {
      kind: 'stock';
      stockId: string;
      symbol: string;
      name: string;
      logoURL?: string;
    }
  | {
      kind: 'asset';
      assetId: string;
      symbol: string;
      name: string;
      logoURL?: string;
    }
  | {
      kind: 'token';
      chainId: string;
      contractAddress: string;
      requestTokenAddress: string;
      isNative: boolean;
      symbol: string;
      name: string;
      logoURL?: string;
    };

export type IMarketWidgetConfiguration = {
  schemaVersion: 1;
  assets: IMarketWidgetAsset[];
  greenUp: boolean;
  locale: string;
  privacyMasked?: boolean;
};

export type IMarketWidgetQuoteUpdate = {
  currency: 'usd';
  quote: {
    asset: IMarketWidgetAsset;
    price: string;
    change24h?: string;
    // Request start (or live tick receipt), never the time a cached value is read.
    fetchedAt: number;
    stockSparkline?: number[];
    priceUpdatedAt?: number;
    marketClosed?: boolean;
  };
};

export type IMarketWidgetKind = 'single' | 'list';
export type IMarketWidgetSource = 'watchlist' | 'hot';

export type IMarketWidgetProfile = {
  id: string;
  kind: IMarketWidgetKind;
  name: string;
  source: IMarketWidgetSource;
  asset?: IMarketWidgetAsset;
  assets?: IMarketWidgetAsset[];
};

export type IMarketWidgetProfileInput = Omit<IMarketWidgetProfile, 'id'> & {
  id?: string;
};

export type IMarketWidgetEditorState = {
  profiles: IMarketWidgetProfile[];
  settings?: IMarketWidgetProfile[];
  watchlist: IMarketWidgetAsset[];
  hot: IMarketWidgetAsset[];
  privacyMasked: boolean;
};

export type IMarketWidgetModule = {
  isSupported: () => boolean;
  supportsStockAssets: () => boolean;
  supportsProfileEditing: () => boolean;
  supportsSettingsEditing: () => boolean;
  supportsQuoteSync: () => boolean;
  syncQuote: (update: IMarketWidgetQuoteUpdate) => Promise<boolean>;
  setConfiguration: (
    configuration: IMarketWidgetConfiguration,
  ) => Promise<void>;
  getEditorState: (editorSession?: string) => Promise<IMarketWidgetEditorState>;
  refreshEditorState?: (
    editorSession?: string,
  ) => Promise<IMarketWidgetEditorState>;
  finishEditing?: (editorSession: string, saved: boolean) => Promise<void>;
  saveProfile: (
    profile: IMarketWidgetProfileInput,
  ) => Promise<IMarketWidgetProfile>;
  saveSettings: (
    settings: Omit<IMarketWidgetProfile, 'id'>,
    editorSession?: string,
  ) => Promise<IMarketWidgetProfile>;
};
