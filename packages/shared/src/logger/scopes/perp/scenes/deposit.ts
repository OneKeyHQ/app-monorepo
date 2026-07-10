import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

import type {
  IPerpDepositInitiateParams,
  IPerpUserSelectDepositTokenParams,
} from '../type';

export class PerpDepositScene extends BaseScene {
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public perpDepositInitiate(params: IPerpDepositInitiateParams) {
    const { userAddress, receiverAddress, ...rest } = params;
    void userAddress;
    void receiverAddress;
    return {
      ...rest,
      tokenSymbol: params.token?.symbol,
      tokenAddress: params.token?.contractAddress,
      tokenNetworkId: params.token?.networkId,
      tokenDecimals: params.token?.decimals,
      tokenName: params.token?.name,
      tokenIsNative: params.token?.isNative,
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
