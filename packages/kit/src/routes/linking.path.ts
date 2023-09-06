import { WalletConnectUniversalLinkPathSchema } from './deepLink';
import { AccountRootLandingPathSchema } from './Root/AccountRootLanding';

export const linkingPathMap = {
  // ** root urls
  walletConnectUniversalLink: WalletConnectUniversalLinkPathSchema,
  watchingAccountAdding: AccountRootLandingPathSchema,
  onLanding: '/onlanding',

  // ** tab urls
  tabHome: `/`,
  tabSwap: `/swap`,
  tabMarket: `/market`,
  tabNFT: `/nft`,
  tabMe: `/menu`,
  tabDiscover: `/explorer`,
  tabDeveloper: `/developer`,

  // ** home urls
  tokenDetail: `/tokenDetail`,
  marketDetail: `/marketDetail`,
  pnlAtHome: `/pnl`,
  pnlAtNFT: `/nft/pnl`,
  bulkSender: `/bulkSender`,
};

// open url matched here won't show unlock screen
// TODO use https://www.npmjs.com/package/path-to-regexp to check match
export const unlockWhiteListUrls = [
  '/account/', // /account/0x88888
  '/wc/connect',
  '/wc/connect/wc',
  linkingPathMap.onLanding,
  linkingPathMap.pnlAtHome,
  linkingPathMap.pnlAtNFT,
];
