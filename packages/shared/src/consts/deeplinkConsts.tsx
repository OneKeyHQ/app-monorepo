export const ONEKEY_APP_DEEP_LINK_NAME = 'onekey-wallet';
export const ONEKEY_APP_DEEP_LINK = `${ONEKEY_APP_DEEP_LINK_NAME}://`; // onekey:// will open onekey legacy
export const WALLET_CONNECT_DEEP_LINK_NAME = 'wc';
export const WALLET_CONNECT_DEEP_LINK = `${WALLET_CONNECT_DEEP_LINK_NAME}://`;

export enum EOneKeyDeepLinkPath {
  url_account = 'url_account',
  market_detail = 'market_detail',
}
export type IEOneKeyDeepLinkParams = {
  [EOneKeyDeepLinkPath.url_account]: {
    networkCode: string;
    address: string;
  };
  [EOneKeyDeepLinkPath.market_detail]: {
    coinGeckoId: string;
  };
};

// https://explorer-api.walletconnect.com/v3/all?projectId=2f05ae7f1116030fde2d36508f472bfb&entries=40&page=1&search=onekey&build=1710747625972
export const ONEKEY_UNIVERSAL_LINK_HOST = '1key.so';
export const ONEKEY_UNIVERSAL_TEST_LINK_HOST = 'app.onekeytest.com';

export const WalletConnectUniversalLinkPath = 'wc/connect/wc';
export const WalletConnectUniversalLinkPathSchema = `/wc/connect/wc`; // do not add ? at the end (which meaning optional)
// use /wc/connect but not /wc/connect/wc, the last /wc will be added by WalletConnect SDK
export const WalletConnectUniversalLinkFull = `https://${ONEKEY_UNIVERSAL_LINK_HOST}/wc/connect`;
