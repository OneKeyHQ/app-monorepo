import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { CSSProperties } from 'react';

import { useIntl } from 'react-intl';
import { useReducedMotion } from 'react-native-reanimated';

import {
  Button,
  Icon,
  IconButton,
  Popover,
  SearchBar,
  Select,
  SizableText,
  Skeleton,
  Stack,
  Tooltip,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { ISelectItem } from '@onekeyhq/components';
import { preloadImages } from '@onekeyhq/components/src/primitives/Image/preload';
import { s } from '@onekeyhq/components/src/utils/scale';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { preloadModalNavigator } from '@onekeyhq/kit/src/routes/Modal/lazyModalNavigator';
import { getTokenImagePrewarmSource } from '@onekeyhq/kit/src/utils/tokenImagePrewarm';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';

import { preloadEarnLoanRouter } from '../../../Staking/router';
import { EarnNavigation } from '../../earnUtils';
import { EARN_ASSET_CLASS_ORDER } from '../../pages/EarnAssetSelect/earnAssetSelect.utils';
import { EarnListEmptyState } from '../EarnListEmptyState';
import { NetworkFilterControl } from '../NetworkFilterControl';

import { ANIMATE_ONLY_BG_COLOR } from './earnDesktopColorEase';
import {
  EARN_DESKTOP_LOAN_LTV,
  LOAN_SORT_BEST_FIRST,
  buildLoanPairs,
  collectWalletTokenKeys,
  pickWalletLoanPairs,
  sortLoanPairs,
} from './earnDesktopHome.utils';
import { EARN_DESKTOP_DEMO_COPY } from './earnDesktopHomeCopy';
import { EarnDesktopPillScroller } from './EarnDesktopPillScroller';
import { buildKeyboardPressProps } from './earnDesktopPressable';
import { EarnDesktopSortLabel } from './EarnDesktopSortLabel';
import { EarnDesktopYourLoans } from './EarnDesktopYourLoans';
import { useStableItems } from './useContentStable';

import type {
  IEarnDesktopLoanAssetType,
  IEarnDesktopLoanPair,
  IEarnDesktopLoanSort,
  IEarnDesktopMarketReserves,
  IEarnDesktopWalletNetworkGroup,
} from './earnDesktopHome.utils';
import type { IEarnDesktopYourLoansProps } from './EarnDesktopYourLoans';

// Laid out as the Earn tab's table: one set of columns for the labels and the
// rows, its row height and its gap between columns
const ROW_GAP = '$3';
const ROW_HEIGHT = 56;
const PAGE_SIZE = 20;
const column = (
  flex: number,
  align: 'flex-start' | 'flex-end' = 'flex-start',
  minWidth = 0,
) =>
  ({
    flexGrow: flex,
    flexShrink: 1,
    flexBasis: 0,
    minWidth,
    ai: align,
  }) as const;
// A wide row ends with its Borrow button, as wide as the Earn table's last
// column, so the two tabs end their rates at one edge
const ACTION_COLUMN_WIDTH = 80;
const stopPropagation = (event: { stopPropagation: () => void }) =>
  event.stopPropagation();
const COLUMNS = {
  collateral: column(2),
  borrow: column(1.8),
  market: column(2.2),
  supply: column(1.2, 'flex-end'),
  borrowApy: column(1.2, 'flex-end'),
  // Wide enough for its label, the info button and "Net APY (50% LTV)" with
  // its sort chevron, so the label doesn't run into Borrow APY's
  net: column(1.3, 'flex-end', 168),
};
const SEARCH_BAR_CONTAINER_PROPS = {
  w: 220,
  borderRadius: '$full' as const,
  bg: '$bgStrong' as const,
  borderColor: '$transparent' as const,
  overflow: 'hidden' as const,
};
// At a phone's width the network filter is a pill like Collateral and Borrow,
// on the page's edge, with their fill and the lighter one while networks are
// picked (wider, it is the network pill beside the search)
const NETWORK_TRIGGER_PROPS = {
  pl: '$3',
  pr: '$2',
  py: '$1.5',
  borderRadius: '$full',
  pressStyle: { bg: '$bgActive' },
} as const;
// Beside the network pill at a phone's width, the search takes the rest of
// the row, so a longer pill label doesn't move its far edge
const NARROW_SEARCH_BAR_CONTAINER_PROPS = {
  flex: 1,
  borderRadius: '$full' as const,
  bg: '$bgStrong' as const,
  borderColor: '$transparent' as const,
  overflow: 'hidden' as const,
};
// Hovers ease their color over the app's quick fade; under reduced motion
// the color changes at once
const HOVER_MOTION = {
  transition: 'quick',
  animateOnly: ANIMATE_ONLY_BG_COLOR,
} as const;

type IAssetFilter = 'all' | 'wallet' | IEarnDesktopLoanAssetType;

// The kinds in the order the Earn tab and every picker show them
const ASSET_TYPE_ORDER = EARN_ASSET_CLASS_ORDER;

function useAssetTypeLabel() {
  const intl = useIntl();
  return useCallback(
    (type: IAssetFilter) => {
      switch (type) {
        case 'all':
          return intl.formatMessage({ id: ETranslations.global_all });
        case 'wallet':
          return EARN_DESKTOP_DEMO_COPY.inYourWallet;
        case 'stable':
          return intl.formatMessage({
            id: ETranslations.earn_stable_tokens__action,
          });
        case 'other':
          return intl.formatMessage({ id: ETranslations.global_others });
        default:
          return type.toUpperCase();
      }
    },
    [intl],
  );
}

/**
 * A pill like the Earn tab's categories that opens a list: the side it filters
 * in the labels' gray, then the pick. Anything but All reads as on
 */
function AssetFilter({
  testID,
  label,
  value,
  options,
  onChange,
}: {
  testID: string;
  label: string;
  value: IAssetFilter;
  options: IAssetFilter[];
  onChange: (value: IAssetFilter) => void;
}) {
  const getLabel = useAssetTypeLabel();
  const reduceMotion = useReducedMotion();
  // Held here so Enter and Space open the list too; a click goes through the
  // Select's own trigger
  const [isOpen, setIsOpen] = useState(false);
  const items = useMemo<ISelectItem[]>(
    () => options.map((option) => ({ label: getLabel(option), value: option })),
    [getLabel, options],
  );
  const isOn = value !== 'all';
  return (
    // Select hands its trigger stacks of its own; left alone they stretch
    <YStack alignSelf="flex-start">
      <Select
        testID={testID}
        title={label}
        items={items}
        value={value}
        onChange={onChange}
        open={isOpen}
        onOpenChange={setIsOpen}
        placement="bottom-start"
        floatingPanelProps={{ width: 220 }}
        renderTrigger={({ onPress }) => (
          <XStack
            role="button"
            ai="center"
            gap="$1.5"
            pl="$3"
            pr="$2"
            py="$1.5"
            bg={isOn ? '$bgActive' : '$bgSubdued'}
            borderRadius="$full"
            cursor="pointer"
            userSelect="none"
            hoverStyle={isOn ? undefined : { bg: '$bgHover' }}
            pressStyle={{ bg: '$bgActive' }}
            {...(reduceMotion ? undefined : HOVER_MOTION)}
            onPress={onPress}
            {...buildKeyboardPressProps(() => setIsOpen(true), 2)}
          >
            <SizableText size="$bodyMd" color="$textSubdued">
              {label}
            </SizableText>
            <SizableText size="$bodyMdMedium">{getLabel(value)}</SizableText>
            <Icon
              name="ChevronDownSmallOutline"
              size="$4"
              color="$iconSubdued"
            />
          </XStack>
        )}
      />
    </YStack>
  );
}

function HeaderLabel({ children }: { children: string }) {
  return (
    <SizableText size="$bodySmMedium" color="$textSubdued" numberOfLines={1}>
      {children}
    </SizableText>
  );
}

// Pointed at, the (i) shows what Net APY means, under the header so the
// search field above stays clear; a tap opens the same
function NetApyInfo() {
  const intl = useIntl();
  const title = intl.formatMessage({ id: ETranslations.defi_net_apy });
  return (
    <Popover
      hoverable
      placement="bottom-end"
      title={title}
      renderTrigger={
        <IconButton
          testID="earn-desktop-loans-net-apy-info"
          aria-label={intl.formatMessage({ id: ETranslations.global_info })}
          icon="InfoCircleOutline"
          size="small"
          variant="tertiary"
        />
      }
      renderContent={
        <SizableText px="$pagePadding" py="$4">
          {EARN_DESKTOP_DEMO_COPY.loanNetApyInfo(
            `${EARN_DESKTOP_LOAN_LTV * 100}%`,
          )}
        </SizableText>
      }
    />
  );
}

const formatRate = (value: number) => `${value.toFixed(2)}%`;

// Red when the loan costs more than the collateral earns. A gain stays in the
// text color: in a list of loans, green read as borrowing to earn more
function NetApyText({
  value,
  size = '$bodyLgMedium',
}: {
  value: number;
  size?: '$bodyLgMedium' | '$bodyMdMedium';
}) {
  const rounded = Number(value.toFixed(2));
  const color = rounded < 0 ? '$textCritical' : '$text';
  return (
    <SizableText size={size} color={color} numberOfLines={1}>
      {`${rounded > 0 ? '+' : ''}${formatRate(rounded)}`}
    </SizableText>
  );
}

// Each logo of the pair icon, and the gap cut around the front one
const PAIR_LOGO = 32;
const PAIR_GAP = 2;

// A see-through circle in the masked element; the soft pixel at its edge
// matches the logos' anti-aliased edges
function getWebHole(x: number, y: number, radius: number): CSSProperties {
  const image = `radial-gradient(circle at ${x}px ${y}px, transparent ${
    radius - 0.5
  }px, #000 ${radius + 0.5}px)`;
  return { WebkitMaskImage: image, maskImage: image };
}

/**
 * The pair for a row too narrow for both columns, as the Pools list stacks a
 * pool's tokens: both logos whole, the collateral in front and the loan behind
 * it, sharing a third. Web cuts the gap out of the back logo, so a hovered row
 * shows through it; native has no hover and paints it the page's color
 */
function PairIcons({ pair }: { pair: IEarnDesktopLoanPair }) {
  const logo = s(PAIR_LOGO);
  const gap = s(PAIR_GAP);
  const backLeft = logo - Math.round(logo / 3);
  const isNative = platformEnv.isNative;
  return (
    <Stack w={backLeft + logo} h={logo} flexShrink={0}>
      <Stack
        position="absolute"
        left={backLeft}
        top={0}
        w={logo}
        h={logo}
        borderRadius="$full"
        overflow="hidden"
        style={
          isNative
            ? undefined
            : getWebHole(logo / 2 - backLeft, logo / 2, logo / 2 + gap)
        }
      >
        <Token size="md" tokenImageUri={pair.borrow.logoURI} />
        {isNative ? (
          <Stack
            position="absolute"
            left={-backLeft - gap}
            top={-gap}
            w={logo + gap * 2}
            h={logo + gap * 2}
            borderRadius="$full"
            bg="$bgApp"
          />
        ) : null}
      </Stack>
      <Stack position="absolute" left={0} top={0}>
        <Token size="md" tokenImageUri={pair.collateral.logoURI} />
      </Stack>
    </Stack>
  );
}

// The Loans router's modal and the navigator it opens in, loaded as a row is
// pointed at, so its first open doesn't wait for them. A failure is left to
// the open, which loads them again
function warmLoanRouter() {
  preloadModalNavigator().catch(() => undefined);
  preloadEarnLoanRouter().catch(() => undefined);
}

function BasicPairRow({
  pair,
  isWide,
  onOpenPair,
}: {
  pair: IEarnDesktopLoanPair;
  isWide: boolean;
  onOpenPair: (pair: IEarnDesktopLoanPair) => void;
}) {
  const intl = useIntl();
  const reduceMotion = useReducedMotion();
  const [isHovered, setIsHovered] = useState(false);
  const { collateral, borrow, market } = pair;
  const onPress = () => onOpenPair(pair);
  const moreCount = pair.moreCollateral.length;
  return (
    <ListItem
      testID={`earn-desktop-loan-${pair.key}`}
      role="button"
      minHeight={ROW_HEIGHT}
      gap={ROW_GAP}
      userSelect="none"
      onPress={onPress}
      onHoverIn={() => {
        setIsHovered(true);
        warmLoanRouter();
      }}
      onHoverOut={() => setIsHovered(false)}
      {...(reduceMotion ? undefined : HOVER_MOTION)}
      {...buildKeyboardPressProps(onPress)}
    >
      {isWide ? (
        <>
          <XStack {...COLUMNS.collateral} ai="center" gap="$3">
            <Token size="md" tokenImageUri={collateral.logoURI} />
            <XStack ai="center" gap="$1.5" flexShrink={1} minWidth={0}>
              <SizableText
                size="$bodyLgMedium"
                numberOfLines={1}
                flexShrink={1}
              >
                {collateral.symbol}
              </SizableText>
              {/* The other forms of the asset the row stands for, named on
                  hover */}
              {moreCount > 0 ? (
                <Tooltip
                  placement="top"
                  renderTrigger={
                    <SizableText
                      size="$bodyMd"
                      color="$textSubdued"
                      flexShrink={0}
                    >
                      {`+${moreCount}`}
                    </SizableText>
                  }
                  renderContent={pair.moreCollateral
                    .map((token) => token.symbol)
                    .join(', ')}
                />
              ) : null}
            </XStack>
          </XStack>
          <XStack {...COLUMNS.borrow} ai="center" gap="$3">
            <Token size="md" tokenImageUri={borrow.logoURI} />
            <SizableText size="$bodyLgMedium" numberOfLines={1} flexShrink={1}>
              {borrow.symbol}
            </SizableText>
          </XStack>
          <XStack {...COLUMNS.market} ai="center" gap="$3">
            <Token size="md" tokenImageUri={market.logoURI} />
            <YStack flex={1} minWidth={0}>
              <SizableText size="$bodyMdMedium" numberOfLines={1}>
                {pair.marketLabel}
              </SizableText>
              <SizableText
                size="$bodySm"
                color="$textSubdued"
                numberOfLines={1}
              >
                {market.network?.name}
              </SizableText>
            </YStack>
          </XStack>
          {/* The parts of Net APY in the body's weight, the sum stands out */}
          <Stack {...COLUMNS.supply}>
            <SizableText size="$bodyMd" numberOfLines={1}>
              {formatRate(collateral.apy)}
            </SizableText>
          </Stack>
          <Stack {...COLUMNS.borrowApy}>
            <SizableText size="$bodyMd" numberOfLines={1}>
              {formatRate(borrow.apy)}
            </SizableText>
          </Stack>
        </>
      ) : (
        <XStack flex={1} minWidth={0} ai="center" gap="$3">
          <PairIcons pair={pair} />
          <YStack flex={1} minWidth={0}>
            <SizableText size="$bodyLgMedium" numberOfLines={1}>
              {`${collateral.symbol} / ${borrow.symbol}`}
            </SizableText>
            <XStack ai="center" gap="$1" minWidth={0}>
              <NetworkAvatar networkId={market.networkId} size="$3.5" />
              <SizableText
                size="$bodySm"
                color="$textSubdued"
                numberOfLines={1}
                flexShrink={1}
              >
                {pair.marketLabel}
              </SizableText>
            </XStack>
          </YStack>
        </XStack>
      )}
      <Stack {...(isWide ? COLUMNS.net : { flexShrink: 0, ai: 'flex-end' })}>
        <NetApyText value={pair.netApy} />
      </Stack>
      {/* The row opens a window, not a page: a wide row says what it does,
          as Earn's options do (demo 10-30). The phone keeps its row */}
      {isWide ? (
        <XStack w={ACTION_COLUMN_WIDTH} flexShrink={0} jc="flex-end">
          <Button
            testID={`earn-desktop-loan-borrow-${pair.key}`}
            size="small"
            variant="secondary"
            // The row is the Tab stop with the same action: one stop a
            // row, not two
            tabIndex={-1}
            transition={reduceMotion ? undefined : 'quick'}
            animateOnly={ANIMATE_ONLY_BG_COLOR}
            // Button stops the press at itself, so the window doesn't open
            // twice. Stopping the press-in keeps the row at its hover color
            // while the button is held
            onPressIn={stopPropagation}
            onPress={onPress}
          >
            {intl.formatMessage({ id: ETranslations.global_borrow })}
          </Button>
        </XStack>
      ) : (
        <Icon
          name="ChevronRightSmallOutline"
          size="$5"
          color={isHovered ? '$icon' : '$iconSubdued'}
          flexShrink={0}
        />
      )}
    </ListItem>
  );
}

// The tab re-renders when the page loses or regains focus (a modal opening
// or closing); the rows keep their render unless their pair changed
const PairRow = memo(BasicPairRow);
// The phone home's Loans section shows the same rows
export const EarnDesktopLoanPairRow = PairRow;
// And the wide home's Loans card, the pair and its rate
export const EarnDesktopLoanPairIcons = PairIcons;
export const EarnDesktopLoanNetApy = NetApyText;
export const warmEarnLoanRouter = warmLoanRouter;

const getPairKey = (pair: IEarnDesktopLoanPair) => pair.key;

/**
 * A Loans row: the pair in the Loans router, on the row's market. The modal
 * opens wide where the window holds the markets beside the form
 */
export function useEarnDesktopOpenLoanPair() {
  const navigation = useAppNavigation();
  const media = useMedia();
  const isWide = media.gtLg;
  return useCallback(
    (pair: IEarnDesktopLoanPair) => {
      EarnNavigation.pushToEarnLoanRouter(navigation, {
        collateral: pair.collateral.symbol,
        borrow: pair.borrow.symbol,
        routeKey: pair.key,
        wide: isWide,
      });
    },
    [isWide, navigation],
  );
}

/**
 * Every borrow-against-collateral pair the markets offer. A pair's borrow
 * side counts as stable once the stable token list is in; until then the
 * pairs are not ready to filter by it
 */
export function useEarnDesktopLoanPairs(markets: IEarnDesktopMarketReserves[]) {
  const { result: stableAssets } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceStaking.getAvailableAssets({
        type: EAvailableAssetsTypeEnum.StableCoins,
      }),
    [],
    { undefinedResultIfError: true },
  );
  const stableSymbols = useMemo(
    () =>
      new Set((stableAssets ?? []).map((asset) => asset.symbol.toUpperCase())),
    [stableAssets],
  );
  const builtPairs = useMemo(
    () => buildLoanPairs({ markets, stableSymbols }),
    [markets, stableSymbols],
  );
  // A market poll rebuilds every pair; the unchanged ones keep their object
  // and their memoized row
  const pairs = useStableItems(builtPairs, getPairKey);
  return { pairs, isStableListIn: stableAssets !== undefined };
}

function MoreRows({ count, onPress }: { count: number; onPress: () => void }) {
  // Subdued until hovered, as the holdings card's "N more"
  const [isHovered, setIsHovered] = useState(false);
  return (
    <XStack
      testID="earn-desktop-loans-more"
      role="button"
      alignSelf="flex-start"
      ai="center"
      gap="$0.5"
      h={44}
      mx="$5"
      cursor="pointer"
      userSelect="none"
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      onPress={onPress}
      {...buildKeyboardPressProps(onPress, 2)}
    >
      <SizableText
        size="$bodyMdMedium"
        color={isHovered ? '$text' : '$textSubdued'}
      >
        {EARN_DESKTOP_DEMO_COPY.showMore(count)}
      </SizableText>
      <Icon
        name="ChevronDownSmallOutline"
        size="$4"
        color={isHovered ? '$icon' : '$iconSubdued'}
      />
    </XStack>
  );
}

/**
 * Loans as ways to borrow: a row per collateral and asset to borrow in one
 * market, with what the collateral earns, what the loan costs and the two
 * together. The filters ask what to put up and what to borrow, a Borrow
 * Router's first questions. A row opens its market.
 */
function BasicEarnDesktopBorrowTab({
  markets,
  isLoaded,
  isActive,
  walletNetworkGroups,
  onOpenPair,
  yourLoans,
}: {
  markets: IEarnDesktopMarketReserves[];
  isLoaded: boolean;
  /** The tab is in view; it mounts hidden as it's pointed at */
  isActive: boolean;
  walletNetworkGroups: IEarnDesktopWalletNetworkGroup[];
  // A row opens the Loans router on its pair, on the market it shows
  onOpenPair: (pair: IEarnDesktopLoanPair) => void;
  /** The account's loans, shown over the list; each opens its market's page */
  yourLoans: IEarnDesktopYourLoansProps;
}) {
  const intl = useIntl();
  const media = useMedia();
  const reduceMotion = useReducedMotion();
  const isWide = media.gtMd;

  const { pairs } = useEarnDesktopLoanPairs(markets);
  const walletTokenKeys = useMemo(
    () => collectWalletTokenKeys(walletNetworkGroups),
    [walletNetworkGroups],
  );
  const walletPairs = useMemo(
    () => pickWalletLoanPairs(pairs, walletTokenKeys),
    [pairs, walletTokenKeys],
  );

  // Until one is picked: every collateral, and stable tokens to borrow, the
  // loan most take. "In your wallet" is one pick away
  const [pickedCollateral, setPickedCollateral] = useState<IAssetFilter>();
  const [pickedBorrow, setPickedBorrow] = useState<IAssetFilter>();
  const collateralFilter = pickedCollateral ?? 'all';
  const borrowFilter = pickedBorrow ?? 'stable';
  const [selectedNetworkIds, setSelectedNetworkIds] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  const [sort, setSort] = useState<{
    key: IEarnDesktopLoanSort;
    direction: 'asc' | 'desc';
  }>({ key: 'net', direction: LOAN_SORT_BEST_FIRST.net });
  const [shownCount, setShownCount] = useState(PAGE_SIZE);

  // Each list offers the groups its side has, in one order
  const collateralOptions = useMemo<IAssetFilter[]>(() => {
    const types = new Set(pairs.map((pair) => pair.collateral.type));
    return [
      'all',
      ...(walletPairs.length ? (['wallet'] as const) : []),
      ...ASSET_TYPE_ORDER.filter((type) => types.has(type)),
    ];
  }, [pairs, walletPairs.length]);
  const borrowOptions = useMemo<IAssetFilter[]>(() => {
    const types = new Set(pairs.map((pair) => pair.borrow.type));
    return ['all', ...ASSET_TYPE_ORDER.filter((type) => types.has(type))];
  }, [pairs]);

  const typedPairs = useMemo(() => {
    const base = collateralFilter === 'wallet' ? walletPairs : pairs;
    return base.filter(
      (pair) =>
        (collateralFilter === 'all' ||
          collateralFilter === 'wallet' ||
          pair.collateral.type === collateralFilter) &&
        (borrowFilter === 'all' || pair.borrow.type === borrowFilter),
    );
  }, [borrowFilter, collateralFilter, pairs, walletPairs]);

  const { availableNetworkIds, networkPairCounts } = useMemo(() => {
    const counts: Record<string, number> = {};
    typedPairs.forEach((pair) => {
      counts[pair.market.networkId] = (counts[pair.market.networkId] ?? 0) + 1;
    });
    return {
      availableNetworkIds: Object.keys(counts),
      networkPairCounts: counts,
    };
  }, [typedPairs]);

  const rows = useMemo(() => {
    const selected = new Set(selectedNetworkIds);
    const keyword = searchText.trim().toLowerCase();
    const matches = typedPairs.filter((pair) => {
      if (selected.size > 0 && !selected.has(pair.market.networkId)) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      return [
        pair.collateral.symbol,
        ...pair.moreCollateral.map((token) => token.symbol),
        pair.borrow.symbol,
        pair.marketLabel,
      ].some((text) => text.toLowerCase().includes(keyword));
    });
    return sortLoanPairs(matches, sort.key, sort.direction);
  }, [searchText, selectedNetworkIds, sort, typedPairs]);

  // A new filter or order starts from the top page again
  const resetPage = () => setShownCount(PAGE_SIZE);
  const handleSort = (key: IEarnDesktopLoanSort) => {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'desc' ? 'asc' : 'desc' }
        : { key, direction: LOAN_SORT_BEST_FIRST[key] },
    );
    resetPage();
  };

  const isFiltered = Boolean(
    searchText.trim() ||
    selectedNetworkIds.length ||
    collateralFilter !== 'all' ||
    borrowFilter !== 'all',
  );
  // The pickers, not the search: a miss under "In your wallet", which the
  // list may have set itself, gets a way back to every pair
  const hasPickedFilters =
    collateralFilter !== 'all' ||
    borrowFilter !== 'all' ||
    selectedNetworkIds.length > 0;
  const handleResetFilters = () => {
    setPickedCollateral('all');
    setPickedBorrow('all');
    setSelectedNetworkIds([]);
    resetPage();
  };
  const isLoading = !isLoaded && !pairs.length;
  const shown = rows.slice(0, shownCount);
  const moreCount = Math.min(PAGE_SIZE, rows.length - shown.length);

  // Mounted hidden as it's pointed at, the tab reads its rows' logos first
  // and builds the rows once they're in: a logo never shown waits for the
  // page to scroll it into view, unless it was read ahead, and then paints in
  // its first frame. Chosen before the logos are in, it shows the rows at
  // once and builds them again as the logos land, early in its fade-in
  const [areLogosWarm, setAreLogosWarm] = useState(false);
  const shownLogosKey = Array.from(
    new Set(
      shown.flatMap((pair) => [
        pair.collateral.logoURI,
        pair.borrow.logoURI,
        pair.market.logoURI,
      ]),
    ),
  )
    .filter(Boolean)
    .join('\n');
  useEffect(() => {
    if (areLogosWarm || !shownLogosKey) {
      return undefined;
    }
    let isCancelled = false;
    void preloadImages(
      shownLogosKey
        .split('\n')
        .map((uri) => getTokenImagePrewarmSource({ uri })),
    ).finally(() => {
      if (!isCancelled) {
        setAreLogosWarm(true);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [areLogosWarm, shownLogosKey]);
  const collateralLabel = intl.formatMessage({
    id: ETranslations.defi_collateral,
  });
  const borrowLabel = intl.formatMessage({ id: ETranslations.global_borrow });
  const supplyApyLabel = intl.formatMessage({
    id: ETranslations.defi_supply_apy,
  });
  const borrowApyLabel = intl.formatMessage({
    id: ETranslations.defi_borrow_apy,
  });
  // The loan every row is worked out for, named where the rate is
  const netApyLabel = EARN_DESKTOP_DEMO_COPY.loanNetApyHeader(
    `${EARN_DESKTOP_LOAN_LTV * 100}%`,
  );

  let list = null;
  if (isLoading || (!isActive && !areLogosWarm)) {
    list = Array.from({ length: 6 }).map((_, index) => (
      <ListItem key={index} minHeight={ROW_HEIGHT} gap={ROW_GAP}>
        <XStack flex={1} ai="center" gap="$3">
          <Skeleton w="$8" h="$8" radius="round" />
          <Skeleton w={120} h={18} borderRadius="$2" />
        </XStack>
        <Skeleton w={72} h={18} borderRadius="$2" />
      </ListItem>
    ));
  } else {
    list = (
      <Fragment key={areLogosWarm ? 'warm' : 'cold'}>
        {shown.map((pair) => (
          <PairRow
            key={pair.key}
            pair={pair}
            isWide={isWide}
            onOpenPair={onOpenPair}
          />
        ))}
      </Fragment>
    );
  }

  const assetFilters = (
    <>
      <AssetFilter
        testID="earn-desktop-loans-collateral"
        label={collateralLabel}
        value={collateralFilter}
        options={collateralOptions}
        onChange={(value) => {
          setPickedCollateral(value);
          resetPage();
        }}
      />
      <AssetFilter
        testID="earn-desktop-loans-borrow"
        label={borrowLabel}
        value={borrowFilter}
        options={borrowOptions}
        onChange={(value) => {
          setPickedBorrow(value);
          resetPage();
        }}
      />
    </>
  );

  return (
    <YStack>
      <EarnDesktopYourLoans {...yourLoans} />
      <YStack gap="$4">
        <XStack ai="center" jc="space-between" gap="$4" flexWrap="wrap">
          {isWide ? (
            <XStack gap="$2">{assetFilters}</XStack>
          ) : (
            // A phone's width scrolls the pills sideways, edge to edge, as the
            // Earn tab's categories do, instead of cutting the second one
            <EarnDesktopPillScroller gap="$2">
              {assetFilters}
            </EarnDesktopPillScroller>
          )}
          <XStack ai="center" gap="$3" w={isWide ? undefined : '100%'}>
            <NetworkFilterControl
              testID="earn-desktop-loans-network-filter"
              variant={isWide ? 'pill' : 'default'}
              availableNetworkIds={availableNetworkIds}
              selectedNetworkIds={selectedNetworkIds}
              networkAssetCounts={networkPairCounts}
              onSelectionChange={(networkIds) => {
                setSelectedNetworkIds(networkIds);
                resetPage();
              }}
              triggerProps={{
                ...NETWORK_TRIGGER_PROPS,
                bg: selectedNetworkIds.length ? '$bgActive' : '$bgSubdued',
                hoverStyle: selectedNetworkIds.length
                  ? undefined
                  : { bg: '$bgHover' },
                ...(reduceMotion ? undefined : HOVER_MOTION),
              }}
            />
            <SearchBar
              testID="earn-desktop-loans-search"
              size="small"
              value={searchText}
              placeholder={intl.formatMessage({
                id: ETranslations.global_search_asset,
              })}
              onChangeText={(text) => {
                setSearchText(text);
                resetPage();
              }}
              containerProps={
                isWide
                  ? SEARCH_BAR_CONTAINER_PROPS
                  : NARROW_SEARCH_BAR_CONTAINER_PROPS
              }
            />
          </XStack>
        </XStack>
        {!isLoading && !rows.length ? (
          // No pairs at all is missing data, not a filter's miss
          <EarnListEmptyState
            isFiltered={isFiltered && pairs.length > 0}
            onReset={hasPickedFilters ? handleResetFilters : undefined}
          />
        ) : (
          <YStack mx="$-5">
            <ListItem gap={ROW_GAP} minHeight="$8">
              {isWide ? (
                <>
                  <Stack {...COLUMNS.collateral}>
                    <HeaderLabel>{collateralLabel}</HeaderLabel>
                  </Stack>
                  <Stack {...COLUMNS.borrow}>
                    <HeaderLabel>{borrowLabel}</HeaderLabel>
                  </Stack>
                  <Stack {...COLUMNS.market}>
                    <HeaderLabel>
                      {intl.formatMessage({ id: ETranslations.global_market })}
                    </HeaderLabel>
                  </Stack>
                  <Stack {...COLUMNS.supply}>
                    <EarnDesktopSortLabel
                      sort="supply"
                      current={sort}
                      onPress={handleSort}
                      testID="earn-desktop-loans-sort-supply"
                    >
                      {supplyApyLabel}
                    </EarnDesktopSortLabel>
                  </Stack>
                  <Stack {...COLUMNS.borrowApy}>
                    <EarnDesktopSortLabel
                      sort="borrow"
                      current={sort}
                      onPress={handleSort}
                      testID="earn-desktop-loans-sort-borrow"
                    >
                      {borrowApyLabel}
                    </EarnDesktopSortLabel>
                  </Stack>
                </>
              ) : (
                <Stack flex={1} minWidth={0}>
                  <HeaderLabel>{`${collateralLabel} / ${borrowLabel}`}</HeaderLabel>
                </Stack>
              )}
              <XStack
                {...(isWide ? COLUMNS.net : { flexShrink: 0 })}
                ai="center"
                jc="flex-end"
                gap="$1"
              >
                <NetApyInfo />
                <EarnDesktopSortLabel
                  sort="net"
                  current={sort}
                  onPress={handleSort}
                  testID="earn-desktop-loans-sort-net"
                >
                  {netApyLabel}
                </EarnDesktopSortLabel>
              </XStack>
              <Stack w={isWide ? ACTION_COLUMN_WIDTH : '$5'} flexShrink={0} />
            </ListItem>
            {list}
            {moreCount > 0 ? (
              <MoreRows
                count={moreCount}
                onPress={() => setShownCount((count) => count + PAGE_SIZE)}
              />
            ) : null}
          </YStack>
        )}
      </YStack>
    </YStack>
  );
}

export const EarnDesktopBorrowTab = memo(BasicEarnDesktopBorrowTab);
