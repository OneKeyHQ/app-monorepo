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
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  getEmptyTokenData,
  getMergedTokenData,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type {
  IAccountToken,
  IFetchAccountTokensParams,
  IFetchAccountTokensResp,
  IFetchTokenDetailItem,
  IFetchTokenDetailParams,
  ISearchTokenItem,
  ISearchTokensParams,
  IToken,
  ITokenData,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import { vaultFactory } from '../vaults/factory';
import { getVaultSettings } from '../vaults/settings';

import ServiceBase from './ServiceBase';
import BigNumber from 'bignumber.js';

@backgroundClass()
class ServiceToken extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  _fetchAccountTokensControllers: AbortController[] = [];

  _searchTokensControllers: AbortController[] = [];

  @backgroundMethod()
  public async abortSearchTokens() {
    this._searchTokensControllers.forEach((controller) => controller.abort());
    this._searchTokensControllers = [];
  }

  @backgroundMethod()
  public async abortFetchAccountTokens() {
    this._fetchAccountTokensControllers.forEach((controller) =>
      controller.abort(),
    );
    this._fetchAccountTokensControllers = [];
  }

  @backgroundMethod()
  public async fetchAccountTokens(
    params: IFetchAccountTokensParams & { mergeTokens?: boolean },
  ): Promise<IFetchAccountTokensResp> {
    const {
      mergeTokens,
      flag,
      accountId,
      isAllNetworks,
      isManualRefresh,
      allNetworksAccountId,
      allNetworksNetworkId,
      saveToLocal,
      ...rest
    } = params;
    const { networkId, contractList = [] } = rest;
    if (
      isAllNetworks &&
      this._currentNetworkId !== getNetworkIdsMap().onekeyall
    )
      return {
        ...getEmptyTokenData(),
        networkId: this._currentNetworkId,
      };

    const accountParams = {
      accountId,
      networkId,
    };
    const [xpub, accountAddress, customTokens, hiddenTokens, vaultSettings] =
      await Promise.all([
        this.backgroundApi.serviceAccount.getAccountXpub(accountParams),
        this.backgroundApi.serviceAccount.getAccountAddressForApi(
          accountParams,
        ),
        this.backgroundApi.serviceCustomToken.getCustomTokens(accountParams),
        this.backgroundApi.serviceCustomToken.getHiddenTokens(accountParams),
        this.backgroundApi.serviceNetwork.getVaultSettings({ networkId }),
      ]);

    if (!accountAddress && !xpub) {
      console.log(
        `fetchAccountTokens ERROR: accountAddress and xpub are both empty`,
      );
      defaultLogger.token.request.fetchAccountTokenAccountAddressAndXpubBothEmpty(
        { params, accountAddress, xpub },
      );
      return getEmptyTokenData();
    }

    rest.contractList = [
      ...(rest.contractList ?? []),
      ...customTokens.map((t) => t.address),
    ];

    rest.hiddenTokens = hiddenTokens.map((t) => t.address);

    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    const controller = new AbortController();
    this._fetchAccountTokensControllers.push(controller);
    const resp = await client.post<{
      data: IFetchAccountTokensResp;
    }>(
      `/wallet/v1/account/token/list?flag=${flag || ''}`,
      {
        ...rest,
        accountAddress,
        xpub,
        isAllNetwork: isAllNetworks,
        isForceRefresh: isManualRefresh,
      },
      {
        signal: controller.signal,
        headers:
          await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader({
            accountId,
          }),
      },
    );

    let allTokens: ITokenData | undefined;
    if (mergeTokens) {
      const { tokens, riskTokens, smallBalanceTokens } = resp.data.data;
      ({ allTokens } = getMergedTokenData({
        tokens,
        riskTokens,
        smallBalanceTokens,
      }));
      if (allTokens) {
        allTokens.data = allTokens.data.map((token) => ({
          ...token,
          accountId,
          networkId,
          mergeAssets: vaultSettings.mergeDeriveAssetsEnabled,
        }));
      }
      resp.data.data.allTokens = allTokens;
    }

    resp.data.data.tokens.data = resp.data.data.tokens.data.map((token) => ({
      ...token,
      accountId,
      networkId,
      mergeAssets: vaultSettings.mergeDeriveAssetsEnabled,
    }));

    resp.data.data.riskTokens.data = resp.data.data.riskTokens.data.map(
      (token) => ({
        ...token,
        accountId,
        networkId,
        mergeAssets: vaultSettings.mergeDeriveAssetsEnabled,
      }),
    );

    resp.data.data.smallBalanceTokens.data =
      resp.data.data.smallBalanceTokens.data.map((token) => ({
        ...token,
        accountId,
        networkId,
        mergeAssets: vaultSettings.mergeDeriveAssetsEnabled,
      }));

    resp.data.data.accountId = accountId;
    resp.data.data.networkId = networkId;

    if (saveToLocal) {
      let tokenListValue = new BigNumber(0);
      tokenListValue = tokenListValue
        .plus(resp.data.data.tokens.fiatValue ?? '0')
        .plus(resp.data.data.smallBalanceTokens.fiatValue ?? '0')
        .plus(resp.data.data.riskTokens.fiatValue ?? '0');

      await this.updateAccountLocalTokens({
        accountId,
        networkId,
        tokenList: resp.data.data.tokens.data,
        smallBalanceTokenList: resp.data.data.smallBalanceTokens.data,
        riskyTokenList: resp.data.data.riskTokens.data,
        tokenListValue: tokenListValue.toFixed(),
        tokenListMap: {
          ...resp.data.data.tokens.map,
          ...resp.data.data.smallBalanceTokens.map,
          ...resp.data.data.riskTokens.map,
        },
      });
    }
    resp.data.data.isSameAllNetworksAccountData = !!(
      allNetworksAccountId &&
      allNetworksNetworkId &&
      allNetworksAccountId === this._currentAccountId &&
      allNetworksNetworkId === this._currentNetworkId
    );

    return resp.data.data;
  }

  @backgroundMethod()
  public async fetchAllNetworkTokens({
    indexedAccountId,
  }: {
    indexedAccountId: string;
  }) {
    const accounts =
      await this.backgroundApi.serviceAccount.getAccountsInSameIndexedAccountId(
        { indexedAccountId },
      );

    console.log('accounts:', accounts);
  }

  @backgroundMethod()
  public async fetchTokensDetails(
    params: IFetchTokenDetailParams,
  ): Promise<IFetchTokenDetailItem[]> {
    const {
      accountId,
      networkId,
      contractList,
      withCheckInscription,
      withFrozenBalance,
    } = params;

    const [accountAddress, xpub] = await Promise.all([
      this.backgroundApi.serviceAccount.getAccountAddressForApi({
        accountId,
        networkId,
      }),
      this.backgroundApi.serviceAccount.getAccountXpub({
        accountId,
        networkId,
      }),
    ]);

    if (!accountAddress && !xpub) {
      console.log(
        `fetchTokensDetails ERROR: accountAddress and xpub are both empty`,
      );
      defaultLogger.token.request.fetchTokensDetailsAccountAddressAndXpubBothEmpty(
        { params, accountAddress, xpub },
      );
      return [];
    }

    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    const resp = await client.post<{ data: IFetchTokenDetailItem[] }>(
      '/wallet/v1/account/token/search',
      {
        networkId,
        accountAddress,
        xpub,
        contractList,
        withCheckInscription,
        withFrozenBalance,
      },
      {
        headers:
          await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader({
            accountId,
          }),
      },
    );

    const vault = await vaultFactory.getVault({
      accountId,
      networkId,
    });

    return vault.fillTokensDetails({
      tokensDetails: resp.data.data,
    });
  }

  @backgroundMethod()
  public async searchTokens(params: ISearchTokensParams) {
    const { accountId, networkId, contractList, keywords } = params;
    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    const controller = new AbortController();
    this._searchTokensControllers.push(controller);
    const resp = await client.post<{ data: ISearchTokenItem[] }>(
      '/wallet/v1/account/token/search',
      {
        networkId,
        contractList,
        keywords,
      },
      {
        headers:
          await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader({
            accountId,
          }),
        signal: controller.signal,
      },
    );

    return resp.data.data.map((item) => ({
      ...item.info,
      $key: item.info.uniqueKey ?? item.info.address,
    }));
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
    accountId,
    networkId,
    tokenIdOnNetwork,
  }: {
    networkId: string;
    accountId: string;
    tokenIdOnNetwork?: string;
  }) {
    let tokenAddress = tokenIdOnNetwork;
    if (isNil(tokenAddress)) {
      tokenAddress = await this.getNativeTokenAddress({ networkId });
    }

    return this.getToken({
      accountId,
      networkId,
      tokenIdOnNetwork: tokenAddress ?? '',
    });
  }

  @backgroundMethod()
  public async getToken(params: {
    accountId: string;
    networkId: string;
    tokenIdOnNetwork: string;
  }) {
    const { accountId, networkId, tokenIdOnNetwork } = params;

    const localToken = await this.backgroundApi.simpleDb.localTokens.getToken({
      networkId,
      tokenIdOnNetwork,
    });

    if (localToken) return localToken;

    try {
      const tokensDetails = await this.fetchTokensDetails({
        accountId,
        networkId,
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

    return null;
  }

  @backgroundMethod()
  public async updateAccountLocalTokens(params: {
    accountId: string;
    networkId: string;
    tokenList: IAccountToken[];
    smallBalanceTokenList: IAccountToken[];
    riskyTokenList: IAccountToken[];
    tokenListMap: Record<string, ITokenFiat>;
    tokenListValue: string;
  }) {
    const {
      accountId,
      networkId,
      tokenList,
      smallBalanceTokenList,
      riskyTokenList,
      tokenListMap,
      tokenListValue,
    } = params;
    const [xpub, accountAddress] = await Promise.all([
      this.backgroundApi.serviceAccount.getAccountXpub({
        accountId,
        networkId,
      }),
      this.backgroundApi.serviceAccount.getAccountAddressForApi({
        accountId,
        networkId,
      }),
    ]);

    await this.backgroundApi.simpleDb.localTokens.updateAccountTokenList({
      networkId,
      accountAddress,
      xpub,
      tokenList,
      smallBalanceTokenList,
      riskyTokenList,
      tokenListMap,
      tokenListValue,
    });
  }

  @backgroundMethod()
  public async getAccountLocalTokens(params: {
    accountId: string;
    networkId: string;
  }) {
    const { accountId, networkId } = params;
    const [xpub, accountAddress] = await Promise.all([
      this.backgroundApi.serviceAccount.getAccountXpub({
        accountId,
        networkId,
      }),
      this.backgroundApi.serviceAccount.getAccountAddressForApi({
        accountId,
        networkId,
      }),
    ]);
    return this.backgroundApi.simpleDb.localTokens.getAccountTokenList({
      networkId,
      accountAddress,
      xpub,
    });
  }
}

export default ServiceToken;
