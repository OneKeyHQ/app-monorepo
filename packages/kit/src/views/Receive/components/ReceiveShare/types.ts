import type { IReceiveTitleLogo } from '../../utils/receiveTitleUtils';

export type IReceiveShareData = {
  /** localized, e.g. "Receive BTC" */
  title: string;
  /** the token logo the title carries; omitted when the page's title has none */
  titleLogo?: IReceiveTitleLogo;
  /** localized, e.g. "Send only Bitcoin network assets to this address" */
  subtitle: string;
  /** used to emphasize the network name inside the subtitle */
  networkName?: string;
  address: string;
};

export type IReceiveShareImageGeneratorRef = {
  generate: () => Promise<string>;
};
