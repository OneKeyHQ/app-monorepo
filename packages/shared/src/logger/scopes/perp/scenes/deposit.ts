import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';
import { NO_LOG_OUTPUT } from '../../../types';

import type {
  IPerpDepositInitiateParams,
  IPerpDepositMinimumDiagnosticParams,
  IPerpUserSelectDepositTokenParams,
} from '../type';

export class PerpDepositScene extends BaseScene {
  private readonly minimumDiagnosticKeys = new Set<string>();

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

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public perpDepositMinimumDiagnostic(
    params: IPerpDepositMinimumDiagnosticParams,
  ) {
    const { dedupKey, ...rest } = params;
    if (
      this.minimumDiagnosticKeys.has(dedupKey) ||
      this.minimumDiagnosticKeys.size >= 100
    ) {
      return NO_LOG_OUTPUT;
    }
    this.minimumDiagnosticKeys.add(dedupKey);
    return rest;
  }
}
