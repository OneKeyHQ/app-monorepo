export type IReceiveShareData = {
  /** localized, e.g. "Receive BTC" */
  title: string;
  /** localized, e.g. "Send only Bitcoin network assets to this address" */
  subtitle: string;
  /** used to emphasize the network name inside the subtitle */
  networkName?: string;
  address: string;
  tokenLogoURI?: string;
  networkLogoURI?: string;
};

export type IReceiveShareImageGeneratorRef = {
  generate: () => Promise<string>;
};
