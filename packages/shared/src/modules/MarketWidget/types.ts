export type IMarketWidgetAsset =
  | {
      kind: 'asset';
      assetId: string;
      symbol: string;
      name: string;
    }
  | {
      kind: 'token';
      chainId: string;
      contractAddress: string;
      requestTokenAddress: string;
      isNative: boolean;
      symbol: string;
      name: string;
    };

export type IMarketWidgetConfiguration = {
  schemaVersion: 1;
  assets: IMarketWidgetAsset[];
  greenUp: boolean;
  locale: string;
};

export type IMarketWidgetModule = {
  isSupported: () => boolean;
  setConfiguration: (
    configuration: IMarketWidgetConfiguration,
  ) => Promise<void>;
};
