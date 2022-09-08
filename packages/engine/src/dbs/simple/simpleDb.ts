import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { SimpleDbEntityHistory } from './entity/SimpleDbEntityHistory';
import { SimpleDbEntityLastActivity } from './entity/SimpleDbEntityLastActivity';
import { SimpleDbEntityNFT } from './entity/SimpleDbEntityNFT';
import { SimpleDbEntityTokens } from './entity/SimpleDbEntityPresetTokens';
import { SimpleDbEntityPwKey } from './entity/SimpleDbEntityPwKey';
import { SimpleDbEntitySwap } from './entity/SimpleDbEntitySwap';
import { SimpleDbEntityWalletConnect } from './entity/SimpleDbEntityWalletConnect';

class SimpleDb {
  history = new SimpleDbEntityHistory();

  pwkey = new SimpleDbEntityPwKey();

  lastActivity = new SimpleDbEntityLastActivity();

  swap = new SimpleDbEntitySwap();

  token = new SimpleDbEntityTokens();

  walletConnect = new SimpleDbEntityWalletConnect();

  nft = new SimpleDbEntityNFT();
}

// eslint-disable-next-line import/no-mutable-exports
let simpleDb: SimpleDb;

if (platformEnv.isExtensionUi) {
  simpleDb = new Proxy(
    {},
    {
      get() {
        throw new Error('[simpleDb] is NOT allowed in UI process currently.');
      },
    },
  ) as SimpleDb;
} else {
  simpleDb = new SimpleDb();
}

if (process.env.NODE_ENV !== 'production') {
  global.$simpleDb = simpleDb;
}

export default simpleDb;
