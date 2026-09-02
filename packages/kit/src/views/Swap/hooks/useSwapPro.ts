import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { useLocaleVariant } from '@onekeyhq/kit/src/hooks/useLocaleVariant';
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
import { LRUCache } from '@onekeyhq/shared/src/utils/cacheUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  checkWrappedTokenPair,
  equalTokenNoCaseSensitive,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type { IMarketSearchV2Token } from '@onekeyhq/shared/types/market';
import type {
  IMarketBasicConfigNetwork,
  IMarketTokenListItem,
} from '@onekeyhq/shared/types/marketV2';
import {
  SWAP_PRO_QUOTE_INPUT_DEBOUNCE_MS,
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
  useSwapProPositionsRuntimeDataAtom,
  useSwapProSelectTokenAtom,
  useSwapProSellToTokenAtom,
  useSwapProTokenBalanceLoadingAtom,
  useSwapProTokenMarketDetailInfoAtom,
  useSwapProTokenSupportLimitAtom,
  useSwapProTradeTypeAtom,
  useSwapProUseSelectBuyTokenAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapToTokenAmountAtom,
  useSwapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap';
import { useMarketBasicConfig } from '../../Market/hooks';
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
import { buildSwapProPositionsNetworkIdsKey } from '../utils/swapProPositionsKeyUtils';
import { loadSwapProPositions } from '../utils/swapProPositionsLoader';
import {
  SWAP_STOCK_ANALYTICS_TOKEN_LIST_TYPE_STOCK,
  getSwapAnalyticsTokenListType,
  getSwapAnalyticsTokenRole,
} from '../utils/swapStockAnalytics';
import {
  filterSwapProCounterpartyTokens,
  getSwapProDefaultTokens,
} from '../utils/swapTypeUtils';

import { backfillSwapProTokenStockIdentity } from './swapStockChannelUtils';
import { useSwapSlippagePercentageModeInfo } from './useSwapState';

type ISwapProSearchTokenListItem = IMarketSearchV2Token & {
  networkLogoURI: string;
};

const SWAP_PRO_SEARCH_RESULTS_REFRESH_INTERVAL = timerUtils.getTimeDurationMs({
  seconds: 15,
});
const swapProAccountCache = new LRUCache<string, INetworkAccount>({ max: 20 });
const swapProSearchTokenCache = new LRUCache<
  string,
  ISwapProSearchTokenListItem[]
>({ max: 30 });
const EMPTY_SWAP_PRO_SEARCH_TOKEN_LIST: ISwapProSearchTokenListItem[] = [];

export function isSwapProTokenBalanceRequestCurrent({
  requestId,
  currentRequestId,
  requestedAccountId,
  requestedAccountAddress,
  requestedToken,
  currentAccountId,
  currentAccountAddress,
  currentToken,
}: {
  requestId: number;
  currentRequestId: number;
  requestedAccountId: string;
  requestedAccountAddress: string;
  requestedToken: ISwapToken | undefined;
  currentAccountId: string | undefined;
  currentAccountAddress: string | undefined;
  currentToken: ISwapToken | undefined;
}) {
  return (
    requestId === currentRequestId &&
    requestedAccountId === currentAccountId &&
    requestedAccountAddress === currentAccountAddress &&
    equalTokenNoCaseSensitive({
      token1: requestedToken,
      token2: currentToken,
    })
  );
}

export function useSwapProInit() {
  const [, setSwapSwitchType] = useSwapTypeSwitchAtom();
  const [, setSwapProDirection] = useSwapProDirectionAtom();
  const { basicConfig, networkList } = useMarketBasicConfig();
  const { initializeSwapProSelectToken } = useSwapActions().current;
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const [swapProJumpToken, setSwapProJumpToken] = useSwapProJumpTokenAtom();
  const swapSwitchProToken = useCallback(
    (payload: { token: ISwapToken }) => {
      setSwapSwitchType(ESwapTabSwitchType.LIMIT);
      void initializeSwapProSelectToken(payload.token);
    },
    [initializeSwapProSelectToken, setSwapSwitchType],
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
    supportNetworksReady: Boolean(basicConfig),
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
  const accountIdentityScope = buildSwapProAccountScope({
    targetNetworkId,
    indexedAccountId,
    accountId,
  });
  const selectedDeriveType =
    indexedAccountId && selectedAccount.networkId === targetNetworkId
      ? selectedAccount.deriveType
      : undefined;
  const knownAccountDeriveType = indexedAccountId
    ? selectedDeriveType
    : 'default';
  const knownAccountScope =
    accountIdentityScope && knownAccountDeriveType
      ? `${accountIdentityScope}|${knownAccountDeriveType}`
      : '';
  const accountRequestScope =
    knownAccountScope ||
    (accountIdentityScope ? `${accountIdentityScope}|network-default` : '');
  const shouldResolveAccount = Boolean(accountRequestScope && targetNetworkId);
  const cachedNetAccount = knownAccountScope
    ? swapProAccountCache.get(knownAccountScope)
    : undefined;
  const netAccountStateRes = usePromiseResult<{
    requestScope: string;
    scope: string;
    account: INetworkAccount | undefined;
  }>(
    async () => {
      if (!shouldResolveAccount) {
        return {
          requestScope: '',
          scope: '',
          account: undefined,
        };
      }
      let resolvedAccountScope = '';
      try {
        const accountDeriveType =
          knownAccountDeriveType ??
          (await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork(
            {
              networkId: targetNetworkId,
            },
          ));
        resolvedAccountScope = `${accountIdentityScope}|${
          indexedAccountId ? (accountDeriveType ?? 'default') : 'default'
        }`;
        const account =
          await backgroundApiProxy.serviceAccount.getNetworkAccount({
            accountId,
            indexedAccountId: indexedAccountId ?? '',
            networkId: targetNetworkId,
            deriveType: accountDeriveType ?? 'default',
          });
        if (account) {
          swapProAccountCache.set(resolvedAccountScope, account);
        }
        return {
          requestScope: accountRequestScope,
          scope: resolvedAccountScope,
          account,
        };
      } catch (_e) {
        const cachedAccount = resolvedAccountScope
          ? swapProAccountCache.get(resolvedAccountScope)
          : undefined;
        return {
          requestScope: accountRequestScope,
          scope: resolvedAccountScope,
          account: cachedAccount,
        };
      }
    },
    [
      accountId,
      accountIdentityScope,
      accountRequestScope,
      indexedAccountId,
      knownAccountDeriveType,
      shouldResolveAccount,
      targetNetworkId,
    ],
    {
      initResult: {
        requestScope: cachedNetAccount ? accountRequestScope : '',
        scope: cachedNetAccount ? knownAccountScope : '',
        account: cachedNetAccount,
      },
    },
  );
  const isResolvedAccountScopeCurrent =
    netAccountStateRes.result.requestScope === accountRequestScope ||
    Boolean(
      knownAccountScope &&
      netAccountStateRes.result.scope === knownAccountScope,
    );
  const resolvedAccountScope = isResolvedAccountScopeCurrent
    ? netAccountStateRes.result.scope
    : '';
  const accountScope = knownAccountScope || resolvedAccountScope;

  const accountStatus = resolveSwapProAccountStatus({
    hasConnectedAccount,
    accountScope,
    resolvedAccountScope,
    accountAddress: netAccountStateRes.result.account?.addressDetail.address,
  });
  const accountForCurrentScope = getSwapProAccountForCurrentScope({
    accountScope,
    resolvedAccountScope,
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
        reason: 'swapProNetworkSync',
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
  const { updateSwapProPositionTokenBalances } = useSwapActions().current;
  const syncTokensToPosition = useCallback(
    async (
      tokens: ISwapToken[],
      positionOwnerKey: string,
      positionAccountIdentity: {
        indexedAccountId?: string;
        accountId?: string;
      },
      currencyId: string,
    ) => {
      if (
        tokens.length === 0 ||
        !positionOwnerKey ||
        !currencyId ||
        (!positionAccountIdentity.indexedAccountId &&
          !positionAccountIdentity.accountId)
      ) {
        return;
      }
      const requests: Promise<ISwapToken | undefined>[] = tokens.map(
        async (token) => {
          const defaultDeriveType =
            await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork(
              {
                networkId: token.networkId ?? '',
              },
            );
          const res = await backgroundApiProxy.serviceAccount.getNetworkAccount(
            {
              accountId: positionAccountIdentity.indexedAccountId
                ? undefined
                : positionAccountIdentity.accountId,
              indexedAccountId: positionAccountIdentity.indexedAccountId ?? '',
              networkId: token.networkId ?? '',
              deriveType: defaultDeriveType ?? 'default',
            },
          );
          const balanceTokenInfo =
            await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
              networkId: token.networkId ?? '',
              contractAddress: token.contractAddress,
              accountAddress: res.addressDetail.address,
              accountId: res.id ?? '',
              currency: currencyId,
            });
          const tokenDetail = balanceTokenInfo?.[0];
          return tokenDetail
            ? {
                ...tokenDetail,
                isStock: token.isStock,
                stock: token.stock,
              }
            : undefined;
        },
      );
      const results = await Promise.all(requests);
      const validResults = results.filter((token): token is ISwapToken =>
        Boolean(token),
      );
      if (validResults.length > 0) {
        updateSwapProPositionTokenBalances({
          positionOwnerKey,
          tokens: validResults,
        });
      }
    },
    [updateSwapProPositionTokenBalances],
  );

  return {
    syncTokensToPosition,
  };
}

export function useSwapProTokenInfoSync() {
  const [balanceLoading] = useSwapProTokenBalanceLoadingAtom();
  const {
    beginSwapProTokenBalanceRequest,
    finishSwapProTokenBalanceRequest,
    invalidateSwapProTokenBalanceRequest,
    isSwapProTokenBalanceRequestLatest,
  } = useSwapActions().current;
  const [swapProSelectToken, setSwapProSelectToken] =
    useSwapProSelectTokenAtom();
  const [swapProDirection] = useSwapProDirectionAtom();
  const [swapProUseSelectBuyToken, setSwapProUseSelectBuyTokenAtom] =
    useSwapProUseSelectBuyTokenAtom();
  const [swapProSellToToken, setSwapProSellToToken] =
    useSwapProSellToTokenAtom();
  const netAccountRes = useSwapProAccount();
  const inputToken = useSwapProInputToken();
  const tokenInfoSyncIdentityRef = useRef({
    accountId: netAccountRes.result?.id,
    accountAddress: netAccountRes.result?.addressDetail.address,
    inputToken,
    swapProDirection,
    swapProSelectToken,
    swapProUseSelectBuyToken,
  });
  tokenInfoSyncIdentityRef.current = {
    accountId: netAccountRes.result?.id,
    accountAddress: netAccountRes.result?.addressDetail.address,
    inputToken,
    swapProDirection,
    swapProSelectToken,
    swapProUseSelectBuyToken,
  };
  const tokenInfoSyncRequestIdRef = useRef(0);
  const activeStoreRequestIdRef = useRef<number | undefined>(undefined);
  useEffect(
    () => () => {
      // Atom setters outlive this hook, so unmount must invalidate old responses.
      tokenInfoSyncRequestIdRef.current += 1;
      if (activeStoreRequestIdRef.current !== undefined) {
        invalidateSwapProTokenBalanceRequest(activeStoreRequestIdRef.current);
      }
    },
    [invalidateSwapProTokenBalanceRequest],
  );

  const syncInputTokenBalance = useCallback(async () => {
    const requestId = tokenInfoSyncRequestIdRef.current + 1;
    tokenInfoSyncRequestIdRef.current = requestId;
    const requestIdentity = tokenInfoSyncIdentityRef.current;
    if (
      !requestIdentity.inputToken?.networkId ||
      !requestIdentity.accountAddress ||
      !requestIdentity.accountId
    ) {
      if (activeStoreRequestIdRef.current !== undefined) {
        invalidateSwapProTokenBalanceRequest(activeStoreRequestIdRef.current);
        activeStoreRequestIdRef.current = undefined;
      }
      return;
    }
    const storeRequestId = beginSwapProTokenBalanceRequest();
    activeStoreRequestIdRef.current = storeRequestId;
    const requestedAccountId = requestIdentity.accountId;
    const requestedAccountAddress = requestIdentity.accountAddress;
    const requestedInputToken = requestIdentity.inputToken;
    const requestedDirection = requestIdentity.swapProDirection;
    const isRequestCurrent = (currentToken: ISwapToken | undefined) =>
      isSwapProTokenBalanceRequestLatest(storeRequestId) &&
      requestedDirection ===
        tokenInfoSyncIdentityRef.current.swapProDirection &&
      isSwapProTokenBalanceRequestCurrent({
        requestId,
        currentRequestId: tokenInfoSyncRequestIdRef.current,
        requestedAccountId,
        requestedAccountAddress,
        requestedToken: requestedInputToken,
        currentAccountId: tokenInfoSyncIdentityRef.current.accountId,
        currentAccountAddress: tokenInfoSyncIdentityRef.current.accountAddress,
        currentToken,
      });
    try {
      const balanceTokenInfo =
        await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
          networkId: requestedInputToken.networkId,
          contractAddress: requestedInputToken.contractAddress ?? '',
          accountAddress: requestedAccountAddress,
          accountId: requestedAccountId,
          currency: 'usd',
        });
      const balanceTokenDetail = balanceTokenInfo?.[0];
      const currentInputToken =
        requestedDirection === ESwapDirection.BUY
          ? tokenInfoSyncIdentityRef.current.swapProUseSelectBuyToken
          : tokenInfoSyncIdentityRef.current.swapProSelectToken;
      if (
        balanceTokenDetail &&
        isRequestCurrent(currentInputToken) &&
        equalTokenNoCaseSensitive({
          token1: requestedInputToken,
          token2: balanceTokenDetail,
        })
      ) {
        if (requestedDirection === ESwapDirection.BUY) {
          setSwapProUseSelectBuyTokenAtom((prev) =>
            prev && isRequestCurrent(prev)
              ? {
                  ...prev,
                  isNative: balanceTokenDetail.isNative ?? false,
                  balanceParsed: balanceTokenDetail.balanceParsed ?? '',
                  price: balanceTokenDetail.price ?? '',
                  fiatValue: balanceTokenDetail.fiatValue ?? '',
                  accountAddress: requestedAccountAddress,
                }
              : prev,
          );
        } else {
          setSwapProSelectToken((prev) =>
            prev && isRequestCurrent(prev)
              ? {
                  ...prev,
                  isNative: balanceTokenDetail.isNative ?? false,
                  balanceParsed: balanceTokenDetail.balanceParsed ?? '',
                  price: balanceTokenDetail.price ?? '',
                  fiatValue: balanceTokenDetail.fiatValue ?? '',
                  accountAddress: requestedAccountAddress,
                }
              : prev,
          );
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      finishSwapProTokenBalanceRequest(storeRequestId);
      if (activeStoreRequestIdRef.current === storeRequestId) {
        activeStoreRequestIdRef.current = undefined;
      }
    }
  }, [
    beginSwapProTokenBalanceRequest,
    finishSwapProTokenBalanceRequest,
    invalidateSwapProTokenBalanceRequest,
    isSwapProTokenBalanceRequestLatest,
    setSwapProSelectToken,
    setSwapProUseSelectBuyTokenAtom,
  ]);
  const syncOrderTokenBalance = useCallback(
    async (currency = 'usd') => {
      const requestId = tokenInfoSyncRequestIdRef.current + 1;
      tokenInfoSyncRequestIdRef.current = requestId;
      const requestIdentity = tokenInfoSyncIdentityRef.current;
      if (
        !requestIdentity.inputToken?.networkId ||
        !requestIdentity.accountAddress ||
        !requestIdentity.accountId
      ) {
        if (activeStoreRequestIdRef.current !== undefined) {
          invalidateSwapProTokenBalanceRequest(activeStoreRequestIdRef.current);
          activeStoreRequestIdRef.current = undefined;
        }
        return;
      }
      const storeRequestId = beginSwapProTokenBalanceRequest();
      activeStoreRequestIdRef.current = storeRequestId;
      const requestedAccountId = requestIdentity.accountId;
      const requestedAccountAddress = requestIdentity.accountAddress;
      const requestedSwapProSelectToken = requestIdentity.swapProSelectToken;
      const requestedSwapProUseSelectBuyToken =
        requestIdentity.swapProUseSelectBuyToken;
      const isRequestCurrent = ({
        requestedToken,
        currentToken,
      }: {
        requestedToken: ISwapToken | undefined;
        currentToken: ISwapToken | undefined;
      }) =>
        isSwapProTokenBalanceRequestLatest(storeRequestId) &&
        isSwapProTokenBalanceRequestCurrent({
          requestId,
          currentRequestId: tokenInfoSyncRequestIdRef.current,
          requestedAccountId,
          requestedAccountAddress,
          requestedToken,
          currentAccountId: tokenInfoSyncIdentityRef.current.accountId,
          currentAccountAddress:
            tokenInfoSyncIdentityRef.current.accountAddress,
          currentToken,
        });
      try {
        const [swapProSelectTokenDetail, swapProUseSelectBuyTokenDetail] =
          await Promise.all([
            backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
              networkId: requestedSwapProSelectToken?.networkId ?? '',
              contractAddress:
                requestedSwapProSelectToken?.contractAddress ?? '',
              accountAddress: requestedAccountAddress,
              accountId: requestedAccountId,
              currency,
            }),
            backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
              networkId: requestedSwapProUseSelectBuyToken?.networkId ?? '',
              contractAddress:
                requestedSwapProUseSelectBuyToken?.contractAddress ?? '',
              accountAddress: requestedAccountAddress,
              accountId: requestedAccountId,
              currency,
            }),
          ]);
        const currentSwapProSelectTokenDetail = isRequestCurrent({
          requestedToken: requestedSwapProSelectToken,
          currentToken: tokenInfoSyncIdentityRef.current.swapProSelectToken,
        })
          ? swapProSelectTokenDetail?.[0]
          : undefined;
        const currentSwapProUseSelectBuyTokenDetail = isRequestCurrent({
          requestedToken: requestedSwapProUseSelectBuyToken,
          currentToken:
            tokenInfoSyncIdentityRef.current.swapProUseSelectBuyToken,
        })
          ? swapProUseSelectBuyTokenDetail?.[0]
          : undefined;
        if (currentSwapProSelectTokenDetail) {
          setSwapProSelectToken((prev) =>
            prev &&
            isRequestCurrent({
              requestedToken: requestedSwapProSelectToken,
              currentToken: prev,
            })
              ? {
                  ...prev,
                  isNative: currentSwapProSelectTokenDetail.isNative ?? false,
                  balanceParsed:
                    currentSwapProSelectTokenDetail.balanceParsed ?? '',
                  price: currentSwapProSelectTokenDetail.price ?? '',
                  fiatValue: currentSwapProSelectTokenDetail.fiatValue ?? '',
                  accountAddress: requestedAccountAddress,
                }
              : prev,
          );
        }
        if (currentSwapProUseSelectBuyTokenDetail) {
          setSwapProUseSelectBuyTokenAtom((prev) =>
            prev &&
            isRequestCurrent({
              requestedToken: requestedSwapProUseSelectBuyToken,
              currentToken: prev,
            })
              ? {
                  ...prev,
                  isNative:
                    currentSwapProUseSelectBuyTokenDetail.isNative ?? false,
                  balanceParsed:
                    currentSwapProUseSelectBuyTokenDetail.balanceParsed ?? '',
                  price: currentSwapProUseSelectBuyTokenDetail.price ?? '',
                  fiatValue:
                    currentSwapProUseSelectBuyTokenDetail.fiatValue ?? '',
                  accountAddress: requestedAccountAddress,
                }
              : prev,
          );
        }
        if (
          !currentSwapProSelectTokenDetail &&
          !currentSwapProUseSelectBuyTokenDetail
        ) {
          return;
        }
        return {
          swapProSelectTokenDetail: currentSwapProSelectTokenDetail,
          swapProUseSelectBuyTokenDetail: currentSwapProUseSelectBuyTokenDetail,
        };
      } catch (e) {
        console.error(e);
      } finally {
        finishSwapProTokenBalanceRequest(storeRequestId);
        if (activeStoreRequestIdRef.current === storeRequestId) {
          activeStoreRequestIdRef.current = undefined;
        }
      }
    },
    [
      beginSwapProTokenBalanceRequest,
      finishSwapProTokenBalanceRequest,
      invalidateSwapProTokenBalanceRequest,
      isSwapProTokenBalanceRequestLatest,
      setSwapProSelectToken,
      setSwapProUseSelectBuyTokenAtom,
    ],
  );

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

export function isSwapProTradeStateOwner({
  isNative,
  swapTypeSwitch,
}: {
  isNative: boolean;
  swapTypeSwitch: ESwapTabSwitchType;
}) {
  return (
    swapTypeSwitch === ESwapTabSwitchType.STOCK ||
    (isNative && swapTypeSwitch === ESwapTabSwitchType.LIMIT)
  );
}

export function useSwapProTokenInit() {
  const { initializeSwapProSelectToken, resetQuoteAction } =
    useSwapActions().current;
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const [swapProTokenSupportLimit] = useSwapProTokenSupportLimitAtom();
  const [swapProJumpToken] = useSwapProJumpTokenAtom();
  const [swapProTradeType, setSwapProTradeType] = useSwapProTradeTypeAtom();
  const [swapProSellToToken, setSwapProSellToToken] =
    useSwapProSellToTokenAtom();
  const [swapProUseSelectBuyTokenAtom, setSwapProUseSelectBuyTokenAtom] =
    useSwapProUseSelectBuyTokenAtom();
  const [swapProInputAmount, setSwapProInputAmount] =
    useSwapProInputAmountAtom();
  const [swapFromInputAmount, setSwapFromInputAmount] =
    useSwapFromTokenAmountAtom();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const hasInitializedSwapProSelectTokenRef = useRef(false);
  const ownsActiveSwapProTradeState = isSwapProTradeStateOwner({
    isNative: Boolean(platformEnv.isNative),
    swapTypeSwitch,
  });
  const shouldSyncSwapProTokenInfo =
    swapTypeSwitch !== ESwapTabSwitchType.STOCK;

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

  const defaultTokensFromType = useMemo(
    () =>
      getSwapProDefaultTokens({
        tradeType: swapProTradeType,
        defaultTokens,
        defaultLimitTokens,
      }),
    [swapProTradeType, defaultTokens, defaultLimitTokens],
  );

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
    // Search within the stock-safe pool so a persisted preference can never
    // resurrect a token the counterparty rule excludes.
    return filterSwapProCounterpartyTokens({
      tokens: defaultTokensFromType,
      isStockPair: !!swapProSelectToken?.isStock,
    }).find(
      (t) =>
        t.networkId === savedPreference.networkId &&
        t.contractAddress.toLowerCase() ===
          savedPreference.contractAddress.toLowerCase(),
    );
  }, [savedPreference, defaultTokensFromType, swapProSelectToken?.isStock]);

  useEffect(() => {
    // Stock tokens must be paid with stable coins: drop the native coin from
    // the candidate pool so a previously selected native coin is forced back
    // to a stable coin.
    const candidateTokens = filterSwapProCounterpartyTokens({
      tokens: defaultTokensFromType,
      isStockPair: !!swapProSelectToken?.isStock,
    });
    // Fail closed: with no whitelist candidate a stock pair must never keep
    // trading against the previously selected counterparty. Drop the
    // selection, its amount and any in-flight quote — the action button
    // stays disabled until the config provides valid candidates.
    if (candidateTokens.length === 0) {
      if (swapProUseSelectBuyTokenAtom) {
        setSwapProUseSelectBuyTokenAtom(undefined);
        setSwapProInputAmount('');
        if (ownsActiveSwapProTradeState) {
          void resetQuoteAction();
        }
      }
      return;
    }
    if (
      (!swapProUseSelectBuyTokenAtom && candidateTokens.length > 0) ||
      !candidateTokens.some((item) =>
        equalTokenNoCaseSensitive({
          token1: item,
          token2: swapProUseSelectBuyTokenAtom,
        }),
      )
    ) {
      // Prefer persisted preference, fallback to first default token
      const preferred = findPreferredToken();
      let selectedDefaultToken =
        (preferred as (typeof defaultTokensFromType)[0]) ?? candidateTokens[0];
      if (
        equalTokenNoCaseSensitive({
          token1: selectedDefaultToken,
          token2: {
            contractAddress: swapProSelectToken?.contractAddress ?? '',
            networkId: swapProSelectToken?.networkId ?? '',
          },
        })
      ) {
        selectedDefaultToken = candidateTokens[1] ?? candidateTokens[0];
      }
      setSwapProUseSelectBuyTokenAtom(selectedDefaultToken);
    } else if (
      swapProUseSelectBuyTokenAtom &&
      candidateTokens.length > 0 &&
      equalTokenNoCaseSensitive({
        token1: swapProUseSelectBuyTokenAtom,
        token2: {
          contractAddress: swapProSelectToken?.contractAddress ?? '',
          networkId: swapProSelectToken?.networkId ?? '',
        },
      })
    ) {
      const noEqualToken = candidateTokens.find(
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
    swapProSelectToken?.isStock,
    swapProUseSelectBuyTokenAtom,
    setSwapProUseSelectBuyTokenAtom,
    setSwapProInputAmount,
    resetQuoteAction,
    ownsActiveSwapProTradeState,
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
    if (swapProJumpToken?.token) {
      hasInitializedSwapProSelectTokenRef.current = true;
      return;
    }
    if (
      hasInitializedSwapProSelectTokenRef.current ||
      (!swapProSelectToken && !speedDefaultSelectToken)
    ) {
      return;
    }
    hasInitializedSwapProSelectTokenRef.current = true;
    void initializeSwapProSelectToken(undefined, speedDefaultSelectToken);
  }, [
    initializeSwapProSelectToken,
    speedDefaultSelectToken,
    swapProJumpToken?.token,
    swapProSelectToken,
  ]);

  useEffect(() => {
    // Stock tokens must trade against stable coins in BOTH directions, so the
    // SELL counterparty pool drops the native coin too.
    const sellCandidateTokens = filterSwapProCounterpartyTokens({
      tokens: defaultTokensFromType,
      isStockPair: !!swapProSelectToken?.isStock,
    });
    // Same fail-closed rule as the BUY init above: clear the SELL
    // counterparty (and the sell amount, which denominates in the traded
    // token but must not quote against a stale receive token).
    if (sellCandidateTokens.length === 0) {
      if (swapProSellToToken) {
        setSwapProSellToToken(undefined);
        if (ownsActiveSwapProTradeState) {
          setSwapFromInputAmount({ value: '', isInput: true });
          void resetQuoteAction();
        }
      }
      return;
    }
    if (
      (!swapProSellToToken && sellCandidateTokens.length > 0) ||
      !sellCandidateTokens.some((item) =>
        equalTokenNoCaseSensitive({
          token1: item,
          token2: swapProSellToToken,
        }),
      )
    ) {
      // Prefer persisted preference for sell-to token
      const preferred = findPreferredToken();
      let selectedDefaultToken = sellCandidateTokens[0];
      const nativeToken = sellCandidateTokens.find((item) => item.isNative);
      const wrappedToken = sellCandidateTokens.find((item) =>
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
            const noWrappedToken = sellCandidateTokens.find(
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
        const defaultTokenZero = sellCandidateTokens[0];
        if (
          equalTokenNoCaseSensitive({
            token1: defaultTokenZero,
            token2: {
              contractAddress: swapProSelectToken?.contractAddress ?? '',
              networkId: swapProSelectToken?.networkId ?? '',
            },
          })
        ) {
          selectedDefaultToken = sellCandidateTokens[1] ?? defaultTokenZero;
        }
      }
      setSwapProSellToToken(selectedDefaultToken);
    } else if (
      swapProSellToToken &&
      sellCandidateTokens.length > 0 &&
      equalTokenNoCaseSensitive({
        token1: swapProSellToToken,
        token2: {
          contractAddress: swapProSelectToken?.contractAddress ?? '',
          networkId: swapProSelectToken?.networkId ?? '',
        },
      })
    ) {
      const noEqualToken = sellCandidateTokens.find(
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
    setSwapFromInputAmount,
    resetQuoteAction,
    ownsActiveSwapProTradeState,
    swapProSelectToken?.networkId,
    swapProSelectToken?.contractAddress,
    swapProSelectToken?.isStock,
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
    if (!shouldSyncSwapProTokenInfo) {
      return;
    }
    if (
      (inputToken && !inputToken.balanceParsed) ||
      (inputToken as ISwapToken)?.accountAddress !==
        netAccountRes.result?.addressDetail.address
    ) {
      void syncInputTokenBalance();
    }
  }, [
    inputToken,
    shouldSyncSwapProTokenInfo,
    syncInputTokenBalance,
    netAccountRes.result?.addressDetail.address,
  ]);

  useEffect(() => {
    if (!shouldSyncSwapProTokenInfo) {
      return;
    }
    if (swapProSellToToken && !swapProSellToToken.price) {
      void syncToTokenPrice();
    }
  }, [shouldSyncSwapProTokenInfo, swapProSellToToken, syncToTokenPrice]);

  useEffect(() => {
    if (!shouldSyncSwapProTokenInfo) {
      return;
    }
    if (swapProSelectToken && isNil(swapProSelectToken?.isNative)) {
      void syncSelectTokenNative();
    }
  }, [shouldSyncSwapProTokenInfo, swapProSelectToken, syncSelectTokenNative]);

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
  const locale = useLocaleVariant();
  const searchScope = `${locale}|${input.trim().toLowerCase()}|${
    selectedNetworkId ?? ''
  }`;
  const cachedSearchTokenList = input
    ? swapProSearchTokenCache.get(searchScope)
    : undefined;
  const [searchLoadingScope, setSearchLoadingScope] = useState('');
  const [searchTokenState, setSearchTokenState] = useState<{
    items: ISwapProSearchTokenListItem[];
    scope: string;
  }>(() => ({
    items: cachedSearchTokenList ?? EMPTY_SWAP_PRO_SEARCH_TOKEN_LIST,
    scope: cachedSearchTokenList !== undefined ? searchScope : '',
  }));
  const searchTokenList =
    searchTokenState.scope === searchScope
      ? searchTokenState.items
      : (cachedSearchTokenList ?? EMPTY_SWAP_PRO_SEARCH_TOKEN_LIST);
  const searchLoading = Boolean(
    input &&
    searchTokenList.length === 0 &&
    cachedSearchTokenList === undefined &&
    (searchTokenState.scope !== searchScope ||
      searchLoadingScope === searchScope),
  );
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
        setSearchTokenState({ items: [], scope: '' });
        setSearchLoadingScope('');
        return;
      }
      if (swapProSearchTokenCache.get(searchScope) === undefined) {
        setSearchLoadingScope(searchScope);
      }
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
        swapProSearchTokenCache.set(searchScope, finalList);
        setSearchTokenState({ items: finalList, scope: searchScope });

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
          if (swapProSearchTokenCache.get(searchScope) === undefined) {
            setSearchTokenState({ items: [], scope: searchScope });
          }
        }
      } finally {
        if (!isCancelled) {
          setSearchLoadingScope((currentScope) =>
            currentScope === searchScope ? '' : currentScope,
          );
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
    searchScope,
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

        setSearchTokenState((prev) => {
          if (prev.scope !== searchScope) {
            return prev;
          }
          const items = mergeBatchQuotes(prev.items, list ?? []);
          swapProSearchTokenCache.set(searchScope, items);
          return { items, scope: searchScope };
        });
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
  }, [mergeBatchQuotes, searchScope, searchTokenListKey]);

  return {
    searchLoading,
    searchTokenList,
  };
}

export function useSwapProTokenDetailInfo() {
  const {
    swapProTokenMarketDetailFetchAction,
    updateSwapProSelectTokenMetadata,
  } = useSwapActions().current;
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const [proTokenDetail] = useSwapProTokenMarketDetailInfoAtom();
  // Tokens persisted before the isStock field existed restore without it and
  // would bypass the stock stable-coin rules; once the authoritative market
  // detail for the selected token arrives, backfill the flag and re-persist
  // so the migration sticks.
  useEffect(() => {
    const backfilled = backfillSwapProTokenStockIdentity({
      token: swapProSelectToken,
      tokenDetail: proTokenDetail,
    });
    if (backfilled && backfilled !== swapProSelectToken) {
      void updateSwapProSelectTokenMetadata(backfilled);
    }
  }, [proTokenDetail, swapProSelectToken, updateSwapProSelectTokenMetadata]);
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

function useSwapProPositionAccountIdentity() {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { selectedAccount } = useSelectedAccount({ num: 0 });
  const [isAccountSelectorStorageInitDone] =
    useAccountSelectorStorageInitDoneAtom();

  return useMemo(
    () =>
      resolveSwapProAccountIdentity({
        isAccountSelectorStorageInitDone,
        selectedNetworkId: selectedAccount.networkId,
        selectedWalletId: selectedAccount.walletId,
        selectedFocusedWallet: selectedAccount.focusedWallet,
        selectedIndexedAccountId: selectedAccount.indexedAccountId,
        selectedAccountId: selectedAccount.othersWalletAccountId,
        activeIndexedAccountId: activeAccount?.indexedAccount?.id,
        activeAccountId:
          activeAccount?.account?.id ?? activeAccount?.dbAccount?.id,
      }),
    [
      activeAccount?.account?.id,
      activeAccount?.dbAccount?.id,
      activeAccount?.indexedAccount?.id,
      isAccountSelectorStorageInitDone,
      selectedAccount.focusedWallet,
      selectedAccount.indexedAccountId,
      selectedAccount.networkId,
      selectedAccount.othersWalletAccountId,
      selectedAccount.walletId,
    ],
  );
}

export function useSwapPositionsSupportTokenListAction() {
  const { swapProLoadSupportNetworksTokenList } = useSwapActions().current;
  const positionAccountIdentity = useSwapProPositionAccountIdentity();
  const currencyInfo = useCurrency();
  const positionCurrencyId = currencyInfo.id.toLowerCase();
  const swapProLoadSupportNetworksTokenListRun = useCallback(
    async (
      networkList: (IMarketBasicConfigNetwork | ISwapNetwork)[],
      options?: {
        forceRefresh?: boolean;
        stockOnly?: boolean;
        additionalNetworkScopes?: {
          networkList: (IMarketBasicConfigNetwork | ISwapNetwork)[];
          stockOnly?: boolean;
        }[];
      },
    ) => {
      await swapProLoadSupportNetworksTokenList(
        networkList.map((item) => ({
          networkId: item.networkId,
          symbol: item.name,
          name: item.name,
        })),
        positionAccountIdentity.indexedAccountId,
        positionAccountIdentity.accountId,
        positionCurrencyId,
        {
          forceRefresh: options?.forceRefresh,
          positionLoader: loadSwapProPositions,
          stockOnly: options?.stockOnly,
          additionalSupportNetworkScopes: options?.additionalNetworkScopes?.map(
            (scope) => ({
              stockOnly: scope.stockOnly,
              supportNetworks: scope.networkList.map((item) => ({
                networkId: item.networkId,
                symbol: item.name,
                name: item.name,
              })),
            }),
          ),
        },
      );
    },
    [
      positionCurrencyId,
      positionAccountIdentity,
      swapProLoadSupportNetworksTokenList,
    ],
  );
  return {
    swapProLoadSupportNetworksTokenListRun,
  };
}

export function useSwapProSupportNetworksTokenList(
  networkList: (IMarketBasicConfigNetwork | ISwapNetwork)[],
  supportNetworksReady: boolean,
  options?: {
    stockOnly?: boolean;
  },
) {
  const positionAccountIdentity = useSwapProPositionAccountIdentity();
  const currencyInfo = useCurrency();
  const positionCurrencyId = currencyInfo.id.toLowerCase();
  const [swapSelectToken] = useSwapProSelectTokenAtom();
  const [swapProUseSelectBuyToken] = useSwapProUseSelectBuyTokenAtom();
  const { syncOrderTokenBalance } = useSwapProTokenInfoSync();
  const [swapProPositionsRuntimeData] = useSwapProPositionsRuntimeDataAtom();
  const { updateSwapProPositionTokenBalances } = useSwapActions().current;
  const { syncTokensToPosition } = useSwapTokenPairBalanceSyncForPosition();
  const positionAccountId =
    positionAccountIdentity.indexedAccountId ??
    positionAccountIdentity.accountId;
  const positionNetworkIdsKey = useMemo(() => {
    if (!supportNetworksReady) {
      return '';
    }
    return buildSwapProPositionsNetworkIdsKey(
      networkList.map((item) => item.networkId),
    );
  }, [networkList, supportNetworksReady]);
  const positionOwnerKey = useMemo(
    () =>
      buildSwapProPositionsOwnerKey({
        accountId: positionAccountId,
        networkIdsKey: positionNetworkIdsKey,
        currencyId: positionCurrencyId,
        stockOnly: options?.stockOnly,
      }),
    [
      options?.stockOnly,
      positionAccountId,
      positionCurrencyId,
      positionNetworkIdsKey,
    ],
  );
  const positionRuntimeEntry = positionOwnerKey
    ? swapProPositionsRuntimeData[positionOwnerKey]
    : undefined;
  const hasPositionOwner =
    Boolean(positionOwnerKey) ||
    (!supportNetworksReady && Boolean(positionAccountId));
  const swapProSelectTokenRef = useRef(swapSelectToken);
  if (swapProSelectTokenRef.current !== swapSelectToken) {
    swapProSelectTokenRef.current = swapSelectToken;
  }
  const swapProUseSelectBuyTokenRef = useRef(swapProUseSelectBuyToken);
  if (swapProUseSelectBuyTokenRef.current !== swapProUseSelectBuyToken) {
    swapProUseSelectBuyTokenRef.current = swapProUseSelectBuyToken;
  }
  const { swapProLoadSupportNetworksTokenListRun } =
    useSwapPositionsSupportTokenListAction();
  useEffect(() => {
    if (!platformEnv.isNative && supportNetworksReady) {
      void swapProLoadSupportNetworksTokenListRun(networkList, {
        stockOnly: options?.stockOnly,
      });
    }
  }, [
    networkList,
    options?.stockOnly,
    supportNetworksReady,
    swapProLoadSupportNetworksTokenListRun,
  ]);

  const checkSyncOrderTokenBalance = useCallback(
    async ({
      orderFromToken,
      orderToToken,
    }: {
      orderFromToken: ISwapTokenBase;
      orderToToken: ISwapTokenBase;
    }) => {
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
        const balanceTokensInfoRes =
          await syncOrderTokenBalance(positionCurrencyId);
        if (balanceTokensInfoRes) {
          const newSwapProSelectTokenDetail =
            balanceTokensInfoRes.swapProSelectTokenDetail;
          const newSwapProUseSelectBuyTokenDetail =
            balanceTokensInfoRes.swapProUseSelectBuyTokenDetail;

          // Update swapProSupportNetworksTokenList with the new token details
          const tokensToUpdate = [
            newSwapProSelectTokenDetail,
            newSwapProUseSelectBuyTokenDetail,
          ].filter(Boolean);

          if (tokensToUpdate.length > 0 && positionOwnerKey) {
            updateSwapProPositionTokenBalances({
              positionOwnerKey,
              tokens: tokensToUpdate.filter((token): token is ISwapToken =>
                Boolean(token),
              ),
            });
          }
        }
      } else {
        void syncTokensToPosition(
          [orderFromToken, orderToToken],
          positionOwnerKey,
          positionAccountIdentity,
          positionCurrencyId,
        );
      }
    },
    [
      syncOrderTokenBalance,
      syncTokensToPosition,
      positionOwnerKey,
      positionAccountIdentity,
      positionCurrencyId,
      updateSwapProPositionTokenBalances,
    ],
  );

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
    positionLoadError: positionRuntimeEntry?.status === 'error',
    positionLoading:
      hasPositionOwner &&
      (!positionRuntimeEntry || positionRuntimeEntry.status === 'loading'),
    positionTokenList: positionRuntimeEntry?.tokens ?? [],
    swapProLoadSupportNetworksTokenListRun,
  };
}

export function useSwapProPositionsListFilter(
  filterToken?: ISwapToken[],
  sourceTokenList: ISwapToken[] = [],
  isStockPositions?: boolean,
) {
  const filterMinValueTokenList = useMemo(() => {
    // Stock positions use a lower $0.1 floor (vs $1) and skip the max-count cap,
    // so small stock holdings still show and aren't pushed out of the top N.
    const minValue = isStockPositions
      ? swapProStockPositionsListMinValue
      : swapProPositionsListMinValue;
    return sourceTokenList.filter((token) => {
      return new BigNumber(token.fiatValue || '0').gt(minValue);
    });
  }, [sourceTokenList, isStockPositions]);

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
  const swapProFromToken = useSwapProInputToken();
  const swapProToToken = useSwapProToToken();
  const [fromSelectTokenAtom] = useSwapSelectFromTokenAtom();
  const [toSelectTokenAtom] = useSwapSelectToTokenAtom();
  const [currentQuote] = useSwapQuoteCurrentSelectAtom();
  const focusSwapPro = useMemo(() => {
    return platformEnv.isNative && swapTypeSwitch === ESwapTabSwitchType.LIMIT;
  }, [swapTypeSwitch]);
  const currentQuoteRes = currentQuote;
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
  const { quoteSpeedAction, resetQuoteAction } = useSwapActions().current;
  const [swapTabSwitchType] = useSwapTypeSwitchAtom();
  const [swapTradeType] = useSwapProTradeTypeAtom();
  const [swapProInputAmount, setSwapProInputAmount] =
    useSwapProInputAmountAtom();
  const debounceInputAmount = useDebounce(
    swapProInputAmount,
    SWAP_PRO_QUOTE_INPUT_DEBOUNCE_MS,
    {
      leading: true,
    },
  );
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const [swapProDirection] = useSwapProDirectionAtom();
  const [swapProUseSelectBuyTokenAtom] = useSwapProUseSelectBuyTokenAtom();
  const [swapProSellToTokenAtom] = useSwapProSellToTokenAtom();
  const [proTokenDetail] = useSwapProTokenMarketDetailInfoAtom();
  // Live per-stock open state from the 10s-polled Pro token detail, used
  // ONLY as a quote re-run trigger below: a market reopen must re-request
  // the quote so a latched closed-market error clears without an input edit
  // (OK-58986). Guarded to the selected token as a defensive ownership check
  // so a stale response can never refresh the next token's quote.
  const selectedStockIsOpen = useMemo(() => {
    if (!proTokenDetail || !swapProSelectToken) {
      return undefined;
    }
    const detailMatchesSelectedToken = equalTokenNoCaseSensitive({
      token1: {
        networkId: proTokenDetail.networkId,
        contractAddress: proTokenDetail.address,
      },
      token2: swapProSelectToken,
    });
    return detailMatchesSelectedToken
      ? proTokenDetail.stock?.isOpen
      : undefined;
  }, [proTokenDetail, swapProSelectToken]);
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
    // Read only as a re-run trigger: an open-state flip re-requests the
    // quote so stale closed-market state refreshes (OK-58986).
    void selectedStockIsOpen;
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
    selectedStockIsOpen,
  ]);

  useEffect(() => {
    const debounceInputAmountBN = new BigNumber(debounceInputAmount || '0');
    if (debounceInputAmountBN.isNaN() || debounceInputAmountBN.lte(0)) {
      void resetQuoteAction();
    }
  }, [debounceInputAmount, resetQuoteAction]);

  useEffect(() => {
    if (
      !enableSwapProMarketQuote ||
      !swapProAccount.result?.addressDetail.address
    ) {
      setSwapProInputAmount('');
    }
  }, [
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
  isAccountContextReady,
  accountScope,
  accountStatus,
}: {
  isSwapProActive: boolean;
  isAccountContextReady: boolean;
  accountScope: string;
  accountStatus: ESwapProAccountStatus;
}) {
  const intl = useIntl();
  const [, setSwapProErrorAlert] = useSwapProErrorAlertAtom();
  const [swapCurrentQuote] = useSwapQuoteCurrentSelectAtom();
  const currentQuoteRes = swapCurrentQuote;
  const previousAccountScopeRef = useRef('');
  useEffect(() => {
    if (!isAccountContextReady) {
      previousAccountScopeRef.current = '';
      setSwapProErrorAlert(undefined);
      return;
    }
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
    isAccountContextReady,
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
  const [, setFromInputAmount] = useSwapFromTokenAmountAtom();
  const [, setToInputAmount] = useSwapToTokenAmountAtom();
  const swapProtoToToken = useSwapProToToken();
  const [swapQuoteCurrentSelect] = useSwapQuoteCurrentSelectAtom();
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
    if (
      swapTypeSwitchValue !== ESwapTabSwitchType.LIMIT ||
      checkWrappedTokenPair({
        fromToken,
        toToken,
      })
    ) {
      let toAmount = '';
      if (
        equalTokenNoCaseSensitive({
          token1: fromToken,
          token2: swapQuoteCurrentSelect?.fromTokenInfo,
        }) &&
        equalTokenNoCaseSensitive({
          token1: toToken,
          token2: swapQuoteCurrentSelect?.toTokenInfo,
        })
      ) {
        toAmount = swapQuoteCurrentSelect?.toAmount ?? '';
      }
      if (
        checkWrappedTokenPair({
          fromToken,
          toToken,
        })
      ) {
        toAmount = swapQuoteCurrentSelect?.isWrapped
          ? (swapQuoteCurrentSelect?.toAmount ?? '')
          : '';
      }
      setToInputAmount({
        value: toAmount,
        isInput: false,
      });
    }
  }, [
    swapQuoteCurrentSelect?.toAmount,
    swapQuoteCurrentSelect?.fromTokenInfo,
    swapQuoteCurrentSelect?.toTokenInfo,
    swapQuoteCurrentSelect?.isWrapped,
    setToInputAmount,
    setFromInputAmount,
    swapTypeSwitchValue,
    fromToken,
    toToken,
  ]);
}
