import type { IToken } from '@onekeyhq/shared/types/token';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class PageScene extends BaseScene {
  // OK-59196: first-trade risk disclaimer tracking
  @LogToServer()
  @LogToLocal()
  public earnRiskDisclaimerAgree({
    stakingProtocol,
    tokenSymbol,
    networkId,
  }: {
    stakingProtocol: string;
    tokenSymbol: string;
    networkId?: string;
  }) {
    return { stakingProtocol, tokenSymbol, networkId };
  }

  @LogToServer()
  @LogToLocal()
  public earnRiskDisclaimerReject({
    stakingProtocol,
    tokenSymbol,
    networkId,
  }: {
    stakingProtocol: string;
    tokenSymbol: string;
    networkId?: string;
  }) {
    return { stakingProtocol, tokenSymbol, networkId };
  }

  @LogToServer()
  @LogToLocal()
  public staking({
    token,
    stakingProtocol,
  }: {
    token?: IToken;
    stakingProtocol: string;
  }) {
    return {
      tokenSymbol: token?.symbol,
      tokenAddress: token?.address,
      stakingProtocol,
    };
  }

  @LogToServer()
  @LogToLocal()
  public unstaking({
    token,
    stakingProtocol,
  }: {
    token?: IToken;
    stakingProtocol: string;
  }) {
    return {
      tokenSymbol: token?.symbol,
      tokenAddress: token?.address,
      stakingProtocol,
    };
  }

  @LogToServer()
  @LogToLocal()
  public enterEarn() {
    return {};
  }

  @LogToServer()
  @LogToLocal()
  public earnModeSwitch(params: {
    mode: 'earn' | 'borrow';
    switchType: 'default' | 'tap' | 'swipe';
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public selectAsset({ tokenSymbol }: { tokenSymbol: string }) {
    return {
      tokenSymbol,
    };
  }

  @LogToServer()
  @LogToLocal()
  public selectProvider({
    network,
    stakeProvider,
  }: {
    network: string;
    stakeProvider: string;
  }) {
    return {
      network,
      stakeProvider,
    };
  }

  @LogToLocal()
  public permitSignError({ error }: { error: string }) {
    return {
      error,
    };
  }
}
