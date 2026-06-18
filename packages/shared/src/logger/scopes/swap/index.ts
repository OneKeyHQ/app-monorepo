import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';

import { CancelLimitOrderScene } from './scenes/cancelLimitOrder';
import { CleanSwapOrderScene } from './scenes/cleanSwapOrder';
import { CreateOrderScene } from './scenes/createOrder';
import { EnterSwapScene } from './scenes/enterSwap';
import { ProviderChangeScene } from './scenes/providerChange';
import { SelectTokenScene } from './scenes/selectToken';
import { StockTokenCheckScene } from './scenes/stockTokenCheck';
import { StockTradeAlertScene } from './scenes/stockTradeAlert';
import { SwapEstimateFeeScene } from './scenes/swapEstimateFee';
import { SwapKlineScene } from './scenes/swapKline';
import { SwapOrderLongPendingWarningScene } from './scenes/swapOrderLongPendingWarning';
import { SwapQuoteScene } from './scenes/swapQuote';
import { SwapSendTxScene } from './scenes/swapSendTx';
import { TokenSelectorSearchScene } from './scenes/tokenSelectorSearch';
import { TradeCategorySwitchScene } from './scenes/tradeCategorySwitch';
import { ValueDropTipScene } from './scenes/valueDropTip';

export class SwapScope extends BaseScope {
  protected override scopeName = EScopeName.swap;

  createSwapOrder = this.createScene('createSwapOrder', CreateOrderScene);

  selectToken = this.createScene('selectToken', SelectTokenScene);

  tokenSelectorSearch = this.createScene(
    'tokenSelectorSearch',
    TokenSelectorSearchScene,
  );

  providerChange = this.createScene('providerChange', ProviderChangeScene);

  cancelLimitOrder = this.createScene(
    'cancelLimitOrder',
    CancelLimitOrderScene,
  );

  cleanSwapOrder = this.createScene('cleanSwapOrder', CleanSwapOrderScene);

  swapQuote = this.createScene('swapQuote', SwapQuoteScene);

  enterSwap = this.createScene('enterSwap', EnterSwapScene);

  swapEstimateFee = this.createScene('swapEstimateFee', SwapEstimateFeeScene);

  swapKline = this.createScene('swapKline', SwapKlineScene);

  stockTokenCheck = this.createScene('stockTokenCheck', StockTokenCheckScene);

  swapSendTx = this.createScene('swapSendTx', SwapSendTxScene);

  tradeCategorySwitch = this.createScene(
    'tradeCategorySwitch',
    TradeCategorySwitchScene,
  );

  stockTradeAlert = this.createScene('stockTradeAlert', StockTradeAlertScene);

  valueDropTip = this.createScene('valueDropTip', ValueDropTipScene);

  swapOrderLongPendingWarning = this.createScene(
    'swapOrderLongPendingWarning',
    SwapOrderLongPendingWarningScene,
  );
}
