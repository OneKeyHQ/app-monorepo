import CoreChainBch from '../bch';
import CoreChainBtc from '../btc';
import CoreChainDoge from '../doge';
import CoreChainEvm from '../evm';
import CoreChainLtc from '../ltc';

export class CoreChainApiHub {
  evm = new CoreChainEvm();

  btc = new CoreChainBtc();

  bch = new CoreChainBch();

  ltc = new CoreChainLtc();

  doge = new CoreChainDoge();
}
