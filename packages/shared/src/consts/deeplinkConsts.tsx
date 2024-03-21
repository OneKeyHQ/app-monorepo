export const ONEKEY_APP_DEEP_LINK_NAME = 'onekey-wallet';
export const ONEKEY_APP_DEEP_LINK = `${ONEKEY_APP_DEEP_LINK_NAME}://`; // onekey:// will open onekey legacy
export const WALLET_CONNECT_DEEP_LINK_NAME = 'wc';
export const WALLET_CONNECT_DEEP_LINK = `${WALLET_CONNECT_DEEP_LINK_NAME}://`;

// https://explorer-api.walletconnect.com/v3/all?projectId=2f05ae7f1116030fde2d36508f472bfb&entries=40&page=1&search=onekey&build=1710747625972
export const ONEKEY_UNIVERSAL_LINK_HOST = 'app.onekey.so';
export const WalletConnectUniversalLinkPath = 'wc/connect/wc';
export const WalletConnectUniversalLinkPathSchema = `/wc/connect/wc`; // do not add ? at the end (which meaning optional)
// use /wc/connect but not /wc/connect/wc, the last /wc will be added by WalletConnect SDK
export const WalletConnectUniversalLinkFull = `https://${ONEKEY_UNIVERSAL_LINK_HOST}/wc/connect`;
