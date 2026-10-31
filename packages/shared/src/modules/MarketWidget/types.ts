export type IMarketWidgetAsset =
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
  supportsProfileEditing: () => boolean;
  supportsSettingsEditing: () => boolean;
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
