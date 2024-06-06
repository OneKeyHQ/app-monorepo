import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type {
  IAllowanceOverview,
  IAprItem,
  IAprToken,
  ILidoEthOverview,
  ILidoHistoryItem,
  ILidoMaticOverview,
  IServerEvmTransaction,
  IStakeTag,
} from '@onekeyhq/shared/types/staking';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceStaking extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  private baseGetApr = memoizee(
    async (token: IAprToken) => {
      const client = await this.getClient(EServiceEndpointEnum.Earn);
      const resp = await client.get<{
        data: IAprItem[];
      }>(`/earn/v1/apr/index`, { params: { token } });
      return resp.data.data;
    },
    {
      promise: true,
      maxAge: timerUtils.getTimeDurationMs({ minute: 5 }),
    },
  );

  @backgroundMethod()
  async getApr(token: IAprToken): Promise<IAprItem[]> {
    return this.baseGetApr(token);
  }

  @backgroundMethod()
  public async fetchLidoEthOverview({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }): Promise<ILidoEthOverview> {
    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        networkId,
        accountId,
      });
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const resp = await client.get<{
      data: ILidoEthOverview;
    }>(`/earn/v1/lido-eth/overview`, { params: { accountAddress, networkId } });
    return resp.data.data;
  }

  @backgroundMethod()
  public async getLidoEthHistory({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }) {
    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        networkId,
        accountId,
      });
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const resp = await client.get<{
      data: ILidoHistoryItem[];
    }>(`/earn/v1/lido-eth/history`, { params: { accountAddress, networkId } });
    return resp.data.data;
  }

  @backgroundMethod()
  public async buildLidoEthStakingTransaction({
    amount,
    networkId,
  }: {
    amount: string;
    networkId: string;
  }) {
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const resp = await client.post<{
      data: IServerEvmTransaction;
    }>(`/earn/v1/lido-eth/tx/stake`, { amount, networkId });
    return resp.data.data;
  }

  @backgroundMethod()
  public async buildLidoEthPermitMessage({
    amount,
    accountId,
    networkId,
  }: {
    amount: string;
    accountId: string;
    networkId: string;
  }) {
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        networkId,
        accountId,
      });
    const resp = await client.post<{
      data: { message: string; deadline: number };
    }>(`/earn/v1/lido-eth/tx/permit`, { amount, accountAddress, networkId });
    return resp.data.data;
  }

  @backgroundMethod()
  public async buildLidoEthWithdrawalTransaction({
    amount,
    deadline,
    signature,
    networkId,
    accountId,
  }: {
    amount: string;
    deadline: number;
    signature: string;
    accountId: string;
    networkId: string;
  }) {
    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        networkId,
        accountId,
      });
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const resp = await client.post<{
      data: IServerEvmTransaction;
    }>(`/earn/v1/lido-eth/tx/withdrawal`, {
      amount,
      deadline,
      signature,
      accountAddress,
      networkId,
    });
    return resp.data.data;
  }

  @backgroundMethod()
  public async buildLidoEthClaimTransaction({
    requestIds,
    networkId,
  }: {
    requestIds: number[];
    networkId: string;
  }) {
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const resp = await client.post<{
      data: IServerEvmTransaction;
    }>(`/earn/v1/lido-eth/tx/claim`, { requestIds, networkId });
    return resp.data.data;
  }

  @backgroundMethod()
  public async fetchLidoMaticOverview({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }): Promise<ILidoMaticOverview> {
    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        networkId,
        accountId,
      });
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const resp = await client.get<{
      data: ILidoMaticOverview;
    }>(`/earn/v1/lido-matic/overview`, {
      params: { accountAddress, networkId },
    });
    return resp.data.data;
  }

  @backgroundMethod()
  public async getLidoMaticHistory({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }) {
    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        networkId,
        accountId,
      });
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const resp = await client.get<{
      data: ILidoHistoryItem[];
    }>(`/earn/v1/lido-matic/history`, {
      params: { accountAddress, networkId },
    });
    return resp.data.data;
  }

  @backgroundMethod()
  public async buildLidoMaticStakingTransaction({
    amount,
    networkId,
  }: {
    amount: string;
    networkId: string;
  }) {
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const resp = await client.post<{
      data: IServerEvmTransaction;
    }>(`/earn/v1/lido-matic/tx/stake`, { amount, networkId });
    return resp.data.data;
  }

  @backgroundMethod()
  public async buildLidoMaticWithdrawalTransaction({
    amount,
    networkId,
  }: {
    amount: string;
    networkId: string;
  }) {
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const resp = await client.post<{
      data: IServerEvmTransaction;
    }>(`/earn/v1/lido-matic/tx/unstake`, { amount, networkId });
    return resp.data.data;
  }

  @backgroundMethod()
  public async buildLidoMaticClaimTransaction({
    tokenId,
    networkId,
  }: {
    tokenId: number;
    networkId: string;
  }) {
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const resp = await client.post<{
      data: IServerEvmTransaction;
    }>(`/earn/v1/lido-matic/tx/claim`, { tokenId, networkId });
    return resp.data.data;
  }

  @backgroundMethod()
  public async fetchTokenAllowance(params: {
    networkId: string;
    accountId: string;
    tokenAddress: string;
    spenderAddress: string;
    blockNumber?: number;
  }) {
    const { networkId, accountId, ...rest } = params;
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        networkId,
        accountId,
      });

    const resp = await client.get<{
      data: IAllowanceOverview;
    }>(`/earn/v1/on-chain/allowance`, {
      params: { accountAddress, networkId, ...rest },
    });

    return resp.data.data;
  }

  @backgroundMethod()
  public async fetchLocalStakingHistory({
    accountId,
    networkId,
    stakeTag,
  }: {
    accountId: string;
    networkId: string;
    stakeTag: IStakeTag;
  }) {
    const pendingTxs =
      await this.backgroundApi.serviceHistory.getAccountLocalHistoryPendingTxs({
        networkId,
        accountId,
      });
    const stakingTxs = pendingTxs.filter(
      (o) => o.stakingInfo && o.stakingInfo.tags.includes(stakeTag),
    );
    return stakingTxs;
  }
}

export default ServiceStaking;
