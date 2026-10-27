import type { ReactNode } from 'react';
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useReducedMotion } from 'react-native-reanimated';

import {
  Accordion,
  Badge,
  Icon,
  ScrollView,
  SearchBar,
  SizableText,
  Skeleton,
  Stack,
  View,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import {
  ANIMATE_ONLY_BACKGROUND_COLOR,
  ANIMATE_ONLY_OPACITY,
} from '@onekeyhq/components/src/utils/animationConstants';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatarGroup } from '@onekeyhq/kit/src/components/NetworkAvatar/NetworkAvatar';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type { IEarnAvailableAsset } from '@onekeyhq/shared/types/earn';
import { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';
import { normalizeToEarnProvider } from '@onekeyhq/shared/types/earn/earnProvider.constants';
import type { IStakeProtocolListItem } from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../../Staking/components/ProtocolDetails/EarnText';
import { EarnNavigation } from '../../earnUtils';
import {
  getItemTvlValue,
  useEarnAllProtocols,
} from '../../hooks/useEarnAllProtocols';
import { EarnTestIDs } from '../../testIDs';
import {
  parseAprPercentValue,
  parseFormattedLiquidityValue,
} from '../../utils/availableAssetsUtils';
import {
  LIST_HIDDEN_STYLE,
  getListHeightTransition,
  getListRowMotion,
} from '../../utils/earnListMotion';
import { AprText } from '../AprText';
import { EarnListEmptyState } from '../EarnListEmptyState';
import { NetworkFilterControl } from '../NetworkFilterControl';

import {
  findPositionDeposit,
  getAssetSortApr,
  isFixedRateProtocol,
} from './earnDesktopHome.utils';
import {
  EarnDesktopSurfaceProvider,
  SurfaceToken,
  buildKeyboardPressProps,
  usePressableSurface,
} from './earnDesktopPressable';
import { EarnDesktopSortLabel } from './EarnDesktopSortLabel';
import { useStableItems } from './useContentStable';
import { useEarnDesktopSurfaces } from './useEarnDesktopSurfaces';

import type {
  IEarnDesktopLendingOffer,
  IEarnDesktopOpenRequest,
  IEarnDesktopPortfolioDeposits,
  IEarnDesktopWalletHolding,
} from './earnDesktopHome.utils';
import type { IEarnDesktopSortState } from './EarnDesktopSortLabel';

type ITokenCategory = 'all' | 'stable' | 'nonStable' | 'fixedIncome';

const TOKEN_CATEGORIES: { value: ITokenCategory; labelId: ETranslations }[] = [
  { value: 'all', labelId: ETranslations.global_all },
  { value: 'stable', labelId: ETranslations.earn_stable_tokens__action },
  { value: 'nonStable', labelId: ETranslations.earn_non_stable_tokens__action },
  { value: 'fixedIncome', labelId: ETranslations.earn_fixed_income },
];

// The header, the token rows and the offers under an open row share one
// column layout, so an offer's TVL and APR sit under the token's numbers
const ROW_GAP = '$3';
// Every row is as tall as one with a "Deposited" line, so the list keeps one
// rhythm whichever tokens hold deposits
const ROW_HEIGHT = 56;
const column = (
  flex: number,
  align: 'flex-start' | 'flex-end' = 'flex-start',
  minWidth = 0,
) => ({
  flexGrow: flex,
  flexShrink: 1,
  flexBasis: 0,
  minWidth,
  ai: align,
});
const COLUMNS = {
  asset: column(3),
  network: column(1.4),
  balance: column(1.4, 'flex-end'),
  // Wide enough for a range like "14.78% - 15.87%" on one line. In one column
  // the rate takes only its own width, so the token's name and badge keep the
  // rest of the row
  apr: {
    ...column(1.4, 'flex-end', 136),
    $md: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', minWidth: 0 },
  } as const,
};
// One column keeps the token and its rate; the network and the balance need
// a wide row
const WIDE_ONLY = { $md: { display: 'none' } } as const;
const SEARCH_BAR_CONTAINER_PROPS = {
  w: 220,
  borderRadius: '$full' as const,
  bg: '$bgStrong' as const,
  borderColor: '$transparent' as const,
  overflow: 'hidden' as const,
};

type IEarnTableRow = {
  key: string;
  asset: IEarnAvailableAsset;
  isFixedRate: boolean;
  networkIds: string[];
  depositedFiatValue: number;
  /** What the wallet holds of the token over every network; undefined if none */
  balance?: string;
  /** That balance's value in USD, shown in the display currency */
  balanceFiatValueUsd?: string;
  tvl: number;
};

const shouldSendVault = (providerName: string) =>
  earnUtils.shouldSendEarnProtocolVault({ providerName });

function CategoryPills({
  value,
  onChange,
}: {
  value: ITokenCategory;
  onChange: (value: ITokenCategory) => void;
}) {
  const intl = useIntl();
  const media = useMedia();
  const pills = (
    <XStack gap="$2">
      {TOKEN_CATEGORIES.map((category) => {
        const isFocused = category.value === value;
        return (
          <XStack
            key={category.value}
            role="button"
            aria-pressed={isFocused}
            px="$3"
            py="$1.5"
            bg={isFocused ? '$bgActive' : '$bgSubdued'}
            borderRadius="$full"
            cursor="pointer"
            userSelect="none"
            hoverStyle={isFocused ? undefined : { bg: '$bgHover' }}
            pressStyle={{ bg: '$bgActive' }}
            onPress={() => onChange(category.value)}
            {...buildKeyboardPressProps(() => onChange(category.value), 2)}
          >
            <SizableText
              size="$bodyMdMedium"
              color={isFocused ? '$text' : '$textSubdued'}
            >
              {intl.formatMessage({ id: category.labelId })}
            </SizableText>
          </XStack>
        );
      })}
    </XStack>
  );
  if (media.gtMd) {
    return pills;
  }
  // A phone's width scrolls the pills sideways, edge to edge, as the phone
  // does, instead of cutting the last one
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      mx="$-5"
      w="100%"
      flexGrow={1}
      contentContainerStyle={{ px: '$5' }}
    >
      {pills}
    </ScrollView>
  );
}

function HeaderLabel({
  children,
  align,
}: {
  children: string;
  align?: 'right';
}) {
  return (
    <SizableText
      size="$bodySmMedium"
      color="$textSubdued"
      textAlign={align}
      numberOfLines={1}
    >
      {children}
    </SizableText>
  );
}

type IOfferRow =
  | {
      kind: 'protocol';
      key: string;
      apr: number;
      tvl: number;
      item: IStakeProtocolListItem;
    }
  | {
      kind: 'lending';
      key: string;
      apr: number;
      tvl: number;
      offer: IEarnDesktopLendingOffer;
    };

type IOfferSort = 'apr' | 'tvl';
type ITokenSort = 'apr';

function OfferRowFrame({
  children,
  onPress,
  testID,
  index,
}: {
  children: ReactNode;
  onPress: () => void;
  testID?: string;
  /** Its place under the offers' header, for the rows coming in one after
   * another as they unfold */
  index: number;
}) {
  const reduceMotion = useReducedMotion();
  // Opaque card steps rather than a translucent wash, so the network badges'
  // rings take the row's color as it changes
  const { surface, isActive, handlers } = usePressableSurface(true);
  return (
    <YStack {...getListRowMotion(index, reduceMotion)}>
      <EarnDesktopSurfaceProvider value={surface}>
        <XStack
          testID={testID}
          role="button"
          ai="center"
          gap={ROW_GAP}
          minHeight={ROW_HEIGHT}
          px="$3"
          mx="$-3"
          borderRadius="$3"
          borderCurve="continuous"
          bg={isActive ? surface : undefined}
          cursor="pointer"
          userSelect="none"
          onPress={onPress}
          {...handlers}
          {...buildKeyboardPressProps(onPress)}
        >
          {children}
        </XStack>
      </EarnDesktopSurfaceProvider>
    </YStack>
  );
}

// The token row's deposit line, for an offer holding part of it
function DepositedLine({ value }: { value: number }) {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  return (
    <XStack ai="center" gap="$1">
      <SizableText size="$bodySm" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.earn_deposited })}
      </SizableText>
      <NumberSizeableTextWrapper
        hideValue
        size="$bodySmMedium"
        formatter="value"
        formatterOptions={{ currency: settings.currencyInfo.symbol }}
      >
        {value}
      </NumberSizeableTextWrapper>
    </XStack>
  );
}

// An offer's deposit in the open list's Deposited column
function DepositedValue({ value }: { value: number }) {
  const [settings] = useSettingsPersistAtom();
  return (
    <NumberSizeableTextWrapper
      hideValue
      size="$bodyLgMedium"
      formatter="value"
      formatterOptions={{ currency: settings.currencyInfo.symbol }}
    >
      {value}
    </NumberSizeableTextWrapper>
  );
}

function TokenOffers({
  row,
  lendingOffers,
  deposits,
}: {
  row: IEarnTableRow;
  lendingOffers?: IEarnDesktopLendingOffer[];
  deposits: IEarnDesktopPortfolioDeposits;
}) {
  const intl = useIntl();
  const media = useMedia();
  const reduceMotion = useReducedMotion();
  // The Network and balance columns show from md up; below, a deposit sits
  // under its rate
  const isWide = media.gtMd;
  const navigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const accountId = activeAccount.account?.id;
  const indexedAccountId = activeAccount.indexedAccount?.id;
  const accountNetworkId = activeAccount.network?.id;
  const { asset, isFixedRate } = row;

  const { result: protocols, isLoading } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceStaking.getProtocolList({
        symbol: asset.symbol,
        accountId,
        networkId: accountNetworkId,
        includeWithdrawOnly: true,
      }),
    [accountId, accountNetworkId, asset.symbol],
    { watchLoading: true, undefinedResultIfError: true },
  );

  const offers = useMemo<IOfferRow[]>(() => {
    const protocolRows: IOfferRow[] = (protocols ?? [])
      .filter((item) => isFixedRateProtocol(item) === isFixedRate)
      .map((item) => ({
        kind: 'protocol',
        key: `${item.network.networkId}-${item.provider.name}-${item.provider.vault ?? ''}`,
        apr: parseAprPercentValue(item.provider.aprWithoutFee),
        tvl: getItemTvlValue(item),
        item,
      }));
    // A market the protocol list already carries (Kamino USDC has a staking
    // config) must not be listed twice
    const listed = new Set(
      (protocols ?? []).map(
        (item) =>
          `${(normalizeToEarnProvider(item.provider.name) ?? item.provider.name).toLowerCase()}:${item.network.networkId}`,
      ),
    );
    const lendingRows: IOfferRow[] = isFixedRate
      ? []
      : (lendingOffers ?? [])
          .filter(
            (offer) =>
              !listed.has(
                `${offer.market.provider.toLowerCase()}:${offer.market.networkId}`,
              ),
          )
          .map((offer) => ({
            kind: 'lending',
            key: offer.key,
            apr: parseAprPercentValue(offer.apy),
            tvl: parseFormattedLiquidityValue(offer.tvlText),
            offer,
          }));
    return [...protocolRows, ...lendingRows];
  }, [isFixedRate, lendingOffers, protocols]);

  // The best rate first until a header is picked
  const [offerSort, setOfferSort] = useState<IEarnDesktopSortState<IOfferSort>>(
    { key: 'apr', direction: 'desc' },
  );
  const sortedOffers = useMemo(() => {
    const sign = offerSort.direction === 'desc' ? -1 : 1;
    return offers.toSorted(
      (a, b) => sign * (a[offerSort.key] - b[offerSort.key]),
    );
  }, [offerSort, offers]);
  const handleOfferSort = useCallback((key: IOfferSort) => {
    setOfferSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'desc' ? 'asc' : 'desc' }
        : { key, direction: 'desc' },
    );
  }, []);

  // What each offer holds of the token
  const depositByKey = useMemo(
    () =>
      new Map(
        offers.map((offer) => [
          offer.key,
          offer.kind === 'lending'
            ? (offer.offer.depositedFiatValue ?? 0)
            : (findPositionDeposit(deposits, {
                provider: offer.item.provider.name,
                networkId: offer.item.network.networkId,
                symbol: asset.symbol,
                vault: offer.item.provider.vault,
              }) ?? 0),
        ]),
      ),
    [asset.symbol, deposits, offers],
  );
  const hasDeposits = [...depositByKey.values()].some((value) => value > 0);

  const handleProtocolPress = useCallback(
    (item: IStakeProtocolListItem) => {
      const vault = shouldSendVault(item.provider.name)
        ? item.provider.vault
        : undefined;
      if (
        item.aprInfo?.button?.type === 'redeem' &&
        !item.aprInfo?.button?.disabled
      ) {
        navigation.pushModal(EModalRoutes.StakingModal, {
          screen: EModalStakingRoutes.ManagePosition,
          params: {
            networkId: item.network.networkId,
            symbol: asset.symbol,
            provider: item.provider.name,
            vault,
            tab: 'withdraw',
          },
        });
        return;
      }
      void EarnNavigation.pushToEarnProtocolDetails(navigation, {
        networkId: item.network.networkId,
        symbol: asset.symbol,
        provider: item.provider.name,
        vault,
        logoURI: asset.logoURI,
      });
    },
    [asset.logoURI, asset.symbol, navigation],
  );

  // A market's supply side opens as an Earn details page, its form a supply
  // with Pay with, as a vault's row opens its own
  const handleLendingPress = useCallback(
    (offer: IEarnDesktopLendingOffer) => {
      EarnNavigation.pushToEarnLendingDetails(navigation, {
        networkId: offer.market.networkId,
        provider: offer.market.provider,
        marketAddress: offer.market.marketAddress,
        reserveAddress: offer.reserveAddress,
        symbol: offer.symbol,
        logoURI: offer.logoURI,
        accountId,
        indexedAccountId,
      });
    },
    [accountId, indexedAccountId, navigation],
  );

  if (isLoading && !protocols) {
    return (
      <YStack>
        {Array.from({ length: 2 }).map((_, index) => (
          <XStack key={index} ai="center" gap="$3" h={ROW_HEIGHT}>
            <Skeleton w="$8" h="$8" radius="round" />
            <Skeleton w={160} h={16} borderRadius="$2" />
          </XStack>
        ))}
      </YStack>
    );
  }

  // A list that failed or came back empty says so instead of a bare header
  if (!offers.length) {
    return (
      <XStack h={ROW_HEIGHT} ai="center">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_no_data })}
        </SizableText>
      </XStack>
    );
  }

  return (
    <YStack>
      <XStack
        h="$8"
        ai="center"
        gap={ROW_GAP}
        {...getListRowMotion(0, reduceMotion)}
      >
        <Stack {...COLUMNS.asset}>
          <HeaderLabel>
            {intl.formatMessage({ id: ETranslations.global_protocol })}
          </HeaderLabel>
        </Stack>
        {/* The offers show their network on the logo, so the column holds
            what each one has of the user's */}
        <Stack {...COLUMNS.network} {...WIDE_ONLY}>
          {hasDeposits ? (
            <HeaderLabel>
              {intl.formatMessage({ id: ETranslations.earn_deposited })}
            </HeaderLabel>
          ) : null}
        </Stack>
        <Stack {...COLUMNS.balance} {...WIDE_ONLY}>
          <EarnDesktopSortLabel
            sort="tvl"
            current={offerSort}
            onPress={handleOfferSort}
            testID={`earn-desktop-offers-sort-tvl-${row.key}`}
          >
            {intl.formatMessage({ id: ETranslations.earn_tvl })}
          </EarnDesktopSortLabel>
        </Stack>
        <Stack {...COLUMNS.apr}>
          <EarnDesktopSortLabel
            sort="apr"
            current={offerSort}
            onPress={handleOfferSort}
            testID={`earn-desktop-offers-sort-apr-${row.key}`}
          >
            {intl.formatMessage({ id: ETranslations.defi_apr_apy })}
          </EarnDesktopSortLabel>
        </Stack>
        <Stack w="$5" />
      </XStack>
      {sortedOffers.map((offer, index) => {
        const deposited = depositByKey.get(offer.key) ?? 0;
        if (offer.kind === 'lending') {
          const { offer: lending } = offer;
          return (
            <OfferRowFrame
              key={offer.key}
              index={index + 1}
              testID={`earn-desktop-offer-${lending.key}`}
              onPress={() => handleLendingPress(lending)}
            >
              <XStack {...COLUMNS.asset} ai="center" gap="$3">
                <SurfaceToken
                  size="md"
                  borderRadius="$2"
                  tokenImageUri={lending.market.logoURI}
                  networkId={lending.market.networkId}
                />
                <YStack flex={1} minWidth={0}>
                  <SizableText size="$bodyLgMedium" numberOfLines={1}>
                    {lending.marketLabel}
                  </SizableText>
                </YStack>
              </XStack>
              <Stack {...COLUMNS.network} {...WIDE_ONLY}>
                {deposited > 0 ? <DepositedValue value={deposited} /> : null}
              </Stack>
              <Stack {...COLUMNS.balance} {...WIDE_ONLY}>
                <SizableText size="$bodyLgMedium" numberOfLines={1}>
                  {lending.tvlText ?? '-'}
                </SizableText>
              </Stack>
              <Stack {...COLUMNS.apr}>
                <SizableText size="$bodyLgMedium">
                  {`${new BigNumber(lending.apy).toFixed(2)}%`}
                </SizableText>
                {!isWide && deposited > 0 ? (
                  <DepositedLine value={deposited} />
                ) : null}
              </Stack>
              <Stack w="$5" />
            </OfferRowFrame>
          );
        }
        const { item } = offer;
        const providerName =
          normalizeToEarnProvider(item.provider.name) ?? item.provider.name;
        const isRedeem = item.aprInfo?.button?.type === 'redeem';
        // The vault under the protocol, as the Protocols page names it; a
        // fixed-rate offer, titled by its maturity, says how long is left
        // (its protocol is the logo)
        const daysRemaining = Number(item.provider.daysRemaining ?? '');
        let subtitle = item.provider.vaultName;
        if (isFixedRate) {
          subtitle =
            item.provider.daysRemaining && Number.isFinite(daysRemaining)
              ? intl.formatMessage(
                  { id: ETranslations.earn_number_days_left },
                  { number: daysRemaining },
                )
              : providerName;
        }
        return (
          <OfferRowFrame
            key={offer.key}
            index={index + 1}
            testID={`earn-desktop-offer-${offer.key}`}
            onPress={() => handleProtocolPress(item)}
          >
            <XStack {...COLUMNS.asset} ai="center" gap="$3">
              <SurfaceToken
                size="md"
                borderRadius="$2"
                tokenImageUri={item.provider.logoURI}
                networkId={item.network.networkId}
              />
              <YStack flex={1} minWidth={0}>
                <XStack ai="center" gap="$2" minWidth={0}>
                  <SizableText
                    size="$bodyLgMedium"
                    numberOfLines={1}
                    flexShrink={1}
                  >
                    {isFixedRate
                      ? item.provider.maturity ||
                        item.provider.vaultName ||
                        providerName
                      : providerName}
                  </SizableText>
                  {item.provider.badges?.map((badge) => (
                    <Badge
                      key={badge.tag}
                      badgeType={badge.badgeType}
                      badgeSize="sm"
                    >
                      <Badge.Text>{badge.tag}</Badge.Text>
                    </Badge>
                  ))}
                </XStack>
                {subtitle ? (
                  <SizableText
                    size="$bodySm"
                    color="$textSubdued"
                    numberOfLines={1}
                  >
                    {subtitle}
                  </SizableText>
                ) : null}
              </YStack>
            </XStack>
            <Stack {...COLUMNS.network} {...WIDE_ONLY}>
              {deposited > 0 ? <DepositedValue value={deposited} /> : null}
            </Stack>
            <Stack {...COLUMNS.balance} {...WIDE_ONLY}>
              <EarnText
                size="$bodyLgMedium"
                numberOfLines={1}
                text={item.tvl}
              />
            </Stack>
            <Stack {...COLUMNS.apr}>
              {isRedeem ? (
                <SizableText size="$bodyLgMedium" color="$textInfo">
                  {item.aprInfo?.button?.text?.text ||
                    intl.formatMessage({ id: ETranslations.defi_redeemable })}
                </SizableText>
              ) : (
                <AprText
                  hideSuffix
                  asset={{
                    aprWithoutFee: item.provider.aprWithoutFee ?? '',
                    aprInfo: item.aprInfo,
                    rewardUnit: item.provider.rewardUnit,
                  }}
                />
              )}
              {!isWide && deposited > 0 ? (
                <DepositedLine value={deposited} />
              ) : null}
            </Stack>
            <Stack w="$5" />
          </OfferRowFrame>
        );
      })}
    </YStack>
  );
}

// The Fixed Income filter is on, so every row is fixed rate. A context, so
// switching the filter re-renders the "Fixed Rate" lines and not their rows
const FixedIncomeOnlyContext = createContext(false);

function FixedRateLine() {
  const intl = useIntl();
  const isFixedIncomeOnly = useContext(FixedIncomeOnlyContext);
  if (isFixedIncomeOnly) {
    return null;
  }
  return (
    <SizableText size="$bodySm" color="$textSubdued">
      {intl.formatMessage({ id: ETranslations.defi_fixed_rate })}
    </SizableText>
  );
}

type ITokenRowCardProps = {
  row: IEarnTableRow;
  isOpen: boolean;
  onToggle: (key: string) => void;
  lendingOffers?: IEarnDesktopLendingOffer[];
  deposits: IEarnDesktopPortfolioDeposits;
};

function BasicTokenRowCard({
  row,
  isOpen,
  onToggle,
  lendingOffers,
  deposits,
}: ITokenRowCardProps) {
  const surfaces = useEarnDesktopSurfaces();
  const reduceMotion = useReducedMotion();
  const [isHovered, setIsHovered] = useState(false);
  // The offers' fold (an Accordion, a fifth of a closed row) mounts once the
  // row is pointed at, pressed or focused, still closed, so the first open
  // unfolds as every later one does and the rows never opened stay light
  const [hasFold, setHasFold] = useState(isOpen);
  const mountFold = () => {
    if (!hasFold) {
      setHasFold(true);
    }
  };
  const { asset } = row;
  const handleToggle = () => onToggle(row.key);
  return (
    // An open token and its offers read as one card, whose color comes and
    // goes with the offers unfolding
    <YStack
      mx="$2"
      borderRadius="$4"
      borderCurve="continuous"
      bg={isOpen ? surfaces.rest : '$transparent'}
      transition={getListHeightTransition(isOpen, reduceMotion)}
      animateOnly={ANIMATE_ONLY_BACKGROUND_COLOR}
    >
      <ListItem
        testID={`earn-desktop-row-${row.key}`}
        role="button"
        aria-expanded={isOpen}
        mx="$0"
        minHeight={ROW_HEIGHT}
        gap={ROW_GAP}
        userSelect="none"
        onPress={handleToggle}
        onPressIn={mountFold}
        onFocus={mountFold}
        onHoverIn={() => {
          setIsHovered(true);
          mountFold();
        }}
        onHoverOut={() => setIsHovered(false)}
        // Opening a token pins the row's hover color as the card's header
        // strip; closing it lets the color go
        {...(isOpen
          ? {
              bg: '$bgHover',
              borderTopLeftRadius: '$4',
              borderTopRightRadius: '$4',
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
            }
          : undefined)}
        {...buildKeyboardPressProps(handleToggle)}
      >
        <XStack {...COLUMNS.asset} ai="center" gap="$3">
          <Token size="md" tokenImageUri={asset.logoURI} borderRadius="$full" />
          <YStack flex={1} minWidth={0}>
            <XStack ai="center" gap="$2" minWidth={0}>
              <SizableText
                size="$bodyLgMedium"
                numberOfLines={1}
                flexShrink={1}
              >
                {earnUtils.getDisplaySymbol(asset)}
              </SizableText>
              {asset.badges?.map((badge) => (
                <Badge
                  key={badge.tag}
                  badgeType={badge.badgeType}
                  badgeSize="sm"
                >
                  <Badge.Text>{badge.tag}</Badge.Text>
                </Badge>
              ))}
            </XStack>
            {/* Fixed rate reads as the token's second line rather than a
                pill after its name, so the names keep one straight edge.
                Fixed-rate rows never show a deposit, so the line is free.
                Under the Fixed Income filter it would say the same on every
                row, so it goes */}
            {row.isFixedRate ? <FixedRateLine /> : null}
            {row.depositedFiatValue > 0 && !row.isFixedRate ? (
              <DepositedLine value={row.depositedFiatValue} />
            ) : null}
          </YStack>
        </XStack>
        <Stack {...COLUMNS.network} {...WIDE_ONLY}>
          <NetworkAvatarGroup
            networkIds={row.networkIds}
            size="$5"
            variant="spread"
            maxVisible={3}
          />
        </Stack>
        <Stack {...COLUMNS.balance} {...WIDE_ONLY}>
          {/* Empty when there's nothing to deposit, whether the balance is 0
              or unknown: a dash on most rows would say nothing */}
          {new BigNumber(row.balance ?? 0).gt(0) ? (
            // The amount over its value, as the Borrow page's Assets to
            // Supply shows a wallet balance
            <YStack ai="flex-end">
              <NumberSizeableTextWrapper
                hideValue
                size="$bodyLgMedium"
                formatter="balance"
              >
                {row.balance}
              </NumberSizeableTextWrapper>
              <Currency
                hideValue
                size="$bodySm"
                color="$textSubdued"
                formatter="value"
                sourceCurrency={USD_CURRENCY_ID}
              >
                {row.balanceFiatValueUsd}
              </Currency>
            </YStack>
          ) : null}
        </Stack>
        <Stack {...COLUMNS.apr}>
          <AprText asset={asset} hideSuffix />
        </Stack>
        <View
          flexShrink={0}
          transition="quick"
          rotate={isOpen ? '180deg' : '0deg'}
          transformOrigin="center"
        >
          <Icon
            name="ChevronDownSmallOutline"
            size="$5"
            color={isHovered ? '$icon' : '$iconSubdued'}
          />
        </View>
      </ListItem>
      {/* The offers unfold under the token as the deposit modal's protocol
          list does, and fade as they fold */}
      {hasFold || isOpen ? (
        <Accordion type="single" collapsible value={isOpen ? row.key : ''}>
          <Accordion.Item value={row.key}>
            <Accordion.HeightAnimator
              transition={getListHeightTransition(isOpen, reduceMotion)}
            >
              <Accordion.Content
                unstyled
                transition="quick"
                animateOnly={ANIMATE_ONLY_OPACITY}
                exitStyle={LIST_HIDDEN_STYLE}
              >
                <YStack px="$3" pb="$2">
                  <TokenOffers
                    row={row}
                    lendingOffers={lendingOffers}
                    deposits={deposits}
                  />
                </YStack>
              </Accordion.Content>
            </Accordion.HeightAnimator>
          </Accordion.Item>
        </Accordion>
      ) : null}
    </YStack>
  );
}

const getRowKey = (row: IEarnTableRow) => row.key;

// A row re-renders only when its own token changes, opens or closes: opening
// one, sorting or filtering no longer re-renders the other fifty
const TokenRowCard = memo(BasicTokenRowCard);

function BasicTokenRow({
  isHidden,
  ...cardProps
}: ITokenRowCardProps & {
  /** Left out by the filters or the search */
  isHidden: boolean;
}) {
  // Showing and hiding re-renders this wrapper, not the row inside it
  return (
    <YStack display={isHidden ? 'none' : 'flex'}>
      <TokenRowCard {...cardProps} />
    </YStack>
  );
}

const TokenRow = memo(BasicTokenRow);

function BasicEarnDesktopEarnTab({
  trendingAssets,
  fixedRateAssets,
  isAssetsLoading,
  deposits,
  lendingOffers,
  walletHoldings,
  openRequest,
}: {
  trendingAssets: IEarnAvailableAsset[];
  fixedRateAssets: IEarnAvailableAsset[];
  isAssetsLoading: boolean;
  deposits: IEarnDesktopPortfolioDeposits;
  lendingOffers: Map<string, IEarnDesktopLendingOffer[]>;
  walletHoldings: Map<string, IEarnDesktopWalletHolding>;
  openRequest?: IEarnDesktopOpenRequest;
}) {
  const intl = useIntl();
  const [category, setCategory] = useState<ITokenCategory>('all');
  const [searchText, setSearchText] = useState('');
  const [selectedNetworkIds, setSelectedNetworkIds] = useState<string[]>([]);
  const [openKey, setOpenKey] = useState<string>();
  // No sort: tokens you hold or have deposited first, then by TVL
  const [tokenSort, setTokenSort] = useState<
    IEarnDesktopSortState<ITokenSort> | undefined
  >();

  const { result: stableAssets } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceStaking.getAvailableAssets({
        type: EAvailableAssetsTypeEnum.StableCoins,
      }),
    [],
    { undefinedResultIfError: true },
  );
  const stableSymbols = useMemo(
    () => new Set((stableAssets ?? []).map((asset) => asset.symbol)),
    [stableAssets],
  );
  const { providers: aggregatedProviders } = useEarnAllProtocols();
  const symbolTvl = useMemo(() => {
    const map = new Map<string, number>();
    aggregatedProviders.forEach((aggregated) => {
      aggregated.tokens.forEach((token) => {
        const key = token.symbol.toLowerCase();
        map.set(key, (map.get(key) ?? 0) + token.tvlValue);
      });
    });
    return map;
  }, [aggregatedProviders]);

  // Each token's portfolio principal, read per asset (a provider's positions
  // arrive merged under its first token), plus its lending supply
  const depositedBySymbol = useMemo(() => {
    const map = new Map(deposits.byToken);
    lendingOffers.forEach((offers) =>
      offers.forEach((offer) => {
        if (offer.depositedFiatValue) {
          const key = offer.symbol.toLowerCase();
          map.set(key, (map.get(key) ?? 0) + offer.depositedFiatValue);
        }
      }),
    );
    return map;
  }, [deposits, lendingOffers]);

  const builtRows = useMemo<IEarnTableRow[]>(() => {
    const build = (asset: IEarnAvailableAsset, isFixedRate: boolean) => {
      const symbolKey = asset.symbol.toLowerCase();
      const lendingNetworks = isFixedRate
        ? []
        : (lendingOffers.get(symbolKey) ?? []).map(
            (offer) => offer.market.networkId,
          );
      return {
        key: `${isFixedRate ? 'fixed' : 'earn'}:${asset.symbol}`,
        asset,
        isFixedRate,
        networkIds: Array.from(
          new Set([
            ...asset.protocols.map((protocol) => protocol.networkId),
            ...lendingNetworks,
          ]),
        ),
        depositedFiatValue: depositedBySymbol.get(symbolKey) ?? 0,
        balance: walletHoldings.get(symbolKey)?.amount,
        balanceFiatValueUsd: walletHoldings.get(symbolKey)?.fiatValueUsd,
        tvl: symbolTvl.get(symbolKey) ?? 0,
      };
    };
    const rows = [
      ...trendingAssets.map((asset) => build(asset, false)),
      ...fixedRateAssets.map((asset) => build(asset, true)),
    ];
    const isOwned = (row: IEarnTableRow) =>
      row.depositedFiatValue > 0 || new BigNumber(row.balance ?? 0).gt(0);
    // Tokens you hold or have deposited first, then by TVL, as the phone sorts
    return rows.toSorted((a, b) => {
      const ownedA = isOwned(a);
      const ownedB = isOwned(b);
      if (ownedA !== ownedB) {
        return ownedA ? -1 : 1;
      }
      if (ownedA && a.depositedFiatValue !== b.depositedFiatValue) {
        return b.depositedFiatValue - a.depositedFiatValue;
      }
      return b.tvl - a.tvl;
    });
  }, [
    depositedBySymbol,
    fixedRateAssets,
    lendingOffers,
    symbolTvl,
    trendingAssets,
    walletHoldings,
  ]);
  // A row rebuilt with the same content keeps its object, so the memoized
  // row skips the render when a refetch or poll changed other tokens only
  const allRows = useStableItems(builtRows, getRowKey);

  // Fixed-rate tokens have a category of their own, so Stable and Non-Stable
  // keep to the flexible ones, as on the Tokens page
  const categoryRows = useMemo(() => {
    if (category === 'stable') {
      return allRows.filter(
        (row) => !row.isFixedRate && stableSymbols.has(row.asset.symbol),
      );
    }
    if (category === 'nonStable') {
      return allRows.filter(
        (row) => !row.isFixedRate && !stableSymbols.has(row.asset.symbol),
      );
    }
    if (category === 'fixedIncome') {
      return allRows.filter((row) => row.isFixedRate);
    }
    return allRows;
  }, [allRows, category, stableSymbols]);

  const { availableNetworkIds, networkAssetCounts } = useMemo(() => {
    const counts: Record<string, number> = {};
    categoryRows.forEach((row) => {
      row.networkIds.forEach((networkId) => {
        counts[networkId] = (counts[networkId] ?? 0) + 1;
      });
    });
    return {
      availableNetworkIds: Object.keys(counts),
      networkAssetCounts: counts,
    };
  }, [categoryRows]);

  const rows = useMemo(() => {
    const selected = new Set(selectedNetworkIds);
    const keyword = searchText.trim().toLowerCase();
    return categoryRows.filter((row) => {
      if (
        selected.size > 0 &&
        !row.networkIds.some((networkId) => selected.has(networkId))
      ) {
        return false;
      }
      if (
        keyword &&
        !earnUtils.matchesSymbolKeyword(row.asset, keyword) &&
        !row.asset.name?.toLowerCase().includes(keyword)
      ) {
        return false;
      }
      return true;
    });
  }, [categoryRows, searchText, selectedNetworkIds]);

  // Every row stays mounted and the filters hide the others, so a category,
  // a network or the search shows and hides rows instead of building them
  // again
  const visibleKeys = useMemo(
    () => new Set(rows.map((row) => row.key)),
    [rows],
  );
  // Highest first, then lowest first, then the list's own order again
  const sortedRows = useMemo(() => {
    if (!tokenSort) {
      return allRows;
    }
    const sign = tokenSort.direction === 'desc' ? -1 : 1;
    return allRows.toSorted(
      (a, b) =>
        sign * (getAssetSortApr(a.asset) - getAssetSortApr(b.asset)) ||
        b.tvl - a.tvl,
    );
  }, [allRows, tokenSort]);
  const handleTokenSort = useCallback((key: ITokenSort) => {
    setTokenSort((current) => {
      if (current?.key !== key) {
        return { key, direction: 'desc' };
      }
      return current.direction === 'desc'
        ? { key, direction: 'asc' }
        : undefined;
    });
  }, []);

  const handleToggle = useCallback((key: string) => {
    setOpenKey((current) => (current === key ? undefined : key));
  }, []);

  // A token's breadcrumb on its pages comes back to its row, open, with
  // every offer for it in view: the filters let go of it if they hid it
  const handledOpenAtRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!openRequest || handledOpenAtRef.current === openRequest.at) {
      return;
    }
    const symbol = openRequest.symbol.toLowerCase();
    const row =
      allRows.find((item) => item.key.toLowerCase() === `earn:${symbol}`) ??
      allRows.find((item) => item.key.toLowerCase() === `fixed:${symbol}`);
    if (!row) {
      return;
    }
    handledOpenAtRef.current = openRequest.at;
    setCategory('all');
    setSearchText('');
    setSelectedNetworkIds([]);
    setOpenKey(row.key);
    // Web and desktop only: the page scrolls as the document
    setTimeout(() => {
      globalThis.document
        ?.querySelector(`[data-testid="earn-desktop-row-${row.key}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }, [allRows, openRequest]);

  const isFiltered = Boolean(
    searchText.trim() || selectedNetworkIds.length || category !== 'all',
  );
  const isEmpty = !isAssetsLoading && !rows.length;

  return (
    <YStack gap="$4">
      <XStack ai="center" jc="space-between" gap="$4" flexWrap="wrap">
        <CategoryPills value={category} onChange={setCategory} />
        <XStack ai="center" gap="$3">
          <NetworkFilterControl
            availableNetworkIds={availableNetworkIds}
            selectedNetworkIds={selectedNetworkIds}
            networkAssetCounts={networkAssetCounts}
            onSelectionChange={setSelectedNetworkIds}
          />
          <SearchBar
            testID={EarnTestIDs.assetSearchInput}
            size="small"
            value={searchText}
            placeholder={intl.formatMessage({
              id: ETranslations.global_search_asset,
            })}
            onChangeText={setSearchText}
            containerProps={SEARCH_BAR_CONTAINER_PROPS}
          />
        </XStack>
      </XStack>
      {isEmpty ? (
        <EarnListEmptyState isFiltered={isFiltered} />
      ) : (
        <FixedIncomeOnlyContext.Provider value={category === 'fixedIncome'}>
          <YStack mx="$-5">
            <ListItem gap={ROW_GAP} minHeight="$8">
              <Stack {...COLUMNS.asset}>
                <HeaderLabel>
                  {intl.formatMessage({ id: ETranslations.global_asset })}
                </HeaderLabel>
              </Stack>
              <Stack {...COLUMNS.network} {...WIDE_ONLY}>
                <HeaderLabel>
                  {intl.formatMessage({ id: ETranslations.global_network })}
                </HeaderLabel>
              </Stack>
              <Stack {...COLUMNS.balance} {...WIDE_ONLY}>
                <HeaderLabel align="right">
                  {intl.formatMessage({
                    id: ETranslations.global_wallet_balance,
                  })}
                </HeaderLabel>
              </Stack>
              <Stack {...COLUMNS.apr}>
                <EarnDesktopSortLabel
                  sort="apr"
                  current={tokenSort}
                  onPress={handleTokenSort}
                  testID="earn-desktop-earn-sort-apr"
                >
                  {intl.formatMessage({ id: ETranslations.defi_apr_apy })}
                </EarnDesktopSortLabel>
              </Stack>
              <Stack w="$5" />
            </ListItem>
            {isAssetsLoading && !rows.length
              ? Array.from({ length: 6 }).map((_, index) => (
                  <ListItem key={index} minHeight={ROW_HEIGHT} gap={ROW_GAP}>
                    <XStack {...COLUMNS.asset} ai="center" gap="$3">
                      <Skeleton w="$8" h="$8" radius="round" />
                      <Skeleton w={96} h={18} borderRadius="$2" />
                    </XStack>
                    <Stack {...COLUMNS.network} {...WIDE_ONLY}>
                      <Skeleton w={64} h={18} borderRadius="$2" />
                    </Stack>
                    <Stack {...column(2.8, 'flex-end')}>
                      <Skeleton w={96} h={18} borderRadius="$2" />
                    </Stack>
                    <Stack w="$5" />
                  </ListItem>
                ))
              : sortedRows.map((row) => (
                  <TokenRow
                    key={row.key}
                    row={row}
                    isHidden={!visibleKeys.has(row.key)}
                    isOpen={row.key === openKey}
                    onToggle={handleToggle}
                    lendingOffers={lendingOffers.get(
                      row.asset.symbol.toLowerCase(),
                    )}
                    deposits={deposits}
                  />
                ))}
          </YStack>
        </FixedIncomeOnlyContext.Provider>
      )}
    </YStack>
  );
}

export const EarnDesktopEarnTab = memo(BasicEarnDesktopEarnTab);
