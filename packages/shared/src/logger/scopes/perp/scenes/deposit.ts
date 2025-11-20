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
    return {
      ...params,
      tokenInfo: params.token,
      tokenSymbol: params.token?.symbol,
      tokenAddress: params.token?.contractAddress,
      tokenNetworkId: params.token?.networkId,
      tokenDecimals: params.token?.decimals,
      tokenLogoURI: params.token?.logoURI,
      tokenName: params.token?.name,
      tokenIsNative: params.token?.isNative,
      tokenPrice: params.token?.price,
      tokenFiatValue: params.token?.fiatValue,
      tokenBalanceParsed: params.token?.balanceParsed,
    };
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public perpUserSelectDepositToken(params: IPerpUserSelectDepositTokenParams) {
    return params;
  }
}
