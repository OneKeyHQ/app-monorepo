import type { ComponentProps, ReactNode } from 'react';
import { useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  Icon,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type { IEarnAvailableAsset } from '@onekeyhq/shared/types/earn';
import { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';

import { buildBorrowMarketKey } from '../../../Borrow/borrowMarketKey';
import { EarnNavigation } from '../../earnUtils';
import { useNavigateToEarnAsset } from '../../hooks/useNavigateToEarnAsset';
import { parseAprPercentValue } from '../../utils/availableAssetsUtils';
import { AprText } from '../AprText';

import {
  EarnDesktopHoldCard,
  EarnDesktopHoldCardSkeleton,
} from './EarnDesktopHoldCard';
import { buildBorrowOffers } from './earnDesktopHome.utils';
import { EARN_DESKTOP_DEMO_COPY } from './earnDesktopHomeCopy';
import {
  EarnDesktopSurfaceProvider,
  SurfaceToken,
  buildKeyboardPressProps,
  usePressableSurface,
} from './earnDesktopPressable';
import { useEarnDesktopSurfaces } from './useEarnDesktopSurfaces';

import type {
  IEarnDesktopHoldRow,
  IEarnDesktopMarketReserves,
  IEarnDesktopOfferKind,
} from './earnDesktopHome.utils';

const ROW_LIMIT = 3;
const ROW_HEIGHT = 50;

// The best rate an asset shows, the way AprText picks its text
function getAssetMaxApr(asset: {
  aprWithoutFee?: string;
  apr?: string;
  aprInfo?: IEarnAvailableAsset['aprInfo'];
  maxAprInfo?: IEarnAvailableAsset['maxAprInfo'];
}) {
  return Math.max(
    parseAprPercentValue(asset.maxAprInfo?.normal?.text),
    parseAprPercentValue(asset.aprInfo?.highlight?.text),
    parseAprPercentValue(asset.aprInfo?.normal?.text),
    parseAprPercentValue(asset.aprWithoutFee || asset.apr),
  );
}

// The color AprText gives an asset's rate: the server's highlight or range
// color (a bonus, say), else plain text. Rates are offers, so this code never
// paints them green on its own; green is for money already earned
function getAssetRateColor(asset: {
  aprInfo?: IEarnAvailableAsset['aprInfo'];
  minAprInfo?: IEarnAvailableAsset['minAprInfo'];
  maxAprInfo?: IEarnAvailableAsset['maxAprInfo'];
}): ComponentProps<typeof SizableText>['color'] {
  if (asset.minAprInfo?.normal?.text && asset.maxAprInfo?.normal?.text) {
    return (
      asset.minAprInfo.normal.color ||
      asset.maxAprInfo.normal.color ||
      asset.aprInfo?.normal?.color ||
      '$text'
    );
  }
  if (asset.aprInfo?.highlight) {
    return asset.aprInfo.highlight.color || '$textSuccess';
  }
  return asset.aprInfo?.normal?.color || '$text';
}

const formatPercent = (value: number | string) =>
  `${new BigNumber(value).toFixed(2)}%`;

// A second line that repeats the first ("sUSD3" under "sUSD3") says nothing
const distinctName = (name: string | undefined, symbol: string) =>
  name && name.trim().toLowerCase() !== symbol.trim().toLowerCase()
    ? name
    : undefined;

// ---------- Tile parts ----------

// One column of the tile row; the frame inside grows to the row's height
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

function TileRateValue({ prefix, value }: { prefix: string; value: number }) {
  return (
    <XStack ai="baseline" gap="$1.5">
      <SizableText size="$bodyLg" color="$textSubdued">
        {prefix}
      </SizableText>
      <SizableText size="$headingXl" fontWeight={500} numberOfLines={1}>
        {formatPercent(value)}
      </SizableText>
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
  return (
    <EarnDesktopSurfaceProvider value={surface}>
      <XStack
        testID={testID}
        ai="center"
        gap="$2.5"
        minHeight={ROW_HEIGHT}
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

function RowUpTo({
  value,
  color = '$text',
}: {
  value: number;
  color?: ComponentProps<typeof SizableText>['color'];
}) {
  return (
    <XStack ai="baseline" gap="$1">
      <SizableText size="$bodySm" color="$textSubdued">
        {EARN_DESKTOP_DEMO_COPY.upTo}
      </SizableText>
      <SizableText size="$bodyMdMedium" color={color}>
        {formatPercent(value)}
      </SizableText>
    </XStack>
  );
}

// A loaded tile's boxes, its "N more" line included, so the row keeps its
// height when the data lands
function TileSkeleton() {
  return (
    <TileFrame>
      <Skeleton w={88} h={14} my={3} borderRadius="$2" />
      <Skeleton w={96} h={20} my={4} borderRadius="$2" />
      <YStack mt="$3">
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
      <XStack mt="auto" pt="$2">
        <Skeleton w={56} h={14} my={3} borderRadius="$2" />
      </XStack>
    </TileFrame>
  );
}

// ---------- Offers for empty tiles ----------

function AssetOfferRow({
  asset,
  onPress,
}: {
  asset: IEarnAvailableAsset;
  onPress: () => void;
}) {
  return (
    <TileRow
      onPress={onPress}
      icon={
        <Token size="md" tokenImageUri={asset.logoURI} borderRadius="$full" />
      }
      primary={
        <XStack ai="center" gap="$1.5" minWidth={0}>
          <SizableText size="$bodyMdMedium" numberOfLines={1} flexShrink={1}>
            {earnUtils.getDisplaySymbol(asset)}
          </SizableText>
          {asset.badges?.slice(0, 1).map((badge) => (
            <Badge key={badge.tag} badgeType={badge.badgeType} badgeSize="sm">
              <Badge.Text>{badge.tag}</Badge.Text>
            </Badge>
          ))}
        </XStack>
      }
      secondary={
        distinctName(asset.name, earnUtils.getDisplaySymbol(asset)) ? (
          <RowText subdued>{asset.name}</RowText>
        ) : undefined
      }
      right={
        // A row has room for one number, so a range shows its top
        asset.minAprInfo?.normal?.text && asset.maxAprInfo?.normal?.text ? (
          <RowUpTo
            value={getAssetMaxApr(asset)}
            color={getAssetRateColor(asset)}
          />
        ) : (
          <AprText asset={asset} size="$bodyMdMedium" hideSuffix />
        )
      }
    />
  );
}

type IOfferLists = {
  trending: IEarnAvailableAsset[];
  fixed: IEarnAvailableAsset[];
  borrowOffers: ReturnType<typeof buildBorrowOffers>;
};

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
  const { trending, fixed, borrowOffers } = lists;

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
        <TileRateValue
          prefix={EARN_DESKTOP_DEMO_COPY.upTo}
          value={Math.max(...trending.map(getAssetMaxApr))}
        />
        <YStack mt="$3">
          {trending.map((asset) => (
            <AssetOfferRow
              key={asset.symbol}
              asset={asset}
              onPress={() =>
                void navigateToAsset(asset, EAvailableAssetsTypeEnum.SimpleEarn)
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
        <TileRateValue
          prefix={EARN_DESKTOP_DEMO_COPY.upTo}
          value={getAssetMaxApr(fixed[0])}
        />
        <YStack mt="$3">
          {fixed.map((asset) => (
            <AssetOfferRow
              key={asset.symbol}
              asset={asset}
              onPress={() =>
                void navigateToAsset(asset, EAvailableAssetsTypeEnum.FixedRate)
              }
            />
          ))}
        </YStack>
      </TileFrame>
    );
  }

  if (kind === 'borrow') {
    if (!borrowOffers.length) {
      return <TileSkeleton />;
    }
    return (
      <TileFrame>
        <TileHead
          title={intl.formatMessage({ id: ETranslations.global_borrow })}
          onPress={() => onOpenBorrow()}
        />
        <TileRateValue
          prefix={EARN_DESKTOP_DEMO_COPY.from}
          value={Math.min(
            ...borrowOffers.map((offer) => Number(offer.apy) || 0),
          )}
        />
        <YStack mt="$3">
          {borrowOffers.map((offer) => (
            <TileRow
              key={`${buildBorrowMarketKey(offer.market)}-${offer.reserveAddress}`}
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
export function EarnDesktopTiles({
  holdRows,
  networkNames,
  isLoading,
  markets,
  isMarketsLoaded,
  trendingAssets,
  fixedRateAssets,
  isTrendingLoading,
  isFixedRateLoading,
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
  onOpenBorrow: (market?: IEarnDesktopMarketReserves['market']) => void;
  onOpenTokens: () => void;
  onOpenHoldRow: (row: IEarnDesktopHoldRow) => void;
}) {
  const media = useMedia();
  const offerLists = useMemo<IOfferLists>(
    () => ({
      trending: trendingAssets.slice(0, ROW_LIMIT),
      fixed: fixedRateAssets
        .toSorted((a, b) => getAssetMaxApr(b) - getAssetMaxApr(a))
        .slice(0, ROW_LIMIT),
      borrowOffers: buildBorrowOffers(markets, ROW_LIMIT),
    }),
    [fixedRateAssets, markets, trendingAssets],
  );

  if (isLoading) {
    return <EarnDesktopHoldCardSkeleton />;
  }
  if (holdRows.length) {
    return (
      <EarnDesktopHoldCard
        rows={holdRows}
        networkNames={networkNames}
        onOpenRow={onOpenHoldRow}
      />
    );
  }

  // An offer whose list loaded empty, or failed, drops its card rather than
  // shimmering forever
  const isOfferUnavailable = (kind: IEarnDesktopOfferKind) => {
    if (kind === 'trending') {
      return !offerLists.trending.length && !isTrendingLoading;
    }
    if (kind === 'fixedIncome') {
      return !offerLists.fixed.length && !isFixedRateLoading;
    }
    if (kind === 'borrow') {
      return !offerLists.borrowOffers.length && isMarketsLoaded;
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
    <YStack gap="$4">
      {rows.map((rowTiles, rowIndex) => (
        <XStack key={rowIndex} gap="$4">
          {rowTiles}
          {Array.from({ length: perRow - rowTiles.length }).map((_, index) => (
            <TileSlot key={`spacer-${index}`}>{null}</TileSlot>
          ))}
        </XStack>
      ))}
    </YStack>
  );
}
