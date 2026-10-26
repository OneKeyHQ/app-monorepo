import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  ActionList,
  Alert,
  Divider,
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
import { useSwapTokenRiskCheck } from '@onekeyhq/kit/src/views/Swap/hooks/useSwapTokenRiskCheck';
import { buildServerAuthoritativeSearchResults } from '@onekeyhq/kit/src/views/Swap/hooks/useSwapTokens.utils';
import {
  EJotaiContextStoreNames,
  useSettingsPersistAtom,
  useTokenSelectorFilterPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { useFuse } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import type { IFuseResult } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalStakingParamList } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import tokenRebaseUtils from '@onekeyhq/shared/src/utils/tokenRebaseUtils';
import { swapPopularTokens } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  ISwapNetwork,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import {
  EARN_PAY_WITH_PICKER_SIZE,
  buildPayWithPickerHeldDeFiKey,
  buildPayWithPickerRequestKey,
  getPayWithPickerAccountAddress,
  getPayWithPickerNetwork,
  isPayWithPickerLpFilterShown,
  payWithPickerHeldDeFiLists,
  payWithPickerTokenLists,
  readPayWithPickerAccountAddress,
  readPayWithPickerHeldDeFiTokens,
  readPayWithPickerNetwork,
  readPayWithPickerTokens,
} from '../EarnRouter/earnPayWithPickerData';
import {
  listWithPayTokens,
  matchesPayTokenKeyword,
} from '../EarnRouter/earnRouter.utils';

import type { FlatList } from 'react-native';

type ITokenItem = ISwapToken | IFuseResult<ISwapToken>;

const getRawToken = (item: ITokenItem) =>
  (item as IFuseResult<ISwapToken>).item
    ? (item as IFuseResult<ISwapToken>).item
    : (item as ISwapToken);

const LOADING_ROW_COUNT = 5;
const SEARCH_DEBOUNCE_MS = 300;
const RETRY_AFTER_CANCEL_MS = 300;
const MODAL_SCREEN_SELECTOR = '[data-testid="APP-Modal-Screen"]';
const NO_NETWORKS: ISwapNetwork[] = [];
const NO_TOKENS: ISwapToken[] = [];
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

// The deposit's network, at once when the form read it ahead
function useLockedNetwork(networkId: string) {
  const { result } = usePromiseResult(
    () => readPayWithPickerNetwork(networkId),
    [networkId],
  );
  return result ?? getPayWithPickerNetwork(networkId);
}

/**
 * Pay with's token picker: Swap's picker kept to the deposit's network, with
 * no network to switch to. Every token on the network shows, the wallet's
 * with their balances, as in Swap, and the wallet's tokens Pay with offers
 * even where Swap files them under DeFi tokens
 */
function EarnPayWithTokenSelectPage() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.EarnPayWithTokenSelect
  >();
  const { accountId, networkId, payTokenAddresses, modalHeight, onSelect } =
    route.params;
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
  const showLpTokenFilterSwitch = isPayWithPickerLpFilterShown({
    networkId,
    network,
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
  const typedKeyword = searchInput.trim();
  const debouncedKeyword = useDebounce(typedKeyword, SEARCH_DEBOUNCE_MS);
  // A cleared field shows the full list again at once, as in Swap
  const keyword = typedKeyword ? debouncedKeyword : '';
  const isSearchSettling = typedKeyword !== keyword;
  const handlePaste = useCallback(async () => {
    const text = await getClipboard();
    if (text) {
      setSearchInput(text.trim());
    }
  }, [getClipboard]);

  // The wallet's address on the network, so the list carries its balances
  const { result: readAccountAddress } = usePromiseResult(
    () => readPayWithPickerAccountAddress({ accountId, networkId }),
    [accountId, networkId],
  );
  const accountAddress =
    readAccountAddress ??
    getPayWithPickerAccountAddress({ accountId, networkId });
  // The request the list on screen has to answer, once the network says
  // whether the DeFi tokens filter goes with it
  const currencyId = settingsPersist.currencyInfo.id;
  const request = useMemo(
    () =>
      accountAddress === undefined || !network
        ? undefined
        : {
            accountId,
            networkId,
            accountAddress,
            lpToken: requestLpToken,
            currencyId,
            keyword,
          },
    [
      accountAddress,
      accountId,
      currencyId,
      keyword,
      network,
      networkId,
      requestLpToken,
    ],
  );
  const requestKey = request
    ? buildPayWithPickerRequestKey(request)
    : undefined;
  const lastRequestKeyRef = useRef(requestKey);
  lastRequestKeyRef.current = requestKey;
  const { result } = usePromiseResult(async () => {
    if (!request || requestKey === undefined) {
      return undefined;
    }
    const fetchTokens = () => readPayWithPickerTokens(request);
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
          tokens: (!keyword && payWithPickerTokenLists.get(requestKey)) || [],
        };
      }
    }
    return { requestKey, tokens };
  }, [keyword, request, requestKey]);
  // The answer to this request; before it, the last full list of the network
  // shows at once, as Swap shows its last complete list
  const answered = result?.requestKey === requestKey;
  const cachedTokens =
    requestKey && !keyword
      ? payWithPickerTokenLists.get(requestKey)
      : undefined;
  const listTokens = answered ? result?.tokens : cachedTokens;

  // With DeFi tokens off, the wallet's tokens Swap files there, read beside
  // the list: the ones Pay with offers (sUSDe, sUSD3) show in it, in a search
  // too, so the token on Pay with's chip is always there
  const hasPayTokens = Boolean(payTokenAddresses?.length);
  const heldDeFiRequest = useMemo(
    () =>
      requestLpToken === false && accountAddress && hasPayTokens
        ? { accountId, networkId, accountAddress, currencyId }
        : undefined,
    [
      accountAddress,
      accountId,
      currencyId,
      hasPayTokens,
      networkId,
      requestLpToken,
    ],
  );
  const heldDeFiKey = heldDeFiRequest
    ? buildPayWithPickerHeldDeFiKey(heldDeFiRequest)
    : undefined;
  const { result: heldDeFiResult } = usePromiseResult(async () => {
    if (!heldDeFiRequest || heldDeFiKey === undefined) {
      return undefined;
    }
    const tokens = await readPayWithPickerHeldDeFiTokens(
      heldDeFiRequest,
    ).catch(() => payWithPickerHeldDeFiLists.get(heldDeFiKey) ?? NO_TOKENS);
    return { heldDeFiKey, tokens };
  }, [heldDeFiKey, heldDeFiRequest]);
  let heldDeFiTokens: ISwapToken[] | undefined = NO_TOKENS;
  if (heldDeFiKey !== undefined) {
    heldDeFiTokens =
      heldDeFiResult?.heldDeFiKey === heldDeFiKey
        ? heldDeFiResult.tokens
        : payWithPickerHeldDeFiLists.get(heldDeFiKey);
  }
  // The rows show once both are in: Pay with's tokens go in among the
  // wallet's, and coming later they would push the rows under them down
  const shownTokens = useMemo(() => {
    if (!listTokens || !heldDeFiTokens) {
      return undefined;
    }
    if (!heldDeFiTokens.length || !payTokenAddresses?.length) {
      return listTokens;
    }
    return listWithPayTokens({
      list: listTokens,
      candidates: keyword
        ? heldDeFiTokens.filter((token) =>
            matchesPayTokenKeyword(token, keyword),
          )
        : heldDeFiTokens,
      payTokenAddresses,
    });
  }, [heldDeFiTokens, keyword, listTokens, payTokenAddresses]);
  // Each row's network badge, which Swap takes from the network it shows:
  // the list itself doesn't carry it
  const networkLogoURI = network?.logoURI;
  const badgedTokens = useMemo<ISwapToken[]>(
    () =>
      (shownTokens ?? []).map((token) =>
        token.networkLogoURI || !networkLogoURI
          ? token
          : { ...token, networkLogoURI },
      ),
    [networkLogoURI, shownTokens],
  );
  // Search results in the server's order, with the letters that match marked
  // as Swap marks them
  const fuseTokens = useFuse(keyword ? badgedTokens : NO_TOKENS, {
    shouldSort: false,
    keys: ['symbol', 'name', 'contractAddress', 'subtitles'],
  });
  const displayTokens = useMemo<ITokenItem[]>(() => {
    if (!keyword) {
      return badgedTokens;
    }
    const matchesByToken = new Map(
      fuseTokens.search(keyword).map((found) => [found.item, found.matches]),
    );
    return buildServerAuthoritativeSearchResults(badgedTokens, matchesByToken);
  }, [badgedTokens, fuseTokens, keyword]);
  const listLoading = !answered || isSearchSettling || !heldDeFiTokens;

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

  // Keys stay in the picker on the web, as in a dialog: the search takes the
  // cursor on wide windows, what is under it (the page, the form's modal)
  // takes no focus while it is up (Tab would walk the hidden form and its
  // button), and focus goes back to what opened it when it closes
  const openerRef = useRef(
    platformEnv.isRuntimeBrowser ? document.activeElement : null,
  );
  const focusesSearchRef = useRef(useDesktopTokenSelector);
  useEffect(() => {
    if (!platformEnv.isRuntimeBrowser) {
      return undefined;
    }
    // This picker is the newest modal
    const screens = Array.from(
      document.querySelectorAll<HTMLElement>(MODAL_SCREEN_SELECTOR),
    );
    const ownScreen = screens[screens.length - 1];
    const opener = openerRef.current;
    // Under it: beside its own branch, under the element it shares with the
    // chip that opened it (the page, and the modal the form is in). Opened
    // some other way, the modals before it
    let under: HTMLElement[] = screens.slice(0, -1);
    if (
      ownScreen &&
      opener instanceof HTMLElement &&
      !ownScreen.contains(opener)
    ) {
      let shared = opener.parentElement;
      while (shared && !shared.contains(ownScreen)) {
        shared = shared.parentElement;
      }
      if (shared) {
        under = Array.from(shared.children).filter(
          (child): child is HTMLElement =>
            child instanceof HTMLElement && !child.contains(ownScreen),
        );
      }
    }
    const covered = under.filter((element) => !element.inert);
    // The chip lets go of the focus now: left to the browser, the blur comes
    // a frame later and can take the search's focus with it
    const focused = document.activeElement;
    if (
      focused instanceof HTMLElement &&
      covered.some((element) => element.contains(focused))
    ) {
      focused.blur();
    }
    covered.forEach((element) => {
      element.inert = true;
    });
    // Once the modal shows: a field in one still coming in can't take it
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        const active = document.activeElement;
        if (focusesSearchRef.current && !ownScreen?.contains(active)) {
          // The token search: the hidden network column's comes first
          Array.from(ownScreen?.querySelectorAll('input') ?? [])
            .find((input) => input.offsetParent !== null)
            ?.focus({ preventScroll: true });
        }
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      covered.forEach((element) => {
        element.inert = false;
      });
      if (
        opener instanceof HTMLElement &&
        opener.isConnected &&
        (!document.activeElement || document.activeElement === document.body)
      ) {
        opener.focus({ preventScroll: true });
      }
    };
  }, []);

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
      // Swap's risk reminder, in this modal as in Swap's: its OK closes the
      // two together, its Cancel goes back to the list
      if (await checkRiskToken(token)) {
        navigation.push(EModalStakingRoutes.EarnPayWithTokenRisk, {
          storeName: EJotaiContextStoreNames.swap,
          token,
          onConfirm: commit,
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
        // Swap's token column alone: the app's usual modal width. Over a
        // taller modal, its height (as on the route)
        modalContentMaxWidth={
          useDesktopTokenSelector ? EARN_PAY_WITH_PICKER_SIZE.width : undefined
        }
        modalContentMaxHeight={
          useDesktopTokenSelector
            ? (modalHeight ?? EARN_PAY_WITH_PICKER_SIZE.height)
            : undefined
        }
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
            {/* Where Swap ends its header, under its network chips */}
            {showPopularTokens ? <Divider /> : null}
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
