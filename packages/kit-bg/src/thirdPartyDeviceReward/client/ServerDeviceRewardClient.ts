// ⚠️ 见 ../README.md — 本文件夹未来迁移。
//
// 调 OneKey Rebate 后端的实现。领券的两步(①申请挑战 ④提交领取)都走服务器。
//
// 【草案阶段】现在是 client → 转发到 ServiceReferralCode(不动现有代码)。
// 真正迁移时方向反过来:逻辑搬进本 client,ServiceReferralCode 里那三个方法
// 改成转发到这里 —— 那一步才动现有代码,现在不动。

import type {
  IDeviceRewardClaimParams,
  IDeviceRewardClient,
  IDeviceRewardCreateChallengeParams,
} from './IDeviceRewardClient';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type {
  IThirdPartyDeviceRewardChallenge,
  IThirdPartyDeviceRewardClaimResult,
  IThirdPartyDeviceRewardWalletInfo,
} from '@onekeyhq/shared/src/referralCode/type';

export class ServerDeviceRewardClient implements IDeviceRewardClient {
  constructor(private readonly backgroundApi: IBackgroundApi) {}

  getWalletInfo(params: {
    walletId: string;
  }): Promise<IThirdPartyDeviceRewardWalletInfo | null> {
    return this.backgroundApi.serviceReferralCode.getThirdPartyDeviceRewardWalletInfo(
      params,
    );
  }

  createChallenge(
    params: IDeviceRewardCreateChallengeParams,
  ): Promise<IThirdPartyDeviceRewardChallenge> {
    return this.backgroundApi.serviceReferralCode.createThirdPartyDeviceRewardChallenge(
      params,
    );
  }

  claim(
    params: IDeviceRewardClaimParams,
  ): Promise<IThirdPartyDeviceRewardClaimResult> {
    return this.backgroundApi.serviceReferralCode.claimThirdPartyDeviceReward(
      params,
    );
  }
}
