import { useEffect, useMemo, useState } from 'react';

import B from 'bignumber.js';
import { pick } from 'lodash';
import natsort from 'natsort';
import { useAsync } from 'react-async-hook';

import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import { getBalanceKey } from '@onekeyhq/engine/src/managers/token';
import type {
  IAccountTokenData,
  Token,
} from '@onekeyhq/engine/src/types/token';
import { TokenRiskLevel } from '@onekeyhq/engine/src/types/token';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { appSelector } from '../store';
import { getPreBaseValue } from '../utils/priceUtils';

import { useAppSelector } from './useAppSelector';

import type { IAccountToken } from '../views/Overview/types';

export const useSingleToken = (networkId: string, address: string) => {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<Token>();

  useEffect(() => {
    backgroundApiProxy.engine
      .findToken({
        networkId,
        tokenIdOnNetwork: address,
      })
      .then((t) => {
        if (t) {
          setToken(t);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [address, networkId]);

  return {
    loading,
    token,
  };
};
export function useNativeToken(networkId?: string): Token | undefined {
  const { token } = useSingleToken(networkId ?? '', '');
  return token;
}

export function useCurrentNetworkTokenInfoByCoingeckoId(
  coingeckoId: string,
): null | Pick<Token, 'coingeckoId' | 'name' | 'symbol' | 'logoURI'> {
  const { networkId, accountId } = useActiveWalletAccount();
  const accountTokens = appSelector(
    (s) => s.tokens.accountTokens?.[networkId]?.[accountId] || [],
  );
  return useMemo(() => {
    const token = accountTokens.find((t) => t.coingeckoId === coingeckoId);
    if (!token) {
      return null;
    }
    return pick(token, 'coingeckoId', 'name', 'symbol', 'logoURI');
  }, [coingeckoId, accountTokens]);
}

export function useAccountTokensBalance(
  networkId?: string,
  accountId?: string,
) {
  const balances = useAppSelector((s) => s.tokens.accountTokensBalance);
  return useMemo(() => {
    if (!networkId || !accountId) {
      return {};
    }
    return balances[networkId]?.[accountId] ?? {};
  }, [networkId, accountId, balances]);
}

export function useAccountTokens({
  networkId = '',
  accountId = '',
  useFilter = false,
  limitSize,
}: {
  networkId?: string;
  accountId?: string;
  useFilter?: boolean;
  limitSize?: number;
}) {
  const {
    hideRiskTokens,
    hideSmallBalance,
    putMainTokenOnTop,
    selectedFiatMoneySymbol,
  } = useAppSelector((s) => s.settings);
  const fiatMap = useAppSelector((s) => s.fiatMoney.map);
  const fiat = fiatMap[selectedFiatMoneySymbol]?.value || 0;
  const tokens = useAppSelector(
    (s) => s.tokens.accountTokens?.[networkId]?.[accountId] ?? [],
  );
  const balances = useAppSelector(
    (s) => s.tokens.accountTokensBalance?.[networkId]?.[accountId] ?? [],
  );
  const prices = useAppSelector((s) => s.tokens.tokenPriceMap ?? {});

  const allNetworksTokens = useAppSelector(
    (s) =>
      s.allNetworks.portfolios[`${networkId}___${accountId}`]?.tokens ?? [],
  );

  const valueTokens: IAccountToken[] = useMemo(() => {
    const accountTokens = isAllNetworks(networkId)
      ? allNetworksTokens.map((t) => ({
          name: t.name,
          symbol: t.symbol,
          address: undefined,
          logoURI: t.logoURI,
          balance: t.balance,
          usdValue: t.value ?? '0',
          value: t.value ?? '0',
          value24h: t.value24h ?? '0',
          price: t.price ?? 0,
          price24h: t.price24h ?? 0,
          isNative: false,
          riskLevel: TokenRiskLevel.UNKNOWN,
          key: t.coingeckoId,
          sendAddress: undefined,
        }))
      : tokens.map((t) => {
          const priceInfo =
            prices[`${networkId}${t.address ? '-' : ''}${t.address ?? ''}`];
          const price = priceInfo?.[selectedFiatMoneySymbol] ?? 0;
          const price24h =
            priceInfo?.[`${selectedFiatMoneySymbol}_24h_change`] ?? 0;
          const balance = balances[getBalanceKey(t)]?.balance ?? '0';
          const value = new B(price).multipliedBy(balance);
          const usdValue = fiat === 0 ? 0 : value.div(fiat);
          const value24h = new B(balance).multipliedBy(
            getPreBaseValue({
              priceInfo,
              vsCurrency: selectedFiatMoneySymbol,
            })[selectedFiatMoneySymbol] ?? 0,
          );
          const info = {
            name: t.name,
            symbol: t.symbol,
            address: t.address,
            logoURI: t.logoURI,
            balance,
            usdValue: usdValue.toString(),
            value: value.toString(),
            value24h: value24h.toString(),
            price,
            price24h,
            isNative: t.isNative,
            riskLevel: t.riskLevel,
            key: `${t.address ?? ''}${t.sendAddress ?? ''}`,
            sendAddress: t.sendAddress,
          };
          return info;
        });

    return accountTokens
      .sort(
        (a, b) =>
          // By value
          new B(b.value).comparedTo(a.value) ||
          // By price
          new B(b.price).comparedTo(a.price) ||
          // By native token
          (b.isNative ? 1 : 0) ||
          (a.isNative ? -1 : 0) ||
          // By name
          natsort({ insensitive: true })(a.name, b.name),
      )
      .slice(0, limitSize);
  }, [
    balances,
    fiat,
    networkId,
    prices,
    selectedFiatMoneySymbol,
    tokens,
    allNetworksTokens,
    limitSize,
  ]);

  if (!useFilter) {
    return valueTokens;
  }

  const filteredTokens = valueTokens.filter((t) => {
    if (hideSmallBalance && new B(t.usdValue).isLessThan(1)) {
      return false;
    }
    if (hideRiskTokens && t.riskLevel && t.riskLevel > TokenRiskLevel.WARN) {
      return false;
    }
    if (putMainTokenOnTop && (t.isNative || !t.address)) {
      return false;
    }
    return true;
  });
  if (!putMainTokenOnTop) {
    return filteredTokens;
  }
  const nativeToken = valueTokens.find((t) => t.isNative && !t.address);
  if (nativeToken) {
    return [nativeToken, ...filteredTokens];
  }
  return filteredTokens;
}

export function useAccountTokenValues(
  networkId: string,
  accountId: string,
  useFilter = true,
) {
  const accountTokens = useAccountTokens({
    networkId,
    accountId,
    useFilter,
  });

  return useMemo(() => {
    let value = new B(0);
    let value24h = new B(0);
    for (const t of accountTokens) {
      value = value.plus(t.value);
      value24h = value24h.plus(t.value24h);
    }
    return {
      value,
      value24h,
    };
  }, [accountTokens]);
}

export function useAccountTokenLoading(networkId: string, accountId: string) {
  const accountTokens = useAppSelector((s) => s.tokens.accountTokens);
  return useMemo(
    () => typeof accountTokens[networkId]?.[accountId] === 'undefined',
    [networkId, accountId, accountTokens],
  );
}

export const useNativeTokenBalance = (
  networkId?: string,
  accountId?: string,
) => {
  const balances = useAccountTokensBalance(networkId, accountId);
  return useMemo(() => balances?.main?.balance || '0', [balances]);
};

export function useNetworkTokens(networkId?: string) {
  const { result: tokens } = useAsync(
    async () =>
      backgroundApiProxy.engine.getTopTokensOnNetwork(networkId ?? ''),
    [networkId],
  );

  return tokens ?? [];
}

export const useTokenSupportStakedAssets = (
  networkId?: string,
  tokenIdOnNetwork?: string,
) => {
  const { networkId: activeNet } = useActiveWalletAccount();
  return useMemo(
    () =>
      !tokenIdOnNetwork &&
      activeNet === networkId &&
      (networkId === OnekeyNetwork.eth || networkId === OnekeyNetwork.goerli),

    [activeNet, networkId, tokenIdOnNetwork],
  );
};

export const useFrozenBalance = ({
  networkId,
  accountId,
  tokenId,
}: {
  networkId: string;
  accountId: string;
  tokenId: string;
}) => {
  const [frozenBalance, setFrozenBalance] = useState<
    number | Record<string, number>
  >(0);

  useEffect(() => {
    (async () => {
      let password;

      const vaultSettings = await backgroundApiProxy.engine.getVaultSettings(
        networkId,
      );
      if (vaultSettings.validationRequired) {
        password = await backgroundApiProxy.servicePassword.getPassword();
      }

      backgroundApiProxy.engine
        .getFrozenBalance({
          accountId,
          networkId,
          password,
        })
        .then(setFrozenBalance)
        .catch((e) => {
          debugLogger.common.error('getFrozenBalance error', e);
        });
    })();
  }, [networkId, accountId]);

  return useMemo(
    () =>
      typeof frozenBalance === 'number'
        ? frozenBalance
        : frozenBalance?.[tokenId] ?? 0,
    [tokenId, frozenBalance],
  );
};

export const useTokenBalance = ({
  networkId,
  accountId,
  token,
  fallback = '0',
}: {
  networkId: string;
  accountId: string;
  token?: Partial<Token> | null;
  fallback?: string;
}) => {
  const balances = useAppSelector((s) => s.tokens.accountTokensBalance);
  return (
    balances?.[networkId]?.[accountId]?.[getBalanceKey(token)]?.balance ??
    fallback
  );
};

export const useTokenBalanceWithoutFrozen = ({
  networkId,
  accountId,
  token,
  fallback = '0',
}: {
  networkId: string;
  accountId: string;
  token?: Partial<Token> | null;
  fallback?: string;
}) => {
  const balance = useTokenBalance({ networkId, accountId, token, fallback });
  const frozenBalance = useFrozenBalance({
    networkId,
    accountId,
    tokenId: token?.tokenIdOnNetwork || 'main',
  });

  return useMemo(() => {
    if (frozenBalance < 0) return '0';
    const realBalance = new B(balance).minus(frozenBalance);
    if (realBalance.isGreaterThan(0)) {
      return realBalance.toFixed();
    }
    return '0';
  }, [balance, frozenBalance]);
};

export const useTokenPrice = ({
  networkId,
  tokenIdOnNetwork,
  fallback = 0,
  vsCurrency,
}: {
  networkId: string;
  vsCurrency: string;
  tokenIdOnNetwork: string;
  fallback?: number;
}) => {
  const key = tokenIdOnNetwork
    ? `${networkId}-${tokenIdOnNetwork ?? ''}`
    : networkId;
  const prices = useAppSelector((s) => s.tokens.tokenPriceMap);
  const price = prices?.[key]?.[vsCurrency];
  return price ?? fallback;
};

export const useCurrentFiatValue = () => {
  const selectedFiatMoneySymbol = useAppSelector(
    (s) => s.settings.selectedFiatMoneySymbol,
  );
  const fiatMap = useAppSelector((s) => s.fiatMoney.map);
  return fiatMap?.[selectedFiatMoneySymbol]?.value || 0;
};

export const useTokenPositionInfo = ({
  accountId,
  networkId,
  address,
  sendAddress,
}: {
  accountId: string;
  networkId: string;
  address: string;
  sendAddress?: string;
}) => {
  const accountTokenBalance = useTokenBalance({
    networkId,
    accountId,
    token: {
      address,
      sendAddress,
    },
  });
  const minerOverview = useAppSelector(
    (s) => s.staking.keleMinerOverviews?.[accountId ?? '']?.[networkId ?? ''],
  );

  const defiTokenAmount = useAppSelector((s) => {
    const defis =
      s.allNetworks.portfolios?.[`${networkId}___${accountId}`]?.defis;
    if (!defis?.length) {
      return new B(0);
    }
    return defis.reduce((protocolSum, obj) => {
      const poolTokens = obj.pools.reduce((poolTypeSum, [, items]) => {
        const tokensValues = items.reduce(
          (allTokenSum, { supplyTokens, rewardTokens }) => {
            const supplyTokenSum = supplyTokens
              .filter((t) => t.tokenAddress === address)
              .reduce(
                (tokenSum, sToken) => tokenSum.plus(sToken.balanceParsed ?? 0),
                new B(0),
              );
            const rewardTokenSum = rewardTokens
              .filter((t) => t.tokenAddress === address)
              .reduce(
                (tokenSum, rToken) => tokenSum.plus(rToken.balanceParsed ?? 0),
                new B(0),
              );
            return allTokenSum.plus(supplyTokenSum).plus(rewardTokenSum);
          },
          new B(0),
        );
        return poolTypeSum.plus(tokensValues);
      }, new B(0));
      return protocolSum.plus(poolTokens);
    }, new B(0));
  });

  return useMemo(() => {
    const stakingAmount = minerOverview?.amount?.total_amount ?? 0;

    return defiTokenAmount
      .plus(stakingAmount)
      .plus(accountTokenBalance)
      .toFixed();
  }, [minerOverview, defiTokenAmount, accountTokenBalance]);
};
