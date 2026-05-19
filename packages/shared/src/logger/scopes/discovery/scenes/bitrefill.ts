import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export type IBitrefillFailStep =
  | 'handlePaymentUri'
  | 'connectWallet'
  | 'switchNetwork'
  | 'resolveAccount'
  | 'resolveToken'
  | 'buildUnsignedTx'
  | 'openSignModal'
  | 'unknown';

export class BitrefillScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public paymentIntentReceived(params: {
    networkId?: string;
    tokenAddress?: string;
  }) {
    return params;
  }

  @LogToLocal()
  public paymentIntentFailed(params: {
    step: IBitrefillFailStep;
    message: string;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public walletReconnectTriggered(params: {
    reason: 'multiAccount';
    connectedCount: number;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public userRejectedConnect() {
    return {};
  }
}
