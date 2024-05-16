import CoreChainAda from '../chains/ada';
// import CoreChainAlgo from '../chains/algo';
// import CoreChainApt from '../chains/apt';
import CoreChainBch from '../chains/bch';
import CoreChainBtc from '../chains/btc';
import CoreChainCfx from '../chains/cfx';
import CoreChainCosmos from '../chains/cosmos';
import CoreChainDnx from '../chains/dnx';
import CoreChainDoge from '../chains/doge';
// import CoreChainDot from '../chains/dot';
import CoreChainEvm from '../chains/evm';
// import CoreChainFil from '../chains/fil';
import CoreChainKaspa from '../chains/kaspa';
import CoreChainLightning from '../chains/lightning';
import CoreChainLtc from '../chains/ltc';
import CoreChainNear from '../chains/near';
import CoreChainNeurai from '../chains/neurai';
import CoreChainNexa from '../chains/nexa';
import CoreChainNostr from '../chains/nostr';
import CoreChainSol from '../chains/sol';
// import CoreChainStc from '../chains/stc';
// import CoreChainSui from '../chains/sui';
import CoreChainTron from '../chains/tron';
// import CoreChainXmr from '../chains/xmr';
import CoreChainXrp from '../chains/xrp';

export class CoreChainApiHub {
  ada = new CoreChainAda();

  evm = new CoreChainEvm();

  btc = new CoreChainBtc();

  cosmos = new CoreChainCosmos();

  bch = new CoreChainBch();

  ltc = new CoreChainLtc();

  doge = new CoreChainDoge();

  lightning = new CoreChainLightning();

  // algo = new CoreChainAlgo();

  // apt = new CoreChainApt();

  cfx = new CoreChainCfx();

  xrp = new CoreChainXrp();

  tron = new CoreChainTron();

  sol = new CoreChainSol();

  near = new CoreChainNear();

  // stc = new CoreChainStc();

  kaspa = new CoreChainKaspa();

  // sui = new CoreChainSui();

  // dot = new CoreChainDot();

  // fil = new CoreChainFil();

  // xmr = new CoreChainXmr();

  nexa = new CoreChainNexa();

  nostr = new CoreChainNostr();

  neurai = new CoreChainNeurai();

  dnx = new CoreChainDnx();
}
