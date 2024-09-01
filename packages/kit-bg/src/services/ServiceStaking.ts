import { isTaprootAddress } from '@onekeyhq/core/src/chains/btc/sdkBtc';
import type { IEncodedTx } from '@onekeyhq/core/src/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type {
  EEarnProviderEnum,
  ISupportedSymbol,
} from '@onekeyhq/shared/types/earn';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type {
  IAllowanceOverview,
  IAprItem,
  IAprToken,
  IAvailableAsset,
  IClaimableListResponse,
  IEarnAccountResponse,
  IGetPortfolioParams,
  ILidoEthOverview,
  ILidoHistoryItem,
  ILidoMaticOverview,
  IPortfolioItem,
  IServerEvmTransaction,
  IStakeBaseParams,
  IStakeClaimBaseParams,
  IStakeHistoriesResponse,
  IStakeHistoryParams,
  IStakeProtocolDetails,
  IStakeProtocolListItem,
  IStakeTag,
  IStakeTxResponse,
  IWithdrawBaseParams,
} from '@onekeyhq/shared/types/staking';

import { vaultFactory } from '../vaults/factory';

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
    const [xpub, accountAddress] = await Promise.all([
      this.backgroundApi.serviceAccount.getAccountXpub({
        accountId,
        networkId,
      }),
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        accountId,
        networkId,
      }),
    ]);

    const pendingTxs =
      await this.backgroundApi.serviceHistory.getAccountLocalHistoryPendingTxs({
        networkId,
        accountAddress,
        xpub,
      });
    const stakingTxs = pendingTxs.filter(
      (o) => o.stakingInfo && o.stakingInfo.tags.includes(stakeTag),
    );
    return stakingTxs;
  }

  @backgroundMethod()
  public async buildLidoEthPermitMessageData({
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
    }>(`/earn/v1/lido-eth/tx/permit_message`, {
      amount,
      accountAddress,
      networkId,
    });
    return resp.data.data;
  }

  @backgroundMethod()
  async buildStakeTransaction(
    params: IStakeBaseParams,
  ): Promise<IStakeTxResponse> {
    const { networkId, accountId, provider, symbol, ...rest } = params;
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const vault = await vaultFactory.getVault({ networkId, accountId });
    const acc = await vault.getAccount();
    const providerKey = earnUtils.getEarnProviderEnumKey(provider);
    if (!providerKey) {
      throw new Error('Invalid provider');
    }
    const stakingConfig = await this.getStakingConfigs({
      networkId,
      symbol: symbol.toUpperCase() as ISupportedSymbol,
      provider: providerKey,
    });
    if (!stakingConfig) {
      throw new Error('Staking config not found');
    }
    const resp = await client.post<{
      data: IStakeTxResponse;
    }>(`/earn/v1/stake`, {
      accountAddress: acc.address,
      publicKey: stakingConfig.usePublicKey ? acc.pub : undefined,
      // TODO: use real data
      term: 150,
      feeRate: 1,
      networkId,
      symbol,
      provider,
      ...rest,
    });
    return resp.data.data;
  }

  @backgroundMethod()
  async buildUnstakeTransaction(params: IWithdrawBaseParams) {
    const { networkId, accountId, ...rest } = params;
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const vault = await vaultFactory.getVault({ networkId, accountId });
    const acc = await vault.getAccount();
    const resp = await client.post<{
      data: IEncodedTx;
    }>(`/earn/v1/unstake`, {
      accountAddress: acc.address,
      networkId,
      publicKey:
        networkId === getNetworkIdsMap().cosmoshub ? acc.pub : undefined,
      ...rest,
    });
    return resp.data.data;
  }

  @backgroundMethod()
  async buildClaimTransaction(params: IStakeClaimBaseParams) {
    const { networkId, accountId, ...rest } = params;
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        networkId,
        accountId,
      });

    const resp = await client.post<{
      data: IEncodedTx;
    }>(`/earn/v1/claim`, { accountAddress, networkId, ...rest });
    return resp.data.data;
  }

  @backgroundMethod()
  async getStakeHistory(params: IStakeHistoryParams) {
    const { networkId, accountId, ...rest } = params;
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        networkId,
        accountId,
      });

    const resp = await client.get<{
      data: IStakeHistoriesResponse;
    }>(`/earn/v1/stake-histories`, {
      params: {
        accountAddress,
        networkId,
        ...rest,
      },
    });
    return resp.data.data;
  }

  @backgroundMethod()
  async getPortfolioList(params: IGetPortfolioParams) {
    const { networkId, accountId, ...rest } = params;
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const vault = await vaultFactory.getVault({ networkId, accountId });
    const acc = await vault.getAccount();

    const resp = await client.get<{
      data: IPortfolioItem[];
    }>(`/earn/v1/portfolio/list`, {
      params: {
        accountAddress: acc.address,
        networkId,
        publicKey: [getNetworkIdsMap().btc, getNetworkIdsMap().sbtc].includes(
          networkId,
        )
          ? acc.pub
          : undefined,
        ...rest,
      },
    });
    return resp.data.data;
  }

  @backgroundMethod()
  async getProtocolDetails(params: {
    accountId?: string;
    indexedAccountId?: string;
    networkId: string;
    symbol: string;
    provider: string;
  }) {
    const { networkId, accountId, indexedAccountId, ...rest } = params;
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const requestParams: {
      accountAddress?: string;
      networkId: string;
      symbol: string;
      provider: string;
      publicKey?: string;
    } = { networkId, ...rest };
    const account = await this.getEarnAccount({
      accountId: accountId ?? '',
      networkId,
      indexedAccountId,
    });
    if (account?.accountAddress) {
      requestParams.accountAddress = account.accountAddress;
    }
    if (account?.account?.pub) {
      requestParams.publicKey = account?.account?.pub;
    }
    const resp = await client.get<{ data: IStakeProtocolDetails }>(
      '/earn/v1/stake-protocol/detail',
      { params: requestParams },
    );
    return resp.data.data;
  }

  @backgroundMethod()
  async getProtocolList(params: {
    networkId: string;
    accountId: string;
    indexedAccountId?: string;
    symbol: string;
  }) {
    const { networkId, accountId, indexedAccountId, symbol } = params;
    const account = await this.getEarnAccount({
      networkId,
      accountId,
      indexedAccountId,
    });
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const protocolListResp = await client.get<{
      data: { protocols: IStakeProtocolListItem[] };
    }>('/earn/v1/stake-protocol/list', {
      params: {
        accountAddress: account?.accountAddress
          ? account.accountAddress
          : undefined,
        symbol: symbol.toUpperCase(),
      },
    });
    const protocols = protocolListResp.data.data.protocols;
    return protocols;
  }

  @backgroundMethod()
  async getClaimableList(params: {
    networkId: string;
    accountId: string;
    symbol: string;
    provider: string;
  }) {
    const { networkId, accountId, symbol, ...rest } = params;
    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        networkId,
        accountId,
      });
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const resp = await client.get<{
      data: IClaimableListResponse;
    }>('/earn/v1/claimable/list', {
      params: {
        networkId,
        accountAddress,
        symbol: symbol.toUpperCase(),
        ...rest,
      },
    });
    return resp.data.data;
  }

  @backgroundMethod()
  async getWithdrawList(params: {
    networkId: string;
    accountId: string;
    symbol: string;
    provider: string;
  }) {
    const { networkId, accountId, symbol, ...rest } = params;
    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        networkId,
        accountId,
      });
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const resp = await client.get<{
      data: IClaimableListResponse;
    }>('/earn/v1/withdraw/list', {
      params: {
        networkId,
        accountAddress,
        symbol: symbol.toUpperCase(),
        ...rest,
      },
    });
    return resp.data.data;
  }

  @backgroundMethod()
  async getAccountAsset(params: { networkId: string; accountAddress: string }) {
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const resp = await client.get<{
      data: IEarnAccountResponse;
    }>(`/earn/v1/get-account`, { params });
    return {
      ...params,
      earn: resp.data.data,
    };
  }

  @backgroundMethod()
  async fetchAllNetworkAssets({
    accountId,
    networkId,
    assets,
  }: {
    accountId: string;
    networkId: string;
    assets: IAvailableAsset[];
  }) {
    const accounts = await this.getEarnAvailableAccounts({
      accountId,
      networkId,
    });
    const accountParams: { networkId: string; accountAddress: string }[] = [];

    assets.forEach((asset) => {
      const account = accounts.find((i) => i.networkId === asset.networkId);
      if (account?.apiAddress) {
        accountParams.push({
          accountAddress: account?.apiAddress,
          networkId: asset.networkId,
        });
      }
    });

    const uniqueAccountParams = Array.from(
      new Map(
        accountParams.map((item) => [JSON.stringify(item), item]),
      ).values(),
    );

    const resp = await Promise.allSettled(
      uniqueAccountParams.map((params) => this.getAccountAsset(params)),
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return resp.filter((v) => v.status === 'fulfilled').map((i) => i.value);
  }

  @backgroundMethod()
  async getAvailableAssets() {
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const resp = await client.get<{
      data: {
        assets: IAvailableAsset[];
      };
    }>(`/earn/v1/available-assets`);
    return resp.data.data.assets;
  }

  @backgroundMethod()
  async getStakingConfigs({
    networkId,
    symbol,
    provider,
  }: {
    networkId: string;
    symbol: ISupportedSymbol;
    provider: EEarnProviderEnum;
  }) {
    const vaultSettings =
      await this.backgroundApi.serviceNetwork.getVaultSettings({ networkId });
    const allStakingConfig = vaultSettings.stakingConfig;
    if (!allStakingConfig) {
      return null;
    }

    const stakingConfig = allStakingConfig[networkId];
    if (!stakingConfig) {
      return null;
    }

    const providerConfig = stakingConfig.providers[provider];
    if (!providerConfig) {
      return null;
    }

    if (providerConfig.supportedSymbols.includes(symbol)) {
      return providerConfig.configs[symbol];
    }

    return null;
  }

  @backgroundMethod()
  async findSymbolByTokenAddress({
    networkId,
    tokenAddress,
  }: {
    networkId: string;
    tokenAddress: string;
  }) {
    const vaultSettings =
      await this.backgroundApi.serviceNetwork.getVaultSettings({ networkId });

    const allStakingConfig = vaultSettings.stakingConfig;
    if (!allStakingConfig) {
      return null;
    }

    const stakingConfig = allStakingConfig[networkId];
    if (!stakingConfig) {
      return null;
    }

    const normalizedTokenAddress = tokenAddress.toLowerCase();

    const providerEntries = Object.entries(stakingConfig.providers).filter(
      ([, providerConfig]) => providerConfig !== undefined,
    );

    for (const [provider, providerConfig] of providerEntries) {
      const symbolEntry = Object.entries(providerConfig.configs).find(
        ([, config]) =>
          config &&
          config.tokenAddress.toLowerCase() === normalizedTokenAddress,
      );

      if (symbolEntry) {
        const [symbol] = symbolEntry;
        return {
          symbol: symbol as ISupportedSymbol,
          provider: provider as EEarnProviderEnum,
        };
      }
    }

    return null;
  }

  @backgroundMethod()
  async getEarnAccount(params: {
    accountId: string;
    networkId: string;
    indexedAccountId?: string;
  }) {
    const { accountId, networkId, indexedAccountId } = params;
    if (networkUtils.isAllNetwork({ networkId })) {
      throw new Error('networkId should not be all network');
    }
    if (networkUtils.isAllNetwork({ networkId }) && !indexedAccountId) {
      throw new Error('indexedAccountId should be provided');
    }
    if (accountUtils.isOthersAccount({ accountId }) || !indexedAccountId) {
      let account: INetworkAccount | null = null;
      try {
        account = await this.backgroundApi.serviceAccount.getAccount({
          accountId,
          networkId,
        });
      } catch (e) {
        return null;
      }
      if (
        networkUtils.isBTCNetwork(networkId) &&
        !isTaprootAddress(account?.address)
      ) {
        return null;
      }
      const accountAddress =
        await this.backgroundApi.serviceAccount.getAccountAddressForApi({
          networkId,
          accountId,
        });
      return {
        accountId: account.id,
        networkId,
        accountAddress,
        account,
      };
    }
    try {
      const globalDeriveType =
        await this.backgroundApi.serviceNetwork.getGlobalDeriveTypeOfNetwork({
          networkId,
        });
      let deriveType = globalDeriveType;
      // only support taproot for earn
      if (networkUtils.isBTCNetwork(networkId)) {
        deriveType = 'BIP86';
      }
      const networkAccount =
        await this.backgroundApi.serviceAccount.getNetworkAccount({
          accountId: undefined,
          indexedAccountId,
          networkId,
          deriveType,
        });
      const accountAddress =
        await this.backgroundApi.serviceAccount.getAccountAddressForApi({
          networkId,
          accountId: networkAccount.id,
        });
      return {
        accountId: networkAccount.id,
        networkId,
        accountAddress,
        account: networkAccount,
      };
    } catch (e) {
      // ignore error
      return null;
    }
  }

  @backgroundMethod()
  async getEarnAvailableAccounts(params: {
    accountId: string;
    networkId: string;
  }) {
    const { accountId, networkId } = params;
    const { accountsInfo } =
      await this.backgroundApi.serviceAllNetwork.getAllNetworkAccounts({
        accountId,
        networkId,
        fetchAllNetworkAccounts: accountUtils.isOthersAccount({ accountId })
          ? undefined
          : true,
      });
    return accountsInfo.filter(
      (account) =>
        !(
          networkUtils.isBTCNetwork(account.networkId) &&
          !isTaprootAddress(account.apiAddress)
        ),
    );
  }
}

export default ServiceStaking;
