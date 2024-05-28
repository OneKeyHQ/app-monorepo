import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IAllowanceOverview,
  IAprItem,
  IAprToken,
  ILidoEthOverview,
  ILidoMaticOverview,
  IServerEvmTransaction,
} from '@onekeyhq/shared/types/staking';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceStaking extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  private baseGetApr = memoizee(
    async (token: IAprToken) => {
      const client = await this.getClient();
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
    const client = await this.getClient();
    const resp = await client.get<{
      data: ILidoEthOverview;
    }>(`/earn/v1/lido-eth/overview`, { params: { accountAddress } });
    return resp.data.data;
  }

  @backgroundMethod()
  public async buildLidoEthStakingTransaction({ amount }: { amount: string }) {
    const client = await this.getClient();
    const resp = await client.post<{
      data: IServerEvmTransaction;
    }>(`/earn/v1/lido-eth/tx/stake`, { amount });
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
    const client = await this.getClient();
    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        networkId,
        accountId,
      });
    const resp = await client.post<{
      data: { message: string; deadline: number };
    }>(`/earn/v1/lido-eth/tx/permit`, { amount, accountAddress });
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
    const client = await this.getClient();
    const resp = await client.post<{
      data: IServerEvmTransaction;
    }>(`/earn/v1/lido-eth/tx/withdrawal`, {
      amount,
      deadline,
      signature,
      accountAddress,
    });
    return resp.data.data;
  }

  @backgroundMethod()
  public async buildLidoEthClaimTransaction({
    requestIds,
  }: {
    requestIds: number[];
  }) {
    const client = await this.getClient();
    const resp = await client.post<{
      data: IServerEvmTransaction;
    }>(`/earn/v1/lido-eth/tx/claim`, { requestIds });
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
    const client = await this.getClient();
    const resp = await client.get<{
      data: ILidoMaticOverview;
    }>(`/earn/v1/lido-matic/overview`, { params: { accountAddress } });
    return resp.data.data;
  }

  @backgroundMethod()
  public async buildLidoMaticStakingTransaction({
    amount,
  }: {
    amount: string;
  }) {
    const client = await this.getClient();
    const resp = await client.post<{
      data: IServerEvmTransaction;
    }>(`/earn/v1/lido-matic/tx/stake`, { amount });
    return resp.data.data;
  }

  @backgroundMethod()
  public async buildLidoMaticWithdrawalTransaction({
    amount,
  }: {
    amount: string;
  }) {
    const client = await this.getClient();
    const resp = await client.post<{
      data: IServerEvmTransaction;
    }>(`/earn/v1/lido-matic/tx/unstake`, { amount });
    return resp.data.data;
  }

  @backgroundMethod()
  public async buildLidoMaticClaimTransaction({
    tokenId,
  }: {
    tokenId: number;
  }) {
    const client = await this.getClient();
    const resp = await client.post<{
      data: IServerEvmTransaction;
    }>(`/earn/v1/lido-matic/tx/claim`, { tokenId });
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
    const client = await this.getClient();
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
}

export default ServiceStaking;
