import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type {
  IEarnPositionsResponse,
  IEarnRewardResponse,
  IEarnWalletHistory,
  IHardwareSalesRecord,
  IInviteHistory,
  IInvitePaidHistory,
  IInvitePostConfig,
  IInviteSummary,
} from '@onekeyhq/shared/src/referralCode/type';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import ServiceBase from './ServiceBase';

import type { IWalletReferralCode } from '../dbs/simple/entity/SimpleDbEntityReferralCode';

@backgroundClass()
class ServiceReferralCode extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async getSummaryInfo() {
    const client = await this.getOneKeyIdClient(EServiceEndpointEnum.Rebate);
    const summary = await client.get<{
      data: IInviteSummary;
    }>('/rebate/v1/invite/summary');
    if (summary.data.data.inviteCode) {
      await this.backgroundApi.serviceReferralCode.updateMyReferralCode(
        summary.data.data.inviteCode,
      );
    }
    return summary.data.data;
  }

  @backgroundMethod()
  async getInvitePaidList() {
    const client = await this.getOneKeyIdClient(EServiceEndpointEnum.Rebate);
    const response = await client.get<{
      data: IInvitePaidHistory;
    }>('/rebate/v1/invite/paid');
    return response.data.data;
  }

  @backgroundMethod()
  async bindAddress(params: {
    networkId: string;
    address: string;
    emailOTP: string;
    uuid: string;
  }) {
    const client = await this.getOneKeyIdClient(EServiceEndpointEnum.Rebate);
    return client.post('/rebate/v1/address', params);
  }

  @backgroundMethod()
  async getHardwareSalesRewardHistory(cursor?: string) {
    const client = await this.getOneKeyIdClient(EServiceEndpointEnum.Rebate);
    const params: {
      subject: string;
      limit: number;
      cursor?: string;
    } = {
      subject: 'HardwareSales',
      limit: 100,
    };
    if (cursor) {
      params.cursor = cursor;
    }
    const response = await client.get<{
      data: IInviteHistory;
    }>('/rebate/v1/invite/history', { params });
    return response.data.data;
  }

  @backgroundMethod()
  async getEarnWalletHistory(cursor?: string) {
    const client = await this.getOneKeyIdClient(EServiceEndpointEnum.Rebate);
    const params: {
      subject: string;
      limit: number;
      cursor?: string;
    } = {
      subject: 'Earn',
      limit: 100,
    };
    if (cursor) {
      params.cursor = cursor;
    }
    const response = await client.get<{
      data: IEarnWalletHistory;
    }>('/rebate/v1/wallet/invite-history', { params });
    return response.data.data;
  }

  @backgroundMethod()
  async getEarnRewardHistory(cursor?: string) {
    const client = await this.getOneKeyIdClient(EServiceEndpointEnum.Rebate);
    const params: {
      subject: string;
      limit: number;
      cursor?: string;
    } = {
      subject: 'Earn',
      limit: 100,
    };
    if (cursor) {
      params.cursor = cursor;
    }
    const response = await client.get<{
      data: IInviteHistory;
    }>('/rebate/v1/invite/history', { params });
    return response.data.data;
  }

  @backgroundMethod()
  async getHardwareSales(cursor?: string) {
    const client = await this.getOneKeyIdClient(EServiceEndpointEnum.Rebate);
    const params: {
      subject: string;
      cursor?: string;
    } = {
      subject: 'HardwareSales',
    };
    if (cursor) {
      params.cursor = cursor;
    }
    const response = await client.get<{
      data: IHardwareSalesRecord;
    }>('/rebate/v1/invite/records', { params });
    return response.data.data;
  }

  @backgroundMethod()
  async getPositions(
    accounts: { networkId: string; accountAddress: string }[],
  ) {
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const response = await client.post<{
      data: IEarnPositionsResponse;
    }>('/earn/v1/positions', { accounts });
    return response.data.data;
  }

  @backgroundMethod()
  async getEarnReward(cursor?: string, available?: boolean) {
    const client = await this.getOneKeyIdClient(EServiceEndpointEnum.Rebate);
    const params: {
      cursor?: string;
      status?: string;
    } = {};
    if (cursor) {
      params.cursor = cursor;
    }
    if (available) {
      params.status = 'AVAILABLE';
    }
    const response = await client.get<{
      data: IEarnRewardResponse;
    }>('/rebate/v1/invite/earn-records', { params });
    return response.data.data;
  }

  @backgroundMethod()
  async getMyReferralCode() {
    const myReferralCode =
      await this.backgroundApi.simpleDb.referralCode.getMyReferralCode();
    setTimeout(async () => {
      const isLogin = await this.backgroundApi.servicePrime.isLoggedIn();
      if (isLogin) {
        void this.getSummaryInfo();
      }
    });
    return myReferralCode;
  }

  @backgroundMethod()
  async checkAndUpdateReferralCode({ accountId }: { accountId: string }) {
    const walletId = accountUtils.getWalletIdFromAccountId({ accountId });
    const walletReferralCode = await this.getWalletReferralCode({
      walletId,
    });
    if (walletReferralCode) {
      const alreadyBound = await this.checkWalletIsBoundReferralCode({
        address: walletReferralCode.address,
        networkId: walletReferralCode.networkId,
      });
      const newWalletReferralCode = {
        ...walletReferralCode,
        isBound: alreadyBound,
      };
      await this.backgroundApi.simpleDb.referralCode.setWalletReferralCode({
        walletId,
        referralCodeInfo: newWalletReferralCode,
      });
      if (alreadyBound) {
        return newWalletReferralCode;
      }
    }
    return undefined;
  }

  @backgroundMethod()
  async updateMyReferralCode(code: string) {
    await this.backgroundApi.simpleDb.referralCode.updateCode({
      myReferralCode: code,
    });
  }

  @backgroundMethod()
  async resetPostConfig() {
    await this.backgroundApi.simpleDb.referralCode.resetPostConfig();
  }

  @backgroundMethod()
  async reset() {
    await this.backgroundApi.simpleDb.referralCode.reset();
  }

  @backgroundMethod()
  async fetchPostConfig() {
    const client = await this.getClient(EServiceEndpointEnum.Rebate);
    const response = await client.get<{
      data: IInvitePostConfig;
    }>('/rebate/v1/invite/post-config');
    const postConfig = response.data.data;
    await this.backgroundApi.simpleDb.referralCode.updatePostConfig(postConfig);
    return postConfig;
  }

  @backgroundMethod()
  async getPostConfig() {
    const postConfig =
      await this.backgroundApi.simpleDb.referralCode.getPostConfig();
    if (postConfig?.locales) {
      setTimeout(() => {
        void this.fetchPostConfig();
      });
      return postConfig;
    }
    return this.fetchPostConfig();
  }

  @backgroundMethod()
  async checkWalletIsBoundReferralCode({
    address,
    networkId,
  }: {
    address: string;
    networkId: string;
  }) {
    const client = await this.getClient(EServiceEndpointEnum.Rebate);
    const response = await client.get<{
      data: { data: boolean };
    }>('/rebate/v1/wallet/check', {
      params: { address, networkId },
    });
    return response.data.data.data;
  }

  @backgroundMethod()
  async getBoundReferralCodeUnsignedMessage({
    address,
    networkId,
    inviteCode,
  }: {
    address: string;
    networkId: string;
    inviteCode: string;
  }) {
    const client = await this.getClient(EServiceEndpointEnum.Rebate);
    const response = await client.post<{
      data: { message: string };
    }>('/rebate/v1/wallet/message', {
      address,
      networkId,
      inviteCode,
    });
    return response.data.data.message;
  }

  @backgroundMethod()
  async boundReferralCodeWithSignedMessage({
    networkId,
    address,
    pubkey,
    referralCode,
    signature,
  }: {
    networkId: string;
    address: string;
    pubkey?: string;
    referralCode: string;
    signature: string;
  }) {
    const client = await this.getClient(EServiceEndpointEnum.Rebate);
    await client.post('/rebate/v1/wallet/bind', {
      networkId,
      address,
      pubkey,
      inviteCode: referralCode,
      signature,
    });
    return true;
  }

  @backgroundMethod()
  async getWalletReferralCode({ walletId }: { walletId: string }) {
    return this.backgroundApi.simpleDb.referralCode.getWalletReferralCode({
      walletId,
    });
  }

  @backgroundMethod()
  async setWalletReferralCode({
    walletId,
    referralCodeInfo,
  }: {
    walletId: string;
    referralCodeInfo: IWalletReferralCode;
  }) {
    return this.backgroundApi.simpleDb.referralCode.setWalletReferralCode({
      walletId,
      referralCodeInfo,
    });
  }

  @backgroundMethod()
  async autoSignBoundReferralCodeMessageByHDWallet({
    unsignedMessage,
    networkId,
    accountId,
  }: {
    unsignedMessage: IUnsignedMessage;
    networkId: string;
    accountId: string;
  }) {
    if (!accountUtils.isHdAccount({ accountId })) {
      return null;
    }
    const cachedPassword =
      await this.backgroundApi.servicePassword.getCachedPassword();
    if (!cachedPassword) {
      return null;
    }

    const result = await this.backgroundApi.serviceSend.signMessage({
      unsignedMessage,
      networkId,
      accountId,
    });
    return result;
  }
}

export default ServiceReferralCode;
