import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import {
  ESwapProJumpTokenDirection,
  useSwapProJumpTokenAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/swap';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  checkWrappedTokenPair,
  equalTokenNoCaseSensitive,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketSearchV2Token } from '@onekeyhq/shared/types/market';
import type {
  IMarketBasicConfigNetwork,
  IMarketTokenListItem,
  IMarketTokenTransaction,
} from '@onekeyhq/shared/types/marketV2';
import {
  swapProPositionsListMaxCount,
  swapProPositionsListMinValue,
  swapProStockPositionsListMinValue,
  wrappedTokens,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  ISwapNetwork,
  ISwapToken,
  ISwapTokenBase,
} from '@onekeyhq/shared/types/swap/types';
import {
  ESwapDirectionType,
  ESwapProTradeType,
  ESwapQuoteKind,
  ESwapSlippageSegmentKey,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useCurrency } from '../../../components/Currency';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import {
  useAccountSelectorStorageInitDoneAtom,
  useActiveAccount,
  useSelectedAccount,
} from '../../../states/jotai/contexts/accountSelector';
import { useAccountSelectorActions } from '../../../states/jotai/contexts/accountSelector/actions';
import {
  buildSwapProPositionsOwnerKey,
  useSwapActions,
  useSwapFromTokenAmountAtom,
  useSwapLimitPriceFromAmountAtom,
  useSwapLimitPriceToAmountAtom,
  useSwapProDirectionAtom,
  useSwapProErrorAlertAtom,
  useSwapProInputAmountAtom,
  useSwapProPositionsCacheAtom,
  useSwapProPositionsRequestStateAtom,
  useSwapProSelectTokenAtom,
  useSwapProSellToTokenAtom,
  useSwapProSupportNetworksTokenListAtom,
  useSwapProTokenSupportLimitAtom,
  useSwapProTokenTransactionPriceAtom,
  useSwapProTradeTypeAtom,
  useSwapProUseSelectBuyTokenAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSpeedQuoteResultAtom,
  useSwapToTokenAmountAtom,
  useSwapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap';
import {
  getSwapQuoteAmountProjection,
  getSwapQuoteKindForCurrentInput,
} from '../../../states/jotai/contexts/swap/quoteSemanticIntent';
import { useMarketBasicConfig } from '../../Market/hooks';
import { useTransactionsWebSocket } from '../../Market/MarketDetailV2/components/InformationTabs/components/TransactionsHistory/hooks/useTransactionsWebSocket';
import { useSpeedSwapInit } from '../../Market/MarketDetailV2/components/SwapPanel/hooks/useSpeedSwapInit';
import { ESwapDirection } from '../../Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';
import {
  type ESwapProAccountStatus,
  ESwapProErrorAlertAction,
  buildSwapProAccountScope,
  getSwapProAccountForCurrentScope,
  getSwapProErrorAlertAction,
  resolveSwapProAccountIdentity,
  resolveSwapProAccountStatus,
  shouldSyncSwapProAccountNetwork,
} from '../utils/swapProAccountUtils';
import {
  SWAP_STOCK_ANALYTICS_TOKEN_LIST_TYPE_STOCK,
  getSwapAnalyticsTokenListType,
  getSwapAnalyticsTokenRole,
} from '../utils/swapStockAnalytics';

import {
  type ISwapProPositionsOwnerRequestScope,
  type ISwapProPositionsRequestGeneration,
  advanceSwapProPositionsOwnerRequestScope,
  buildSwapProPositionsNetworkIdsKey,
  hasSwapProPositionsOwnerRequestSettledSince,
  isSwapProPositionsOwnerRequestScopeSettled,
  isSwapProPositionsRequestGenerationCurrent,
  isSwapProPositionsSourceUnavailable,
  mergeSwapProPositionTokenDetails,
  resolveSwapProPositionsAccountIdentity,
  useSwapProPositionsGenerationGuardedCallback,
} from './swapProPositionsUtils';
import {
  useSwapQuoteProgressState,
  useSwapSlippagePercentageModeInfo,
} from './useSwapState';

type ISwapProSearchTokenListItem = IMarketSearchV2Token & {
  networkLogoURI: string;
};

const SWAP_PRO_SEARCH_RESULTS_REFRESH_INTERVAL = timerUtils.getTimeDurationMs({
  seconds: 15,
});

export function useSwapProPositionsAccountIdentity() {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { selectedAccount } = useSelectedAccount({ num: 0 });

  return resolveSwapProPositionsAccountIdentity({
    activeAccount,
    selectedAccount,
  });
}

export function useSwapProInit() {
  const [, setSwapProDirection] = useSwapProDirectionAtom();
  const { networkList } = useMarketBasicConfig();
  const { setSwapProSelectToken, swapTypeSwitchAction } =
    useSwapActions().current;
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const [swapProJumpToken, setSwapProJumpToken] = useSwapProJumpTokenAtom();
  const swapSwitchProToken = useCallback(
    (payload: { token: ISwapToken }) => {
      // Market handoffs may arrive while Stock still owns the shared amount
      // and balance atoms. Use the canonical transition so the old execution
      // owner is revoked before the Limit surface becomes visible.
      void swapTypeSwitchAction(ESwapTabSwitchType.LIMIT);
      void setSwapProSelectToken(payload.token);
    },
    [setSwapProSelectToken, swapTypeSwitchAction],
  );
  const swapProSelectTokenRef = useRef<ISwapToken | undefined>(
    swapProSelectToken,
  );
  if (swapProSelectTokenRef.current !== swapProSelectToken) {
    swapProSelectTokenRef.current = swapProSelectToken;
  }
  const swapProJumpTokenRef = useRef<ISwapToken | undefined>(
    swapProJumpToken?.token,
  );
  if (swapProJumpTokenRef.current !== swapProJumpToken?.token) {
    swapProJumpTokenRef.current = swapProJumpToken?.token;
  }
  useEffect(() => {
    if (swapProJumpToken.token) {
      swapSwitchProToken({ token: swapProJumpToken.token });
      if (swapProJumpToken.direction === ESwapProJumpTokenDirection.SELL) {
        setSwapProDirection(ESwapDirection.SELL);
      } else {
        setSwapProDirection(ESwapDirection.BUY);
      }
      setSwapProJumpToken({
        token: undefined,
        direction: ESwapProJumpTokenDirection.BUY,
        marketPresetToken: undefined,
      });
    }
  }, [
    swapProJumpToken,
    swapSwitchProToken,
    setSwapProJumpToken,
    setSwapProDirection,
  ]);
  return {
    networkList,
  };
}

export function useSwapProInputToken() {
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const [swapProDirection] = useSwapProDirectionAtom();
  const [swapProUseSelectBuyTokenAtom] = useSwapProUseSelectBuyTokenAtom();
  const inputToken = useMemo(() => {
    if (swapProDirection === ESwapDirection.BUY) {
      return swapProUseSelectBuyTokenAtom;
    }
    return swapProSelectToken;
  }, [swapProDirection, swapProUseSelectBuyTokenAtom, swapProSelectToken]);
  return inputToken;
}

export function useSwapProToToken() {
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const [swapProDirection] = useSwapProDirectionAtom();
  const [swapProSellToTokenAtom] = useSwapProSellToTokenAtom();
  const toToken = useMemo(() => {
    if (swapProDirection === ESwapDirection.BUY) {
      return swapProSelectToken;
    }
    return swapProSellToTokenAtom;
  }, [swapProDirection, swapProSellToTokenAtom, swapProSelectToken]);
  return toToken;
}

export function useSwapProAccount() {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { selectedAccount } = useSelectedAccount({ num: 0 });
  const [isAccountSelectorStorageInitDone] =
    useAccountSelectorStorageInitDoneAtom();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const inputToken = useSwapProInputToken();
  const [selectMarketToken] = useSwapProSelectTokenAtom();
  const { updateSelectedAccountNetwork } = useAccountSelectorActions().current;
  const targetNetworkId =
    inputToken?.networkId ?? selectMarketToken?.networkId ?? '';
  const accountNetworkSyncTargetId = selectMarketToken?.networkId ?? '';
  const { indexedAccountId, accountId } = resolveSwapProAccountIdentity({
    isAccountSelectorStorageInitDone,
    selectedNetworkId: selectedAccount.networkId,
    selectedWalletId: selectedAccount.walletId,
    selectedFocusedWallet: selectedAccount.focusedWallet,
    selectedIndexedAccountId: selectedAccount.indexedAccountId,
    selectedAccountId: selectedAccount.othersWalletAccountId,
    activeIndexedAccountId: activeAccount?.indexedAccount?.id,
    activeAccountId: activeAccount?.account?.id ?? activeAccount?.dbAccount?.id,
  });
  const hasConnectedAccount = Boolean(indexedAccountId || accountId);
  const accountScope = buildSwapProAccountScope({
    targetNetworkId,
    indexedAccountId,
    accountId,
  });
  const shouldResolveAccount = Boolean(accountScope && targetNetworkId);
  const netAccountStateRes = usePromiseResult(
    async () => {
      if (!shouldResolveAccount) {
        return {
          scope: '',
          account: undefined,
        };
      }
      try {
        const defaultDeriveType =
          await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
            networkId: targetNetworkId,
          });
        const account =
          await backgroundApiProxy.serviceAccount.getNetworkAccount({
            accountId,
            indexedAccountId: indexedAccountId ?? '',
            networkId: targetNetworkId,
            deriveType: defaultDeriveType ?? 'default',
          });
        return {
          scope: accountScope,
          account,
        };
      } catch (_e) {
        return {
          scope: accountScope,
          account: undefined,
        };
      }
    },
    [
      accountId,
      accountScope,
      indexedAccountId,
      shouldResolveAccount,
      targetNetworkId,
    ],
    {
      initResult: {
        scope: '',
        account: undefined,
      },
    },
  );

  const accountStatus = resolveSwapProAccountStatus({
    hasConnectedAccount,
    accountScope,
    resolvedAccountScope: netAccountStateRes.result.scope,
    accountAddress: netAccountStateRes.result.account?.addressDetail.address,
  });
  const accountForCurrentScope = getSwapProAccountForCurrentScope({
    accountScope,
    resolvedAccountScope: netAccountStateRes.result.scope,
    account: netAccountStateRes.result.account,
  });
  const isSwapProActive = Boolean(
    platformEnv.isNative && swapTypeSwitch === ESwapTabSwitchType.LIMIT,
  );
  const hasIndexedAccount = Boolean(indexedAccountId);
  const isSingletonAccountReady = Boolean(
    !hasIndexedAccount &&
    accountId &&
    activeAccount.ready &&
    activeAccount.dbAccount?.id === accountId,
  );
  const isSingletonAccountCompatible = Boolean(
    isSingletonAccountReady &&
    activeAccount.dbAccount &&
    accountNetworkSyncTargetId &&
    accountUtils.isAccountCompatibleWithNetwork({
      account: activeAccount.dbAccount,
      networkId: accountNetworkSyncTargetId,
    }),
  );
  const shouldSyncAccountNetwork = shouldSyncSwapProAccountNetwork({
    isSwapProActive,
    targetNetworkId: accountNetworkSyncTargetId,
    currentNetworkId: selectedAccount.networkId ?? activeAccount?.network?.id,
    hasConnectedAccount,
    hasIndexedAccount,
    isSingletonAccountReady,
    isSingletonAccountCompatible,
  });

  useEffect(() => {
    if (shouldSyncAccountNetwork) {
      void updateSelectedAccountNetwork({
        num: 0,
        networkId: accountNetworkSyncTargetId,
      });
    }
  }, [
    accountNetworkSyncTargetId,
    shouldSyncAccountNetwork,
    updateSelectedAccountNetwork,
  ]);

  return {
    ...netAccountStateRes,
    result: accountForCurrentScope,
    accountScope,
    accountStatus,
    hasConnectedAccount,
  };
}

export function useSwapTokenPairBalanceSyncForPosition() {
  const { indexedAccountId, otherWalletTypeAccountId } =
    useSwapProPositionsAccountIdentity();
  const [, setSwapProSupportNetworksTokenList] =
    useSwapProSupportNetworksTokenListAtom();
  const [, setSwapProPositionsCache] = useSwapProPositionsCacheAtom();
  const [positionsRequestState] = useSwapProPositionsRequestStateAtom();
  const positionsRequestStateRef = useRef(positionsRequestState);
  positionsRequestStateRef.current = positionsRequestState;
  const syncTokensToPosition = useCallback(
    async (
      tokens: ISwapToken[],
      expectedOwnerKey: string,
      expectedRequestId: number,
    ) => {
      if (tokens.length === 0) {
        return;
      }
      if (
        !isSwapProPositionsRequestGenerationCurrent({
          current: positionsRequestStateRef.current,
          expectedOwnerKey,
          expectedRequestId,
        })
      ) {
        return;
      }
      const dispatchedOwnerKey = expectedOwnerKey;
      const requests = tokens.map(async (token) => {
        const defaultDeriveType =
          await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
            networkId: token.networkId ?? '',
          });
        const res = await backgroundApiProxy.serviceAccount.getNetworkAccount({
          accountId: indexedAccountId ? undefined : otherWalletTypeAccountId,
          indexedAccountId: indexedAccountId ?? '',
          networkId: token.networkId ?? '',
          deriveType: defaultDeriveType ?? 'default',
        });
        const balanceTokenInfo =
          await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
            networkId: token.networkId ?? '',
            contractAddress: token.contractAddress,
            accountAddress: res.addressDetail.address,
            accountId: res.id ?? '',
            currency: 'usd',
          });
        return balanceTokenInfo?.[0];
      });
      const results = await Promise.all(requests);
      const validResults = results.filter(Boolean);
      if (
        validResults.length > 0 &&
        isSwapProPositionsRequestGenerationCurrent({
          current: positionsRequestStateRef.current,
          expectedOwnerKey: dispatchedOwnerKey,
          expectedRequestId,
        })
      ) {
        const tokenDetails = validResults;
        setSwapProSupportNetworksTokenList((prevList) =>
          mergeSwapProPositionTokenDetails(prevList, tokenDetails),
        );
        setSwapProPositionsCache((prev) => {
          const entry = prev.byOwner[dispatchedOwnerKey];
          if (!entry) {
            return prev;
          }
          return {
            byOwner: {
              ...prev.byOwner,
              [dispatchedOwnerKey]: {
                ...entry,
                tokens: mergeSwapProPositionTokenDetails(
                  entry.tokens,
                  tokenDetails,
                ),
                updatedAt: Date.now(),
              },
            },
          };
        });
      }
    },
    [
      indexedAccountId,
      otherWalletTypeAccountId,
      setSwapProPositionsCache,
      setSwapProSupportNetworksTokenList,
    ],
  );

  return {
    syncTokensToPosition,
  };
}

export function useSwapProTokenInfoSync() {
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [swapProSelectToken, setSwapProSelectToken] =
    useSwapProSelectTokenAtom();
  const [swapProDirection] = useSwapProDirectionAtom();
  const [swapProUseSelectBuyToken, setSwapProUseSelectBuyTokenAtom] =
    useSwapProUseSelectBuyTokenAtom();
  const [swapProSellToToken, setSwapProSellToToken] =
    useSwapProSellToTokenAtom();
  const netAccountRes = useSwapProAccount();
  const inputToken = useSwapProInputToken();

  const syncInputTokenBalance = useCallback(async () => {
    if (
      !inputToken?.networkId ||
      !netAccountRes.result?.addressDetail.address ||
      !netAccountRes.result?.id
    ) {
      return;
    }
    setBalanceLoading(true);
    try {
      const balanceTokenInfo =
        await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
          networkId: inputToken?.networkId ?? '',
          contractAddress: inputToken?.contractAddress ?? '',
          accountAddress: netAccountRes.result?.addressDetail.address ?? '',
          accountId: netAccountRes.result?.id ?? '',
          currency: 'usd',
        });
      if (balanceTokenInfo?.length) {
        if (swapProDirection === ESwapDirection.BUY) {
          setSwapProUseSelectBuyTokenAtom((prev) =>
            prev &&
            equalTokenNoCaseSensitive({
              token1: prev,
              token2: balanceTokenInfo[0],
            })
              ? {
                  ...prev,
                  isNative: balanceTokenInfo[0].isNative ?? false,
                  balanceParsed: balanceTokenInfo[0].balanceParsed ?? '',
                  price: balanceTokenInfo[0].price ?? '',
                  fiatValue: balanceTokenInfo[0].fiatValue ?? '',
                  accountAddress:
                    netAccountRes.result?.addressDetail.address ?? '',
                }
              : prev,
          );
        } else {
          setSwapProSelectToken((prev) =>
            prev &&
            equalTokenNoCaseSensitive({
              token1: prev,
              token2: balanceTokenInfo[0],
            })
              ? {
                  ...prev,
                  isNative: balanceTokenInfo[0].isNative ?? false,
                  balanceParsed: balanceTokenInfo[0].balanceParsed ?? '',
                  price: balanceTokenInfo[0].price ?? '',
                  fiatValue: balanceTokenInfo[0].fiatValue ?? '',
                  accountAddress:
                    netAccountRes.result?.addressDetail.address ?? '',
                }
              : prev,
          );
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setBalanceLoading(false);
    }
  }, [
    inputToken?.contractAddress,
    inputToken?.networkId,
    netAccountRes.result?.addressDetail.address,
    netAccountRes.result?.id,
    setSwapProSelectToken,
    setSwapProUseSelectBuyTokenAtom,
    swapProDirection,
  ]);
  const syncOrderTokenBalance = useCallback(async () => {
    if (
      !inputToken?.networkId ||
      !netAccountRes.result?.addressDetail.address ||
      !netAccountRes.result?.id
    ) {
      return;
    }
    setBalanceLoading(true);
    try {
      const [swapProSelectTokenDetail, swapProUseSelectBuyTokenDetail] =
        await Promise.all([
          backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
            networkId: swapProSelectToken?.networkId ?? '',
            contractAddress: swapProSelectToken?.contractAddress ?? '',
            accountAddress: netAccountRes.result?.addressDetail.address ?? '',
            accountId: netAccountRes.result?.id ?? '',
            currency: 'usd',
          }),
          backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
            networkId: swapProUseSelectBuyToken?.networkId ?? '',
            contractAddress: swapProUseSelectBuyToken?.contractAddress ?? '',
            accountAddress: netAccountRes.result?.addressDetail.address ?? '',
            accountId: netAccountRes.result?.id ?? '',
            currency: 'usd',
          }),
        ]);
      if (swapProSelectTokenDetail?.length) {
        setSwapProSelectToken((prev) =>
          prev
            ? {
                ...prev,
                isNative: swapProSelectTokenDetail[0].isNative ?? false,
                balanceParsed: swapProSelectTokenDetail[0].balanceParsed ?? '',
                price: swapProSelectTokenDetail[0].price ?? '',
                fiatValue: swapProSelectTokenDetail[0].fiatValue ?? '',
                accountAddress:
                  netAccountRes.result?.addressDetail.address ?? '',
              }
            : undefined,
        );
      }
      if (swapProUseSelectBuyTokenDetail?.length) {
        setSwapProUseSelectBuyTokenAtom((prev) =>
          prev
            ? {
                ...prev,
                isNative: swapProUseSelectBuyTokenDetail[0].isNative ?? false,
                balanceParsed:
                  swapProUseSelectBuyTokenDetail[0].balanceParsed ?? '',
                price: swapProUseSelectBuyTokenDetail[0].price ?? '',
                fiatValue: swapProUseSelectBuyTokenDetail[0].fiatValue ?? '',
                accountAddress:
                  netAccountRes.result?.addressDetail.address ?? '',
              }
            : undefined,
        );
      }
      return {
        swapProSelectTokenDetail: swapProSelectTokenDetail?.[0],
        swapProUseSelectBuyTokenDetail: swapProUseSelectBuyTokenDetail?.[0],
      };
    } catch (e) {
      console.error(e);
    } finally {
      setBalanceLoading(false);
    }
  }, [
    inputToken?.networkId,
    netAccountRes.result?.addressDetail.address,
    netAccountRes.result?.id,
    setSwapProSelectToken,
    setSwapProUseSelectBuyTokenAtom,
    swapProSelectToken?.contractAddress,
    swapProSelectToken?.networkId,
    swapProUseSelectBuyToken?.contractAddress,
    swapProUseSelectBuyToken?.networkId,
  ]);

  const syncToTokenPrice = useCallback(async () => {
    const balanceTokenInfo =
      await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
        networkId: swapProSellToToken?.networkId ?? '',
        contractAddress: swapProSellToToken?.contractAddress ?? '',
        currency: 'usd',
      });
    if (balanceTokenInfo?.length) {
      setSwapProSellToToken((prev) =>
        prev &&
        equalTokenNoCaseSensitive({ token1: prev, token2: balanceTokenInfo[0] })
          ? {
              ...prev,
              isNative: balanceTokenInfo[0].isNative ?? false,
              price: balanceTokenInfo[0].price ?? '',
            }
          : prev,
      );
    }
  }, [
    setSwapProSellToToken,
    swapProSellToToken?.contractAddress,
    swapProSellToToken?.networkId,
  ]);

  const syncSelectTokenNative = useCallback(async () => {
    const balanceTokenInfo =
      await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
        networkId: swapProSelectToken?.networkId ?? '',
        contractAddress: swapProSelectToken?.contractAddress ?? '',
        currency: 'usd',
      });
    if (balanceTokenInfo?.length) {
      setSwapProSelectToken((prev) =>
        prev &&
        equalTokenNoCaseSensitive({ token1: prev, token2: balanceTokenInfo[0] })
          ? { ...prev, isNative: balanceTokenInfo[0].isNative ?? false }
          : prev,
      );
    }
  }, [
    swapProSelectToken?.contractAddress,
    swapProSelectToken?.networkId,
    setSwapProSelectToken,
  ]);
  return {
    syncOrderTokenBalance,
    syncInputTokenBalance,
    syncToTokenPrice,
    syncSelectTokenNative,
    balanceLoading,
    netAccountRes,
  };
}

export function useSwapProTokenInit() {
  const { setSwapProSelectToken } = useSwapActions().current;
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const [swapProTokenSupportLimit] = useSwapProTokenSupportLimitAtom();
  const [swapProJumpToken] = useSwapProJumpTokenAtom();
  const [swapProTradeType, setSwapProTradeType] = useSwapProTradeTypeAtom();
  const [swapProSellToToken, setSwapProSellToToken] =
    useSwapProSellToTokenAtom();
  const [swapProUseSelectBuyTokenAtom, setSwapProUseSelectBuyTokenAtom] =
    useSwapProUseSelectBuyTokenAtom();
  const [swapProInputAmount] = useSwapProInputAmountAtom();
  const [swapFromInputAmount] = useSwapFromTokenAmountAtom();

  const {
    defaultTokens,
    defaultLimitTokens,
    isLoading,
    speedConfig,
    speedConfigReady,
    swapMevNetConfig,
    speedDefaultSelectToken,
    supportSpeedSwap,
    onlySupportCrossChain,
  } = useSpeedSwapInit(swapProSelectToken?.networkId || '');

  const defaultTokensFromType = useMemo(() => {
    if (swapProTradeType === ESwapProTradeType.MARKET) {
      return defaultTokens;
    }
    return defaultLimitTokens;
  }, [swapProTradeType, defaultTokens, defaultLimitTokens]);

  // Read persisted token preference (shared with Instant Mode) via simpledb
  const { result: savedPreference } = usePromiseResult(
    async () => {
      const networkId = swapProSelectToken?.networkId || '';
      if (!networkId) return undefined;
      return backgroundApiProxy.simpleDb.marketTokenPreference.getPreference({
        networkId,
      });
    },
    [swapProSelectToken?.networkId],
    { revalidateOnFocus: true },
  );
  const findPreferredToken = useCallback((): ISwapTokenBase | undefined => {
    if (!savedPreference || defaultTokensFromType.length === 0)
      return undefined;
    return defaultTokensFromType.find(
      (t) =>
        t.networkId === savedPreference.networkId &&
        t.contractAddress.toLowerCase() ===
          savedPreference.contractAddress.toLowerCase(),
    );
  }, [savedPreference, defaultTokensFromType]);

  useEffect(() => {
    if (
      (!swapProUseSelectBuyTokenAtom && defaultTokensFromType.length > 0) ||
      !defaultTokensFromType.some((item) =>
        equalTokenNoCaseSensitive({
          token1: item,
          token2: swapProUseSelectBuyTokenAtom,
        }),
      )
    ) {
      // Prefer persisted preference, fallback to first default token
      const preferred = findPreferredToken();
      let selectedDefaultToken =
        (preferred as (typeof defaultTokensFromType)[0]) ??
        defaultTokensFromType[0];
      if (
        equalTokenNoCaseSensitive({
          token1: selectedDefaultToken,
          token2: {
            contractAddress: swapProSelectToken?.contractAddress ?? '',
            networkId: swapProSelectToken?.networkId ?? '',
          },
        })
      ) {
        selectedDefaultToken =
          defaultTokensFromType[1] ?? defaultTokensFromType[0];
      }
      setSwapProUseSelectBuyTokenAtom(selectedDefaultToken);
    } else if (
      swapProUseSelectBuyTokenAtom &&
      defaultTokensFromType.length > 0 &&
      equalTokenNoCaseSensitive({
        token1: swapProUseSelectBuyTokenAtom,
        token2: {
          contractAddress: swapProSelectToken?.contractAddress ?? '',
          networkId: swapProSelectToken?.networkId ?? '',
        },
      })
    ) {
      const noEqualToken = defaultTokensFromType.find(
        (item) =>
          !equalTokenNoCaseSensitive({
            token1: item,
            token2: swapProUseSelectBuyTokenAtom,
          }),
      );
      if (noEqualToken) {
        setSwapProUseSelectBuyTokenAtom(noEqualToken);
      }
    }
  }, [
    swapProSelectToken?.contractAddress,
    swapProSelectToken?.networkId,
    swapProUseSelectBuyTokenAtom,
    setSwapProUseSelectBuyTokenAtom,
    defaultTokensFromType,
    findPreferredToken,
  ]);

  useEffect(() => {
    if (
      !swapProTokenSupportLimit &&
      swapProSelectToken &&
      swapProTradeType === ESwapProTradeType.LIMIT
    ) {
      setSwapProTradeType(ESwapProTradeType.MARKET);
    }
  }, [
    swapProTokenSupportLimit,
    swapProSelectToken,
    swapProTradeType,
    setSwapProTradeType,
  ]);

  useEffect(() => {
    if (
      !swapProJumpToken?.token &&
      !swapProSelectToken &&
      speedDefaultSelectToken
    ) {
      void setSwapProSelectToken(undefined, speedDefaultSelectToken);
    }
  }, [
    swapProJumpToken,
    setSwapProSelectToken,
    speedDefaultSelectToken,
    swapProSelectToken,
  ]);

  useEffect(() => {
    if (
      (!swapProSellToToken && defaultTokensFromType.length > 0) ||
      !defaultTokensFromType.some((item) =>
        equalTokenNoCaseSensitive({
          token1: item,
          token2: swapProSellToToken,
        }),
      )
    ) {
      // Prefer persisted preference for sell-to token
      const preferred = findPreferredToken();
      let selectedDefaultToken = defaultTokensFromType[0];
      const nativeToken = defaultTokensFromType.find((item) => item.isNative);
      const wrappedToken = defaultTokensFromType.find((item) =>
        wrappedTokens.some(
          (wrapped) =>
            wrapped.address.toLowerCase() ===
              item.contractAddress.toLowerCase() &&
            wrapped.networkId === item.networkId,
        ),
      );
      if (preferred) {
        selectedDefaultToken = preferred as (typeof defaultTokensFromType)[0];
      } else if (nativeToken || wrappedToken) {
        if (swapProTradeType === ESwapProTradeType.MARKET && nativeToken) {
          selectedDefaultToken = nativeToken;
        } else if (
          swapProTradeType === ESwapProTradeType.LIMIT &&
          wrappedToken
        ) {
          if (
            equalTokenNoCaseSensitive({
              token1: wrappedToken,
              token2: {
                contractAddress: swapProSelectToken?.contractAddress ?? '',
                networkId: swapProSelectToken?.networkId ?? '',
              },
            })
          ) {
            const noWrappedToken = defaultTokensFromType.find(
              (item) =>
                !wrappedTokens.find(
                  (wrapped) =>
                    wrapped.address.toLowerCase() ===
                      item.contractAddress.toLowerCase() &&
                    wrapped.networkId === item.networkId,
                ),
            );
            if (noWrappedToken) {
              selectedDefaultToken = noWrappedToken;
            }
          } else {
            selectedDefaultToken = wrappedToken;
          }
        }
      } else {
        const defaultTokenZero = defaultTokensFromType[0];
        if (
          equalTokenNoCaseSensitive({
            token1: defaultTokenZero,
            token2: {
              contractAddress: swapProSelectToken?.contractAddress ?? '',
              networkId: swapProSelectToken?.networkId ?? '',
            },
          })
        ) {
          selectedDefaultToken = defaultTokensFromType[1] ?? defaultTokenZero;
        }
      }
      setSwapProSellToToken(selectedDefaultToken);
    } else if (
      swapProSellToToken &&
      defaultTokensFromType.length > 0 &&
      equalTokenNoCaseSensitive({
        token1: swapProSellToToken,
        token2: {
          contractAddress: swapProSelectToken?.contractAddress ?? '',
          networkId: swapProSelectToken?.networkId ?? '',
        },
      })
    ) {
      const noEqualToken = defaultTokensFromType.find(
        (item) =>
          !equalTokenNoCaseSensitive({
            token1: item,
            token2: {
              contractAddress: swapProSelectToken?.contractAddress ?? '',
              networkId: swapProSelectToken?.networkId ?? '',
            },
          }),
      );
      if (noEqualToken) {
        setSwapProSellToToken(noEqualToken);
      }
    }
  }, [
    defaultTokensFromType,
    setSwapProSellToToken,
    swapProSelectToken?.networkId,
    swapProSelectToken?.contractAddress,
    swapProSellToToken,
    swapProTradeType,
    findPreferredToken,
  ]);

  // Apply preference when it loads after init effects already set defaults
  useEffect(() => {
    if (!savedPreference || defaultTokensFromType.length === 0) return;
    const preferred = findPreferredToken();
    if (!preferred) return;
    if (
      swapProUseSelectBuyTokenAtom &&
      !equalTokenNoCaseSensitive({
        token1: preferred,
        token2: swapProUseSelectBuyTokenAtom,
      })
    ) {
      setSwapProUseSelectBuyTokenAtom(
        preferred as (typeof defaultTokensFromType)[0],
      );
    }
    if (
      swapProSellToToken &&
      !equalTokenNoCaseSensitive({
        token1: preferred,
        token2: swapProSellToToken,
      })
    ) {
      setSwapProSellToToken(preferred as (typeof defaultTokensFromType)[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedPreference]);

  const inputToken = useSwapProInputToken();

  const {
    syncInputTokenBalance,
    syncToTokenPrice,
    syncSelectTokenNative,
    balanceLoading,
    netAccountRes,
  } = useSwapProTokenInfoSync();

  useEffect(() => {
    if (
      (inputToken && !inputToken.balanceParsed) ||
      (inputToken as ISwapToken)?.accountAddress !==
        netAccountRes.result?.addressDetail.address
    ) {
      void syncInputTokenBalance();
    }
  }, [
    inputToken,
    syncInputTokenBalance,
    netAccountRes.result?.addressDetail.address,
  ]);

  useEffect(() => {
    if (swapProSellToToken && !swapProSellToToken.price) {
      void syncToTokenPrice();
    }
  }, [swapProSellToToken, syncToTokenPrice]);

  useEffect(() => {
    if (swapProSelectToken && isNil(swapProSelectToken?.isNative)) {
      void syncSelectTokenNative();
    }
  }, [swapProSelectToken, syncSelectTokenNative]);

  const isMEV = useMemo(() => {
    return Array.isArray(swapMevNetConfig)
      ? swapMevNetConfig.includes(swapProSelectToken?.networkId ?? '')
      : undefined;
  }, [swapMevNetConfig, swapProSelectToken?.networkId]);

  const hasEnoughBalance = useMemo(() => {
    if (balanceLoading) {
      return true;
    }
    const inputAmountBN =
      swapProTradeType === ESwapProTradeType.MARKET
        ? new BigNumber(swapProInputAmount || '0')
        : new BigNumber(
            swapFromInputAmount.value ? swapFromInputAmount.value : '0',
          );
    if (inputAmountBN.isNaN() || inputAmountBN.isZero()) {
      return true;
    }
    const inputTokenBalanceBN = new BigNumber(inputToken?.balanceParsed || '0');
    return inputTokenBalanceBN.gte(inputAmountBN);
  }, [
    balanceLoading,
    swapProTradeType,
    swapProInputAmount,
    swapFromInputAmount.value,
    inputToken?.balanceParsed,
  ]);

  return {
    defaultTokensFromType,
    isLoading,
    balanceLoading,
    speedConfig,
    speedConfigReady,
    swapMevNetConfig,
    swapProSelectToken,
    isMEV,
    hasEnoughBalance,
    supportSpeedSwap,
    onlySupportCrossChain,
  };
}

export function useSwapProTokenSearch(
  input: string,
  selectedNetworkId?: string,
  analyticsOverride?: {
    tokenRole?: string;
    tokenListType?: string;
  },
) {
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchTokenList, setSearchTokenList] = useState<
    ISwapProSearchTokenListItem[]
  >([]);
  const lastLoggedSearchRef = useRef<string>(''); // query__networkId
  const searchTokenListRef =
    useRef<ISwapProSearchTokenListItem[]>(searchTokenList);

  if (searchTokenListRef.current !== searchTokenList) {
    searchTokenListRef.current = searchTokenList;
  }

  const mergeBatchQuotes = useCallback(
    (
      currentItems: ISwapProSearchTokenListItem[],
      latestItems: Array<IMarketTokenListItem | undefined>,
    ) => {
      let hasChanges = false;
      const merged = currentItems.map((item, index) => {
        const latest = latestItems[index];
        if (!latest) {
          return item;
        }

        const nextItem: ISwapProSearchTokenListItem = {
          ...item,
          price: latest.price ?? item.price,
          liquidity: latest.liquidity ?? item.liquidity,
          volume_24h: latest.volume24h ?? item.volume_24h,
          volume24h: latest.volume24h ?? item.volume24h,
          marketCap: latest.marketCap ?? item.marketCap,
          priceChange24hPercent:
            latest.priceChange24hPercent ?? item.priceChange24hPercent,
        };

        if (
          nextItem.price === item.price &&
          nextItem.liquidity === item.liquidity &&
          nextItem.volume_24h === item.volume_24h &&
          nextItem.volume24h === item.volume24h &&
          nextItem.marketCap === item.marketCap &&
          nextItem.priceChange24hPercent === item.priceChange24hPercent
        ) {
          return item;
        }

        hasChanges = true;
        return nextItem;
      });

      return hasChanges ? merged : currentItems;
    },
    [],
  );

  useEffect(() => {
    let isCancelled = false;

    void (async () => {
      if (!input) {
        setSearchTokenList([]);
        return;
      }
      setSearchLoading(true);
      try {
        const searchRes =
          await backgroundApiProxy.serviceUniversalSearch.universalSearchOfV2MarketToken(
            input,
          );
        if (isCancelled) {
          return;
        }
        const searchTokenParse = searchRes?.map((t) => {
          const networkInfo = networkUtils.getLocalNetworkInfo(t.network);
          return {
            ...t,
            networkLogoURI: networkInfo?.logoURI ?? '',
          };
        });
        const finalList = searchTokenParse ?? [];
        setSearchTokenList(finalList);

        const queryLength = input.length;
        const currentNetworkId = selectedNetworkId ?? '';
        const logKey = [
          input,
          currentNetworkId,
          analyticsOverride?.tokenRole ?? '',
          analyticsOverride?.tokenListType ?? '',
        ].join('__');
        if (queryLength >= 1 && lastLoggedSearchRef.current !== logKey) {
          lastLoggedSearchRef.current = logKey;
          const networkInfo = selectedNetworkId
            ? networkUtils.getLocalNetworkInfo(selectedNetworkId)
            : undefined;
          const networkName =
            networkInfo?.name ?? selectedNetworkId ?? 'Market';
          const resultCount =
            analyticsOverride?.tokenListType ===
            SWAP_STOCK_ANALYTICS_TOKEN_LIST_TYPE_STOCK
              ? finalList.filter((item) => !!item.stock).length
              : finalList.length;
          defaultLogger.swap.tokenSelectorSearch.swapTokenSelectorSearch({
            query: input,
            resultCount,
            networkId: currentNetworkId,
            networkName,
            network: networkName,
            direction: ESwapDirectionType.FROM,
            from: 'pro',
            tokenRole:
              analyticsOverride?.tokenRole ??
              getSwapAnalyticsTokenRole(ESwapDirectionType.FROM),
            tokenListType:
              analyticsOverride?.tokenListType ??
              getSwapAnalyticsTokenListType({ from: 'pro' }),
          });
        }
      } catch (e) {
        if (!isCancelled) {
          console.error(e);
        }
      } finally {
        if (!isCancelled) {
          setSearchLoading(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [
    input,
    analyticsOverride?.tokenListType,
    analyticsOverride?.tokenRole,
    selectedNetworkId,
  ]);

  const searchTokenListLength = searchTokenList.length;
  // Use a content-based key so the polling effect restarts when search
  // results change, even if the count stays the same.
  const searchTokenListKey = useMemo(
    () => searchTokenList.map((t) => `${t.network}:${t.address}`).join(','),
    [searchTokenList],
  );
  useEffect(() => {
    if (searchTokenListLength === 0) {
      return;
    }

    let isCancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const refreshQuotes = async () => {
      const snapshot = searchTokenListRef.current;
      try {
        const { list } =
          await backgroundApiProxy.serviceMarketV2.fetchMarketTokenListBatch({
            tokenAddressList: snapshot.map((item) => ({
              chainId: item.network,
              contractAddress: item.address,
              isNative: item.isNative,
            })),
            skipCache: true,
          });

        if (isCancelled) {
          return;
        }

        // Discard if search results were replaced by a new search
        if (searchTokenListRef.current !== snapshot) {
          return;
        }

        setSearchTokenList((prev) => mergeBatchQuotes(prev, list ?? []));
      } catch (error) {
        if (!isCancelled) {
          console.error(error);
        }
      } finally {
        if (!isCancelled) {
          timer = setTimeout(
            () => void refreshQuotes(),
            SWAP_PRO_SEARCH_RESULTS_REFRESH_INTERVAL,
          );
        }
      }
    };

    void refreshQuotes();

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mergeBatchQuotes, searchTokenListKey]);

  return {
    searchLoading,
    searchTokenList,
  };
}

export function useSwapProTokenDetailInfo() {
  const { swapProTokenMarketDetailFetchAction } = useSwapActions().current;
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const fetchTokenMarketDetailInfo = useCallback(async () => {
    if (swapProSelectToken?.networkId) {
      void swapProTokenMarketDetailFetchAction(
        swapProSelectToken?.contractAddress,
        swapProSelectToken?.networkId,
      );
    }
  }, [
    swapProSelectToken?.contractAddress,
    swapProSelectToken?.networkId,
    swapProTokenMarketDetailFetchAction,
  ]);
  usePromiseResult(
    async () => {
      await fetchTokenMarketDetailInfo();
    },
    [fetchTokenMarketDetailInfo],
    {
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 10 }),
    },
  );

  return {
    fetchTokenMarketDetailInfo,
  };
}

export function useSwapProTokenTransactionList(
  tokenAddress: string,
  networkId: string,
  enableWebSocket: boolean,
  supportSpeedSwap?: boolean,
) {
  const currencyInfo = useCurrency();
  const [, setSwapProTokenTransactionPrice] =
    useSwapProTokenTransactionPriceAtom();
  const [swapProTokenTransactionList, setSwapProTokenTransactionList] =
    useState<IMarketTokenTransaction[]>([]);
  const swapProTokenTransactionListRef = useRef<IMarketTokenTransaction[]>(
    swapProTokenTransactionList,
  );
  if (swapProTokenTransactionListRef.current !== swapProTokenTransactionList) {
    swapProTokenTransactionListRef.current = [...swapProTokenTransactionList];
  }
  const {
    result: transactionsData,
    isLoading: isRefreshing,
    run: fetchTransactions,
  } = usePromiseResult(
    async () => {
      if (!networkId || !supportSpeedSwap) {
        return undefined;
      }
      try {
        const response =
          await backgroundApiProxy.serviceMarketV2.fetchMarketTokenTransactions(
            {
              tokenAddress,
              networkId,
              limit: 10,
            },
          );
        return response;
      } catch (_e) {
        return { list: [] };
      }
    },
    [networkId, supportSpeedSwap, tokenAddress],
    {
      watchLoading: true,
    },
  );
  useEffect(() => {
    const newTransactions = transactionsData?.list;
    if (!newTransactions || newTransactions.length === 0) {
      setSwapProTokenTransactionList([]);
      setSwapProTokenTransactionPrice('');
      return;
    }
    setSwapProTokenTransactionList(newTransactions);
    setSwapProTokenTransactionPrice(newTransactions[0].to.price ?? '');
  }, [transactionsData?.list, setSwapProTokenTransactionPrice]);

  const addNewTransactions = useCallback(
    (newTransactions: IMarketTokenTransaction[]) => {
      if (newTransactions.length === 0) {
        return;
      }

      const prev = swapProTokenTransactionListRef.current;
      const seenHashes = new Set(prev.map((tx) => tx.hash));
      const nextTransactions = newTransactions.filter((tx) => {
        if (seenHashes.has(tx.hash)) {
          return false;
        }
        seenHashes.add(tx.hash);
        return true;
      });

      if (nextTransactions.length === 0) {
        return;
      }

      const updatedTransactions = [...nextTransactions, ...prev].toSorted(
        (a, b) => b.timestamp - a.timestamp,
      );
      setSwapProTokenTransactionList(updatedTransactions);
      setSwapProTokenTransactionPrice(updatedTransactions[0].to.price ?? '');
    },
    [setSwapProTokenTransactionPrice],
  );

  // Subscribe to real-time transaction updates
  // Only enable if websocket.txs is enabled and other conditions are met
  useTransactionsWebSocket({
    networkId,
    tokenAddress,
    enabled: enableWebSocket && supportSpeedSwap,
    currency: currencyInfo.id,
    onNewTransactions: addNewTransactions,
  });

  return {
    swapProTokenTransactionList,
    isRefreshing,
    fetchTransactions,
  };
}

export function useSwapPositionsSupportTokenListAction() {
  const { swapProLoadSupportNetworksTokenList } = useSwapActions().current;
  const { accountId, indexedAccountId, otherWalletTypeAccountId } =
    useSwapProPositionsAccountIdentity();
  const swapProLoadSupportNetworksTokenListRun = useCallback(
    async (networkList: (IMarketBasicConfigNetwork | ISwapNetwork)[]) => {
      if (networkList.length > 0 && accountId) {
        await swapProLoadSupportNetworksTokenList(
          networkList.map((item) => ({
            networkId: item.networkId,
            symbol: item.name,
            name: item.name,
          })),
          indexedAccountId,
          otherWalletTypeAccountId,
        );
      }
    },
    [
      accountId,
      indexedAccountId,
      otherWalletTypeAccountId,
      swapProLoadSupportNetworksTokenList,
    ],
  );
  return {
    swapProLoadSupportNetworksTokenListRun,
  };
}

export function useSwapProSupportNetworksTokenList(
  networkList: (IMarketBasicConfigNetwork | ISwapNetwork)[],
) {
  const { accountId: positionAccountId, identityReady: positionIdentityReady } =
    useSwapProPositionsAccountIdentity();
  const [swapSelectToken] = useSwapProSelectTokenAtom();
  const [swapProUseSelectBuyToken] = useSwapProUseSelectBuyTokenAtom();
  const { syncOrderTokenBalance } = useSwapProTokenInfoSync();
  const [swapProSupportNetworksTokenList, setSwapProSupportNetworksTokenList] =
    useSwapProSupportNetworksTokenListAtom();
  const [swapProPositionsCache, setSwapProPositionsCache] =
    useSwapProPositionsCacheAtom();
  const [positionsRequestState] = useSwapProPositionsRequestStateAtom();
  const { syncTokensToPosition } = useSwapTokenPairBalanceSyncForPosition();
  const positionNetworkIdsKey = useMemo(
    () => buildSwapProPositionsNetworkIdsKey(networkList),
    [networkList],
  );
  const positionOwnerKey = useMemo(
    () =>
      buildSwapProPositionsOwnerKey({
        accountId: positionAccountId,
        networkIdsKey: positionNetworkIdsKey,
      }),
    [positionAccountId, positionNetworkIdsKey],
  );
  const positionsRequestStateRef = useRef(positionsRequestState);
  positionsRequestStateRef.current = positionsRequestState;
  const cachedPositionEntry = useMemo(() => {
    if (positionOwnerKey) {
      const exactEntry = swapProPositionsCache.byOwner[positionOwnerKey];
      if (exactEntry) {
        return exactEntry;
      }
    }
    if (!positionAccountId || positionNetworkIdsKey) {
      return undefined;
    }
    const ownerPrefix = `${positionAccountId}__`;
    return Object.values(swapProPositionsCache.byOwner)
      .filter((entry) => entry.ownerKey.startsWith(ownerPrefix))
      .toSorted((a, b) => b.updatedAt - a.updatedAt)[0];
  }, [
    positionAccountId,
    positionNetworkIdsKey,
    positionOwnerKey,
    swapProPositionsCache.byOwner,
  ]);
  const cachedPositionTokenList = useMemo(() => {
    if (
      !cachedPositionEntry ||
      (!positionNetworkIdsKey && !positionAccountId)
    ) {
      return [];
    }
    if (
      cachedPositionEntry?.ownerKey === positionOwnerKey &&
      cachedPositionEntry.networkIdsKey === positionNetworkIdsKey
    ) {
      return cachedPositionEntry.tokens;
    }
    if (!positionNetworkIdsKey && positionAccountId) {
      const ownerPrefix = `${positionAccountId}__`;
      if (cachedPositionEntry.ownerKey.startsWith(ownerPrefix)) {
        return cachedPositionEntry.tokens;
      }
    }
    return [];
  }, [
    cachedPositionEntry,
    positionAccountId,
    positionNetworkIdsKey,
    positionOwnerKey,
  ]);
  const swapProSelectTokenRef = useRef(swapSelectToken);
  if (swapProSelectTokenRef.current !== swapSelectToken) {
    swapProSelectTokenRef.current = swapSelectToken;
  }
  const swapProUseSelectBuyTokenRef = useRef(swapProUseSelectBuyToken);
  if (swapProUseSelectBuyTokenRef.current !== swapProUseSelectBuyToken) {
    swapProUseSelectBuyTokenRef.current = swapProUseSelectBuyToken;
  }
  const swapProSupportNetworksTokenListRef = useRef(
    swapProSupportNetworksTokenList,
  );
  if (
    swapProSupportNetworksTokenListRef.current !==
    swapProSupportNetworksTokenList
  ) {
    swapProSupportNetworksTokenListRef.current = [
      ...swapProSupportNetworksTokenList,
    ];
  }
  const { swapProLoadSupportNetworksTokenListRun } =
    useSwapPositionsSupportTokenListAction();
  const ownerRequestScopeRef = useRef<ISwapProPositionsOwnerRequestScope>({
    baselineRequestId: positionsRequestState.requestId,
    ownerKey: positionOwnerKey,
    sessionId: 0,
  });
  ownerRequestScopeRef.current = advanceSwapProPositionsOwnerRequestScope({
    currentRequestId: positionsRequestState.requestId,
    currentScope: ownerRequestScopeRef.current,
    ownerKey: positionOwnerKey,
  });
  const currentOwnerRequestScope = ownerRequestScopeRef.current;
  const [settledPositionOwnerScope, setSettledPositionOwnerScope] =
    useState<ISwapProPositionsOwnerRequestScope>();
  const hasCurrentOwnerRequestSettled =
    hasSwapProPositionsOwnerRequestSettledSince({
      baselineRequestId: currentOwnerRequestScope.baselineRequestId,
      currentRequestState: positionsRequestState,
      ownerKey: positionOwnerKey,
    });
  useEffect(() => {
    void swapProLoadSupportNetworksTokenListRun(networkList);
  }, [swapProLoadSupportNetworksTokenListRun, networkList]);
  useEffect(() => {
    if (hasCurrentOwnerRequestSettled) {
      setSettledPositionOwnerScope(currentOwnerRequestScope);
    }
  }, [currentOwnerRequestScope, hasCurrentOwnerRequestSettled]);

  const handleCurrentGenerationBalanceUpdate = useCallback(
    async (
      {
        orderFromToken,
        orderToToken,
      }: {
        orderFromToken: ISwapTokenBase;
        orderToToken: ISwapTokenBase;
      },
      dispatchedGeneration: ISwapProPositionsRequestGeneration,
    ) => {
      const dispatchedOwnerKey = dispatchedGeneration.ownerKey;
      const dispatchedRequestId = dispatchedGeneration.requestId;
      if (
        swapProSelectTokenRef.current?.networkId &&
        swapProUseSelectBuyTokenRef.current?.networkId &&
        (equalTokenNoCaseSensitive({
          token1: swapProSelectTokenRef.current,
          token2: orderFromToken,
        }) ||
          equalTokenNoCaseSensitive({
            token1: swapProUseSelectBuyTokenRef.current,
            token2: orderFromToken,
          }) ||
          equalTokenNoCaseSensitive({
            token1: swapProSelectTokenRef.current,
            token2: orderToToken,
          }) ||
          equalTokenNoCaseSensitive({
            token1: swapProUseSelectBuyTokenRef.current,
            token2: orderToToken,
          }))
      ) {
        const balanceTokensInfoRes = await syncOrderTokenBalance();
        if (
          balanceTokensInfoRes &&
          isSwapProPositionsRequestGenerationCurrent({
            current: positionsRequestStateRef.current,
            expectedOwnerKey: dispatchedOwnerKey,
            expectedRequestId: dispatchedRequestId,
          })
        ) {
          const newSwapProSelectTokenDetail =
            balanceTokensInfoRes.swapProSelectTokenDetail;
          const newSwapProUseSelectBuyTokenDetail =
            balanceTokensInfoRes.swapProUseSelectBuyTokenDetail;

          // Update swapProSupportNetworksTokenList with the new token details
          const tokensToUpdate = [
            newSwapProSelectTokenDetail,
            newSwapProUseSelectBuyTokenDetail,
          ].filter(Boolean);

          if (tokensToUpdate.length > 0) {
            const tokenDetails = tokensToUpdate;
            setSwapProSupportNetworksTokenList((prevList) =>
              mergeSwapProPositionTokenDetails(prevList, tokenDetails),
            );
            setSwapProPositionsCache((prev) => {
              const entry = prev.byOwner[dispatchedOwnerKey];
              if (!entry) {
                return prev;
              }
              return {
                byOwner: {
                  ...prev.byOwner,
                  [dispatchedOwnerKey]: {
                    ...entry,
                    tokens: mergeSwapProPositionTokenDetails(
                      entry.tokens,
                      tokenDetails,
                    ),
                    updatedAt: Date.now(),
                  },
                },
              };
            });
          }
        }
      } else {
        void syncTokensToPosition(
          [orderFromToken, orderToToken],
          dispatchedOwnerKey,
          dispatchedRequestId,
        );
      }
    },
    [
      setSwapProPositionsCache,
      syncOrderTokenBalance,
      setSwapProSupportNetworksTokenList,
      syncTokensToPosition,
    ],
  );
  const checkSyncOrderTokenBalance =
    useSwapProPositionsGenerationGuardedCallback<{
      orderFromToken: ISwapTokenBase;
      orderToToken: ISwapTokenBase;
    }>({
      currentRequestStateRef: positionsRequestStateRef,
      onCurrentGenerationEvent: handleCurrentGenerationBalanceUpdate,
      ownerKey: positionOwnerKey,
    });

  useEffect(() => {
    appEventBus.off(
      EAppEventBusNames.SwapSpeedBalanceUpdate,
      checkSyncOrderTokenBalance,
    );
    appEventBus.on(
      EAppEventBusNames.SwapSpeedBalanceUpdate,
      checkSyncOrderTokenBalance,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.SwapSpeedBalanceUpdate,
        checkSyncOrderTokenBalance,
      );
    };
  }, [checkSyncOrderTokenBalance]);

  return {
    cachedPositionTokenList,
    hasSettledPositionOwnerRequest:
      Boolean(positionOwnerKey) &&
      (isSwapProPositionsOwnerRequestScopeSettled({
        currentScope: currentOwnerRequestScope,
        settledScope: settledPositionOwnerScope,
      }) ||
        hasCurrentOwnerRequestSettled),
    hasCachedPositionTokenList: Boolean(cachedPositionEntry),
    positionIdentityReady,
    positionOwnerKey,
    positionSourceUnavailable: isSwapProPositionsSourceUnavailable({
      accountId: positionAccountId,
      identityReady: positionIdentityReady,
    }),
    swapProLoadSupportNetworksTokenListRun,
  };
}

export function useSwapProPositionsListFilter(
  filterToken?: ISwapToken[],
  sourceTokenList?: ISwapToken[],
  isStockPositions?: boolean,
) {
  const [swapProSupportNetworksTokenList] =
    useSwapProSupportNetworksTokenListAtom();
  const positionsTokenList = sourceTokenList ?? swapProSupportNetworksTokenList;
  const filterMinValueTokenList = useMemo(() => {
    // Stock positions use a lower $0.1 floor (vs $1) and skip the max-count cap,
    // so small stock holdings still show and aren't pushed out of the top N.
    const minValue = isStockPositions
      ? swapProStockPositionsListMinValue
      : swapProPositionsListMinValue;
    return positionsTokenList.filter((token) => {
      return new BigNumber(token.fiatValue || '0').gt(minValue);
    });
  }, [positionsTokenList, isStockPositions]);

  const filterDefaultTokenList = useMemo(() => {
    if (
      isStockPositions ||
      filterMinValueTokenList.length <= swapProPositionsListMaxCount
    ) {
      return filterMinValueTokenList;
    }
    return filterMinValueTokenList.slice(0, swapProPositionsListMaxCount);
  }, [filterMinValueTokenList, isStockPositions]);

  const finallyTokenList = useMemo(
    () =>
      filterToken
        ? filterMinValueTokenList.filter((token) =>
            filterToken.some((t) =>
              equalTokenNoCaseSensitive({ token1: t, token2: token }),
            ),
          )
        : filterDefaultTokenList,
    [filterDefaultTokenList, filterMinValueTokenList, filterToken],
  );
  return {
    finallyTokenList,
  };
}

export function useSwapBuildTxInfo() {
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const [swapProQuoteResult] = useSwapSpeedQuoteResultAtom();
  const swapProFromToken = useSwapProInputToken();
  const swapProToToken = useSwapProToToken();
  const [fromSelectTokenAtom] = useSwapSelectFromTokenAtom();
  const [toSelectTokenAtom] = useSwapSelectToTokenAtom();
  const [currentQuote] = useSwapQuoteCurrentSelectAtom();
  const focusSwapPro = useMemo(() => {
    return platformEnv.isNative && swapTypeSwitch === ESwapTabSwitchType.LIMIT;
  }, [swapTypeSwitch]);
  const currentQuoteRes = useMemo(() => {
    if (focusSwapPro && swapProTradeType === ESwapProTradeType.MARKET) {
      return swapProQuoteResult;
    }
    return currentQuote;
  }, [focusSwapPro, swapProTradeType, currentQuote, swapProQuoteResult]);
  const fromSelectToken = useMemo(() => {
    if (focusSwapPro) {
      return swapProFromToken;
    }
    return fromSelectTokenAtom;
  }, [focusSwapPro, fromSelectTokenAtom, swapProFromToken]);
  const toSelectToken = useMemo(() => {
    if (focusSwapPro) {
      return swapProToToken;
    }
    return toSelectTokenAtom;
  }, [focusSwapPro, toSelectTokenAtom, swapProToToken]);

  const swapTypeFinal = useMemo(() => {
    if (focusSwapPro) {
      return swapProTradeType === ESwapProTradeType.LIMIT
        ? ESwapTabSwitchType.LIMIT
        : ESwapTabSwitchType.SWAP;
    }
    return swapTypeSwitch;
  }, [focusSwapPro, swapProTradeType, swapTypeSwitch]);
  return {
    currentQuoteRes,
    fromSelectToken,
    toSelectToken,
    swapTypeFinal,
  };
}

export function useSwapProActionsQuote() {
  const { quoteSpeedAction, cancelSpeedQuote, cleanSpeedQuote } =
    useSwapActions().current;
  const [swapTabSwitchType] = useSwapTypeSwitchAtom();
  const [swapTradeType] = useSwapProTradeTypeAtom();
  const [swapProInputAmount, setSwapProInputAmount] =
    useSwapProInputAmountAtom();
  const debounceInputAmount = useDebounce(swapProInputAmount, 300, {
    leading: true,
  });
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const [swapProDirection] = useSwapProDirectionAtom();
  const [swapProUseSelectBuyTokenAtom] = useSwapProUseSelectBuyTokenAtom();
  const [swapProSellToTokenAtom] = useSwapProSellToTokenAtom();
  const { slippageItem } = useSwapSlippagePercentageModeInfo();
  const swapProAccount = useSwapProAccount();
  const slippageItemRef = useRef(slippageItem);
  if (slippageItemRef.current !== slippageItem) {
    slippageItemRef.current = slippageItem;
  }
  const swapProMarketQuoteCustomSlippage =
    slippageItem.key === ESwapSlippageSegmentKey.CUSTOM
      ? slippageItem.value
      : undefined;
  const enableSwapProMarketQuote = useMemo(
    () =>
      swapTabSwitchType === ESwapTabSwitchType.LIMIT &&
      swapTradeType === ESwapProTradeType.MARKET,
    [swapTabSwitchType, swapTradeType],
  );

  useEffect(() => {
    const debounceInputAmountBN = new BigNumber(debounceInputAmount ?? '0');
    if (
      enableSwapProMarketQuote &&
      swapProAccount.result?.addressDetail.address &&
      !debounceInputAmountBN.isNaN() &&
      debounceInputAmountBN.gt(0)
    ) {
      void quoteSpeedAction(
        slippageItemRef.current,
        swapProAccount.result?.addressDetail.address,
        swapProAccount.result?.id,
        swapProAccount.result?.addressDetail.address,
      );
    }
  }, [
    debounceInputAmount,
    quoteSpeedAction,
    swapProSelectToken?.contractAddress,
    swapProSelectToken?.networkId,
    swapProDirection,
    swapProUseSelectBuyTokenAtom?.contractAddress,
    swapProUseSelectBuyTokenAtom?.networkId,
    swapProSellToTokenAtom?.contractAddress,
    swapProSellToTokenAtom?.networkId,
    enableSwapProMarketQuote,
    swapProAccount.result?.addressDetail.address,
    swapProAccount.result?.id,
    slippageItem.key,
    swapProMarketQuoteCustomSlippage,
  ]);

  useEffect(() => {
    const debounceInputAmountBN = new BigNumber(debounceInputAmount || '0');
    if (debounceInputAmountBN.isNaN() || debounceInputAmountBN.lte(0)) {
      cancelSpeedQuote();
      void cleanSpeedQuote();
    }
  }, [cancelSpeedQuote, cleanSpeedQuote, debounceInputAmount]);

  useEffect(() => {
    if (
      !enableSwapProMarketQuote ||
      !swapProAccount.result?.addressDetail.address
    ) {
      setSwapProInputAmount('');
    }
  }, [
    cleanSpeedQuote,
    enableSwapProMarketQuote,
    setSwapProInputAmount,
    swapProAccount.result?.addressDetail.address,
  ]);

  return {
    quoteSpeedAction,
  };
}

export function useSwapProErrorAlert({
  isSwapProActive,
  accountScope,
  accountStatus,
}: {
  isSwapProActive: boolean;
  accountScope: string;
  accountStatus: ESwapProAccountStatus;
}) {
  const intl = useIntl();
  const [, setSwapProErrorAlert] = useSwapProErrorAlertAtom();
  const [swapProQuoteResult] = useSwapSpeedQuoteResultAtom();
  const [swapCurrentQuote] = useSwapQuoteCurrentSelectAtom();
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const currentQuoteRes = useMemo(() => {
    if (swapProTradeType === ESwapProTradeType.MARKET) {
      return swapProQuoteResult;
    }
    return swapCurrentQuote;
  }, [swapProTradeType, swapProQuoteResult, swapCurrentQuote]);
  const previousAccountScopeRef = useRef('');
  useEffect(() => {
    const alertAction = getSwapProErrorAlertAction({
      isSwapProActive,
      previousAccountScope: previousAccountScopeRef.current,
      accountScope,
      accountStatus,
      hasQuoteError: Boolean(currentQuoteRes?.errorMessage),
    });
    previousAccountScopeRef.current = isSwapProActive ? accountScope : '';

    if (alertAction === ESwapProErrorAlertAction.PRESERVE) {
      return;
    }
    if (alertAction === ESwapProErrorAlertAction.UNSUPPORTED) {
      setSwapProErrorAlert({
        title: intl.formatMessage({
          id: ETranslations.swap_page_alert_account_does_not_support_swap,
        }),
      });
    } else if (
      alertAction === ESwapProErrorAlertAction.QUOTE_ERROR &&
      currentQuoteRes?.errorMessage
    ) {
      setSwapProErrorAlert({
        title: currentQuoteRes.errorMessage,
      });
    } else {
      setSwapProErrorAlert(undefined);
    }
  }, [
    accountScope,
    accountStatus,
    currentQuoteRes,
    intl,
    isSwapProActive,
    setSwapProErrorAlert,
  ]);
}

export function useSwapLimitPriceCheck(
  fromToken?: ISwapToken,
  toToken?: ISwapToken,
) {
  const [swapLimitPriceFromAmount] = useSwapLimitPriceFromAmountAtom();
  const [swapLimitPriceToAmount] = useSwapLimitPriceToAmountAtom();
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const [swapTypeSwitchValue] = useSwapTypeSwitchAtom();
  const [fromInputAmount, setFromInputAmount] = useSwapFromTokenAmountAtom();
  const [toInputAmount, setToInputAmount] = useSwapToTokenAmountAtom();
  const swapProtoToToken = useSwapProToToken();
  const [swapQuoteCurrentSelect] = useSwapQuoteCurrentSelectAtom();
  const { displayQuote: swapQuoteDisplay } = useSwapQuoteProgressState();
  const swapQuoteForAmountProjection =
    swapQuoteDisplay ?? swapQuoteCurrentSelect;
  useEffect(() => {
    if (
      swapTypeSwitchValue === ESwapTabSwitchType.LIMIT &&
      swapLimitPriceFromAmount
    ) {
      setFromInputAmount({
        value: swapLimitPriceFromAmount,
        isInput: false,
      });
    }
  }, [setFromInputAmount, swapLimitPriceFromAmount, swapTypeSwitchValue]);

  useEffect(() => {
    if (
      swapTypeSwitchValue === ESwapTabSwitchType.LIMIT &&
      swapLimitPriceToAmount
    ) {
      setToInputAmount({
        value: swapLimitPriceToAmount,
        isInput: false,
      });
    }
  }, [
    setToInputAmount,
    swapLimitPriceToAmount,
    swapProTradeType,
    swapProtoToToken?.decimals,
    swapProtoToToken?.price,
    swapTypeSwitchValue,
  ]);

  useEffect(() => {
    const isWrappedTokenPair = checkWrappedTokenPair({ fromToken, toToken });
    if (
      swapTypeSwitchValue === ESwapTabSwitchType.LIMIT &&
      !isWrappedTokenPair
    ) {
      return;
    }

    const expectedKind = getSwapQuoteKindForCurrentInput({
      protocol: swapTypeSwitchValue,
      toAmount: toInputAmount,
    });
    const projection = getSwapQuoteAmountProjection({
      expectedKind,
      fromAmount: fromInputAmount.value,
      fromToken,
      quote:
        !isWrappedTokenPair || swapQuoteForAmountProjection?.isWrapped
          ? swapQuoteForAmountProjection
          : undefined,
      toAmount: toInputAmount.value,
      toToken,
    });

    if (projection?.direction === ESwapDirectionType.FROM) {
      if (
        fromInputAmount.value !== projection.value ||
        fromInputAmount.isInput
      ) {
        setFromInputAmount({ value: projection.value, isInput: false });
      }
      return;
    }
    if (projection?.direction === ESwapDirectionType.TO) {
      if (toInputAmount.value !== projection.value || toInputAmount.isInput) {
        setToInputAmount({ value: projection.value, isInput: false });
      }
      return;
    }

    if (expectedKind === ESwapQuoteKind.BUY) {
      if (fromInputAmount.value || fromInputAmount.isInput) {
        setFromInputAmount({ value: '', isInput: false });
      }
    } else if (toInputAmount.value || toInputAmount.isInput) {
      setToInputAmount({ value: '', isInput: false });
    }
  }, [
    fromInputAmount,
    fromToken,
    setToInputAmount,
    setFromInputAmount,
    swapTypeSwitchValue,
    swapQuoteForAmountProjection,
    toInputAmount,
    toToken,
  ]);
}
