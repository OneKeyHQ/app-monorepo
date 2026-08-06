import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

import type {
  IPerpDepositAddressSourceSelectParams,
  IPerpDepositInitiateParams,
  IPerpDepositMethodPanelViewParams,
  IPerpDepositMethodSelectParams,
  IPerpUserSelectDepositTokenParams,
} from '../type';

export class PerpDepositScene extends BaseScene {
  /** Track a visible deposit-method selection panel. */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public perpDepositMethodPanelView(params: IPerpDepositMethodPanelViewParams) {
    return params;
  }

  /** Track the deposit method explicitly selected from the panel. */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public perpDepositMethodSelect(params: IPerpDepositMethodSelectParams) {
    return params;
  }

  /** Track the effective source token and chain for deposit-address flows. */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public perpDepositAddressSourceSelect(
    params: IPerpDepositAddressSourceSelectParams,
  ) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public perpDepositInitiate(params: IPerpDepositInitiateParams) {
    const { token, ...rest } = params;
    return {
      ...rest,
      tokenSymbol: token.symbol,
      tokenAddress: token.contractAddress,
      tokenNetworkId: token.networkId,
      tokenDecimals: token.decimals,
      tokenName: token.name,
      tokenIsNative: token.isNative,
    };
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public perpUserSelectDepositToken(params: IPerpUserSelectDepositTokenParams) {
    const { userAddress, ...rest } = params;
    void userAddress;
    return rest;
  }
}
