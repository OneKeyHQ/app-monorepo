import type { IToken } from '@onekeyhq/shared/types/token';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../decorators';

export class PageScene extends BaseScene {
  @LogToServer()
  @LogToLocal()
  public staking({
    token,
    stakingProtocol,
  }: {
    token: IToken;
    stakingProtocol: string;
  }) {
    return {
      tokenSymbol: token.symbol,
      tokenAddress: token.address,
      stakingProtocol,
    };
  }

  @LogToServer()
  @LogToLocal()
  public unstaking({
    token,
    stakingProtocol,
  }: {
    token: IToken;
    stakingProtocol: string;
  }) {
    return {
      tokenSymbol: token.symbol,
      tokenAddress: token.address,
      stakingProtocol,
    };
  }
}
