import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type {
  EExportTimeRange,
  IBatchCheckWalletItem,
  IBatchCheckWalletResponse,
  IEarnPositionsResponse,
  IEarnRewardResponse,
  IEarnWalletHistory,
  IExportInviteDataParams,
  IHardwareCumulativeRewards,
  IHardwareRecordItem,
  IHardwareRecordsResponse,
  IHardwareSalesRecord,
  IInviteCodeItem,
  IInviteCodeListResponse,
  IInviteHistory,
  IInviteLevelDetail,
  IInvitePaidHistory,
  IInvitePostConfig,
  IInviteSummary,
  IPerpsCumulativeRewardsParams,
  IPerpsCumulativeRewardsResponse,
  IPerpsInviteeRewardsResponse,
  IPerpsInvitesParams,
  IPerpsInvitesResponse,
  IPerpsRecordsResponse,
  IRedemptionCodeRedeemParams,
  IRedemptionCodeRedeemResponse,
  IRedemptionRecordsResponse,
  IUpdateInviteCodeNoteResponse,
} from '@onekeyhq/shared/src/referralCode/type';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { IHyperLiquidSignatureRSV } from '@onekeyhq/shared/types/hyperliquid/webview';

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
  async getLevelDetail() {
    const client = await this.getOneKeyIdClient(EServiceEndpointEnum.Rebate);
    const response = await client.get<{
      data: IInviteLevelDetail;
    }>('/rebate/v1/invite/level-detail');
    return response.data.data;
  }

  @backgroundMethod()
  async createInviteCode() {
    const client = await this.getOneKeyIdClient(EServiceEndpointEnum.Rebate);
    const response = await client.post<{
      data: IInviteCodeItem;
    }>('/rebate/v1/invite-codes');
    return response.data.data;
  }

  @backgroundMethod()
  async getInviteCodeList() {
    const client = await this.getOneKeyIdClient(EServiceEndpointEnum.Rebate);
    const response = await client.get<{
      data: IInviteCodeListResponse;
    }>('/rebate/v1/invite-codes');
    return response.data.data;
  }

  @backgroundMethod()
  async updateInviteCodeNote(params: { code: string; note: string }) {
    const client = await this.getOneKeyIdClient(EServiceEndpointEnum.Rebate);
    const response = await client.put<{
      data: IUpdateInviteCodeNoteResponse;
    }>('/rebate/v1/invite-codes/note', params);
    return response.data.data;
  }

  @backgroundMethod()
  async exportInviteData(params: IExportInviteDataParams) {
    const client = await this.getOneKeyIdClient(EServiceEndpointEnum.Rebate);
    const queryParams: {
      subject: string;
      timeRange?: string;
      inviteCode?: string;
      tab?: string;
      startTime?: number;
      endTime?: number;
    } = {
      subject: params.subject,
    };
    // Only pass timeRange when not using custom date range
    if (params.startTime && params.endTime) {
      queryParams.startTime = params.startTime;
      queryParams.endTime = params.endTime;
    } else {
      queryParams.timeRange = params.timeRange;
    }
    if (params.inviteCode) {
      queryParams.inviteCode = params.inviteCode;
    }
    if (params.tab) {
      queryParams.tab = params.tab;
    }
    // API returns CSV string directly, not JSON
    const response = await client.get<string>('/rebate/v1/invite/export', {
      params: queryParams,
      responseType: 'text',
      autoHandleError: false, // Skip JSON error checking for CSV response
    } as any);

    // Parse filename from Content-Disposition header
    const contentDisposition = response.headers['content-disposition'] as
      | string
      | undefined;
    let filename: string | undefined;
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
      if (match) {
        filename = match[1];
      }
    }

    return {
      data: response.data,
      filename,
    };
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
  async getHardwareSales(
    cursor?: string,
    timeRange?: EExportTimeRange,
    inviteCode?: string,
  ) {
    const client = await this.getOneKeyIdClient(EServiceEndpointEnum.Rebate);
    const params: {
      subject: string;
      cursor?: string;
      timeRange?: string;
      inviteCode?: string;
    } = {
      subject: 'HardwareSales',
    };
    if (cursor) {
      params.cursor = cursor;
    }
    if (timeRange) {
      params.timeRange = timeRange;
    }
    if (inviteCode) {
      params.inviteCode = inviteCode;
    }
    const response = await client.get<{
      data: IHardwareSalesRecord;
    }>('/rebate/v1/invite/records', { params });
    return response.data.data;
  }

  @backgroundMethod()
  async getHardwareCumulativeRewards(
    inviteCode?: string,
    timeRange?: EExportTimeRange,
    startTime?: number,
    endTime?: number,
  ): Promise<IHardwareCumulativeRewards> {
    const client = await this.getOneKeyIdClient(EServiceEndpointEnum.Rebate);
    const params: {
      inviteCode?: string;
      timeRange?: string;
      startTime?: number;
      endTime?: number;
    } = {};
    if (inviteCode) {
      params.inviteCode = inviteCode;
    }
    if (timeRange) {
      params.timeRange = timeRange;
    }
    if (startTime) {
      params.startTime = startTime;
    }
    if (endTime) {
      params.endTime = endTime;
    }
    const response = await client.get<{
      data: IHardwareCumulativeRewards;
    }>('/rebate/v1/invite/hardware-cumulative-rewards', { params });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data.data;
  }

  @backgroundMethod()
  async getPerpsCumulativeRewards(
    params: IPerpsCumulativeRewardsParams,
  ): Promise<IPerpsCumulativeRewardsResponse> {
    const client = await this.getOneKeyIdClient(EServiceEndpointEnum.Rebate);
    const queryParams: {
      timeRange?: string;
      startTime?: number;
      endTime?: number;
      inviteCode?: string;
    } = {};
    if (params.timeRange) {
      queryParams.timeRange = params.timeRange;
    }
    if (params.startTime) {
      queryParams.startTime = params.startTime;
    }
    if (params.endTime) {
      queryParams.endTime = params.endTime;
    }
    if (params.inviteCode) {
      queryParams.inviteCode = params.inviteCode;
    }
    const response = await client.get<{
      data: IPerpsCumulativeRewardsResponse;
    }>('/rebate/v1/invite/perps-cumulative-rewards', { params: queryParams });
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
  async getEarnReward(
    cursor?: string,
    available?: boolean,
    timeRange?: EExportTimeRange,
    inviteCode?: string,
    startTime?: number,
    endTime?: number,
  ) {
    const client = await this.getOneKeyIdClient(EServiceEndpointEnum.Rebate);
    const params: {
      cursor?: string;
      status?: string;
      timeRange?: string;
      inviteCode?: string;
      startTime?: number;
      endTime?: number;
    } = {};
    if (cursor) {
      params.cursor = cursor;
    }
    if (available) {
      params.status = 'AVAILABLE';
    }
    if (timeRange) {
      params.timeRange = timeRange;
    }
    if (inviteCode) {
      params.inviteCode = inviteCode;
    }
    if (startTime) {
      params.startTime = startTime;
    }
    if (endTime) {
      params.endTime = endTime;
    }
    const response = await client.get<{
      data: IEarnRewardResponse;
    }>('/rebate/v1/invite/earn-records', { params });
    return response.data.data;
  }

  @backgroundMethod()
  async getPerpsRecords(
    timeRange?: EExportTimeRange,
    inviteCode?: string,
    status?: 'AVAILABLE',
  ): Promise<IPerpsRecordsResponse> {
    const client = await this.getOneKeyIdClient(EServiceEndpointEnum.Rebate);
    const params: {
      timeRange?: string;
      inviteCode?: string;
      status?: string;
    } = {};
    if (timeRange) {
      params.timeRange = timeRange;
    }
    if (inviteCode) {
      params.inviteCode = inviteCode;
    }
    if (status) {
      params.status = status;
    }
    const response = await client.get<{ data: IPerpsRecordsResponse }>(
      '/rebate/v1/invite/perps-records',
      { params },
    );
    return response.data.data;
  }

  @backgroundMethod()
  async getPerpsInviteeRewards(params: {
    walletAddress: string;
  }): Promise<IPerpsInviteeRewardsResponse> {
    const client = await this.getOneKeyIdClient(EServiceEndpointEnum.Rebate);
    const response = await client.get<{ data: IPerpsInviteeRewardsResponse }>(
      '/rebate/v1/invite/perps-invitee-rewards',
      { params },
    );
    return response.data.data;
  }

  @backgroundMethod()
  async getPerpsInvites(
    params: IPerpsInvitesParams,
  ): Promise<IPerpsInvitesResponse> {
    const client = await this.getOneKeyIdClient(EServiceEndpointEnum.Rebate);
    const queryParams: {
      tab: string;
      timeRange?: string;
      startTime?: number;
      endTime?: number;
      inviteCode?: string;
      hideZeroVolume?: boolean;
      sortBy?: string;
      sortOrder?: string;
      cursor?: string;
    } = {
      tab: params.tab,
    };
    if (params.timeRange) {
      queryParams.timeRange = params.timeRange;
    }
    if (params.startTime) {
      queryParams.startTime = params.startTime;
    }
    if (params.endTime) {
      queryParams.endTime = params.endTime;
    }
    if (params.inviteCode) {
      queryParams.inviteCode = params.inviteCode;
    }
    if (params.hideZeroVolume !== undefined) {
      queryParams.hideZeroVolume = params.hideZeroVolume;
    }
    if (params.sortBy) {
      queryParams.sortBy = params.sortBy;
    }
    if (params.sortOrder) {
      queryParams.sortOrder = params.sortOrder;
    }
    if (params.cursor) {
      queryParams.cursor = params.cursor;
    }
    const response = await client.get<{ data: IPerpsInvitesResponse }>(
      '/rebate/v1/invite/perps-invites',
      { params: queryParams },
    );
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
      const { address, networkId } = walletReferralCode;
      const batchResult = await this.batchCheckWalletsBoundReferralCode([
        { address, networkId },
      ]);
      const key = `${networkId}:${address}`;
      const alreadyBound = batchResult[key] ?? false;
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
  async batchCheckWalletsBoundReferralCode(items: IBatchCheckWalletItem[]) {
    const client = await this.getClient(EServiceEndpointEnum.Rebate);
    const response = await client.post<{
      data: IBatchCheckWalletResponse;
    }>('/rebate/v1/wallet/batch-check', { items });
    // Response: { code: 0, message: "success", data: { "networkId:address": boolean } }
    return response.data.data;
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
  async getCachedInviteCode() {
    return this.backgroundApi.simpleDb.referralCode.getCachedInviteCode();
  }

  @backgroundMethod()
  async setCachedInviteCode(code: string) {
    return this.backgroundApi.simpleDb.referralCode.setCachedInviteCode(code);
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

  @backgroundMethod()
  async getHardwareRecords(
    cursor?: string,
    timeRange?: EExportTimeRange,
    inviteCode?: string,
    startTime?: number,
    endTime?: number,
  ): Promise<IHardwareRecordsResponse> {
    const client = await this.getOneKeyIdClient(EServiceEndpointEnum.Rebate);
    const params: {
      limit: number;
      cursor?: string;
      timeRange?: string;
      inviteCode?: string;
      startTime?: number;
      endTime?: number;
    } = {
      limit: 10,
    };
    if (cursor) {
      params.cursor = cursor;
    }
    if (timeRange) {
      params.timeRange = timeRange;
    }
    if (inviteCode) {
      params.inviteCode = inviteCode;
    }
    if (startTime) {
      params.startTime = startTime;
    }
    if (endTime) {
      params.endTime = endTime;
    }
    const response = await client.get<{
      data: IHardwareRecordsResponse;
    }>('/rebate/v1/invite/hardware-records', { params });
    return response.data.data;
  }

  @backgroundMethod()
  async getHardwareRecordDetail(id: string): Promise<IHardwareRecordItem> {
    const client = await this.getOneKeyIdClient(EServiceEndpointEnum.Rebate);
    const response = await client.get<{
      data: IHardwareRecordItem;
    }>(`/rebate/v1/invite/hardware-records/${id}`);
    return response.data.data;
  }

  @backgroundMethod()
  async bindPerpsWallet({
    action,
    nonce,
    signature,
    referenceAddress,
    signerAddress,
  }: {
    action: {
      type: string;
      signatureChainId: string;
      hyperliquidChain: string;
      agentAddress: string;
      agentName: string;
      nonce: number;
    };
    nonce: number;
    signature: IHyperLiquidSignatureRSV;
    referenceAddress?: string;
    signerAddress: string;
  }): Promise<{ success: boolean }> {
    const client = await this.getClient(EServiceEndpointEnum.Rebate);
    const response = await client.post<{
      data: { success: boolean };
    }>('/rebate/v1/wallet/perps/bind-wallet', {
      action,
      nonce,
      signature,
      referenceAddress,
      signerAddress,
    });
    return response.data.data;
  }

  @backgroundMethod()
  async getRedemptionRecords(): Promise<IRedemptionRecordsResponse> {
    const client = await this.getOneKeyIdClient(EServiceEndpointEnum.Rebate);
    const response = await client.get<{
      data: IRedemptionRecordsResponse;
    }>('/rebate/v1/redemption-center/records');
    return response.data.data;
  }

  @backgroundMethod()
  async redeemCode(
    params: IRedemptionCodeRedeemParams,
  ): Promise<IRedemptionCodeRedeemResponse> {
    const client = await this.getOneKeyIdClient(EServiceEndpointEnum.Rebate);
    try {
      const response = await client.post<{
        code: number;
        message: string;
        messageId?: string;
        data?: {
          metadata?: {
            previousLevel?: number;
            newLevel?: number;
          };
        };
      }>('/rebate/v1/redemption-center/redemption-code/redeem', params, {
        autoHandleError: false,
      } as any);

      // Check if API returned an error (non-zero code)
      if (response.data.code !== 0) {
        return {
          success: false,
          error: {
            code: response.data.code,
            message: response.data.message,
            messageId: response.data.messageId,
          },
        };
      }

      const metadata = response.data.data?.metadata;
      return {
        success: true,
        upgradeInfo:
          metadata?.previousLevel !== undefined &&
          metadata?.newLevel !== undefined
            ? {
                fromLevel: metadata.previousLevel,
                toLevel: metadata.newLevel,
              }
            : undefined,
      };
    } catch (error) {
      // Handle axios error response
      const axiosError = error as { response?: { data?: unknown } };
      if (axiosError?.response?.data) {
        const errorData = axiosError.response.data as {
          code: number;
          message: string;
          messageId?: string;
        };
        return {
          success: false,
          error: {
            code: errorData.code,
            message: errorData.message,
            messageId: errorData.messageId,
          },
        };
      }
      throw error;
    }
  }
}

export default ServiceReferralCode;
