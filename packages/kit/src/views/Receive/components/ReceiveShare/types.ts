export type IReceiveShareData = {
  /** localized, e.g. "Receive BTC" */
  title: string;
  /** localized, e.g. "Send only Bitcoin network assets to this address" */
  subtitle: string;
  address: string;
  tokenLogoURI?: string;
  networkId?: string;
};

export type IReceiveShareImageGeneratorRef = {
  generate: () => Promise<string>;
};
