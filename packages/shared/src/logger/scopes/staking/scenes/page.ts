import type { IToken } from '@onekeyhq/shared/types/token';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../decorators';

export class PageScene extends BaseScene {
  @LogToServer()
  @LogToLocal()
  public staking({
    token,
    amount,
    stakingProtocol,
    txnHash,
    tokenValue,
  }: {
    token: IToken;
    amount: string;
    stakingProtocol: string;
    txnHash: string;
    tokenValue: string;
  }) {
    return {
      tokenSymbol: token.symbol,
      tokenAddress: token.address,
      tokenAmount: amount,
      stakingProtocol,
      txnHash,
      tokenValue,
    };
  }

  @LogToServer()
  @LogToLocal()
  public unstaking({
    token,
    amount,
    stakingProtocol,
    txnHash,
    tokenValue,
  }: {
    token: IToken;
    amount: string;
    stakingProtocol: string;
    txnHash: string;
    tokenValue: string;
  }) {
    return {
      tokenSymbol: token.symbol,
      tokenAddress: token.address,
      tokenAmount: amount,
      stakingProtocol,
      txnHash,
      tokenValue,
    };
  }
}
