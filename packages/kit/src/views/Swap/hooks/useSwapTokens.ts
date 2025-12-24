import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { debounce } from 'lodash';

import { useIsOverlayPage } from '@onekeyhq/components';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IFuseResult } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import { useFuse } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  ESwapCrossChainStatus,
  ESwapTabSwitchType,
  ESwapTxHistoryStatus,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import {
  useSwapActions,
  useSwapAllNetworkTokenListMapAtom,
  useSwapNetworksAtom,
  useSwapNetworksIncludeAllNetworkAtom,
  useSwapSelectTokenNetworkAtom,
  useSwapTokenFetchingAtom,
  useSwapTokenMapAtom,
} from '../../../states/jotai/contexts/swap';

import { useSwapAddressInfo } from './useSwapAccount';

export function useSwapTokenList(
  selectTokenModalType: ESwapDirectionType,
  currentNetworkId?: string,
  keywords?: string,
  from?: ESwapTabSwitchType,
) {
  const [currentTokens, setCurrentTokens] = useState<
    (ISwapToken | IFuseResult<ISwapToken>)[]
  >([]);
  const [{ tokenCatch }] = useSwapTokenMapAtom();
  const [swapAllNetworkTokenListMap] = useSwapAllNetworkTokenListMapAtom();
  const swapSupportAllAccountsRef = useRef<IAllNetworkAccountInfo[]>([]);
  const [swapNetworks] = useSwapNetworksAtom();
  const [swapSupportAllNetworks] = useSwapNetworksIncludeAllNetworkAtom();
  const { tokenListFetchAction, swapLoadAllNetworkTokenList } =
    useSwapActions().current;
  const swapAddressInfo = useSwapAddressInfo(selectTokenModalType);
  const [swapTokenFetching] = useSwapTokenFetchingAtom();
  const [currentSelectNetwork] = useSwapSelectTokenNetworkAtom();
  const searchLogStateRef = useRef<{
    key: string;
    phase: 'idle' | 'fetching' | 'done';
  } | null>(null);

  useEffect(() => {
    void (async () => {
      const { swapSupportAccounts } =
        await backgroundApiProxy.serviceSwap.getSupportSwapAllAccounts({
          indexedAccountId: swapAddressInfo?.accountInfo?.indexedAccount?.id,
          otherWalletTypeAccountId: !swapAddressInfo?.accountInfo
            ?.indexedAccount?.id
            ? swapAddressInfo?.accountInfo?.account?.id ??
              swapAddressInfo?.accountInfo?.dbAccount?.id
            : undefined,
          swapSupportNetworks: swapNetworks,
        });
      swapSupportAllAccountsRef.current = swapSupportAccounts;
    })();
  }, [
    swapAddressInfo?.accountInfo?.account?.id,
    swapAddressInfo?.accountInfo?.dbAccount?.id,
    swapAddressInfo?.accountInfo?.indexedAccount?.id,
    swapNetworks,
  ]);

  const tokenFetchParams = useMemo(() => {
    const findNetInfo = swapSupportAllAccountsRef.current.find(
      (net) =>
        net.networkId === currentNetworkId ||
        net.networkId === currentSelectNetwork?.networkId,
    );
    if (
      swapAddressInfo.networkId === currentNetworkId ||
      swapAddressInfo.networkId === currentSelectNetwork?.networkId
    ) {
      return {
        networkId: currentSelectNetwork?.networkId ?? currentNetworkId,
        keywords,
        accountAddress: swapAddressInfo?.address,
        accountNetworkId: swapAddressInfo?.networkId,
        accountId: swapAddressInfo?.accountInfo?.account?.id,
      };
    }
    return {
      networkId: currentSelectNetwork?.networkId ?? currentNetworkId,
      keywords,
      accountAddress: findNetInfo?.apiAddress,
      accountNetworkId: findNetInfo?.networkId,
      accountId: findNetInfo?.accountId,
    };
  }, [
    currentNetworkId,
    swapAddressInfo.networkId,
    swapAddressInfo?.address,
    swapAddressInfo?.accountInfo?.account?.id,
    keywords,
    currentSelectNetwork?.networkId,
  ]);

  const swapAllNetworkTokenList = useMemo(
    () =>
      swapAllNetworkTokenListMap[
        swapAddressInfo?.accountInfo?.indexedAccount?.id ??
          swapAddressInfo?.accountInfo?.account?.id ??
          swapAddressInfo?.accountInfo?.dbAccount?.id ??
          'noAccountId'
      ],
    [
      swapAllNetworkTokenListMap,
      swapAddressInfo?.accountInfo?.indexedAccount?.id,
      swapAddressInfo?.accountInfo?.account?.id,
      swapAddressInfo?.accountInfo?.dbAccount?.id,
    ],
  );
  const sortAllNetworkTokens = useCallback((tokens: ISwapToken[]) => {
    const havePriceTokens = tokens
      .filter((token) => {
        const priceBN = new BigNumber(token.price ?? '0');
        return !priceBN.isNaN() && !priceBN.isZero();
      })
      ?.sort((a, b) => {
        const aBalanceBN = new BigNumber(a.fiatValue ?? '0');
        const bBalanceBN = new BigNumber(b.fiatValue ?? '0');
        return bBalanceBN.comparedTo(aBalanceBN);
      });
    const noPriceTokens = tokens
      .filter((token) => {
        const priceBN = new BigNumber(token.price ?? '0');
        return priceBN.isNaN() || priceBN.isZero();
      })
      ?.sort((a, b) => {
        const aBalanceBN = new BigNumber(a.fiatValue ?? '0');
        const bBalanceBN = new BigNumber(b.fiatValue ?? '0');
        return bBalanceBN.comparedTo(aBalanceBN);
      });
    return [...havePriceTokens, ...noPriceTokens];
  }, []);

  const mergedAllNetworkTokenList = useCallback(
    ({
      swapAllNetRecommend,
      swapSearchTokens,
    }: {
      swapAllNetRecommend?: ISwapToken[];
      swapSearchTokens?: ISwapToken[];
    }) => {
      if (swapAllNetRecommend?.length && !swapAllNetworkTokenList) {
        return [];
      }
      const allNetworkTokenList =
        swapAllNetworkTokenList
          ?.map((token) => {
            const swapNet = swapNetworks.find(
              (net) => net.networkId === token.networkId,
            );
            if (swapNet) {
              return { ...token, networkLogoURI: swapNet.logoURI };
            }
            return token;
          })
          ?.filter((token) =>
            swapSupportAllNetworks.find(
              (net) => net.networkId === token.networkId,
            ),
          ) ?? [];
      const haveBalanceTokenList =
        allNetworkTokenList?.filter((token) => {
          const balanceBN = new BigNumber(token?.balanceParsed ?? '0');
          if (!balanceBN.isNaN() && !balanceBN.isZero()) {
            return true;
          }
          return false;
        }) ?? [];
      if (swapAllNetRecommend) {
        const filterRecommendTokenList =
          swapAllNetRecommend
            ?.filter(
              (token) =>
                !haveBalanceTokenList?.find((balanceToken) =>
                  equalTokenNoCaseSensitive({
                    token1: {
                      networkId: balanceToken?.networkId,
                      contractAddress: balanceToken?.contractAddress,
                    },
                    token2: {
                      networkId: token?.networkId,
                      contractAddress: token?.contractAddress,
                    },
                  }),
                ),
            )
            ?.filter((token) =>
              swapSupportAllNetworks.find(
                (net) => net.networkId === token.networkId,
              ),
            ) ?? [];
        const allNetTokens = [
          ...haveBalanceTokenList,
          ...filterRecommendTokenList,
        ];
        return sortAllNetworkTokens(allNetTokens ?? []);
      }
      if (swapSearchTokens) {
        const allNetSearchTokens = swapSearchTokens
          .map((token) => {
            if (
              !swapSupportAllNetworks.find(
                (net) => net.networkId === token.networkId,
              )
            ) {
              return undefined;
            }
            const balanceToken = haveBalanceTokenList.find(
              (walletToken) =>
                walletToken?.contractAddress === token?.contractAddress &&
                walletToken?.networkId === token?.networkId,
            );
            if (balanceToken) {
              return balanceToken;
            }

            return token;
          })
          .filter((token) => token) as ISwapToken[];
        return sortAllNetworkTokens(allNetSearchTokens ?? []);
      }
      return [];
    },
    [
      sortAllNetworkTokens,
      swapAllNetworkTokenList,
      swapNetworks,
      swapSupportAllNetworks,
    ],
  );

  const fuseRemoteTokensSearch = useFuse(
    networkUtils.isAllNetwork({ networkId: tokenFetchParams.networkId }) &&
      keywords
      ? mergedAllNetworkTokenList({
          swapSearchTokens:
            tokenCatch?.[JSON.stringify(tokenFetchParams)]?.data || [],
        })
      : tokenCatch?.[JSON.stringify(tokenFetchParams)]?.data || [],
    {
      shouldSort: false,
      keys: ['symbol', 'contractAddress'],
    },
  );

  const fuseRemoteTokensSearchRef = useRef(fuseRemoteTokensSearch);
  if (fuseRemoteTokensSearchRef.current !== fuseRemoteTokensSearch) {
    fuseRemoteTokensSearchRef.current = fuseRemoteTokensSearch;
  }

  useEffect(() => {
    if (
      tokenFetchParams.networkId &&
      !keywords &&
      networkUtils.isAllNetwork({ networkId: tokenFetchParams.networkId })
    ) {
      void swapLoadAllNetworkTokenList(
        swapAddressInfo?.accountInfo?.indexedAccount?.id,
        !swapAddressInfo?.accountInfo?.indexedAccount?.id
          ? swapAddressInfo?.accountInfo?.account?.id ??
              swapAddressInfo?.accountInfo?.dbAccount?.id
          : undefined,
      );
    }
    void tokenListFetchAction(tokenFetchParams);
  }, [
    swapAddressInfo?.accountInfo?.account?.id,
    swapAddressInfo?.accountInfo?.dbAccount?.id,
    swapAddressInfo?.accountInfo?.indexedAccount?.id,
    swapLoadAllNetworkTokenList,
    tokenFetchParams,
    tokenListFetchAction,
    keywords,
  ]);

  useEffect(() => {
    if (!keywords) {
      searchLogStateRef.current = null;
      return;
    }
    const queryLength = keywords.length;
    if (queryLength < 1) {
      searchLogStateRef.current = null;
      return;
    }

    const networkId = currentSelectNetwork?.networkId ?? '';
    const key = `${keywords}__${networkId}__${selectTokenModalType}`;

    if (!searchLogStateRef.current || searchLogStateRef.current.key !== key) {
      searchLogStateRef.current = { key, phase: 'idle' };
    }

    const state = searchLogStateRef.current;
    if (!state) {
      return;
    }

    if (swapTokenFetching) {
      if (state.phase !== 'fetching') {
        searchLogStateRef.current = { key, phase: 'fetching' };
      }
      return;
    }

    if (state.phase === 'fetching') {
      const resultCount =
        fuseRemoteTokensSearchRef.current?.search(keywords)?.length ?? 0;

      defaultLogger.swap.tokenSelectorSearch.swapTokenSelectorSearch({
        query: keywords,
        resultCount,
        networkId,
        networkName: currentSelectNetwork?.isAllNetworks
          ? 'All Networks'
          : currentSelectNetwork?.name ?? '',
        direction: selectTokenModalType,
        from,
      });

      searchLogStateRef.current = { key, phase: 'done' };
    }
  }, [
    keywords,
    currentSelectNetwork?.networkId,
    currentSelectNetwork?.name,
    currentSelectNetwork?.isAllNetworks,
    from,
    selectTokenModalType,
    swapTokenFetching,
  ]);

  useEffect(() => {
    if (keywords && fuseRemoteTokensSearchRef.current) {
      setCurrentTokens(fuseRemoteTokensSearchRef.current.search(keywords));
    } else {
      setCurrentTokens(
        networkUtils.isAllNetwork({ networkId: tokenFetchParams.networkId })
          ? mergedAllNetworkTokenList({
              swapAllNetRecommend:
                tokenCatch?.[JSON.stringify(tokenFetchParams)]?.data || [],
            })
          : tokenCatch?.[JSON.stringify(tokenFetchParams)]?.data || [],
      );
    }
  }, [
    tokenCatch,
    tokenFetchParams,
    currentNetworkId,
    keywords,
    mergedAllNetworkTokenList,
  ]);

  return {
    fetchLoading:
      (swapTokenFetching && currentTokens.length === 0) ||
      (networkUtils.isAllNetwork({ networkId: tokenFetchParams.networkId }) &&
        !swapAllNetworkTokenList),
    currentTokens,
  };
}

/**
 * Manages and updates detailed information for a selected swap token, including balance and status, in response to swap transaction events and focus changes.
 *
 * Triggers token detail reloads when relevant swap transaction history updates occur, and manages event listeners based on modal and tab focus state.
 *
 * @param token - The swap token to manage details for
 * @param type - The swap direction type (`FROM` or `TO`)
 */
export function useSwapSelectedTokenInfo({
  token,
  type,
}: {
  type: ESwapDirectionType;
  token?: ISwapToken;
}) {
  const swapAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM); // always fetch from account balance
  const swapAddressInfoTo = useSwapAddressInfo(ESwapDirectionType.TO);
  const [{ swapHistoryPendingList }] = useInAppNotificationAtom();
  const { loadSwapSelectTokenDetail } = useSwapActions().current;
  const swapHistoryPendingListRef = useRef(swapHistoryPendingList);
  if (swapHistoryPendingListRef.current !== swapHistoryPendingList) {
    swapHistoryPendingListRef.current = swapHistoryPendingList;
  }
  const swapAddressInfoRef =
    useRef<ReturnType<typeof useSwapAddressInfo>>(swapAddressInfo);
  if (swapAddressInfoRef.current !== swapAddressInfo) {
    swapAddressInfoRef.current = swapAddressInfo;
  }
  const isFocused = useIsFocused();
  const isFocusRef = useRef(isFocused);
  if (isFocusRef.current !== isFocused) {
    isFocusRef.current = isFocused;
  }
  const tokenInfoRef = useRef<ISwapToken | undefined>(token);
  if (tokenInfoRef.current !== token) {
    tokenInfoRef.current = token;
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loadSwapSelectTokenDetailDeb = useCallback(
    debounce((direction, addressInfo, fetchBalance) => {
      void loadSwapSelectTokenDetail(direction, addressInfo, fetchBalance);
    }, 300),
    [],
  );

  const reloadSwapSelectTokenDetail = useCallback(
    ({
      fromToken,
      toToken,
    }: {
      status: ESwapTxHistoryStatus;
      crossChainStatus?: ESwapCrossChainStatus;
      fromToken?: ISwapToken;
      toToken?: ISwapToken;
    }) => {
      if (
        (type === ESwapDirectionType.FROM &&
          equalTokenNoCaseSensitive({
            token1: {
              networkId: fromToken?.networkId,
              contractAddress: fromToken?.contractAddress,
            },
            token2: {
              networkId: tokenInfoRef.current?.networkId,
              contractAddress: tokenInfoRef.current?.contractAddress,
            },
          })) ||
        (type === ESwapDirectionType.TO &&
          equalTokenNoCaseSensitive({
            token1: {
              networkId: toToken?.networkId,
              contractAddress: toToken?.contractAddress,
            },
            token2: {
              networkId: tokenInfoRef.current?.networkId,
              contractAddress: tokenInfoRef.current?.contractAddress,
            },
          }))
      ) {
        void loadSwapSelectTokenDetailDeb(
          type,
          swapAddressInfoRef.current,
          true,
        );
      }
    },
    [type, loadSwapSelectTokenDetailDeb],
  );
  const isModalPage = useIsOverlayPage();
  useEffect(() => {
    if (isFocused && isModalPage) {
      appEventBus.off(
        EAppEventBusNames.SwapTxHistoryStatusUpdate,
        reloadSwapSelectTokenDetail,
      );
      appEventBus.on(
        EAppEventBusNames.SwapTxHistoryStatusUpdate,
        reloadSwapSelectTokenDetail,
      );
    }
  }, [isFocused, isModalPage, reloadSwapSelectTokenDetail]);

  useEffect(() => {
    if (isFocused) {
      void loadSwapSelectTokenDetailDeb(
        type,
        swapAddressInfoRef.current,
        false,
      );
    }
  }, [
    isFocused,
    type,
    swapAddressInfo,
    swapAddressInfoTo.accountInfo?.deriveType,
    token?.networkId,
    token?.contractAddress,
    token?.balanceParsed,
    loadSwapSelectTokenDetailDeb,
    token?.reservationValue,
    token?.isNative,
  ]);

  useListenTabFocusState(
    ETabRoutes.Swap,
    (isFocus: boolean, isHiddenModel: boolean) => {
      if (!isModalPage) {
        if (isFocus) {
          appEventBus.off(
            EAppEventBusNames.SwapTxHistoryStatusUpdate,
            reloadSwapSelectTokenDetail,
          );
          appEventBus.on(
            EAppEventBusNames.SwapTxHistoryStatusUpdate,
            reloadSwapSelectTokenDetail,
          );
        } else if (isHiddenModel) {
          appEventBus.off(
            EAppEventBusNames.SwapTxHistoryStatusUpdate,
            reloadSwapSelectTokenDetail,
          );
        } else {
          appEventBus.off(
            EAppEventBusNames.SwapTxHistoryStatusUpdate,
            reloadSwapSelectTokenDetail,
          );
          appEventBus.on(
            EAppEventBusNames.SwapTxHistoryStatusUpdate,
            reloadSwapSelectTokenDetail,
          );
        }
      }
    },
  );
}
