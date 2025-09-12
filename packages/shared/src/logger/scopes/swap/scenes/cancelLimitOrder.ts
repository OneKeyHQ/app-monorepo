import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class CancelLimitOrderScene extends BaseScene {
  @LogToServer({ level: 'info' })
  @LogToLocal({ level: 'info' })
  public cancelLimitOrder({
    cancelFrom,
    chain,
    sourceTokenSymbol,
    receivedTokenSymbol,
    sellTokenAmount,
  }: {
    cancelFrom: string;
    chain: string;
    sourceTokenSymbol: string;
    receivedTokenSymbol: string;
    sellTokenAmount: string;
  }) {
    return {
      cancelFrom,
      chain,
      sourceTokenSymbol,
      receivedTokenSymbol,
      sellTokenAmount,
    };
  }
}
