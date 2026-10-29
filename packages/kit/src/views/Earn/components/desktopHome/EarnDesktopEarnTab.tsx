import type { ReactNode } from 'react';
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useReducedMotion } from 'react-native-reanimated';

import {
  Badge,
  Icon,
  SearchBar,
  SizableText,
  Skeleton,
  Stack,
  View,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { IElement } from '@onekeyhq/components';
import {
  ANIMATE_ONLY_HEIGHT,
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
import { useEarnAllProtocols } from '../../hooks/useEarnAllProtocols';
import { EarnTestIDs } from '../../testIDs';
import {
  LIST_FOLD_MS,
  LIST_HIDDEN_STYLE,
  getListHeightTransition,
  getListRowMotion,
} from '../../utils/earnListMotion';
import { AprText } from '../AprText';
import { EarnListEmptyState } from '../EarnListEmptyState';
import { NetworkFilterControl } from '../NetworkFilterControl';

import { ANIMATE_ONLY_BG_COLOR } from './earnDesktopColorEase';
import {
  buildNetworkView,
  buildTokenOffers,
  findPositionDeposit,
  getAssetSortApr,
} from './earnDesktopHome.utils';
import { EarnDesktopPillScroller } from './EarnDesktopPillScroller';
import {
  EarnDesktopSurfaceProvider,
  SurfaceToken,
  buildKeyboardPressProps,
  usePressableSurface,
} from './earnDesktopPressable';
import { EarnDesktopSortLabel } from './EarnDesktopSortLabel';
import {
  warmEarnLendingDetails,
  warmEarnProtocolDetails,
} from './earnDesktopWarm';
import { useStableItems } from './useContentStable';
import { useEarnDesktopFadeIn } from './useEarnDesktopFadeIn';
import { useEarnDesktopScrollPin } from './useEarnDesktopScrollPin';
import { useEarnDesktopSurfaces } from './useEarnDesktopSurfaces';

import type {
  IEarnDesktopLendingOffer,
  IEarnDesktopNetworkView,
  IEarnDesktopOpenRequest,
  IEarnDesktopPortfolioDeposits,
  IEarnDesktopTokenOffer,
  IEarnDesktopWalletHolding,
} from './earnDesktopHome.utils';
import type { IEarnDesktopSortState } from './EarnDesktopSortLabel';

export type IEarnDesktopTokenCategory =
  | 'all'
  | 'stable'
  | 'nonStable'
  | 'fixedIncome';
type ITokenCategory = IEarnDesktopTokenCategory;
/** A category the home's cards ask the tab to show */
export type IEarnDesktopCategoryRequest = {
  category: IEarnDesktopTokenCategory;
  at: number;
};

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
// The network filter's trigger is a pill that takes a picked category's fill
// while networks are picked. Its padding stays either way so the label holds
// still, and its start pulls back so the label keeps the row's edge
const NETWORK_TRIGGER_PROPS = {
  px: '$3',
  py: '$1.5',
  ml: '$-3',
  borderRadius: '$full',
} as const;

type IEarnTableRow = {
  key: string;
  asset: IEarnAvailableAsset;
  isFixedRate: boolean;
  /** Every network the token is offered on, which the network filter matches */
  networkIds: string[];
  depositedFiatValue: number;
  /** What the wallet holds of the token over every network; undefined if none */
  balance?: string;
  /** That balance's value in USD, shown in the display currency */
  balanceFiatValueUsd?: string;
  tvl: number;
  /** The offers opening the row lists, as every protocol's list counts them */
  offerCount: number;
  /** With networks picked in the filter: the row's offers there alone */
  networkFilter?: IEarnDesktopNetworkView & {
    pickedNetworkIds: string[];
    offerCount: number;
  };
};

// A pointer resting this long on a row reads its offers ahead; one passing
// over the list doesn't
const FOLD_HOVER_INTENT_MS = 120;
// An open row's offers read again on a later open, past this age
const OFFERS_FRESH_MS = 10_000;
// Offers landing after the skeleton fade in where it stood as it fades out
const SKELETON_FADE_MS = 150;
const CROSS_FADE_ROW_MOTION = {
  transition: 'quick',
  animateOnly: ANIMATE_ONLY_OPACITY,
  enterStyle: LIST_HIDDEN_STYLE,
} as const;
// Hovers ease their color over the app's quick fade; under reduced motion
// the color changes at once
const HOVER_MOTION = {
  transition: 'quick',
  animateOnly: ANIMATE_ONLY_BG_COLOR,
} as const;

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
  const reduceMotion = useReducedMotion();
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
            {...(reduceMotion ? undefined : HOVER_MOTION)}
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
  return <EarnDesktopPillScroller>{pills}</EarnDesktopPillScroller>;
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

// No wallet: its balance and what an open token's offers hold of it could
// only be empty, so their columns go and the others take the room, an open
// token's columns still under the token's. A context, so connecting
// re-renders the cells and not their rows
const WalletColumnContext = createContext(true);

function WalletColumn({
  column: columnProps,
  children,
}: {
  column: ReturnType<typeof column>;
  children?: ReactNode;
}) {
  const hasWallet = useContext(WalletColumnContext);
  if (!hasWallet) {
    return null;
  }
  return (
    <Stack {...columnProps} {...WIDE_ONLY}>
      {children}
    </Stack>
  );
}

type IOfferSort = 'apr' | 'tvl';
type ITokenSort = 'apr';

function OfferRowFrame({
  children,
  onPress,
  onWarm,
  testID,
  index,
  entersFromSkeleton,
}: {
  children: ReactNode;
  onPress: () => void;
  /** Loads what the press opens, while the row is pointed at or focused */
  onWarm: () => void;
  testID?: string;
  /** Its place under the offers' header, for the rows coming in one after
   * another as they unfold */
  index: number;
  /** It takes a skeleton row's place: it fades in there, all rows at once */
  entersFromSkeleton: boolean;
}) {
  const reduceMotion = useReducedMotion();
  // Opaque card steps rather than a translucent wash, so the network badges'
  // rings take the row's color as it changes
  const { surface, isActive, handlers } = usePressableSurface(true);
  let motion = getListRowMotion(index, reduceMotion);
  if (entersFromSkeleton && !reduceMotion) {
    motion = CROSS_FADE_ROW_MOTION;
  }
  return (
    <YStack {...motion}>
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
          {...(reduceMotion ? undefined : HOVER_MOTION)}
          onPress={onPress}
          {...handlers}
          onHoverIn={() => {
            handlers?.onHoverIn();
            onWarm();
          }}
          onFocus={onWarm}
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

// Stands in for the offers until the token's list answers, one row for each
// offer the list is expected to hold. The real rows take its place in flow
// and it stays over them, fading out, so no frame between is empty
function OfferSkeleton({
  count,
  isLeaving,
}: {
  count: number;
  isLeaving: boolean;
}) {
  return (
    <YStack
      pointerEvents="none"
      opacity={isLeaving ? 0 : 1}
      transition="quick"
      animateOnly={ANIMATE_ONLY_OPACITY}
      {...(isLeaving
        ? { position: 'absolute', top: 0, left: 0, right: 0 }
        : undefined)}
    >
      {Array.from({ length: count }).map((_, index) => (
        <XStack key={index} ai="center" gap={ROW_GAP} h={ROW_HEIGHT}>
          <XStack {...COLUMNS.asset} ai="center" gap="$3">
            <Skeleton w="$8" h="$8" radius="round" />
            <Skeleton w={160} h={16} borderRadius="$2" />
          </XStack>
          <Stack {...COLUMNS.apr}>
            <Skeleton w={56} h={16} borderRadius="$2" />
          </Stack>
          <Stack w="$5" />
        </XStack>
      ))}
    </YStack>
  );
}

function TokenOffers({
  row,
  protocols,
  isLoading,
  lendingOffers,
  deposits,
}: {
  row: IEarnTableRow;
  /** The token's protocol list for the account; undefined until it answers */
  protocols?: IStakeProtocolListItem[];
  isLoading: boolean;
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
  const { asset, isFixedRate, networkFilter } = row;
  const pickedNetworkIds = networkFilter?.pickedNetworkIds;

  const offers = useMemo<IEarnDesktopTokenOffer[]>(
    () =>
      buildTokenOffers({
        protocols: protocols ?? [],
        lendingOffers: lendingOffers ?? [],
        isFixedRate,
        networkIds: pickedNetworkIds,
      }),
    [isFixedRate, lendingOffers, pickedNetworkIds, protocols],
  );

  const isWaiting = isLoading && !protocols;
  // Rows that come after the skeleton take its place, which fades out over
  // them; rows that are there at once unfold one after another
  const [entersFromSkeleton] = useState(isWaiting);
  const [hasSkeleton, setHasSkeleton] = useState(isWaiting);
  useEffect(() => {
    if (isWaiting || !hasSkeleton) {
      return undefined;
    }
    const timer = setTimeout(
      () => setHasSkeleton(false),
      SKELETON_FADE_MS + 50,
    );
    return () => clearTimeout(timer);
  }, [hasSkeleton, isWaiting]);
  // As many rows as the token's offers, counted from every protocol's list;
  // two before that list is in
  const skeletonCount = (networkFilter?.offerCount ?? row.offerCount) || 2;

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
  // A new order comes in with a fade instead of rows jumping in one frame
  const offerRowsRef = useEarnDesktopFadeIn(
    `${offerSort.key}-${offerSort.direction}`,
  );

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

  const skeleton = hasSkeleton ? (
    <OfferSkeleton count={skeletonCount} isLeaving={!isWaiting} />
  ) : null;

  // A list that failed or came back empty says so instead of a bare header
  if (!isWaiting && !offers.length) {
    return (
      <YStack>
        <XStack h={ROW_HEIGHT} ai="center">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.global_no_data })}
          </SizableText>
        </XStack>
        {skeleton}
      </YStack>
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
        <WalletColumn column={COLUMNS.network}>
          {hasDeposits ? (
            <HeaderLabel>
              {intl.formatMessage({ id: ETranslations.earn_deposited })}
            </HeaderLabel>
          ) : null}
        </WalletColumn>
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
      <YStack ref={offerRowsRef}>
        {(isWaiting ? [] : sortedOffers).map((offer, index) => {
          const deposited = depositByKey.get(offer.key) ?? 0;
          if (offer.kind === 'lending') {
            const { offer: lending } = offer;
            return (
              <OfferRowFrame
                key={offer.key}
                index={index + 1}
                entersFromSkeleton={entersFromSkeleton}
                testID={`earn-desktop-offer-${lending.key}`}
                onPress={() => handleLendingPress(lending)}
                onWarm={warmEarnLendingDetails}
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
                <WalletColumn column={COLUMNS.network}>
                  {deposited > 0 ? <DepositedValue value={deposited} /> : null}
                </WalletColumn>
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
              entersFromSkeleton={entersFromSkeleton}
              testID={`earn-desktop-offer-${offer.key}`}
              onPress={() => handleProtocolPress(item)}
              onWarm={warmEarnProtocolDetails}
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
              <WalletColumn column={COLUMNS.network}>
                {deposited > 0 ? <DepositedValue value={deposited} /> : null}
              </WalletColumn>
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
        {skeleton}
      </YStack>
    </YStack>
  );
}

// The token's offers fold and unfold on the list curve, and a change in
// their height while open (the list landing after the skeleton) eases the
// same way: one height animates for all of it, so the card never jumps
function OffersFold({
  isOpen,
  children,
}: {
  isOpen: boolean;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const outerRef = useRef<IElement>(null);
  const innerRef = useRef<IElement>(null);
  const [contentHeight, setContentHeight] = useState(0);
  // The offers mount as the row opens and leave once it has folded
  const [isPresent, setIsPresent] = useState(isOpen);
  if (isOpen && !isPresent) {
    setIsPresent(true);
  }
  useEffect(() => {
    if (isOpen || !isPresent) {
      return undefined;
    }
    const timer = setTimeout(() => setIsPresent(false), LIST_FOLD_MS + 50);
    return () => clearTimeout(timer);
  }, [isOpen, isPresent]);
  // Measured in the commit that mounts or changes the offers, so the height
  // sets off toward them in that frame. The folded height is laid out first,
  // so an unfold that mounts with its row still animates from it
  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (typeof HTMLElement === 'undefined' || !(inner instanceof HTMLElement)) {
      return;
    }
    const height = inner.getBoundingClientRect().height;
    if (Math.abs(height - contentHeight) >= 0.5) {
      // Reading it lays the folded height out; the value itself is unused
      void (outerRef.current as HTMLElement | null)?.offsetHeight;
      setContentHeight(height);
    }
  }, [children, contentHeight, isPresent]);
  return (
    <YStack
      ref={outerRef}
      height={isOpen ? contentHeight : 0}
      overflow="hidden"
      transition={getListHeightTransition(isOpen, reduceMotion)}
      animateOnly={ANIMATE_ONLY_HEIGHT}
    >
      {/* Out of flow, so it keeps its own height however far the fold has
          gone, and fades as it folds */}
      <YStack
        ref={innerRef}
        position="absolute"
        top={0}
        left={0}
        right={0}
        opacity={isOpen ? 1 : 0}
        transition="quick"
        animateOnly={ANIMATE_ONLY_OPACITY}
        onLayout={(event) => setContentHeight(event.nativeEvent.layout.height)}
      >
        {isPresent ? children : null}
      </YStack>
    </YStack>
  );
}

// A token's offers, read once the row is pointed at, pressed or focused, so
// an open after a moment's hover finds them in
function TokenFold({
  row,
  isOpen,
  lendingOffers,
  deposits,
}: {
  row: IEarnTableRow;
  isOpen: boolean;
  lendingOffers?: IEarnDesktopLendingOffer[];
  deposits: IEarnDesktopPortfolioDeposits;
}) {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const accountId = activeAccount.account?.id;
  const accountNetworkId = activeAccount.network?.id;
  const { symbol } = row.asset;
  const fetchedAtRef = useRef(0);
  const {
    result: protocols,
    isLoading,
    run,
  } = usePromiseResult(
    async () => {
      const list = await backgroundApiProxy.serviceStaking.getProtocolList({
        symbol,
        accountId,
        networkId: accountNetworkId,
        includeWithdrawOnly: true,
      });
      fetchedAtRef.current = Date.now();
      return list;
    },
    [accountId, accountNetworkId, symbol],
    { watchLoading: true, undefinedResultIfError: true },
  );
  // A later open reads the list again, showing the one it has meanwhile
  useEffect(() => {
    if (
      isOpen &&
      fetchedAtRef.current &&
      Date.now() - fetchedAtRef.current > OFFERS_FRESH_MS
    ) {
      void run();
    }
  }, [isOpen, run]);
  return (
    <OffersFold isOpen={isOpen}>
      <YStack px="$3" pb="$2">
        <TokenOffers
          row={row}
          protocols={protocols}
          isLoading={Boolean(isLoading)}
          lendingOffers={lendingOffers}
          deposits={deposits}
        />
      </YStack>
    </OffersFold>
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

const formatApr = (value: number) => `${value.toFixed(2)}%`;

// The rate on the picked networks alone, in the color its offers there give
// their own rates; a dash where nothing there pays
function NetworkAprText({
  asset,
  range,
  color,
}: {
  asset: IEarnAvailableAsset;
  range?: { min: number; max: number };
  color?: IEarnDesktopNetworkView['aprColor'];
}) {
  if (!range) {
    return (
      <SizableText size="$bodyLgMedium" color="$textSubdued">
        -
      </SizableText>
    );
  }
  const min = formatApr(range.min);
  const max = formatApr(range.max);
  return (
    <AprText
      hideSuffix
      asset={{
        aprWithoutFee: max,
        rewardUnit: asset.rewardUnit,
        aprInfo: {
          normal: {
            text: min === max ? max : `${min} - ${max}`,
            color,
          },
        },
      }}
    />
  );
}

type ITokenRowCardProps = {
  row: IEarnTableRow;
  isOpen: boolean;
  /** The row's card, so the list can hold it in place on screen */
  onToggle: (key: string, card: IElement | null) => void;
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
  // The offers' fold mounts once the row is pointed at for a moment, pressed
  // or focused, still closed: it reads the token's offers then, so the first
  // open unfolds as every later one does, and the rows never opened stay
  // light
  const [hasFold, setHasFold] = useState(isOpen);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => () => clearTimeout(hoverTimerRef.current), []);
  const mountFold = () => {
    clearTimeout(hoverTimerRef.current);
    if (!hasFold) {
      setHasFold(true);
    }
  };
  const handleHoverIn = () => {
    setIsHovered(true);
    if (!hasFold) {
      hoverTimerRef.current = setTimeout(mountFold, FOLD_HOVER_INTENT_MS);
    }
  };
  const handleHoverOut = () => {
    setIsHovered(false);
    clearTimeout(hoverTimerRef.current);
  };
  const { asset, networkFilter } = row;
  const cardRef = useRef<IElement>(null);
  const handleToggle = () => onToggle(row.key, cardRef.current);
  return (
    // An open token and its offers read as one card, whose color comes and
    // goes with the offers unfolding
    <YStack
      ref={cardRef}
      mx="$2"
      borderRadius="$4"
      borderCurve="continuous"
      bg={isOpen ? surfaces.rest : '$transparent'}
      transition={getListHeightTransition(isOpen, reduceMotion)}
      animateOnly={ANIMATE_ONLY_BG_COLOR}
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
        onHoverIn={handleHoverIn}
        onHoverOut={handleHoverOut}
        {...(reduceMotion ? undefined : HOVER_MOTION)}
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
              {/* With networks picked, a badge an offer carries shows only
                  with that offer among the picked networks */}
              {(networkFilter ? networkFilter.badges : asset.badges)?.map(
                (badge) => (
                  <Badge
                    key={badge.tag}
                    badgeType={badge.badgeType}
                    badgeSize="sm"
                  >
                    <Badge.Text>{badge.tag}</Badge.Text>
                  </Badge>
                ),
              )}
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
            networkIds={networkFilter?.networkIds ?? row.networkIds}
            size="$5"
            variant="spread"
            maxVisible={3}
          />
        </Stack>
        <WalletColumn column={COLUMNS.balance}>
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
        </WalletColumn>
        <Stack {...COLUMNS.apr}>
          {networkFilter ? (
            <NetworkAprText
              asset={asset}
              range={networkFilter.aprRange}
              color={networkFilter.aprColor}
            />
          ) : (
            <AprText asset={asset} hideSuffix />
          )}
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
        <TokenFold
          row={row}
          isOpen={isOpen}
          lendingOffers={lendingOffers}
          deposits={deposits}
        />
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
  hasWallet,
  openRequest,
  categoryRequest,
}: {
  trendingAssets: IEarnAvailableAsset[];
  fixedRateAssets: IEarnAvailableAsset[];
  isAssetsLoading: boolean;
  deposits: IEarnDesktopPortfolioDeposits;
  lendingOffers: Map<string, IEarnDesktopLendingOffer[]>;
  walletHoldings: Map<string, IEarnDesktopWalletHolding>;
  /** False once it's known no wallet is connected */
  hasWallet: boolean;
  openRequest?: IEarnDesktopOpenRequest;
  categoryRequest?: IEarnDesktopCategoryRequest;
}) {
  const intl = useIntl();
  const media = useMedia();
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
  // Every protocol's offers for each token, before a row is opened: the
  // token's TVL, its rates on picked networks and its open list's length
  const { symbolTvl, protocolsBySymbol } = useMemo(() => {
    const tvl = new Map<string, number>();
    const protocols = new Map<string, IStakeProtocolListItem[]>();
    aggregatedProviders.forEach((aggregated) => {
      aggregated.tokens.forEach((token) => {
        const key = token.symbol.toLowerCase();
        tvl.set(key, (tvl.get(key) ?? 0) + token.tvlValue);
        protocols.set(key, [...(protocols.get(key) ?? []), token.item]);
      });
    });
    return { symbolTvl: tvl, protocolsBySymbol: protocols };
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
        offerCount: buildTokenOffers({
          protocols: protocolsBySymbol.get(symbolKey) ?? [],
          lendingOffers: lendingOffers.get(symbolKey) ?? [],
          isFixedRate,
        }).length,
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
    protocolsBySymbol,
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
  // With networks picked, a row in view speaks for its offers there alone:
  // their rates, their networks and, opened, the offers themselves
  const filteredRows = useMemo(() => {
    if (!selectedNetworkIds.length) {
      return allRows;
    }
    return allRows.map((row): IEarnTableRow => {
      if (!visibleKeys.has(row.key)) {
        return row;
      }
      const symbolKey = row.asset.symbol.toLowerCase();
      const protocols = protocolsBySymbol.get(symbolKey) ?? [];
      const lending = lendingOffers.get(symbolKey) ?? [];
      return {
        ...row,
        networkFilter: {
          ...buildNetworkView({
            protocols,
            lendingOffers: lending,
            isFixedRate: row.isFixedRate,
            rowNetworkIds: row.networkIds,
            pickedNetworkIds: selectedNetworkIds,
            badges: row.asset.badges,
          }),
          pickedNetworkIds: selectedNetworkIds,
          offerCount: buildTokenOffers({
            protocols,
            lendingOffers: lending,
            isFixedRate: row.isFixedRate,
            networkIds: selectedNetworkIds,
          }).length,
        },
      };
    });
  }, [
    allRows,
    lendingOffers,
    protocolsBySymbol,
    selectedNetworkIds,
    visibleKeys,
  ]);
  const shownRows = useStableItems(filteredRows, getRowKey);
  // Highest first, then lowest first, then the list's own order again; by
  // the rate a row shows
  const sortedRows = useMemo(() => {
    if (!tokenSort) {
      return shownRows;
    }
    const getSortApr = (row: IEarnTableRow) =>
      row.networkFilter
        ? (row.networkFilter.aprRange?.max ?? 0)
        : getAssetSortApr(row.asset);
    const sign = tokenSort.direction === 'desc' ? -1 : 1;
    return shownRows.toSorted(
      (a, b) => sign * (getSortApr(a) - getSortApr(b)) || b.tvl - a.tvl,
    );
  }, [shownRows, tokenSort]);
  // A filter, the search or a sort lays the list out again: the new order
  // comes in with a fade instead of rows jumping in one frame
  const listOrderKey = useMemo(
    () =>
      sortedRows
        .filter((row) => visibleKeys.has(row.key))
        .map((row) => row.key)
        .join('|'),
    [sortedRows, visibleKeys],
  );
  const listRef = useEarnDesktopFadeIn(listOrderKey);
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

  // The open token above folds as the pressed one opens: the pressed row
  // stays where it was on screen instead of sliding up with the fold
  const pinScroll = useEarnDesktopScrollPin();
  const handleToggle = useCallback(
    (key: string, card: IElement | null) => {
      pinScroll(card);
      setOpenKey((current) => (current === key ? undefined : key));
    },
    [pinScroll],
  );

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

  // A card's title asks for its category: every token of it, the other
  // filters let go
  const handledCategoryAtRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (
      !categoryRequest ||
      handledCategoryAtRef.current === categoryRequest.at
    ) {
      return;
    }
    handledCategoryAtRef.current = categoryRequest.at;
    setCategory(categoryRequest.category);
    setSearchText('');
    setSelectedNetworkIds([]);
    setOpenKey(undefined);
  }, [categoryRequest]);

  const isFiltered = Boolean(
    searchText.trim() || selectedNetworkIds.length || category !== 'all',
  );
  const isEmpty = !isAssetsLoading && !rows.length;
  // A miss gets a way back to every token, as the Loans tab's does
  const handleResetFilters = useCallback(() => {
    setCategory('all');
    setSearchText('');
    setSelectedNetworkIds([]);
  }, []);

  return (
    <YStack gap="$4">
      <XStack ai="center" jc="space-between" gap="$4" flexWrap="wrap">
        <CategoryPills value={category} onChange={setCategory} />
        <XStack ai="center" gap="$3">
          <NetworkFilterControl
            testID="earn-desktop-earn-network-filter"
            variant={media.gtMd ? 'pill' : 'default'}
            availableNetworkIds={availableNetworkIds}
            selectedNetworkIds={selectedNetworkIds}
            networkAssetCounts={networkAssetCounts}
            onSelectionChange={setSelectedNetworkIds}
            triggerProps={{
              ...NETWORK_TRIGGER_PROPS,
              bg: selectedNetworkIds.length ? '$bgActive' : '$transparent',
            }}
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
        <EarnListEmptyState
          isFiltered={isFiltered}
          onReset={isFiltered ? handleResetFilters : undefined}
        />
      ) : (
        <FixedIncomeOnlyContext.Provider value={category === 'fixedIncome'}>
          <WalletColumnContext.Provider value={hasWallet}>
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
                <WalletColumn column={COLUMNS.balance}>
                  <HeaderLabel align="right">
                    {intl.formatMessage({
                      id: ETranslations.global_wallet_balance,
                    })}
                  </HeaderLabel>
                </WalletColumn>
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
              <YStack ref={listRef}>
                {isAssetsLoading && !rows.length
                  ? Array.from({ length: 6 }).map((_, index) => (
                      <ListItem
                        key={index}
                        minHeight={ROW_HEIGHT}
                        gap={ROW_GAP}
                      >
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
            </YStack>
          </WalletColumnContext.Provider>
        </FixedIncomeOnlyContext.Provider>
      )}
    </YStack>
  );
}

export const EarnDesktopEarnTab = memo(BasicEarnDesktopEarnTab);
