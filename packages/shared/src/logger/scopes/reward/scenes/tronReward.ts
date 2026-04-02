import { BaseScene } from '../../../base/baseScene';
import { LogToServer } from '../../../base/decorators';

export class TronRewardScene extends BaseScene {
  @LogToServer()
  public claimResource({
    networkId,
    address,
    sourceFlag,
    isSuccess,
    resourceType,
    isAutoClaimed,
  }: {
    networkId: string | undefined;
    address: string | undefined;
    sourceFlag: string | undefined;
    isSuccess: boolean | undefined;
    resourceType: string | undefined;
    isAutoClaimed: boolean | undefined;
  }) {
    void address;
    return {
      networkId,
      sourceFlag,
      isSuccess,
      resourceType,
      isAutoClaimed,
    };
  }

  @LogToServer()
  public redeemResource({
    networkId,
    address,
    code,
    sourceFlag,
    isSuccess,
    resourceType,
  }: {
    networkId: string | undefined;
    address: string | undefined;
    code: string | undefined;
    sourceFlag: string | undefined;
    isSuccess: boolean | undefined;
    resourceType: string | undefined;
  }) {
    void address;
    return {
      networkId,
      code,
      sourceFlag,
      isSuccess,
      resourceType,
    };
  }
}
