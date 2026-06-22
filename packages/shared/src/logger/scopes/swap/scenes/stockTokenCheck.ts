import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

interface IStockTokenCheckUnavailableParams {
  cacheKey: string;
  networkId: string;
  tokenSymbol?: string;
  errorMessage?: string;
}

export class StockTokenCheckScene extends BaseScene {
  @LogToLocal({ level: 'debug' })
  public stockTokenCheckUnavailable(params: IStockTokenCheckUnavailableParams) {
    return params;
  }
}
