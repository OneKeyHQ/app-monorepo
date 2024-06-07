import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { V4SimpleDbEntityHistory } from './v4entity/V4SimpleDbEntityHistory';

export class V4SimpleDb {
  history = new V4SimpleDbEntityHistory();

  // pwkey = new SimpleDbEntityPwKey();

  // lastActivity = new SimpleDbEntityLastActivity();

  // swap = new SimpleDbEntitySwap();

  // token = new SimpleDbEntityTokens();

  // walletConnect = new SimpleDbEntityWalletConnect();

  // nft = new SimpleDbEntityNFT();

  // market = new SimpleDbEntityMarket();

  // setting = new SimpleDbEntitySetting();

  // utxoAccounts = new SimpleDbEntityUtxoAccounts();

  // serverNetworks = new SimpleDbEntityServerNetworks();

  // accountPortfolios = new SimpleDbEntityAccountPortfolios();

  // inscribe = new SimpleDbEntityInscribe();

  // urlInfo = new SimpleDbEntityUrlInfo();
}

// // eslint-disable-next-line import/no-mutable-exports
// let v4simpleDb: V4SimpleDb;

// if (platformEnv.isExtensionUi) {
//   v4simpleDb = new Proxy(
//     {},
//     {
//       get() {
//         throw new Error('[V4SimpleDb] is NOT allowed in UI process currently.');
//       },
//     },
//   ) as V4SimpleDb;
// } else {
//   v4simpleDb = new V4SimpleDb();
// }

// if (process.env.NODE_ENV !== 'production') {
//   global.$$simpleDbV4 = v4simpleDb;
// }

// export default v4simpleDb;
