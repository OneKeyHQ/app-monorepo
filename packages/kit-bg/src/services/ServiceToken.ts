import BigNumber from 'bignumber.js';
import { debounce, uniq } from 'lodash';
import memoizee from 'memoizee';

import {
  balanceSupprtedNetwork,
  getBalancesFromApi,
} from '@onekeyhq/engine/src/apiProxyUtils';
import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import type { CheckParams } from '@onekeyhq/engine/src/managers/goplus';
import {
  checkSite,
  getAddressRiskyItems,
  getTokenRiskyItems,
} from '@onekeyhq/engine/src/managers/goplus';
import {
  fetchTokenSource,
  fetchTools,
  getBalanceKey,
} from '@onekeyhq/engine/src/managers/token';
import type { DBVariantAccount } from '@onekeyhq/engine/src/types/account';
import { AccountType } from '@onekeyhq/engine/src/types/account';
import type { Token } from '@onekeyhq/engine/src/types/token';
import { setTools } from '@onekeyhq/kit/src/store/reducers/data';
import type { TokenBalanceValue } from '@onekeyhq/kit/src/store/reducers/tokens';
import {
  setAccountTokens,
  setAccountTokensBalances,
  setTokenPriceMap,
} from '@onekeyhq/kit/src/store/reducers/tokens';
import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import {
  backgroundClass,
  backgroundMethod,
  bindThis,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import ServiceBase from './ServiceBase';

export type IFetchAccountTokensParams = {
  activeAccountId: string;
  activeNetworkId: string;
  forceReloadTokens?: boolean;
};

@backgroundClass()
export default class ServiceToken extends ServiceBase {
  private interval: any;

  @bindThis()
  registerEvents() {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    appEventBus.on(AppEventBusNames.NetworkChanged, this.refreshTokenBalance);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  @bindThis()
  @backgroundMethod()
  async startRefreshAccountTokens() {
    if (this.interval) {
      return;
    }
    this.interval = setInterval(() => {
      this.refreshTokenBalance();
    }, getTimeDurationMs({ seconds: 15 }));
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  @bindThis()
  @backgroundMethod()
  async stopRefreshAccountTokens() {
    clearInterval(this.interval);
    this.interval = null;
  }

  @bindThis()
  refreshTokenBalance() {
    const { appSelector } = this.backgroundApi;
    const { activeAccountId, activeNetworkId } = appSelector((s) => s.general);
    if (activeAccountId && activeNetworkId) {
      this.fetchAccountTokens({
        activeAccountId,
        activeNetworkId,
      });
    }
  }

  @bindThis()
  @backgroundMethod()
  async fetchAccountTokens({
    activeAccountId,
    activeNetworkId,
    forceReloadTokens,
  }: IFetchAccountTokensParams) {
    const { engine, dispatch, servicePrice, appSelector } = this.backgroundApi;
    const tokens = await engine.getTokens(
      activeNetworkId,
      activeAccountId,
      true,
      true,
      forceReloadTokens,
    );
    const { selectedFiatMoneySymbol } = appSelector((s) => s.settings);
    const actions: any[] = [];
    const [balances, autodetectedTokens = []] = await this.fetchTokenBalance({
      activeAccountId,
      activeNetworkId,
      tokenIds: tokens.map((token) => token.tokenIdOnNetwork),
    });
    const accountTokens = tokens.concat(autodetectedTokens);
    const prices = await servicePrice.fetchSimpleTokenPrice({
      networkId: activeNetworkId,
      accountId: activeAccountId,
      tokenIds: accountTokens.map((t) => t.tokenIdOnNetwork),
      vsCurrency: selectedFiatMoneySymbol,
    });
    actions.push(
      setAccountTokensBalances({
        activeAccountId,
        activeNetworkId,
        tokensBalance: balances,
      }),
      setTokenPriceMap({
        prices,
      }),
      setAccountTokens({
        activeAccountId,
        activeNetworkId,
        tokens: accountTokens,
      }),
    );
    dispatch(...actions);
    return accountTokens;
  }

  @backgroundMethod()
  async fetchTokenBalance({
    activeNetworkId,
    activeAccountId,
    tokenIds,
  }: {
    activeNetworkId: string;
    activeAccountId: string;
    tokenIds?: string[];
  }): Promise<[Record<string, TokenBalanceValue>, Token[] | undefined]> {
    const top50tokens = await this.backgroundApi.engine.getTopTokensOnNetwork(
      activeNetworkId,
      50,
    );
    const { appSelector, dispatch } = this.backgroundApi;
    const { accountTokens } = appSelector((s) => s.tokens);
    let tokenIdsOnNetwork: string[] = [];
    if (tokenIds) {
      tokenIdsOnNetwork = tokenIds;
    } else {
      const ids1 = top50tokens.map((t) => t.tokenIdOnNetwork) ?? [];
      const ids2 = (
        accountTokens[activeNetworkId]?.[activeAccountId] || []
      ).map((t) => t.tokenIdOnNetwork);
      tokenIdsOnNetwork = ids1.concat(ids2);
    }
    if (!activeAccountId) {
      return [{}, undefined];
    }
    const [tokensBalance, autodetectedTokens] = await this.getAccountBalance(
      activeAccountId,
      activeNetworkId,
      uniq(tokenIdsOnNetwork),
      true,
    );
    dispatch(
      setAccountTokensBalances({
        activeAccountId,
        activeNetworkId,
        tokensBalance,
      }),
    );
    return [tokensBalance, autodetectedTokens];
  }

  async _batchFetchAccountBalances({
    walletId,
    networkId,
    accountIds,
  }: {
    walletId: string;
    networkId: string;
    accountIds: string[];
  }) {
    const { dispatch, engine } = this.backgroundApi;

    const vault = await engine.getWalletOnlyVault(networkId, walletId);
    const dbNetwork = await engine.dbApi.getNetwork(networkId);
    const dbAccounts = await engine.dbApi.getAccounts(accountIds);

    let balances: Array<BigNumber | undefined>;
    try {
      const balancesAddress = await Promise.all(
        dbAccounts.map(async (a) => {
          if (a.type === AccountType.UTXO) {
            const address = await vault.getFetchBalanceAddress(a);
            return { address };
          }
          if (a.type === AccountType.VARIANT) {
            let address = (a as unknown as DBVariantAccount).addresses?.[
              networkId
            ];
            if (!address) {
              address = await vault.addressFromBase(a.address);
            }
            return { address };
          }
          return { address: a.address };
        }),
      );
      const requests = balancesAddress.map((acc) => ({ address: acc.address }));
      balances = await vault.getBalances(requests);
    } catch {
      balances = dbAccounts.map(() => undefined);
    }

    const data = dbAccounts.reduce((result, item, index) => {
      const balance = balances[index];
      result[item.id] = balance
        ? balance.div(new BigNumber(10).pow(dbNetwork.decimals)).toFixed()
        : undefined;
      return result;
    }, {} as Record<string, string | undefined>);

    const actions: any[] = [];
    Object.entries(data).forEach(([key, value]) => {
      if (!Number.isNaN(value)) {
        actions.push(
          setAccountTokensBalances({
            activeAccountId: key,
            activeNetworkId: networkId,
            tokensBalance: {
              'main': {
                balance: value ?? '0',
              },
            },
          }),
        );
      }
    });
    if (actions.length > 0) {
      dispatch(...actions);
    }
  }

  batchFetchAccountBalancesDebounce = debounce(
    // eslint-disable-next-line @typescript-eslint/unbound-method
    this._batchFetchAccountBalances,
    600,
    {
      leading: false,
      trailing: true,
    },
  );

  @backgroundMethod()
  batchFetchAccountBalances({
    walletId,
    networkId,
    accountIds,
  }: {
    walletId: string;
    networkId: string;
    accountIds: string[];
  }) {
    return this.batchFetchAccountBalancesDebounce({
      walletId,
      networkId,
      accountIds,
    });
  }

  @backgroundMethod()
  async addAccountToken(
    networkId: string,
    accountId: string,
    address: string,
    logoURI?: string,
  ): Promise<Token | undefined> {
    const { engine, appSelector } = this.backgroundApi;
    if (!address) {
      return;
    }
    const accountTokens = appSelector((s) => s.tokens.accountTokens);
    const tokens = accountTokens[networkId]?.[accountId] ?? ([] as Token[]);
    const isExists = tokens.find((item) => item.tokenIdOnNetwork === address);
    if (isExists) {
      return;
    }
    const result = await engine.quickAddToken(
      accountId,
      networkId,
      address,
      logoURI,
    );
    await this.fetchAccountTokens({
      activeAccountId: accountId,
      activeNetworkId: networkId,
    });
    return result;
  }

  @backgroundMethod()
  async fetchTokenSource() {
    return fetchTokenSource();
  }

  @backgroundMethod()
  async getTokenRiskyItems(params: CheckParams) {
    return this._getTokenRiskyItemsWithMemo(params);
  }

  _getTokenRiskyItemsWithMemo = memoizee(getTokenRiskyItems, {
    promise: true,
    primitive: true,
    max: 500,
    maxAge: getTimeDurationMs({ day: 1 }),
    normalizer: (args) => JSON.stringify(args),
  });

  @backgroundMethod()
  async getAddressRiskyItems(params: CheckParams) {
    return getAddressRiskyItems(params);
  }

  @backgroundMethod()
  async getSiteSecurityInfo(url: string, chainId: string) {
    return checkSite(url, chainId);
  }

  @backgroundMethod()
  async fetchTools() {
    const tools = await fetchTools();
    const { dispatch } = this.backgroundApi;
    dispatch(setTools(tools));
  }

  @backgroundMethod()
  async getAccountBalanceFromServerApi(
    networkId: string,
    accountId: string,
    withMain = true,
  ): Promise<[Record<string, TokenBalanceValue>, Token[] | undefined]> {
    const { engine } = this.backgroundApi;

    const vault = await engine.getVault({ networkId, accountId });

    const account = await engine.getAccount(accountId, networkId);
    const accountAddress = await vault.getFetchBalanceAddress(account);

    const accountTokens = await engine.getTokens(
      networkId,
      accountId,
      withMain,
      true,
      false,
    );

    const ret: Record<string, TokenBalanceValue> = {};
    const balancesFromApi =
      (await getBalancesFromApi(networkId, accountAddress)) || [];
    const removedTokens = await simpleDb.token.localTokens.getRemovedTokens(
      accountId,
      networkId,
    );
    const allAccountTokens: Token[] = [];
    for (const {
      address,
      balance,
      sendAddress,
      bestBlockNumber: blockHeight,
    } of balancesFromApi.filter(
      (b) =>
        (+b.balance > 0 || !b.address) && !removedTokens.includes(b.address),
    )) {
      try {
        let token = await engine.findToken({
          networkId,
          tokenIdOnNetwork: address,
        });
        if (!token) {
          token = await engine.quickAddToken(accountId, networkId, address);
        }
        if (token) {
          // only record new token balances
          // other token balances still get from RPC for accuracy
          Object.assign(ret, {
            [getBalanceKey({
              address,
              sendAddress,
            })]: {
              balance,
              blockHeight,
            },
          });
          allAccountTokens.push({
            ...token,
            sendAddress,
            autoDetected: !accountTokens.some((t) => t.address === address),
          });
        }
      } catch (e) {
        // pass
      }
    }
    return [ret, allAccountTokens];
  }

  @backgroundMethod()
  async getAccountBalanceFromRpc(
    networkId: string,
    accountId: string,
    tokensToGet: string[],
    withMain = true,
  ): Promise<[Record<string, TokenBalanceValue>, Token[] | undefined]> {
    const { engine } = this.backgroundApi;
    const network = await engine.getNetwork(networkId);
    const client = await engine.getChainOnlyVault(networkId);

    const vault = await engine.getVault({ networkId, accountId });
    const { latestBlock } = await client.getClientEndpointStatus(
      await client.getRpcUrl(),
    );
    const blockHeight = String(latestBlock);

    const ret: Record<string, TokenBalanceValue> = {};
    const balances = await vault.getAccountBalance(tokensToGet, withMain);
    if (withMain && typeof balances[0] !== 'undefined') {
      Object.assign(ret, {
        main: {
          balance: balances[0]
            .div(new BigNumber(10).pow(network.decimals))
            .toFixed(),
          blockHeight,
        },
      });
    }
    const balanceList = balances.slice(withMain ? 1 : 0);
    for (let i = 0; i < balanceList.length; i += 1) {
      const balance = balanceList[i];

      const tokenId1 = tokensToGet[i];
      const token = await engine.findToken({
        networkId,
        tokenIdOnNetwork: tokenId1,
      });
      const decimals = token?.decimals;
      if (
        token &&
        typeof decimals !== 'undefined' &&
        typeof balance !== 'undefined'
      ) {
        const bal = balance.div(new BigNumber(10).pow(decimals)).toFixed();
        Object.assign(ret, {
          [getBalanceKey({
            address: tokenId1,
          })]: {
            balance: bal,
            blockHeight,
          },
        });
      }
    }
    return [ret, undefined];
  }

  @backgroundMethod()
  async getAccountBalance(
    accountId: string,
    networkId: string,
    tokenIds: string[],
    withMain = true,
  ): Promise<[Record<string, TokenBalanceValue>, Token[] | undefined]> {
    const { engine } = this.backgroundApi;

    const accountTokens = await engine.getTokens(
      networkId,
      accountId,
      withMain,
      true,
      false,
    );
    const tokensToGet = uniq([
      ...tokenIds,
      ...accountTokens.map((t) => t.tokenIdOnNetwork),
    ]).filter((address) => {
      if (withMain && address === '') {
        return false;
      }
      return true;
    });
    let serverBalances: Record<string, TokenBalanceValue> = {};
    let rpcBalances: Record<string, TokenBalanceValue> = {};
    let autodetectedTokens: Token[] = [];
    if (balanceSupprtedNetwork.includes(networkId)) {
      try {
        [serverBalances, autodetectedTokens = []] =
          await this.getAccountBalanceFromServerApi(
            networkId,
            accountId,
            withMain,
          );
      } catch (e) {
        debugLogger.common.error(
          `getBalancesFromApi`,
          {
            params: [networkId, accountId],
            message: e instanceof Error ? e.message : e,
          },
          e,
        );
      }
    }
    try {
      [rpcBalances] = await this.getAccountBalanceFromRpc(
        networkId,
        accountId,
        tokensToGet,
        withMain,
      );
    } catch (e) {
      debugLogger.common.error(
        `getBalancesFromRpc`,
        {
          params: [networkId, accountId],
          message: e instanceof Error ? e.message : e,
        },
        e,
      );
    }
    const balances: Record<string, TokenBalanceValue> = {};
    for (const k of Object.keys({
      ...serverBalances,
      ...rpcBalances,
    })) {
      const rpcValue = rpcBalances[k];
      const serverValue = serverBalances[k];
      if (!serverValue || !rpcValue) {
        Object.assign(balances, {
          [k]: serverValue || rpcValue,
        });
      } else if (!serverValue.blockHeight || !rpcValue.blockHeight) {
        Object.assign(balances, {
          [k]: rpcValue,
        });
      } else {
        const v = new BigNumber(rpcValue.blockHeight).isGreaterThan(
          serverValue.blockHeight,
        )
          ? rpcValue
          : serverValue;
        Object.assign(balances, {
          [k]: v,
        });
      }
    }

    return [balances, autodetectedTokens];
  }
}
