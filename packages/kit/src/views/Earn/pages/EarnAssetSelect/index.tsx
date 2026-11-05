import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  ActionList,
  Icon,
  Input,
  Page,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
  useClipboard,
  useMedia,
} from '@onekeyhq/components';
import type { IScrollViewRef } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import NetworkToggleGroup from '@onekeyhq/kit/src/components/NetworkToggleGroup';
import type { INetworkToggleGroupItem } from '@onekeyhq/kit/src/components/NetworkToggleGroup';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { convertFiat } from '@onekeyhq/kit/src/utils/fiatConvert';
import useConfigurableChainSelector from '@onekeyhq/kit/src/views/ChainSelector/hooks/useChainSelector';
import { SwapTokenSelectorNetworkColumn } from '@onekeyhq/kit/src/views/Swap/components/SwapTokenSelectorDesktop';
import {
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { swapNetworksCommonCountMD } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

import { CategoryPills } from '../../components/desktopHome/EarnDesktopEarnTab';
import { EARN_DESKTOP_DEMO_COPY } from '../../components/desktopHome/earnDesktopHomeCopy';
import { buildKeyboardPressProps } from '../../components/desktopHome/earnDesktopPressable';

import { getEarnAssetClassLabel } from './earnAssetClassLabel';
import { EarnAssetKindLogos } from './EarnAssetLogos';
import {
  buildAssetSelectView,
  getAssetSelectOpening,
  isAddressKeyword,
  isSameAssetPick,
  listAssetSelectHeldNetworks,
  listAssetSelectNetworks,
  orderAssetSelectPhoneNetworks,
  splitClassMembers,
} from './earnAssetSelect.utils';
import { EARN_ASSET_SELECT_SIZE } from './earnAssetSelectSize';

import type {
  IEarnAssetPick,
  IEarnAssetSelectCategory,
  IEarnAssetSelectClassRow,
  IEarnAssetSelectNetwork,
  IEarnAssetSelectPurpose,
  IEarnAssetSelectToken,
} from './earnAssetSelect.utils';

// The rows sit where Swap's selector puts its own: inset from the column's
// edges, their content 20px in at either width
const ROW_INSET_WIDE = { mx: '$4', px: '$1' } as const;

const formatRate = (rate: number) => `${rate.toFixed(2)}%`;
// From the figures' right edge to the row's: the check, the menu, their gaps
const FIGURE_END_INSET = 20 + 24 + 12 * 2;
// The picked row, which the list opens on
const SELECTED_ROW_TEST_ID = 'earn-asset-select-picked';
// A token row's second line, which the figure's second line matches
const SECOND_LINE_HEIGHT = 20;

const ALL_NETWORKS_ID = getNetworkIdsMap().onekeyall;
const NO_NETWORK_IDS: string[] = [];
const noop = () => undefined;

const toColumnNetwork = (network: IEarnAssetSelectNetwork): ISwapNetwork => ({
  networkId: network.id,
  name: network.name,
  symbol: '',
  logoURI: network.logoURI,
});

// What the row's right side says: Earn's best rate, a loan's lowest, or what
// the wallet holds of a collateral. Under it, what the wallet holds in the
// currency; its line is kept where it holds none, so every figure sits on
// its symbol's line
function RowFigure({
  purpose,
  rate,
  balance,
  fiatValue,
  isKind,
}: {
  purpose: IEarnAssetSelectPurpose;
  rate?: number;
  balance?: string;
  fiatValue?: number;
  isKind?: boolean;
}) {
  const none = (text: string) => (
    <SizableText size="$bodyLgMedium" color="$textDisabled" numberOfLines={1}>
      {text}
    </SizableText>
  );
  let figure: ReactNode;
  if (purpose === 'loanSupply' && isKind) {
    // A kind's amounts don't add up across its tokens; their value does
    figure = fiatValue ? (
      <Currency
        hideValue
        size="$bodyLgMedium"
        formatter="value"
        sourceCurrency={USD_CURRENCY_ID}
        numberOfLines={1}
      >
        {String(fiatValue)}
      </Currency>
    ) : (
      none('0')
    );
  } else if (purpose === 'loanSupply') {
    figure = balance ? (
      <NumberSizeableTextWrapper
        hideValue
        size="$bodyLgMedium"
        formatter="balance"
        numberOfLines={1}
      >
        {balance}
      </NumberSizeableTextWrapper>
    ) : (
      none('0')
    );
  } else if (rate !== undefined) {
    figure = (
      <SizableText
        size="$bodyLgMedium"
        color={purpose === 'earn' ? '$textSuccess' : undefined}
        numberOfLines={1}
      >
        {formatRate(rate)}
      </SizableText>
    );
  } else {
    figure = none('--');
  }
  const showsHeld = Boolean(fiatValue) && !(purpose === 'loanSupply' && isKind);
  return (
    <YStack ai="flex-end" flexShrink={0}>
      {figure}
      {showsHeld ? (
        <Currency
          hideValue
          size="$bodyMd"
          color="$textSubdued"
          formatter="value"
          sourceCurrency={USD_CURRENCY_ID}
          numberOfLines={1}
        >
          {String(fiatValue)}
        </Currency>
      ) : (
        <Stack h={SECOND_LINE_HEIGHT} />
      )}
    </YStack>
  );
}

// The pick's check, its place kept on every row so the figures line up
function RowCheck({ isSelected }: { isSelected: boolean }) {
  return isSelected ? (
    <Icon
      name="CheckLargeOutline"
      size="$5"
      color="$iconSuccess"
      flexShrink={0}
    />
  ) : (
    <Stack w="$5" h="$5" flexShrink={0} />
  );
}

// Where the token is offered when that is more than one network: their logos
// after its name
function NetworkLogos({ token }: { token: IEarnAssetSelectToken }) {
  if (token.networks.length < 2) {
    return null;
  }
  const shown = token.networks.slice(0, 3);
  return (
    <XStack ai="center" gap="$1" flexShrink={0}>
      {shown.map((network) => (
        <Token key={network.id} size="xxs" tokenImageUri={network.logoURI} />
      ))}
      {token.networks.length > shown.length ? (
        <SizableText size="$bodySm" color="$textSubdued">
          {`+${token.networks.length - shown.length}`}
        </SizableText>
      ) : null}
    </XStack>
  );
}

// A row's menu place (its button's width), where the row has none
function MenuPlace() {
  return <Stack w="$6" flexShrink={0} />;
}

// Where the token has one contract to name: a network's own coin has none,
// a token across several networks has one on each
function TokenMenu({ token }: { token: IEarnAssetSelectToken }) {
  const intl = useIntl();
  const { copyText } = useClipboard();
  const contract =
    token.addresses.length === 1 && token.networks.length === 1
      ? token.addresses[0]
      : undefined;
  if (!contract) {
    return <MenuPlace />;
  }
  return (
    <Stack alignSelf="center">
      <ActionList
        title={token.symbol}
        renderTrigger={
          <ListItem.IconButton icon="DotVerSolid" variant="tertiary" />
        }
        items={[
          {
            icon: 'Copy3Outline',
            label: intl.formatMessage({
              id: ETranslations.global_copy_token_contract,
            }),
            onPress: () => copyText(contract.address),
          },
          {
            icon: 'OpenOutline',
            label: intl.formatMessage({
              id: ETranslations.swap_token_selector_contract_info,
            }),
            onPress: async () => {
              const url =
                await backgroundApiProxy.serviceExplorer.buildExplorerUrl({
                  networkId: contract.networkId,
                  type: 'token',
                  param: contract.address,
                });
              openUrlExternal(url);
            },
          },
        ]}
      />
    </Stack>
  );
}

function TokenRow({
  token,
  purpose,
  networkId,
  isSelected,
  isWide,
  matchedAddress,
  onPick,
}: {
  token: IEarnAssetSelectToken;
  purpose: IEarnAssetSelectPurpose;
  // The network chosen; unset, every network
  networkId?: string;
  isSelected: boolean;
  isWide: boolean;
  matchedAddress?: string;
  onPick: (pick: IEarnAssetPick) => void;
}) {
  const press = useCallback(
    () => onPick({ kind: 'token', symbol: token.symbol, networkId }),
    [networkId, onPick, token.symbol],
  );
  // On one network the logo carries its badge; across every network, none
  const network = networkId
    ? token.networks.find((item) => item.id === networkId)
    : undefined;
  return (
    <ListItem
      testID={
        isSelected
          ? SELECTED_ROW_TEST_ID
          : `earn-asset-select-token-${token.symbol}`
      }
      role="option"
      aria-selected={isSelected}
      userSelect="none"
      onPress={press}
      {...(isWide ? ROW_INSET_WIDE : undefined)}
      {...(isSelected ? { bg: '$bgHover' } : undefined)}
      {...buildKeyboardPressProps(press)}
    >
      <Token tokenImageUri={token.logoURI} networkImageUri={network?.logoURI} />
      <ListItem.Text
        flex={1}
        primary={token.symbol}
        primaryTextProps={{ numberOfLines: 1 }}
        secondary={
          <XStack ai="center" gap="$1.5" minWidth={0}>
            <SizableText
              size="$bodyMd"
              color="$textSubdued"
              numberOfLines={1}
              flexShrink={1}
            >
              {token.name}
            </SizableText>
            {matchedAddress ? (
              <SizableText size="$bodyMd" color="$textDisabled" flexShrink={0}>
                {accountUtils.shortenAddress({
                  address: matchedAddress,
                  leadingLength: 6,
                  trailingLength: 4,
                })}
              </SizableText>
            ) : null}
            {/* Across every network; with one chosen, the logo's badge says
                where */}
            {!matchedAddress && !networkId ? (
              <NetworkLogos token={token} />
            ) : null}
          </XStack>
        }
      />
      <RowFigure
        purpose={purpose}
        rate={token.rate}
        balance={token.balance}
        fiatValue={token.fiatValue}
      />
      <RowCheck isSelected={isSelected} />
      <TokenMenu token={token} />
    </ListItem>
  );
}

// A kind's tab's first row: the whole kind, its logos in one token logo's
// place; a pick compares every token of it
function ClassRow({
  row,
  purpose,
  networkId,
  isSelected,
  isWide,
  onPick,
}: {
  row: IEarnAssetSelectClassRow;
  purpose: IEarnAssetSelectPurpose;
  networkId?: string;
  isSelected: boolean;
  isWide: boolean;
  onPick: (pick: IEarnAssetPick) => void;
}) {
  const intl = useIntl();
  const press = useCallback(
    () => onPick({ kind: 'class', assetClass: row.assetClass, networkId }),
    [networkId, onPick, row.assetClass],
  );
  // A phone's line has room for one name and the count; with three, the
  // count was cut off ("U and 2...")
  const { shown, rest } = splitClassMembers(row.tokens, isWide ? 3 : 1);
  return (
    <ListItem
      testID={
        isSelected
          ? SELECTED_ROW_TEST_ID
          : `earn-asset-select-class-${row.assetClass}`
      }
      role="option"
      aria-selected={isSelected}
      userSelect="none"
      onPress={press}
      {...(isWide ? ROW_INSET_WIDE : undefined)}
      {...(isSelected ? { bg: '$bgHover' } : undefined)}
      {...buildKeyboardPressProps(press)}
    >
      <EarnAssetKindLogos logos={row.tokens.map((token) => token.logoURI)} />
      <ListItem.Text
        flex={1}
        primary={EARN_DESKTOP_DEMO_COPY.assetSelectAllOfKind(
          getEarnAssetClassLabel(intl, row.assetClass),
        )}
        primaryTextProps={{ numberOfLines: 1 }}
        secondary={EARN_DESKTOP_DEMO_COPY.classMembers(shown, rest)}
        secondaryTextProps={{ numberOfLines: 1 }}
      />
      <RowFigure
        purpose={purpose}
        rate={row.rate}
        fiatValue={row.fiatValue}
        isKind
      />
      <RowCheck isSelected={isSelected} />
      <MenuPlace />
    </ListItem>
  );
}

function SearchEmpty({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <YStack
      testID="earn-asset-select-empty"
      flex={1}
      ai="center"
      jc="center"
      px="$5"
      py="$16"
      gap="$2"
    >
      <Icon name="SearchOutline" size="$6" color="$iconSubdued" />
      <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
        {title}
      </SizableText>
      {description ? (
        <SizableText size="$bodySm" color="$textDisabled" textAlign="center">
          {description}
        </SizableText>
      ) : null}
    </YStack>
  );
}

function EarnRouterAssetSelectPage() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.EarnRouterAssetSelect
  >();
  const { purpose, title, tokens, selected, networks, modalHeight, onSelect } =
    route.params;
  const { gtMd } = useMedia();
  const isWide = Boolean((platformEnv.isDesktop || platformEnv.isWeb) && gtMd);
  const { getClipboard } = useClipboard();
  const openChainSelector = useConfigurableChainSelector();
  const [{ currencyInfo }] = useSettingsPersistAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();

  // The column's networks: those given, else every network the tokens are
  // on, the ones the wallet holds most on first
  const networkList = useMemo(
    () => (networks?.length ? networks : listAssetSelectNetworks(tokens)),
    [networks, tokens],
  );
  // Opened on the pick: its network, and a kind on its own tab
  const [opening] = useState(() =>
    getAssetSelectOpening({ selected, networks: networkList }),
  );
  const [networkId, setNetworkId] = useState(opening.networkId);
  const [category, setCategory] = useState<IEarnAssetSelectCategory>(
    opening.category,
  );
  const [keyword, setKeyword] = useState('');
  const [networkKeyword, setNetworkKeyword] = useState('');
  // The phone's row of networks shows one picked from the full list up front
  const [phoneLeadId, setPhoneLeadId] = useState(opening.networkId);

  const view = useMemo(
    () =>
      buildAssetSelectView({ tokens, purpose, networkId, category, keyword }),
    [category, keyword, networkId, purpose, tokens],
  );
  const network = networkList.find((item) => item.id === networkId);
  const isSearching = keyword.trim().length > 0;

  const handlePick = useCallback(
    (pick: IEarnAssetPick) => {
      navigation.popStack();
      onSelect(pick);
    },
    [navigation, onSelect],
  );
  const isPicked = (pick: IEarnAssetPick) =>
    Boolean(selected && isSameAssetPick(selected, pick));
  const handlePaste = useCallback(async () => {
    const text = await getClipboard();
    if (text) {
      setKeyword(text.trim());
    }
  }, [getClipboard]);
  const handleCategoryChange = useCallback(
    (value: IEarnAssetSelectCategory | 'fixedIncome') => {
      if (value !== 'fixedIncome') {
        setCategory(value);
      }
    },
    [],
  );

  // The network column, in Swap's own terms
  const allColumnNetwork = useMemo<ISwapNetwork>(
    () => ({
      networkId: ALL_NETWORKS_ID,
      name: EARN_DESKTOP_DEMO_COPY.allNetworks,
      symbol: '',
      isAllNetworks: true,
    }),
    [],
  );
  const columnNetworks = useMemo(
    () => networkList.map(toColumnNetwork),
    [networkList],
  );
  const heldNetworks = useMemo(
    () =>
      listAssetSelectHeldNetworks({ tokens, networks: networkList }).map(
        (item) => ({
          network: toColumnNetwork(item.network),
          fiatValue: convertFiat({
            value: item.fiatValue,
            sourceCurrency: USD_CURRENCY_ID,
            targetCurrency: currencyInfo.id,
            currencyMap,
          }),
        }),
      ),
    [currencyInfo.id, currencyMap, networkList, tokens],
  );
  const selectedColumnNetwork =
    columnNetworks.find((item) => item.networkId === networkId) ??
    allColumnNetwork;
  // As Swap labels it, with a comma for Swap's dot
  const allNetworksLabel = intl.formatMessage({
    id: ETranslations.global_all_networks,
  });

  // The phone's row: All Networks, then the networks, More at its end
  const phoneNetworks = useMemo<INetworkToggleGroupItem[]>(
    () => [
      {
        networkId: ALL_NETWORKS_ID,
        name: EARN_DESKTOP_DEMO_COPY.allNetworks,
        isAllNetworks: true,
      },
      ...orderAssetSelectPhoneNetworks(networkList, phoneLeadId).map(
        (item) => ({
          networkId: item.id,
          name: item.name,
          logoURI: item.logoURI,
        }),
      ),
    ],
    [networkList, phoneLeadId],
  );
  const handleMoreNetworks = useCallback(() => {
    openChainSelector({
      defaultNetworkId: networkId,
      networkIds: networkList.map((item) => item.id),
      grouped: false,
      onSelect: (picked) => {
        if (picked) {
          setPhoneLeadId(picked.id);
          setNetworkId(picked.id);
        }
      },
    });
  }, [networkId, networkList, openChainSelector]);

  const scrollRef = useRef<IScrollViewRef>(null);
  // The list opens on the pick, in the middle of the rows when it is far down.
  // The modal lays the rows out a frame after it mounts and takes its size
  // later still, so the pick is centred again every frame of the opening's
  // first second, until the list is scrolled by hand. Only the list scrolls:
  // scrollIntoView moved the modal too, and the pick ended up below it
  useEffect(() => {
    if (!platformEnv.isRuntimeBrowser) {
      return undefined;
    }
    let frame = 0;
    let setTop: number | undefined;
    const startedAt = Date.now();
    const scrollToPick = () => {
      const scrollable: unknown = scrollRef.current?.getScrollableNode();
      const node = document.querySelector<HTMLElement>(
        `[data-testid="${SELECTED_ROW_TEST_ID}"]`,
      );
      const rect = node?.getBoundingClientRect();
      if (scrollable instanceof HTMLElement && rect?.height) {
        if (
          setTop !== undefined &&
          Math.abs(scrollable.scrollTop - setTop) > 1
        ) {
          return;
        }
        const box = scrollable.getBoundingClientRect();
        scrollable.scrollTop +=
          rect.top - box.top - (scrollable.clientHeight - rect.height) / 2;
        setTop = scrollable.scrollTop;
      }
      if (Date.now() - startedAt < 1000) {
        frame = requestAnimationFrame(scrollToPick);
      }
    };
    frame = requestAnimationFrame(scrollToPick);
    return () => cancelAnimationFrame(frame);
  }, []);
  // Another network, tab or search starts the list at its top
  const viewKey = `${networkId ?? ''}|${view.category}|${keyword}`;
  const shownViewKeyRef = useRef(viewKey);
  useEffect(() => {
    if (shownViewKeyRef.current === viewKey) {
      return;
    }
    shownViewKeyRef.current = viewKey;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [viewKey]);

  const placeholder = intl.formatMessage({
    id: ETranslations.token_selector_search_placeholder,
  });
  const listLabel = intl.formatMessage(
    { id: ETranslations.title_tokens_on_network },
    { network: network?.name ?? EARN_DESKTOP_DEMO_COPY.allNetworks },
  );
  let figureLabel = intl.formatMessage({ id: ETranslations.global_apy });
  if (purpose === 'loanSupply') {
    figureLabel = intl.formatMessage({
      id: ETranslations.global_wallet_balance,
    });
  } else if (purpose === 'loanBorrow') {
    figureLabel = intl.formatMessage({ id: ETranslations.defi_borrow_apy });
  }

  let emptyDescription: string | undefined;
  if (isSearching) {
    emptyDescription = intl.formatMessage({
      id: ETranslations.description_check_spelling_or_paste_contract_address,
    });
  }
  if (isAddressKeyword(keyword)) {
    if (purpose !== 'earn') {
      emptyDescription = EARN_DESKTOP_DEMO_COPY.assetSelectNoLoan;
    } else if (network) {
      emptyDescription = EARN_DESKTOP_DEMO_COPY.assetSelectNoEarn(network.name);
    } else {
      emptyDescription = EARN_DESKTOP_DEMO_COPY.assetSelectNoEarnAnywhere;
    }
  }

  const list: ReactNode = view.rows.length ? (
    view.rows.map((item) =>
      item.type === 'class' ? (
        <ClassRow
          key={`class-${item.row.assetClass}`}
          row={item.row}
          purpose={purpose}
          networkId={networkId}
          isSelected={isPicked({
            kind: 'class',
            assetClass: item.row.assetClass,
            networkId,
          })}
          isWide={isWide}
          onPick={handlePick}
        />
      ) : (
        <TokenRow
          key={`token-${item.token.symbol}`}
          token={item.token}
          purpose={purpose}
          networkId={networkId}
          isSelected={isPicked({
            kind: 'token',
            symbol: item.token.symbol,
            networkId,
          })}
          isWide={isWide}
          matchedAddress={item.matchedAddress}
          onPick={handlePick}
        />
      ),
    )
  ) : (
    <SearchEmpty
      title={intl.formatMessage({ id: ETranslations.empty_no_tokens_found })}
      description={emptyDescription}
    />
  );

  const pills =
    view.categories.length > 1 ? (
      <XStack px="$5" pb="$1" testID="earn-asset-select-categories">
        <CategoryPills
          categories={view.categories}
          value={view.category}
          onChange={handleCategoryChange}
        />
      </XStack>
    ) : null;
  // The list's name, and what the figure on each row's right is
  const listHeader = (
    <XStack h={38} ai="center" jc="space-between" gap="$3" pl="$5" pr="$5">
      <SizableText
        size={isWide ? '$bodyMdMedium' : '$bodyMd'}
        color="$textSubdued"
        numberOfLines={1}
        flexShrink={1}
      >
        {listLabel}
      </SizableText>
      <SizableText
        size={isWide ? '$bodyMdMedium' : '$bodyMd'}
        color="$textSubdued"
        flexShrink={0}
        // Over the figures: they end before the check's place and the
        // menu's (20 + 24, with a 12 gap before each)
        pr={FIGURE_END_INSET}
      >
        {figureLabel}
      </SizableText>
    </XStack>
  );
  const rows = (
    <ScrollView
      ref={scrollRef}
      flex={1}
      contentContainerStyle={{ paddingBottom: 12 }}
    >
      {list}
    </ScrollView>
  );

  return (
    <Page lazyLoad={!platformEnv.isNativeIOS} safeAreaEnabled={false}>
      <Page.Header
        title={title}
        // Swap's token selector's size, and over a taller modal its height
        modalContentMaxWidth={isWide ? EARN_ASSET_SELECT_SIZE.width : undefined}
        modalContentMaxHeight={
          isWide ? (modalHeight ?? EARN_ASSET_SELECT_SIZE.height) : undefined
        }
        {...(!isWide
          ? {
              headerSearchBarOptions: {
                placeholder,
                onChangeText: ({ nativeEvent }) => {
                  setKeyword(nativeEvent.text);
                },
                searchBarInputValue: keyword,
                ...(keyword.length === 0 && !platformEnv.isExtension
                  ? {
                      addOns: [
                        {
                          iconName: 'ClipboardOutline' as const,
                          onPress: () => void handlePaste(),
                        },
                      ],
                    }
                  : {}),
              },
            }
          : {})}
      />
      <Page.Body>
        {isWide ? (
          <XStack flex={1} minHeight={0} testID="earn-asset-select">
            <SwapTokenSelectorNetworkColumn
              allNetwork={allColumnNetwork}
              networks={columnNetworks}
              selectedNetwork={selectedColumnNetwork}
              assetNetworks={heldNetworks}
              disableNetworks={NO_NETWORK_IDS}
              networkSearchValue={networkKeyword}
              allNetworksLabel={allNetworksLabel}
              sameChainLabel=""
              allSectionLabel={`${allNetworksLabel}, A–Z`}
              searchTestID="earn-asset-select-network-search"
              rowTestIDPrefix="earn-asset-select-network"
              onNetworkSearchChange={setNetworkKeyword}
              onSelectNetwork={(item) =>
                setNetworkId(item.isAllNetworks ? undefined : item.networkId)
              }
              onDisableNetworksClick={noop}
              currencySymbol={currencyInfo.symbol}
            />
            <YStack flex={1} minWidth={0} minHeight={0}>
              <YStack px="$4" pt="$3" pb="$2">
                <Input
                  testID="earn-asset-select-search"
                  size="medium"
                  height={38}
                  pl={34}
                  containerProps={{
                    height: 38,
                    bg: '$bgStrong',
                    borderWidth: 0,
                    borderRadius: '$3',
                  }}
                  leftIconName="SearchOutline"
                  allowPaste={keyword.length === 0}
                  allowClear
                  autoFocus
                  value={keyword}
                  placeholder={placeholder}
                  onChangeText={setKeyword}
                />
              </YStack>
              {pills}
              {listHeader}
              {rows}
            </YStack>
          </XStack>
        ) : (
          <YStack flex={1} minHeight={0} testID="earn-asset-select">
            <NetworkToggleGroup
              networks={phoneNetworks}
              maxVisibleNetworks={swapNetworksCommonCountMD}
              selectedNetwork={phoneNetworks.find(
                (item) => item.networkId === (networkId ?? ALL_NETWORKS_ID),
              )}
              onSelectNetwork={(item) =>
                setNetworkId(item.isAllNetworks ? undefined : item.networkId)
              }
              onMoreNetwork={handleMoreNetworks}
              testIDPrefix="earn-asset-select-network"
            />
            {pills}
            {listHeader}
            {rows}
          </YStack>
        )}
      </Page.Body>
    </Page>
  );
}

export default EarnRouterAssetSelectPage;
