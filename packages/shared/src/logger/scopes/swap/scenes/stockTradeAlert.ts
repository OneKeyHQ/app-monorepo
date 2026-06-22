import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

type IStockTradeAlertParams = {
  alertType: string;
  alertLevel?: string;
  tradeDisabled?: boolean;
  tradeSide?: string;
  stockTokenSymbol?: string;
  stockTokenAddress?: string;
  network?: string;
};

export class StockTradeAlertScene extends BaseScene {
  @LogToServer({ level: 'info' })
  @LogToLocal({ level: 'info' })
  public stockTradeAlertShown(params: IStockTradeAlertParams) {
    return params;
  }

  @LogToServer({ level: 'info' })
  @LogToLocal({ level: 'info' })
  public stockTradeAlertActionClick(
    params: IStockTradeAlertParams & {
      action: string;
    },
  ) {
    return params;
  }
}
