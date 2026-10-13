import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { BinanceDepositScene } from './scenes/binanceDeposit';
import { OnramperScene } from './scenes/onramper';
import { RequestScene } from './scenes/request';

export class FiatCryptoScope extends BaseScope {
  protected override scopeName = EScopeName.fiatCrypto;

  request = this.createScene('request', RequestScene);

  onramper = this.createScene('onramper', OnramperScene);

  binanceDeposit = this.createScene('binanceDeposit', BinanceDepositScene);
}
