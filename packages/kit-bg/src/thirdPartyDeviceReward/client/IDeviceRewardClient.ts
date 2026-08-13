// ⚠️ 见 ../README.md — 本文件夹未来迁移。
//
// 领券客户端的统一接口。两个实现:
//   LocalMockDeviceRewardClient  — 本地模拟(当前,dev-only)
//   ServerDeviceRewardClient     — 调 OneKey Rebate 后端(未来默认)
// 切换本地/服务端 = 换实现,调用方不动。

import type {
  IThirdPartyDeviceRewardChallenge,
  IThirdPartyDeviceRewardClaimResult,
  IThirdPartyDeviceRewardEvidence,
  IThirdPartyDeviceRewardWalletInfo,
  IThirdPartyHardwareRewardVendor,
} from '@onekeyhq/shared/src/referralCode/type';

// 账户地址对 challenge.addressMessage 的签名。client 不关心签名怎么产生的。
export interface IDeviceRewardAddressSignature {
  scheme: 'evm-personal-sign' | 'btc-ecdsa';
  address: string;
  signature: string;
  pubkey?: string;
}

export interface IDeviceRewardCreateChallengeParams {
  walletId: string;
  vendor: IThirdPartyHardwareRewardVendor;
  campaignId: string;
  walletAddAttemptId: string;
}

export interface IDeviceRewardClaimParams {
  challengeId: string;
  addressSignature: IDeviceRewardAddressSignature;
  // 真机验真的产物(Trezor 证书链 / Ledger sessionId),由 deviceComm 产出。
  evidence: IThirdPartyDeviceRewardEvidence;
  // 邀请码是可选入参,client 不依赖 referral,谁调用谁负责传。
  inviteCode?: string;
}

export interface IDeviceRewardClient {
  // 领券链路只包含"跟后端说话"的两步:①申请挑战 ④提交领取。
  // ②真机验真、③地址签名由调用方用 deviceComm + 钱包完成,不在本接口。
  getWalletInfo(params: {
    walletId: string;
  }): Promise<IThirdPartyDeviceRewardWalletInfo | null>;

  createChallenge(
    params: IDeviceRewardCreateChallengeParams,
  ): Promise<IThirdPartyDeviceRewardChallenge>;

  claim(
    params: IDeviceRewardClaimParams,
  ): Promise<IThirdPartyDeviceRewardClaimResult>;
}
