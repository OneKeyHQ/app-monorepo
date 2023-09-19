import CoreChainAlgo from '../chains/algo';
import CoreChainBch from '../chains/bch';
import CoreChainBtc from '../chains/btc';
import CoreChainDoge from '../chains/doge';
import CoreChainEvm from '../chains/evm';
import CoreChainLtc from '../chains/ltc';

export class CoreChainApiHub {
  evm = new CoreChainEvm();

  btc = new CoreChainBtc();

  bch = new CoreChainBch();

  ltc = new CoreChainLtc();

  doge = new CoreChainDoge();

  algo = new CoreChainAlgo();
}
