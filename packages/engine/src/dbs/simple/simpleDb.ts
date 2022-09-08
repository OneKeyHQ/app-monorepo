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

const simpleDb = new SimpleDb();
if (process.env.NODE_ENV !== 'production') {
  global.$simpleDb = simpleDb;
}
export default simpleDb;
