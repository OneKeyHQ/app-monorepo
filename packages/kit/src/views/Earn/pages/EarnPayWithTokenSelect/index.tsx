import { useCallback, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  ActionList,
  Alert,
  Empty,
  ListView,
  Page,
  SizableText,
  Skeleton,
  Stack,
  Toast,
  XStack,
  YStack,
  useClipboard,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { ITokenListItemProps } from '@onekeyhq/kit/src/components/TokenListItem';
import { TokenListItem } from '@onekeyhq/kit/src/components/TokenListItem';
import { TokenSelectorLpTokenSwitch } from '@onekeyhq/kit/src/components/TokenSelectorFilter';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import SwapPopularTokenGroup from '@onekeyhq/kit/src/views/Swap/components/SwapPopularTokenGroup';
import { SwapTokenSelectorDesktop } from '@onekeyhq/kit/src/views/Swap/components/SwapTokenSelectorDesktop';
import { buildSwapTokenFetchParams } from '@onekeyhq/kit/src/views/Swap/hooks/swapTokenFetchParamsUtils';
import { useSwapTokenRiskCheck } from '@onekeyhq/kit/src/views/Swap/hooks/useSwapTokenRiskCheck';
import {
  EJotaiContextStoreNames,
  useSettingsPersistAtom,
  useTokenSelectorFilterPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IFuseResult } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes/swap';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import tokenRebaseUtils from '@onekeyhq/shared/src/utils/tokenRebaseUtils';
import {
  SWAP_LP_TOKEN_FILTER_SERVER_SUPPORTED,
  isTokenSelectorDappTokenFilterSupportedNetwork,
} from '@onekeyhq/shared/src/utils/tokenSelectorFilterUtils';
import { swapPopularTokens } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import {
  ESwapTabSwitchType,
  type ISwapNetwork,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import type { FlatList } from 'react-native';

type ITokenItem = ISwapToken | IFuseResult<ISwapToken>;

const getRawToken = (item: ITokenItem) =>
  (item as IFuseResult<ISwapToken>).item
    ? (item as IFuseResult<ISwapToken>).item
    : (item as ISwapToken);

const LOADING_ROW_COUNT = 5;
const SEARCH_DEBOUNCE_MS = 300;
const RETRY_AFTER_CANCEL_MS = 300;
// The last full list per network, account, filter and currency
const lastTokenLists = new Map<string, ISwapToken[]>();
const NO_NETWORKS: ISwapNetwork[] = [];
const NO_NETWORK_IDS: string[] = [];
const NO_ASSET_NETWORKS: [] = [];
const noop = () => {};

function ListSkeleton() {
  return (
    <>
      {Array.from({ length: LOADING_ROW_COUNT }).map((_, index) => (
        <ListItem key={`earn-pay-with-skeleton-${index}`}>
          <Skeleton w="$10" h="$10" radius="round" />
          <YStack>
            <YStack py="$1">
              <Skeleton h="$4" w="$32" />
            </YStack>
            <YStack py="$1">
              <Skeleton h="$3" w="$24" />
            </YStack>
          </YStack>
        </ListItem>
      ))}
    </>
  );
}

// The deposit's network as Swap knows it (whether it filters DeFi tokens),
// its name and logo from the app's own list when Swap doesn't list it
function useLockedNetwork(networkId: string) {
  const { result } = usePromiseResult(async () => {
    const [network, swapNetworks] = await Promise.all([
      backgroundApiProxy.serviceNetwork.getNetworkSafe({ networkId }),
      backgroundApiProxy.serviceSwap
        .fetchSwapNetworks({ autoHandleError: false })
        .catch(() => [] as ISwapNetwork[]),
    ]);
    const swapNetwork = swapNetworks.find(
      (item) => item.networkId === networkId,
    );
    if (swapNetwork) {
      return swapNetwork;
    }
    return {
      networkId,
      name: network?.name ?? '',
      symbol: network?.symbol ?? '',
      logoURI: network?.logoURI,
    } satisfies ISwapNetwork;
  }, [networkId]);
  return result;
}

/**
 * Pay with's token picker: Swap's picker kept to the deposit's network, with
 * no network to switch to. Every token on the network shows, the wallet's
 * with their balances, as in Swap
 */
function EarnPayWithTokenSelectPage() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.EarnPayWithTokenSelect
  >();
  const { accountId, networkId, onSelect } = route.params;
  const { gtMd, md } = useMedia();
  const { bottom } = useSafeAreaInsets();
  const { copyText, getClipboard } = useClipboard();
  const [settingsPersist] = useSettingsPersistAtom();
  const [tokenSelectorFilter, setTokenSelectorFilter] =
    useTokenSelectorFilterPersistAtom();
  const listViewRef = useRef<FlatList<ITokenItem>>(null);
  const useDesktopTokenSelector =
    (platformEnv.isDesktop || platformEnv.isWeb) && gtMd;

  const network = useLockedNetwork(networkId);
  const showLpTokenFilterSwitch =
    SWAP_LP_TOKEN_FILTER_SERVER_SUPPORTED &&
    Boolean(network) &&
    isTokenSelectorDappTokenFilterSupportedNetwork({
      network: {
        id: networkId,
        isAllNetworks: false,
        backendIndex: network?.backendIndex,
      },
      isDeFiEnabled: network?.isDeFiEnabled,
    });
  const showLpTokensOnly = showLpTokenFilterSwitch
    ? tokenSelectorFilter.swapShowLpTokensOnly
    : false;
  const requestLpToken = showLpTokenFilterSwitch ? showLpTokensOnly : undefined;
  const handleLpTokenFilterChange = useCallback(
    (value: boolean) => {
      setTokenSelectorFilter((prev) => ({
        ...prev,
        swapShowLpTokensOnly: value,
      }));
      listViewRef.current?.scrollToOffset({ offset: 0, animated: false });
    },
    [setTokenSelectorFilter],
  );

  const [searchInput, setSearchInput] = useState('');
  const keyword = useDebounce(searchInput.trim(), SEARCH_DEBOUNCE_MS);
  const isSearchSettling = searchInput.trim() !== keyword;
  const handlePaste = useCallback(async () => {
    const text = await getClipboard();
    if (text) {
      setSearchInput(text.trim());
    }
  }, [getClipboard]);

  // The wallet's address on the network, so the list carries its balances
  const { result: accountAddress } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceAccount
        .getAccountAddressForApi({ accountId, networkId })
        .catch(() => ''),
    [accountId, networkId],
  );
  // The request the list on screen has to answer
  const requestKey =
    accountAddress === undefined
      ? undefined
      : [
          networkId,
          accountAddress,
          String(requestLpToken),
          settingsPersist.currencyInfo.id,
          keyword,
        ].join('|');
  const lastRequestKeyRef = useRef(requestKey);
  lastRequestKeyRef.current = requestKey;
  const { result } = usePromiseResult(async () => {
    if (accountAddress === undefined || requestKey === undefined) {
      return undefined;
    }
    const params = buildSwapTokenFetchParams({
      currentNetworkId: networkId,
      keywords: keyword || undefined,
      swapType: ESwapTabSwitchType.SWAP,
      lpToken: requestLpToken,
      requestCurrency: settingsPersist.currencyInfo.id,
      shouldUseCurrentAccountAddress: Boolean(accountAddress),
      currentAccountAddress: accountAddress || undefined,
      currentAccountNetworkId: networkId,
      currentAccountId: accountId,
    });
    const fetchTokens = () =>
      backgroundApiProxy.serviceSwap.fetchSwapTokens(params);
    let tokens: ISwapToken[];
    try {
      tokens = await fetchTokens();
    } catch {
      // Cancelled: by a newer request here, whose answer replaces this
      // one, or by Swap's own, which shares the request; the latest one
      // asks once more
      if (lastRequestKeyRef.current !== requestKey) {
        return undefined;
      }
      await timerUtils.wait(RETRY_AFTER_CANCEL_MS);
      if (lastRequestKeyRef.current !== requestKey) {
        return undefined;
      }
      try {
        tokens = await fetchTokens();
      } catch {
        return {
          requestKey,
          tokens: (!keyword && lastTokenLists.get(requestKey)) || [],
        };
      }
    }
    if (!keyword) {
      lastTokenLists.set(requestKey, tokens);
    }
    return { requestKey, tokens };
  }, [
    accountAddress,
    accountId,
    keyword,
    networkId,
    requestKey,
    requestLpToken,
    settingsPersist.currencyInfo.id,
  ]);
  // The answer to this request; before it, the last full list of the network
  // shows at once, as Swap shows its last complete list
  const answered = result?.requestKey === requestKey;
  const cachedTokens =
    requestKey && !keyword ? lastTokenLists.get(requestKey) : undefined;
  const shownTokens = answered ? result?.tokens : cachedTokens;
  const displayTokens = useMemo<ITokenItem[]>(
    () => shownTokens ?? [],
    [shownTokens],
  );
  const listLoading = !answered || isSearchSettling;

  const popularTokens = useMemo(
    () => swapPopularTokens[networkId] ?? [],
    [networkId],
  );
  const showPopularTokens = popularTokens.length > 0 && !keyword;
  // One note above the first token with no price, as Swap has it
  const alertIndex = useMemo(
    () =>
      displayTokens.findIndex((item) => {
        const raw = getRawToken(item);
        return !raw.price || new BigNumber(raw.price).isZero();
      }),
    [displayTokens],
  );
  const searchTitle =
    keyword && network?.name
      ? intl.formatMessage(
          { id: ETranslations.title_tokens_on_network },
          { network: network.name },
        )
      : undefined;

  const checkRiskToken = useSwapTokenRiskCheck();
  const handleSelectToken = useCallback(
    async (token: ISwapToken) => {
      if (
        tokenRebaseUtils.isScalingBalanceMultiplier(token.balanceMultiplier)
      ) {
        Toast.message({
          title: intl.formatMessage({
            id: ETranslations.earn_unsupported_token,
          }),
        });
        return;
      }
      const commit = () => {
        navigation.popStack();
        onSelect(token);
      };
      if (await checkRiskToken(token)) {
        navigation.pushModal(EModalRoutes.SwapModal, {
          screen: EModalSwapRoutes.TokenRiskReminder,
          params: {
            storeName: EJotaiContextStoreNames.swap,
            token,
            onConfirm: (close: () => void) => {
              close();
              commit();
            },
          },
        });
        return;
      }
      commit();
    },
    [checkRiskToken, intl, navigation, onSelect],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: ITokenItem; index: number }) => {
      const raw = getRawToken(item);
      const balanceBN = new BigNumber(raw.balanceParsed ?? 0);
      const fiatValueBN = new BigNumber(raw.fiatValue ?? 0);
      const contractAddressDisplay = md
        ? accountUtils.shortenAddress({ address: raw.contractAddress })
        : raw.contractAddress;
      const tokenItem: ITokenListItemProps = {
        isSearch: Boolean(keyword),
        tokenImageSrc: raw.logoURI,
        tokenName: raw.name,
        tokenSymbol: raw.symbol,
        networkImageSrc: raw.networkLogoURI,
        tokenContrastAddress: keyword ? contractAddressDisplay : undefined,
        balance: !balanceBN.isZero() ? raw.balanceParsed : undefined,
        valueProps:
          raw.fiatValue && !fiatValueBN.isZero()
            ? {
                value: raw.fiatValue,
                currency: settingsPersist.currencyInfo.symbol,
              }
            : undefined,
        onPress: () => void handleSelectToken(raw),
        titleMatchStr: (item as IFuseResult<ISwapToken>).matches?.find(
          (match) => match.key === 'symbol',
        ),
      };
      return (
        <>
          {searchTitle && index === 0 ? (
            <SizableText
              size={useDesktopTokenSelector ? '$bodyMdMedium' : '$bodyMd'}
              color="$textSubdued"
              px="$5"
              pt="$3"
              pb="$1"
            >
              {searchTitle}
            </SizableText>
          ) : null}
          {alertIndex === index ? (
            <Stack
              pt={useDesktopTokenSelector ? '$0' : '$3'}
              pb={useDesktopTokenSelector ? '$0' : '$2'}
              mx={useDesktopTokenSelector ? '$4' : '$0'}
            >
              <Alert
                fullBleed
                type="default"
                title={intl.formatMessage({
                  id: ETranslations.token_selector_unverified_token_warning,
                })}
                icon="InfoCircleOutline"
              />
            </Stack>
          ) : null}
          <TokenListItem
            {...tokenItem}
            {...(useDesktopTokenSelector ? { mx: '$4', px: '$1' } : {})}
            moreComponent={
              <Stack alignSelf="center">
                <ActionList
                  title={tokenItem.tokenSymbol ?? ''}
                  disabled={raw.isNative}
                  renderTrigger={
                    <ListItem.IconButton
                      icon="DotVerSolid"
                      variant="tertiary"
                    />
                  }
                  items={[
                    {
                      icon: 'Copy3Outline',
                      label: intl.formatMessage({
                        id: ETranslations.global_copy_token_contract,
                      }),
                      onPress: () => {
                        copyText(raw.contractAddress);
                      },
                      disabled: raw.isNative,
                    },
                    {
                      icon: 'OpenOutline',
                      label: intl.formatMessage({
                        id: ETranslations.swap_token_selector_contract_info,
                      }),
                      onPress: async () => {
                        const url =
                          await backgroundApiProxy.serviceExplorer.buildExplorerUrl(
                            {
                              networkId: raw.networkId,
                              type: 'token',
                              param: raw.contractAddress,
                            },
                          );
                        openUrlExternal(url);
                      },
                      disabled: raw.isNative,
                    },
                  ]}
                />
              </Stack>
            }
          />
        </>
      );
    },
    [
      alertIndex,
      copyText,
      handleSelectToken,
      intl,
      keyword,
      md,
      searchTitle,
      settingsPersist.currencyInfo.symbol,
      useDesktopTokenSelector,
    ],
  );

  const tokenListEmptyComponent = useMemo(() => {
    if (listLoading) {
      return <ListSkeleton />;
    }
    return (
      <Empty
        illustration="TwoBlocks"
        title={intl.formatMessage({ id: ETranslations.global_no_results })}
        description={intl.formatMessage({
          id: ETranslations.token_no_search_results_desc,
        })}
      />
    );
  }, [intl, listLoading]);

  const searchPlaceholder = intl.formatMessage({
    id: ETranslations.token_selector_search_placeholder,
  });

  return (
    <Page lazyLoad={!platformEnv.isNativeIOS} safeAreaEnabled={false}>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.token_selector_title })}
        // Swap's token column alone: the app's usual modal width
        modalContentMaxWidth={useDesktopTokenSelector ? 640 : undefined}
        modalContentMaxHeight={useDesktopTokenSelector ? 700 : undefined}
        {...(!useDesktopTokenSelector
          ? {
              headerSearchBarOptions: {
                placeholder: searchPlaceholder,
                onChangeText: ({ nativeEvent }) => {
                  setSearchInput(nativeEvent.text);
                },
                searchBarInputValue: searchInput,
                ...(searchInput.length === 0 && !platformEnv.isExtension
                  ? {
                      addOns: [
                        {
                          iconName: 'ClipboardOutline' as const,
                          onPress: handlePaste,
                        },
                      ],
                    }
                  : {}),
              },
            }
          : {})}
      />
      <Page.Body>
        {useDesktopTokenSelector && network ? (
          <SwapTokenSelectorDesktop
            hideNetworkColumn
            allNetwork={network}
            networks={NO_NETWORKS}
            selectedNetwork={network}
            assetNetworks={NO_ASSET_NETWORKS}
            disableNetworks={NO_NETWORK_IDS}
            networkSearchValue=""
            tokenSearchValue={searchInput}
            tokenSearchPlaceholder={searchPlaceholder}
            allNetworksLabel={intl.formatMessage({
              id: ETranslations.global_all_networks,
            })}
            sameChainLabel=""
            onNetworkSearchChange={noop}
            onTokenSearchChange={setSearchInput}
            onSelectNetwork={noop}
            onDisableNetworksClick={noop}
            onSelectToken={handleSelectToken}
            listViewRef={listViewRef}
            popularTokens={popularTokens}
            showPopularTokens={showPopularTokens}
            showLpTokenFilterSwitch={showLpTokenFilterSwitch}
            showLpTokensOnly={showLpTokensOnly}
            onLpTokenFilterChange={handleLpTokenFilterChange}
            tokens={displayTokens}
            renderToken={renderItem}
            currencySymbol={settingsPersist.currencyInfo.symbol}
            tokenListEmptyComponent={tokenListEmptyComponent}
          />
        ) : null}
        {!useDesktopTokenSelector ? (
          <>
            <XStack
              px="$5"
              pb="$2"
              alignItems="center"
              justifyContent="space-between"
              gap="$3"
            >
              <XStack alignItems="center" flexShrink={1} h="$8" minWidth={0}>
                <SizableText
                  size="$bodyMd"
                  color="$textSubdued"
                  pr="$2"
                  lineHeight={32}
                >
                  {intl.formatMessage({
                    id: ETranslations.token_selector_network,
                  })}
                </SizableText>
                <SizableText size="$bodyMd" numberOfLines={1} lineHeight={32}>
                  {network?.name}
                </SizableText>
              </XStack>
              {showLpTokenFilterSwitch ? (
                <TokenSelectorLpTokenSwitch
                  value={showLpTokensOnly}
                  onChange={handleLpTokenFilterChange}
                />
              ) : null}
            </XStack>
            <YStack flex={1}>
              <ListView
                useFlashList={platformEnv.isNative}
                ref={listViewRef}
                data={displayTokens}
                renderItem={renderItem}
                estimatedItemSize={60}
                ListHeaderComponent={
                  showPopularTokens ? (
                    <YStack px="$5" pt="$3" gap="$2">
                      <SizableText size="$bodyMd" color="$textSubdued" pr="$2">
                        {intl.formatMessage({
                          id: ETranslations.swap_token_selector_popular_token,
                        })}
                      </SizableText>
                      <SwapPopularTokenGroup
                        onSelectToken={handleSelectToken}
                        tokens={popularTokens}
                      />
                    </YStack>
                  ) : null
                }
                ListFooterComponent={<Stack h={bottom || '$2'} />}
                ListEmptyComponent={tokenListEmptyComponent}
              />
            </YStack>
          </>
        ) : null}
      </Page.Body>
    </Page>
  );
}

export default EarnPayWithTokenSelectPage;
