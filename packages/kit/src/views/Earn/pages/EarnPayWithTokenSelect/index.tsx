import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import { useIsFocused } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  ActionList,
  Alert,
  Divider,
  Empty,
  Icon,
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
import { ANIMATE_ONLY_OPACITY } from '@onekeyhq/components/src/utils/animationConstants';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import NetworkToggleGroup from '@onekeyhq/kit/src/components/NetworkToggleGroup';
import type { ITokenListItemProps } from '@onekeyhq/kit/src/components/TokenListItem';
import { TokenListItem } from '@onekeyhq/kit/src/components/TokenListItem';
import { TokenSelectorLpTokenSwitch } from '@onekeyhq/kit/src/components/TokenSelectorFilter';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { convertFiat } from '@onekeyhq/kit/src/utils/fiatConvert';
import useConfigurableChainSelector from '@onekeyhq/kit/src/views/ChainSelector/hooks/useChainSelector';
import SwapPopularTokenGroup from '@onekeyhq/kit/src/views/Swap/components/SwapPopularTokenGroup';
import { SwapTokenSelectorDesktop } from '@onekeyhq/kit/src/views/Swap/components/SwapTokenSelectorDesktop';
import { buildSwapTokenSelectorAssetNetworks } from '@onekeyhq/kit/src/views/Swap/components/SwapTokenSelectorDesktop/SwapTokenSelectorDesktop.utils';
import { useSwapTokenRiskCheck } from '@onekeyhq/kit/src/views/Swap/hooks/useSwapTokenRiskCheck';
import { buildServerAuthoritativeSearchResults } from '@onekeyhq/kit/src/views/Swap/hooks/useSwapTokens.utils';
import {
  EJotaiContextStoreNames,
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
  useTokenSelectorFilterPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { dangerAllNetworkRepresent } from '@onekeyhq/shared/src/config/presetNetworks';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
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

import { EARN_DESKTOP_DEMO_COPY } from '../../components/desktopHome/earnDesktopHomeCopy';
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
import { PAY_WITH_TRIGGER_TEST_ID } from '../EarnRouter/EarnRouterPayWith';

import type { FlatList } from 'react-native';

type ITokenItem = ISwapToken | IFuseResult<ISwapToken>;

const getRawToken = (item: ITokenItem) =>
  (item as IFuseResult<ISwapToken>).item
    ? (item as IFuseResult<ISwapToken>).item
    : (item as ISwapToken);

const LOADING_ROW_COUNT = 5;
// The rows drawn as the list first shows, in this long after it, fade in:
// from dim, so no frame between the placeholder rows and them is blank
const ROWS_REVEAL_MS = 300;
const ROW_FADE_IN = { opacity: 0.4 } as const;
const SEARCH_DEBOUNCE_MS = 300;
const RETRY_AFTER_CANCEL_MS = 300;
const MODAL_SCREEN_SELECTOR = '[data-testid="APP-Modal-Screen"]';
const NO_NETWORKS: ISwapNetwork[] = [];
const NO_TOKENS: ISwapToken[] = [];
const NO_NETWORK_IDS: string[] = [];
const NO_ASSET_NETWORKS: [] = [];
const noop = () => {};
// Across networks: Swap's picker's width, for its network column
const EARN_PAY_WITH_PICKER_ACROSS_WIDTH = 880;
// The phone's row of network icons before the one that opens them all
const PHONE_VISIBLE_NETWORKS = 5;

// The token search: the hidden network column's comes first
const findPickerSearch = (screen?: HTMLElement) =>
  Array.from(screen?.querySelectorAll('input') ?? []).find(
    (input) => input.offsetParent !== null,
  );

const focusPickerSearch = (screen?: HTMLElement) => {
  findPickerSearch(screen)?.focus({ preventScroll: true });
};

const isFocusOnPage = () =>
  !document.activeElement || document.activeElement === document.body;

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

// A token's row, fading in when it is among the first the list draws
function PickerRow({
  fadesIn,
  children,
}: {
  fadesIn: boolean;
  children: ReactNode;
}) {
  // As it mounts, and kept: a view that gained an enterStyle later would be
  // drawn again as a new view
  const [entryFadesIn] = useState(fadesIn);
  return (
    <YStack
      transition="quick"
      animateOnly={ANIMATE_ONLY_OPACITY}
      enterStyle={entryFadesIn ? ROW_FADE_IN : undefined}
    >
      {children}
    </YStack>
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
  const {
    accountId: depositAccountId,
    networkId: depositNetworkId,
    payTokenAddresses,
    modalHeight,
    selectedToken,
    acrossNetworks = false,
    heldTokens,
    accountIdByNetwork,
    onSelect,
  } = route.params;
  const { gtMd, md } = useMedia();
  const { bottom } = useSafeAreaInsets();
  const { copyText, getClipboard } = useClipboard();
  const [settingsPersist] = useSettingsPersistAtom();
  const [tokenSelectorFilter, setTokenSelectorFilter] =
    useTokenSelectorFilterPersistAtom();
  const listViewRef = useRef<FlatList<ITokenItem>>(null);
  const useDesktopTokenSelector =
    (platformEnv.isDesktop || platformEnv.isWeb) && gtMd;

  // Across networks (the Earn window, 11-05): Swap's networks in a column,
  // All Networks listing what the wallet holds on each; a token elsewhere
  // is bridged to the deposit's network. Else the deposit's network alone
  const { result: swapNetworks = NO_NETWORKS } = usePromiseResult(
    async () =>
      acrossNetworks
        ? backgroundApiProxy.serviceSwap
            .fetchSwapNetworks()
            .catch(() => NO_NETWORKS)
        : NO_NETWORKS,
    [acrossNetworks],
  );
  // Swap's own entry for every network, as its picker builds it
  const allNetwork = useMemo<ISwapNetwork | undefined>(
    () =>
      swapNetworks.length
        ? {
            networkId: getNetworkIdsMap().onekeyall,
            name: dangerAllNetworkRepresent.name,
            symbol: dangerAllNetworkRepresent.symbol,
            logoURI: dangerAllNetworkRepresent.logoURI,
            shortcode: dangerAllNetworkRepresent.shortcode,
            isAllNetworks: true,
          }
        : undefined,
    [swapNetworks],
  );
  // The networks a token can come from: the deposit's, and the ones a
  // bridge leaves from
  const columnNetworks = useMemo(
    () =>
      swapNetworks.filter(
        (item) =>
          !item.isAllNetworks &&
          (item.networkId === depositNetworkId || item.supportCrossChainSwap),
      ),
    [depositNetworkId, swapNetworks],
  );
  const [listNetworkId, setListNetworkId] = useState(
    (acrossNetworks && selectedToken?.networkId) || depositNetworkId,
  );
  const networkId = acrossNetworks ? listNetworkId : depositNetworkId;
  const isAllNetworksView =
    acrossNetworks &&
    Boolean(allNetwork) &&
    networkId === allNetwork?.networkId;
  // The wallet's account on the network listed, for its balances there
  const accountId =
    (acrossNetworks ? accountIdByNetwork?.[networkId] : undefined) ??
    depositAccountId;
  const handleSelectNetwork = useCallback((item: ISwapNetwork) => {
    setListNetworkId(item.networkId);
    listViewRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  const network = useLockedNetwork(
    isAllNetworksView ? depositNetworkId : networkId,
  );
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

  // The rows, the costly part to draw, come a frame after the picker: its
  // frame (title, search, placeholder rows) shows at once with the modal's
  // fade and scale, and the rows fade in after it
  const [isListShown, setIsListShown] = useState(!platformEnv.isRuntimeBrowser);
  const rowsFadeInRef = useRef(false);
  useEffect(() => {
    if (isListShown) {
      return undefined;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        rowsFadeInRef.current = true;
        timer = setTimeout(() => {
          rowsFadeInRef.current = false;
        }, ROWS_REVEAL_MS);
        startTransition(() => {
          setIsListShown(true);
        });
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
    // Once, as the picker opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [searchInput, setSearchInput] = useState('');
  const [networkSearch, setNetworkSearch] = useState('');
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
      accountAddress === undefined || !network || isAllNetworksView
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
      isAllNetworksView,
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
  // The wallet's tokens on every network, in the currency the app shows,
  // each with its network's logo: All Networks lists them, and the column
  // sums them by network
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const heldSwapTokens = useMemo(() => {
    if (!acrossNetworks || !heldTokens?.length) {
      return NO_TOKENS;
    }
    const logoById = new Map(
      columnNetworks.map((item) => [item.networkId, item.logoURI]),
    );
    return heldTokens.map((token) => ({
      ...token,
      fiatValue: convertFiat({
        value: token.fiatValue ?? '0',
        sourceCurrency: USD_CURRENCY_ID,
        targetCurrency: currencyId,
        currencyMap,
      }),
      currency: currencyId,
      networkLogoURI: token.networkLogoURI || logoById.get(token.networkId),
    }));
  }, [acrossNetworks, columnNetworks, currencyId, currencyMap, heldTokens]);
  const assetNetworks = useMemo(
    () =>
      acrossNetworks
        ? buildSwapTokenSelectorAssetNetworks({
            networks: columnNetworks,
            tokens: heldSwapTokens,
          })
        : NO_ASSET_NETWORKS,
    [acrossNetworks, columnNetworks, heldSwapTokens],
  );
  const answered = isAllNetworksView || result?.requestKey === requestKey;
  const cachedTokens =
    requestKey && !keyword
      ? payWithPickerTokenLists.get(requestKey)
      : undefined;
  let listTokens = answered ? result?.tokens : cachedTokens;
  if (isAllNetworksView) {
    listTokens = keyword
      ? heldSwapTokens.filter((token) => matchesPayTokenKeyword(token, keyword))
      : heldSwapTokens;
  }

  // With DeFi tokens off, the wallet's tokens Swap files there, read beside
  // the list: the ones Pay with offers (sUSDe, sUSD3) show in it, in a search
  // too, so the token on Pay with's chip is always there
  const hasPayTokens = Boolean(payTokenAddresses?.length);
  const heldDeFiRequest = useMemo(
    () =>
      requestLpToken === false &&
      accountAddress &&
      hasPayTokens &&
      !isAllNetworksView
        ? { accountId, networkId, accountAddress, currencyId }
        : undefined,
    [
      accountAddress,
      accountId,
      currencyId,
      hasPayTokens,
      isAllNetworksView,
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
    const tokens = await readPayWithPickerHeldDeFiTokens(heldDeFiRequest).catch(
      () => payWithPickerHeldDeFiLists.get(heldDeFiKey) ?? NO_TOKENS,
    );
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
    () =>
      isAllNetworksView ? NO_TOKENS : (swapPopularTokens[networkId] ?? []),
    [isAllNetworksView, networkId],
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
    keyword && network?.name && !isAllNetworksView
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
  const ownScreenRef = useRef<HTMLElement | undefined>(undefined);
  useEffect(() => {
    if (!platformEnv.isRuntimeBrowser) {
      return undefined;
    }
    // This picker is the newest modal
    const screens = Array.from(
      document.querySelectorAll<HTMLElement>(MODAL_SCREEN_SELECTOR),
    );
    const ownScreen = screens[screens.length - 1];
    ownScreenRef.current = ownScreen;
    const opener = openerRef.current;
    // Where the chip is: a pick draws the form again, with a new chip
    const openerScope =
      opener instanceof HTMLElement
        ? opener.closest<HTMLElement>(MODAL_SCREEN_SELECTOR)
        : null;
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
          focusPickerSearch(ownScreen);
        }
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      covered.forEach((element) => {
        element.inert = false;
      });
      if (!isFocusOnPage()) {
        return;
      }
      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus({ preventScroll: true });
        return;
      }
      // After a pick of another token: the form's new chip, once drawn
      requestAnimationFrame(() => {
        const scope = openerScope?.isConnected ? openerScope : document;
        const chip = Array.from(
          scope.querySelectorAll<HTMLElement>(
            `[data-testid="${PAY_WITH_TRIGGER_TEST_ID}"]`,
          ),
        ).find((element) => element.offsetParent !== null);
        if (chip && isFocusOnPage()) {
          chip.focus({ preventScroll: true });
        }
      });
    };
  }, []);
  // Back from the risk reminder (its Cancel or back arrow), the search takes
  // the cursor again, as when the picker opened. The reminder's button that
  // was pressed slides away with the focus in it
  const isFocused = useIsFocused();
  const wasFocusedRef = useRef(isFocused);
  useEffect(() => {
    const wasFocused = wasFocusedRef.current;
    wasFocusedRef.current = isFocused;
    if (
      !platformEnv.isRuntimeBrowser ||
      !isFocused ||
      wasFocused ||
      !focusesSearchRef.current
    ) {
      return undefined;
    }
    let tries = 0;
    let frame = 0;
    const focusSearch = () => {
      const search = findPickerSearch(ownScreenRef.current);
      if (search) {
        if (document.activeElement !== search) {
          search.focus({ preventScroll: true });
        }
        return;
      }
      // The list slides back in: its search shows within a few frames
      tries += 1;
      if (tries < 10) {
        frame = requestAnimationFrame(focusSearch);
      }
    };
    frame = requestAnimationFrame(focusSearch);
    return () => cancelAnimationFrame(frame);
  }, [isFocused]);

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
          modalHeight,
        });
        return;
      }
      commit();
    },
    [checkRiskToken, intl, modalHeight, navigation, onSelect],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: ITokenItem; index: number }) => {
      const raw = getRawToken(item);
      const balanceBN = new BigNumber(raw.balanceParsed ?? 0);
      const fiatValueBN = new BigNumber(raw.fiatValue ?? 0);
      const contractAddressDisplay = md
        ? accountUtils.shortenAddress({ address: raw.contractAddress })
        : raw.contractAddress;
      // The token paying now: the row lit and checked, as the Deposit
      // picker marks its pick
      const isSelected = Boolean(
        selectedToken &&
        (!acrossNetworks ||
          !selectedToken.networkId ||
          raw.networkId === selectedToken.networkId) &&
        (selectedToken.isNative
          ? raw.isNative
          : !raw.isNative &&
            raw.contractAddress?.toLowerCase() ===
              selectedToken.address.toLowerCase()),
      );
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
        <PickerRow fadesIn={rowsFadeInRef.current}>
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
            {...(isSelected ? { bg: '$bgHover' } : undefined)}
            aria-selected={isSelected}
            moreComponent={
              <XStack alignSelf="center" ai="center" gap="$1">
                {/* Its place kept on every row, so the figures line up */}
                {isSelected ? (
                  <Icon
                    name="CheckLargeOutline"
                    size="$5"
                    color="$iconSuccess"
                    flexShrink={0}
                  />
                ) : (
                  <Stack w="$5" h="$5" flexShrink={0} />
                )}
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
              </XStack>
            }
          />
        </PickerRow>
      );
    },
    [
      acrossNetworks,
      alertIndex,
      copyText,
      handleSelectToken,
      intl,
      keyword,
      md,
      searchTitle,
      selectedToken,
      settingsPersist.currencyInfo.symbol,
      useDesktopTokenSelector,
    ],
  );
  // The phone's row of networks, as Swap's: the ones the wallet holds most
  // on first, the rest in the chain selector
  const openChainSelector = useConfigurableChainSelector();
  const toggleNetworks = useMemo(() => {
    if (!acrossNetworks) {
      return NO_NETWORKS;
    }
    const heldIds = assetNetworks.map((item) => item.network.networkId);
    const held = heldIds.flatMap((id) => {
      const found = columnNetworks.find((item) => item.networkId === id);
      return found ? [found] : [];
    });
    const rest = columnNetworks.filter(
      (item) => !heldIds.includes(item.networkId),
    );
    return [...(allNetwork ? [allNetwork] : []), ...held, ...rest];
  }, [acrossNetworks, allNetwork, assetNetworks, columnNetworks]);
  const selectedListNetwork = isAllNetworksView
    ? allNetwork
    : (columnNetworks.find((item) => item.networkId === networkId) ?? network);
  const handleMoreNetworks = useCallback(() => {
    openChainSelector({
      defaultNetworkId: isAllNetworksView ? undefined : networkId,
      networkIds: columnNetworks.map((item) => item.networkId),
      grouped: false,
      onSelect: (picked) => {
        const found = picked
          ? columnNetworks.find((item) => item.networkId === picked.id)
          : undefined;
        if (found) {
          handleSelectNetwork(found);
        }
      },
    });
  }, [
    columnNetworks,
    handleSelectNetwork,
    isAllNetworksView,
    networkId,
    openChainSelector,
  ]);

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
  // Swap's token column alone; across networks, with its network column
  let desktopPickerWidth: number | undefined;
  if (useDesktopTokenSelector) {
    desktopPickerWidth = acrossNetworks
      ? EARN_PAY_WITH_PICKER_ACROSS_WIDTH
      : EARN_PAY_WITH_PICKER_SIZE.width;
  }

  return (
    <Page lazyLoad={!platformEnv.isNativeIOS} safeAreaEnabled={false}>
      <Page.Header
        // Named for what it picks, as the Deposit picker is (demo 10-29)
        title={EARN_DESKTOP_DEMO_COPY.payWith}
        // Swap's token column alone: the app's usual modal width. Over a
        // taller modal, its height (as on the route)
        modalContentMaxWidth={desktopPickerWidth}
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
            hideNetworkColumn={!acrossNetworks || !allNetwork}
            allNetwork={(acrossNetworks && allNetwork) || network}
            networks={acrossNetworks ? columnNetworks : NO_NETWORKS}
            selectedNetwork={
              acrossNetworks ? (selectedListNetwork ?? network) : network
            }
            assetNetworks={assetNetworks}
            disableNetworks={NO_NETWORK_IDS}
            networkSearchValue={networkSearch}
            tokenSearchValue={searchInput}
            tokenSearchPlaceholder={searchPlaceholder}
            allNetworksLabel={intl.formatMessage({
              id: ETranslations.global_all_networks,
            })}
            sameChainLabel=""
            onNetworkSearchChange={setNetworkSearch}
            onTokenSearchChange={setSearchInput}
            onSelectNetwork={acrossNetworks ? handleSelectNetwork : noop}
            onDisableNetworksClick={noop}
            onSelectToken={handleSelectToken}
            listViewRef={listViewRef}
            popularTokens={popularTokens}
            showPopularTokens={showPopularTokens}
            // The wallet's own list on every network: nothing to filter
            showLpTokenFilterSwitch={
              showLpTokenFilterSwitch && !isAllNetworksView
            }
            showLpTokensOnly={showLpTokensOnly}
            onLpTokenFilterChange={handleLpTokenFilterChange}
            tokens={isListShown ? displayTokens : NO_TOKENS}
            renderToken={renderItem}
            currencySymbol={settingsPersist.currencyInfo.symbol}
            tokenListEmptyComponent={
              isListShown ? tokenListEmptyComponent : <ListSkeleton />
            }
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
                  {selectedListNetwork?.name ?? network?.name}
                </SizableText>
              </XStack>
              {showLpTokenFilterSwitch && !isAllNetworksView ? (
                <TokenSelectorLpTokenSwitch
                  value={showLpTokensOnly}
                  onChange={handleLpTokenFilterChange}
                />
              ) : null}
            </XStack>
            {acrossNetworks && toggleNetworks.length ? (
              <NetworkToggleGroup
                networks={toggleNetworks}
                maxVisibleNetworks={PHONE_VISIBLE_NETWORKS}
                selectedNetwork={selectedListNetwork}
                onSelectNetwork={handleSelectNetwork}
                onMoreNetwork={handleMoreNetworks}
                testIDPrefix="earn-pay-with-network"
              />
            ) : null}
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
