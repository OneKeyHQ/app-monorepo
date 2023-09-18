import CoreChainBtc from '../btc';
import CoreChainEvm from '../evm';

export class CoreChainApiHub {
  evm = new CoreChainEvm();

  btc = new CoreChainBtc();
}
