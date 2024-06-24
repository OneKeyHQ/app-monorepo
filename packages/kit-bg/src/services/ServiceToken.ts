import { isNil } from 'lodash';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EthereumMatic,
  SepoliaMatic,
} from '@onekeyhq/shared/src/consts/addresses';
import { getMergedTokenData } from '@onekeyhq/shared/src/utils/tokenUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type {
  IFetchAccountTokensParams,
  IFetchAccountTokensResp,
  IFetchTokenDetailItem,
  IFetchTokenDetailParams,
  IToken,
  ITokenData,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import { vaultFactory } from '../vaults/factory';
import { getVaultSettings } from '../vaults/settings';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceToken extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  _fetchAccountTokensController: AbortController | null = null;

  @backgroundMethod()
  public async abortFetchAccountTokens() {
    if (this._fetchAccountTokensController) {
      this._fetchAccountTokensController.abort();
      this._fetchAccountTokensController = null;
    }
  }

  @backgroundMethod()
  public async fetchAccountTokens(
    params: IFetchAccountTokensParams & { mergeTokens?: boolean },
  ): Promise<IFetchAccountTokensResp> {
    const { mergeTokens, flag, ...rest } = params;
    const { networkId, contractList = [] } = rest;
    if (
      [getNetworkIdsMap().eth, getNetworkIdsMap().sepolia].includes(networkId)
    ) {
      // Add native/matic token address to the contract list, due to the fact that lack of native/matic staking entry page
      const maticAddress =
        networkId === getNetworkIdsMap().eth ? EthereumMatic : SepoliaMatic;
      rest.contractList = ['', maticAddress, ...contractList];
    }
    const vault = await vaultFactory.getChainOnlyVault({
      networkId: rest.networkId,
    });
    const { normalizedAddress } = await vault.validateAddress(
      rest.accountAddress,
    );
    rest.accountAddress = normalizedAddress;
    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    const controller = new AbortController();
    this._fetchAccountTokensController = controller;
    const resp = await client.post<{ data: IFetchAccountTokensResp }>(
      `/wallet/v1/account/token/list?flag=${flag || ''}`,
      rest,
      {
        signal: controller.signal,
      },
    );
    this._fetchAccountTokensController = null;

    let allTokens: ITokenData | undefined;
    if (mergeTokens) {
      const { tokens, riskTokens, smallBalanceTokens } = resp.data.data;
      ({ allTokens } = getMergedTokenData({
        tokens,
        riskTokens,
        smallBalanceTokens,
      }));
    }

    resp.data.data.allTokens = allTokens;
    return resp.data.data;
  }

  @backgroundMethod()
  public async fetchTokensDetails(
    params: IFetchTokenDetailParams,
  ): Promise<IFetchTokenDetailItem[]> {
    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    const resp = await client.post<{ data: IFetchTokenDetailItem[] }>(
      '/wallet/v1/account/token/search',
      params,
    );

    return resp.data.data;
  }

  @backgroundMethod()
  public async updateLocalTokens({
    networkId,
    tokens,
  }: {
    networkId: string;
    tokens: IToken[];
  }) {
    return this.backgroundApi.simpleDb.localTokens.updateTokens({
      networkId,
      tokens,
    });
  }

  @backgroundMethod()
  public async clearLocalTokens() {
    return this.backgroundApi.simpleDb.localTokens.clearTokens();
  }

  @backgroundMethod()
  public async getNativeTokenAddress({ networkId }: { networkId: string }) {
    const vaultSettings = await getVaultSettings({ networkId });
    let tokenAddress = vaultSettings.networkInfo[networkId]?.nativeTokenAddress;
    if (typeof tokenAddress === 'string') {
      return tokenAddress;
    }
    tokenAddress = vaultSettings.networkInfo.default.nativeTokenAddress;
    if (typeof tokenAddress === 'string') {
      return tokenAddress;
    }
    return '';
  }

  @backgroundMethod()
  public async getNativeToken({
    networkId,
    accountAddress,
    tokenIdOnNetwork,
  }: {
    networkId: string;
    accountAddress?: string;
    tokenIdOnNetwork?: string;
  }) {
    let tokenAddress = tokenIdOnNetwork;
    if (isNil(tokenAddress)) {
      tokenAddress = await this.getNativeTokenAddress({ networkId });
    }

    return this.getToken({
      networkId,
      tokenIdOnNetwork: tokenAddress ?? '',
      accountAddress,
    });
  }

  @backgroundMethod()
  public async getToken(params: {
    networkId: string;
    tokenIdOnNetwork: string;
    accountAddress?: string;
  }) {
    const { networkId, tokenIdOnNetwork, accountAddress } = params;

    const localToken = await this.backgroundApi.simpleDb.localTokens.getToken({
      networkId,
      tokenIdOnNetwork,
    });

    if (localToken) return localToken;

    try {
      const tokensDetails = await this.fetchTokensDetails({
        networkId,
        accountAddress,
        contractList: [tokenIdOnNetwork],
      });

      const tokenInfo = tokensDetails[0].info;

      void this.updateLocalTokens({
        networkId,
        tokens: [tokenInfo],
      });

      return tokenInfo;
    } catch (error) {
      console.log('fetchTokensDetails ERROR:', error);
    }

    throw new Error('getToken ERROR: token not found.');
  }

  @backgroundMethod()
  public async blockToken({
    networkId,
    tokenId,
  }: {
    networkId: string;
    tokenId: string;
  }) {
    const unblockedTokens =
      await this.backgroundApi.simpleDb.riskyTokens.getUnblockedTokens(
        networkId,
      );

    if (unblockedTokens[tokenId]) {
      return this.backgroundApi.simpleDb.riskyTokens.updateUnblockedTokens({
        networkId,
        removeFromUnBlockedTokens: [tokenId],
      });
    }

    return this.backgroundApi.simpleDb.riskyTokens.updateBlockedTokens({
      networkId,
      addToBlockedTokens: [tokenId],
    });
  }

  @backgroundMethod()
  public async unblockToken({
    networkId,
    tokenId,
  }: {
    networkId: string;
    tokenId: string;
  }) {
    const blockedTokens =
      await this.backgroundApi.simpleDb.riskyTokens.getBlockedTokens(networkId);

    if (blockedTokens[tokenId]) {
      return this.backgroundApi.simpleDb.riskyTokens.updateBlockedTokens({
        networkId,
        removeFromBlockedTokens: [tokenId],
      });
    }

    return this.backgroundApi.simpleDb.riskyTokens.updateUnblockedTokens({
      networkId,
      addToUnBlockedTokens: [tokenId],
    });
  }

  @backgroundMethod()
  public async getBlockedTokens({ networkId }: { networkId: string }) {
    return this.backgroundApi.simpleDb.riskyTokens.getBlockedTokens(networkId);
  }

  @backgroundMethod()
  public async getUnblockedTokens({ networkId }: { networkId: string }) {
    return this.backgroundApi.simpleDb.riskyTokens.getUnblockedTokens(
      networkId,
    );
  }
}

export default ServiceToken;
