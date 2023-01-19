import BigNumber from 'bignumber.js';
import { debounce, uniq } from 'lodash';

import type { CheckParams } from '@onekeyhq/engine/src/managers/goplus';
import {
  checkSite,
  getAddressRiskyItems,
  getTokenRiskyItems,
} from '@onekeyhq/engine/src/managers/goplus';
import {
  fetchTokenSource,
  fetchTools,
} from '@onekeyhq/engine/src/managers/token';
import type { DBVariantAccount } from '@onekeyhq/engine/src/types/account';
import { AccountType } from '@onekeyhq/engine/src/types/account';
import type { Token } from '@onekeyhq/engine/src/types/token';
import { setTools } from '@onekeyhq/kit/src/store/reducers/data';
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

import ServiceBase from './ServiceBase';

import type { IServiceBaseProps } from './ServiceBase';

export type IFetchAccountTokensParams = {
  activeAccountId: string;
  activeNetworkId: string;
  withBalance?: boolean;
  wait?: boolean;
  forceReloadTokens?: boolean;
};
@backgroundClass()
export default class ServiceToken extends ServiceBase {
  constructor(props: IServiceBaseProps) {
    super(props);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    appEventBus.on(AppEventBusNames.NetworkChanged, this.refreshTokenBalance);

    setInterval(() => {
      this.refreshTokenBalance();
    }, getTimeDurationMs({ seconds: 15 }));
  }

  @bindThis()
  refreshTokenBalance() {
    const { appSelector } = this.backgroundApi;
    const { activeAccountId, activeNetworkId } = appSelector((s) => s.general);
    if (activeAccountId && activeNetworkId) {
      this.fetchAccountTokens({
        activeAccountId,
        activeNetworkId,
        withBalance: true,
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
  }): Promise<[Record<string, string | undefined>, Token[] | undefined]> {
    const top50tokens = await this.backgroundApi.engine.getTopTokensOnNetwork(
      activeNetworkId,
      50,
    );
    const { engine, appSelector, dispatch } = this.backgroundApi;
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
    const [tokensBalance, autodetectedTokens] = await engine.getAccountBalance(
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
            tokensBalance: { 'main': value },
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
    return getTokenRiskyItems(params);
  }

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
}
