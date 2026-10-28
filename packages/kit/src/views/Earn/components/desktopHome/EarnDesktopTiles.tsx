import type { ReactNode } from 'react';
import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useReducedMotion } from 'react-native-reanimated';

import {
  Badge,
  Icon,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { IElement } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type { IEarnAvailableAsset } from '@onekeyhq/shared/types/earn';
import { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';
import type { IStakeProtocolListItem } from '@onekeyhq/shared/types/staking';

import { buildBorrowMarketKey } from '../../../Borrow/borrowMarketKey';
import { EarnNavigation } from '../../earnUtils';
import { useEarnAllProtocols } from '../../hooks/useEarnAllProtocols';
import { useNavigateToEarnAsset } from '../../hooks/useNavigateToEarnAsset';

import { ANIMATE_ONLY_BG_COLOR } from './earnDesktopColorEase';
import {
  EarnDesktopHoldCard,
  EarnDesktopHoldCardSkeleton,
  OfferRate,
} from './EarnDesktopHoldCard';
import { buildLoanOffers, buildOfferRows } from './earnDesktopHome.utils';
import {
  EarnDesktopSurfaceProvider,
  SurfaceToken,
  buildKeyboardPressProps,
  usePressableSurface,
} from './earnDesktopPressable';
import { useEarnDesktopSurfaces } from './useEarnDesktopSurfaces';

import type {
  IEarnDesktopHoldRow,
  IEarnDesktopLendingOffer,
  IEarnDesktopLoanOffer,
  IEarnDesktopMarketReserves,
  IEarnDesktopOfferKind,
  IEarnDesktopOfferRow,
} from './earnDesktopHome.utils';

const ROW_LIMIT = 3;
const ROW_HEIGHT = 50;

const formatPercent = (value: number | string) =>
  `${new BigNumber(value).toFixed(2)}%`;

// A second line that repeats the first ("sUSD3" under "sUSD3") says nothing
const distinctName = (name: string | undefined, symbol: string) =>
  name && name.trim().toLowerCase() !== symbol.trim().toLowerCase()
    ? name
    : undefined;

// ---------- Tile parts ----------

// One column of the tile row; the frame inside grows to the row's height
// What stands under the hero changes as the page loads: the loading tiles,
// then the holdings or the offers. When the new content's height differs,
// the box eases to it instead of moving the page at once: on a phone a
// holding with a badge takes a line more than its loading tile did
const SWAP_EASE_MS = 250;

function SwapHeightEase({
  contentKey,
  children,
}: {
  contentKey: string;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const boxRef = useRef<IElement>(null);
  const keyRef = useRef(contentKey);
  // The content's own height as last laid out
  const heightRef = useRef<number | undefined>(undefined);
  useLayoutEffect(() => {
    const box = boxRef.current as HTMLElement | null;
    if (!box?.getBoundingClientRect) {
      return undefined;
    }
    if (keyRef.current === contentKey) {
      heightRef.current = box.getBoundingClientRect().height;
      return undefined;
    }
    keyRef.current = contentKey;
    // Mid-ease the box shows the height it is pinned to
    const from = box.style.height
      ? box.getBoundingClientRect().height
      : heightRef.current;
    const release = () =>
      ['transition', 'height', 'overflow'].forEach((property) =>
        box.style.removeProperty(property),
      );
    release();
    const to = box.getBoundingClientRect().height;
    heightRef.current = to;
    if (reduceMotion || from === undefined || Math.abs(from - to) < 1) {
      return undefined;
    }
    box.style.overflow = 'hidden';
    box.style.height = `${from}px`;
    void box.offsetHeight;
    box.style.transition = `height ${SWAP_EASE_MS}ms cubic-bezier(0.2, 0, 0, 1)`;
    box.style.height = `${to}px`;
    const timer = setTimeout(release, SWAP_EASE_MS + 50);
    return () => clearTimeout(timer);
  }, [contentKey, reduceMotion]);
  return (
    <YStack
      ref={boxRef}
      onLayout={(event) => {
        if (!(boxRef.current as HTMLElement | null)?.style?.height) {
          heightRef.current = event.nativeEvent.layout.height;
        }
      }}
    >
      {children}
    </YStack>
  );
}

function TileSlot({ children }: { children: ReactNode }) {
  return (
    <YStack flex={1} flexBasis={0} minWidth={0}>
      {children}
    </YStack>
  );
}

function TileFrame({ children }: { children: ReactNode }) {
  const surfaces = useEarnDesktopSurfaces();
  return (
    // The last row's text sits as far from the bottom edge as the title does
    // from the top
    <YStack
      flexGrow={1}
      bg={surfaces.rest}
      borderRadius="$5"
      borderCurve="continuous"
      px="$4"
      pt="$4"
      pb="$4"
    >
      {children}
    </YStack>
  );
}

function TileHead({ title, onPress }: { title: string; onPress?: () => void }) {
  // Subdued until hovered, the way the tabs below brighten
  const [isHovered, setIsHovered] = useState(false);
  return (
    <XStack
      ai="center"
      gap="$0.5"
      alignSelf="flex-start"
      {...(onPress
        ? {
            role: 'button' as const,
            cursor: 'pointer' as const,
            userSelect: 'none' as const,
            borderRadius: '$1' as const,
            pressStyle: { opacity: 0.6 },
            onHoverIn: () => setIsHovered(true),
            onHoverOut: () => setIsHovered(false),
            onPress,
          }
        : undefined)}
      {...buildKeyboardPressProps(onPress, 2)}
    >
      <SizableText
        size="$bodyMdMedium"
        color={isHovered ? '$text' : '$textSubdued'}
      >
        {title}
      </SizableText>
      {onPress ? (
        <Icon
          name="ChevronRightSmallOutline"
          size="$4"
          color={isHovered ? '$icon' : '$iconSubdued'}
        />
      ) : null}
    </XStack>
  );
}

function TileRow({
  icon,
  primary,
  secondary,
  right,
  testID,
  onPress,
}: {
  icon: ReactNode;
  primary: ReactNode;
  secondary?: ReactNode;
  right?: ReactNode;
  testID?: string;
  onPress?: () => void;
}) {
  // Opaque card steps rather than a translucent wash, so the network badges'
  // rings take the row's color as it changes
  const { surface, isActive, handlers } = usePressableSurface(!!onPress);
  const reduceMotion = useReducedMotion();
  return (
    <EarnDesktopSurfaceProvider value={surface}>
      <XStack
        testID={testID}
        ai="center"
        gap="$2.5"
        minHeight={ROW_HEIGHT}
        // Eases with the badges' rings, which ease the same way
        transition={reduceMotion ? undefined : 'quick'}
        animateOnly={ANIMATE_ONLY_BG_COLOR}
        {...(onPress
          ? {
              // Highlights like the table rows. The negative margin lets the
              // highlight reach into the tile's padding while the content
              // stays in line with the tile's title
              role: 'button' as const,
              px: '$2',
              mx: '$-2',
              borderRadius: '$3',
              borderCurve: 'continuous' as const,
              bg: isActive ? surface : undefined,
              cursor: 'pointer' as const,
              userSelect: 'none' as const,
              onPress,
              ...handlers,
            }
          : undefined)}
        {...buildKeyboardPressProps(onPress)}
      >
        {icon}
        <YStack flex={1} minWidth={0}>
          {primary}
          {secondary}
        </YStack>
        {right ? (
          <XStack flexShrink={0} ai="center">
            {right}
          </XStack>
        ) : null}
      </XStack>
    </EarnDesktopSurfaceProvider>
  );
}

function RowText({
  children,
  subdued,
}: {
  children: ReactNode;
  subdued?: boolean;
}) {
  return (
    <SizableText
      size={subdued ? '$bodySm' : '$bodyMdMedium'}
      color={subdued ? '$textSubdued' : '$text'}
      numberOfLines={1}
    >
      {children}
    </SizableText>
  );
}

// A loaded tile's boxes, so the row keeps its height when the data lands
function TileSkeleton() {
  return (
    <TileFrame>
      <Skeleton w={88} h={14} my={3} borderRadius="$2" />
      <YStack mt="$2">
        {Array.from({ length: ROW_LIMIT }).map((_, index) => (
          <XStack key={index} ai="center" gap="$2.5" h={ROW_HEIGHT}>
            <Skeleton w="$8" h="$8" radius="round" />
            <YStack flex={1} gap="$1.5">
              <Skeleton w="70%" h={14} borderRadius="$2" />
              <Skeleton w="40%" h={12} borderRadius="$2" />
            </YStack>
          </XStack>
        ))}
      </YStack>
    </TileFrame>
  );
}

// ---------- Offers for empty tiles ----------

// A token on one network: its chain on the icon, the best rate there
function NetworkOfferRow({
  row,
  onPress,
}: {
  row: IEarnDesktopOfferRow;
  onPress: () => void;
}) {
  const [best] = row.offers;
  const symbol = earnUtils.getDisplaySymbol(row.asset);
  // The rate shown is the best offer's, so its badge (a bonus) is too
  const badge =
    best.kind === 'protocol' ? best.item.provider.badges?.[0] : undefined;
  return (
    <TileRow
      testID={`earn-desktop-offer-${row.networkId}-${row.asset.symbol}`}
      onPress={onPress}
      icon={
        <SurfaceToken
          size="md"
          tokenImageUri={row.asset.logoURI}
          networkId={row.networkId}
        />
      }
      primary={
        <XStack ai="center" gap="$1.5" minWidth={0}>
          <SizableText size="$bodyMdMedium" numberOfLines={1} flexShrink={1}>
            {symbol}
          </SizableText>
          {badge ? (
            <Badge badgeType={badge.badgeType} badgeSize="sm">
              <Badge.Text>{badge.tag}</Badge.Text>
            </Badge>
          ) : null}
        </XStack>
      }
      secondary={
        distinctName(row.asset.name, symbol) ? (
          <RowText subdued>{row.asset.name}</RowText>
        ) : undefined
      }
      right={<OfferRate offer={best} size="$bodyMdMedium" />}
    />
  );
}

type IOfferLists = {
  trending: IEarnDesktopOfferRow[];
  fixed: IEarnDesktopOfferRow[];
  loans: IEarnDesktopLoanOffer[];
};

// A card is its title over three rows; the rows say the rates
function OfferTile({
  kind,
  lists,
  onOpenTokens,
  onOpenBorrow,
}: {
  kind: IEarnDesktopOfferKind;
  lists: IOfferLists;
  onOpenTokens: () => void;
  onOpenBorrow: (market?: IEarnDesktopMarketReserves['market']) => void;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const navigateToAsset = useNavigateToEarnAsset();
  const { trending, fixed, loans } = lists;

  if (kind === 'trending') {
    if (!trending.length) {
      return <TileSkeleton />;
    }
    return (
      <TileFrame>
        <TileHead
          title={intl.formatMessage({
            id: ETranslations.trending_tokens__title,
          })}
          onPress={onOpenTokens}
        />
        <YStack mt="$2">
          {trending.map((row) => (
            <NetworkOfferRow
              key={row.key}
              row={row}
              onPress={() =>
                void navigateToAsset(
                  row.asset,
                  EAvailableAssetsTypeEnum.SimpleEarn,
                )
              }
            />
          ))}
        </YStack>
      </TileFrame>
    );
  }

  if (kind === 'fixedIncome') {
    if (!fixed.length) {
      return <TileSkeleton />;
    }
    return (
      <TileFrame>
        <TileHead
          title={intl.formatMessage({ id: ETranslations.earn_fixed_income })}
          onPress={() => EarnNavigation.pushToEarnFixedRateTokens(navigation)}
        />
        <YStack mt="$2">
          {fixed.map((row) => (
            <NetworkOfferRow
              key={row.key}
              row={row}
              onPress={() =>
                void navigateToAsset(
                  row.asset,
                  EAvailableAssetsTypeEnum.FixedRate,
                )
              }
            />
          ))}
        </YStack>
      </TileFrame>
    );
  }

  if (kind === 'borrow') {
    if (!loans.length) {
      return <TileSkeleton />;
    }
    return (
      <TileFrame>
        <TileHead
          title={intl.formatMessage({ id: ETranslations.earn_loans__action })}
          onPress={() => onOpenBorrow()}
        />
        <YStack mt="$2">
          {loans.map((offer) => (
            <TileRow
              key={`${buildBorrowMarketKey(offer.market)}-${offer.reserveAddress}`}
              testID={`earn-desktop-loan-${offer.market.networkId}-${offer.symbol}`}
              onPress={() => onOpenBorrow(offer.market)}
              icon={
                <SurfaceToken
                  size="md"
                  tokenImageUri={offer.logoURI}
                  networkId={offer.market.networkId}
                />
              }
              primary={<RowText>{offer.symbol}</RowText>}
              secondary={<RowText subdued>{offer.marketLabel}</RowText>}
              right={
                <SizableText size="$bodyMdMedium">
                  {formatPercent(offer.apy)}
                </SizableText>
              }
            />
          ))}
        </YStack>
      </TileFrame>
    );
  }

  return null;
}

// ---------- Under the hero ----------

const OFFER_KINDS: IEarnDesktopOfferKind[] = [
  'trending',
  'fixedIncome',
  'borrow',
];

/**
 * What the wallet holds and can earn on comes first. A wallet with nothing
 * Earn takes gets the offers a new account sees instead.
 */
function BasicEarnDesktopTiles({
  holdRows,
  networkNames,
  isLoading,
  markets,
  isMarketsLoaded,
  trendingAssets,
  fixedRateAssets,
  isTrendingLoading,
  isFixedRateLoading,
  lendingOffers,
  onOpenBorrow,
  onOpenTokens,
  onOpenHoldRow,
}: {
  holdRows: IEarnDesktopHoldRow[];
  networkNames: Map<string, string>;
  /** Until the wallet, the Earn lists and the markets have each answered */
  isLoading: boolean;
  markets: IEarnDesktopMarketReserves[];
  isMarketsLoaded: boolean;
  trendingAssets: IEarnAvailableAsset[];
  fixedRateAssets: IEarnAvailableAsset[];
  isTrendingLoading: boolean;
  isFixedRateLoading: boolean;
  lendingOffers: Map<string, IEarnDesktopLendingOffer[]>;
  onOpenBorrow: (market?: IEarnDesktopMarketReserves['market']) => void;
  onOpenTokens: () => void;
  onOpenHoldRow: (row: IEarnDesktopHoldRow) => void;
}) {
  const media = useMedia();
  // Every protocol's rate and TVL in one list, the one the Earn table reads.
  // Trending and Fixed Income wait for it: without it their rows would be
  // the lending rates alone, in no order
  const { providers, isSettled: isProtocolsSettled } = useEarnAllProtocols();
  const protocolsBySymbol = useMemo(() => {
    const bySymbol = new Map<string, IStakeProtocolListItem[]>();
    providers.forEach(({ tokens }) =>
      tokens.forEach(({ symbol, item }) => {
        const key = symbol.toLowerCase();
        bySymbol.set(key, [...(bySymbol.get(key) ?? []), item]);
      }),
    );
    return bySymbol;
  }, [providers]);
  const offerLists = useMemo<IOfferLists>(() => {
    const loans = buildLoanOffers(markets, ROW_LIMIT);
    if (!protocolsBySymbol.size) {
      return { trending: [], fixed: [], loans };
    }
    return {
      // The most deposited first; Fixed Income's best rate first
      trending: buildOfferRows({
        assets: trendingAssets,
        protocolsBySymbol,
        lendingOffers,
        isFixedRate: false,
      })
        .toSorted((a, b) => b.tvl - a.tvl)
        .slice(0, ROW_LIMIT),
      fixed: buildOfferRows({
        assets: fixedRateAssets,
        protocolsBySymbol,
        lendingOffers,
        isFixedRate: true,
      })
        .toSorted((a, b) => b.offers[0].apr - a.offers[0].apr)
        .slice(0, ROW_LIMIT),
      loans,
    };
  }, [
    fixedRateAssets,
    lendingOffers,
    markets,
    protocolsBySymbol,
    trendingAssets,
  ]);

  if (isLoading) {
    return (
      <SwapHeightEase contentKey="loading">
        <EarnDesktopHoldCardSkeleton />
      </SwapHeightEase>
    );
  }
  if (holdRows.length) {
    return (
      <SwapHeightEase contentKey="holdings">
        <EarnDesktopHoldCard
          rows={holdRows}
          networkNames={networkNames}
          onOpenRow={onOpenHoldRow}
        />
      </SwapHeightEase>
    );
  }

  // An offer whose list loaded empty, or failed, drops its card rather than
  // shimmering forever
  const isOfferUnavailable = (kind: IEarnDesktopOfferKind) => {
    if (kind === 'trending') {
      return (
        !offerLists.trending.length && !isTrendingLoading && isProtocolsSettled
      );
    }
    if (kind === 'fixedIncome') {
      return (
        !offerLists.fixed.length && !isFixedRateLoading && isProtocolsSettled
      );
    }
    if (kind === 'borrow') {
      return !offerLists.loans.length && isMarketsLoaded;
    }
    return true;
  };
  const tiles = OFFER_KINDS.filter((kind) => !isOfferUnavailable(kind)).map(
    (kind) => (
      <TileSlot key={kind}>
        <OfferTile
          kind={kind}
          lists={offerLists}
          onOpenTokens={onOpenTokens}
          onOpenBorrow={onOpenBorrow}
        />
      </TileSlot>
    ),
  );
  // Three across from 1024; two on a tablet; one a row on a phone
  let perRow = 1;
  if (media.gtLg) {
    perRow = Math.max(tiles.length, 1);
  } else if (media.gtMd) {
    perRow = 2;
  }
  const rows: ReactNode[][] = [];
  for (let index = 0; index < tiles.length; index += perRow) {
    rows.push(tiles.slice(index, index + perRow));
  }
  return (
    <SwapHeightEase contentKey="offers">
      <YStack gap="$4">
        {rows.map((rowTiles, rowIndex) => (
          <XStack key={rowIndex} gap="$4">
            {rowTiles}
            {Array.from({ length: perRow - rowTiles.length }).map(
              (_, index) => (
                <TileSlot key={`spacer-${index}`}>{null}</TileSlot>
              ),
            )}
          </XStack>
        ))}
      </YStack>
    </SwapHeightEase>
  );
}

export const EarnDesktopTiles = memo(BasicEarnDesktopTiles);
