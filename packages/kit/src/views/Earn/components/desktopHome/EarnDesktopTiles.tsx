import type { ComponentProps, ReactNode } from 'react';
import { useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  Icon,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type { IEarnAvailableAsset } from '@onekeyhq/shared/types/earn';
import { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';
import type {
  IEarnPortfolioInvestment,
  IRecommendAsset,
} from '@onekeyhq/shared/types/staking';
import { EManagePositionType } from '@onekeyhq/shared/types/staking';

import { getBorrowMarketLabel } from '../../../Borrow/borrowMarketDisplayName';
import { BorrowNavigation } from '../../../Borrow/borrowUtils';
import { hasPositiveBorrowBalance } from '../../../Borrow/components/borrowRepayPosition.utils';
import { EarnText } from '../../../Staking/components/ProtocolDetails/EarnText';
import { EarnNavigation } from '../../earnUtils';
import { useNavigateToEarnAsset } from '../../hooks/useNavigateToEarnAsset';
import { parseAprPercentValue } from '../../utils/availableAssetsUtils';
import { AprText } from '../AprText';
import { WrappedActionButton } from '../PortfolioTabContent';

import {
  buildBorrowOffers,
  collectTileRows,
  pickTileOffers,
  sumBorrowedFiat,
} from './earnDesktopHome.utils';
import { EARN_DESKTOP_DEMO_COPY } from './earnDesktopHomeCopy';
import { extractAvailableAmount } from './useEarnDesktopHomeData';
import { useEarnDesktopSurfaces } from './useEarnDesktopSurfaces';

import type {
  IEarnDesktopMarketReserves,
  IEarnDesktopOfferKind,
  IEarnDesktopRowAction,
  IEarnDesktopTileRow,
  IEarnDesktopTileRows,
} from './earnDesktopHome.utils';
import type { IEarnDesktopAccountMarket } from './useEarnDesktopHomeData';

const ROW_LIMIT = 3;
const ROW_HEIGHT = 50;
const TILE_BUTTON_PROPS = { size: 'small', variant: 'secondary' } as const;

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
    <YStack
      flexGrow={1}
      bg={surfaces.rest}
      borderRadius="$5"
      borderCurve="continuous"
      px="$4"
      pt="$4"
      pb="$3"
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
            pressStyle: { opacity: 0.6 },
            onHoverIn: () => setIsHovered(true),
            onHoverOut: () => setIsHovered(false),
            onPress,
          }
        : undefined)}
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

function TileFiatValue({ value }: { value: number | string }) {
  const [settings] = useSettingsPersistAtom();
  return (
    <NumberSizeableTextWrapper
      hideValue
      size="$headingXl"
      fontWeight={500}
      formatter="value"
      formatterOptions={{ currency: settings.currencyInfo.symbol }}
      numberOfLines={1}
    >
      {String(value)}
    </NumberSizeableTextWrapper>
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
  return (
    <XStack
      testID={testID}
      ai="center"
      gap="$2.5"
      minHeight={ROW_HEIGHT}
      {...(onPress
        ? {
            // Highlights like the table rows. The negative margin lets the
            // highlight reach into the tile's padding while the content stays
            // in line with the tile's title
            role: 'button' as const,
            px: '$2',
            mx: '$-2',
            borderRadius: '$3',
            borderCurve: 'continuous' as const,
            cursor: 'pointer' as const,
            userSelect: 'none' as const,
            hoverStyle: { bg: '$bgHover' },
            pressStyle: { bg: '$bgActive' },
            onPress,
          }
        : undefined)}
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
  );
}

function RowAmount({ amount, symbol }: { amount: string; symbol: string }) {
  return (
    <NumberSizeableTextWrapper
      hideValue
      size="$bodyMdMedium"
      formatter="balance"
      formatterOptions={{ tokenSymbol: symbol }}
      numberOfLines={1}
    >
      {amount}
    </NumberSizeableTextWrapper>
  );
}

function RowFiat({ value }: { value: string }) {
  const [settings] = useSettingsPersistAtom();
  return (
    <NumberSizeableTextWrapper
      hideValue
      size="$bodySm"
      color="$textSubdued"
      formatter="value"
      formatterOptions={{ currency: settings.currencyInfo.symbol }}
      numberOfLines={1}
    >
      {value}
    </NumberSizeableTextWrapper>
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

function PendingBadge() {
  const intl = useIntl();
  return (
    <Badge badgeType="info" badgeSize="lg">
      <Badge.Text>
        {intl.formatMessage({ id: ETranslations.global_pending })}
      </Badge.Text>
    </Badge>
  );
}

function MoreLink({ count, onPress }: { count: number; onPress: () => void }) {
  if (count <= 0) {
    return null;
  }
  return (
    <XStack mt="auto" pt="$2">
      <TileHead title={EARN_DESKTOP_DEMO_COPY.more(count)} onPress={onPress} />
    </XStack>
  );
}

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
    </TileFrame>
  );
}

// ---------- Rewards and Withdrawals ----------

const DAY_MS = 24 * 60 * 60 * 1000;

function RowActionButton({ action }: { action: IEarnDesktopRowAction }) {
  if (action.source === 'airdrop') {
    return (
      <WrappedActionButton
        asset={action.asset}
        reward={action.reward}
        claimSourceIdentity={action.claimSourceIdentity}
        rewardSymbol={action.rewardSymbol}
        buttonProps={TILE_BUTTON_PROPS}
      />
    );
  }
  return (
    <WrappedActionButton
      asset={action.asset}
      reward={action.reward}
      rewardSymbol={action.rewardSymbol}
      buttonProps={TILE_BUTTON_PROPS}
    />
  );
}

function PortfolioRow({ item }: { item: IEarnDesktopTileRow }) {
  const intl = useIntl();
  let right: ReactNode = null;
  if (item.isPending) {
    right = <PendingBadge />;
  } else if (item.action) {
    right = <RowActionButton action={item.action} />;
  } else if (item.kind === 'unstaking') {
    right = item.unlockAt ? (
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage(
          { id: ETranslations.earn_number_days_left },
          {
            number: Math.max(
              1,
              Math.ceil((item.unlockAt - Date.now()) / DAY_MS),
            ),
          },
        )}
      </SizableText>
    ) : (
      <EarnText size="$bodyMd" color="$textSubdued" text={item.description} />
    );
  }
  return (
    <TileRow
      icon={
        <Token
          size="md"
          tokenImageUri={item.logoURI}
          networkId={item.networkId}
          showNetworkIcon
        />
      }
      primary={
        item.amount ? (
          <RowAmount amount={item.amount} symbol={item.symbol} />
        ) : (
          <EarnText size="$bodyMdMedium" numberOfLines={1} text={item.title} />
        )
      }
      secondary={
        item.fiatValue > 0 || item.amount ? (
          <RowFiat value={String(item.fiatValue)} />
        ) : (
          <EarnText
            size="$bodySm"
            color="$textSubdued"
            numberOfLines={1}
            text={item.description}
          />
        )
      }
      right={right}
    />
  );
}

function PortfolioRowsTile({
  title,
  data,
  onOpenPortfolio,
}: {
  title: string;
  data: IEarnDesktopTileRows;
  onOpenPortfolio: () => void;
}) {
  return (
    <TileFrame>
      <TileHead title={title} onPress={onOpenPortfolio} />
      <TileFiatValue value={data.totalFiatValue} />
      <YStack mt="$3">
        {data.rows.slice(0, ROW_LIMIT).map((item) => (
          <PortfolioRow key={item.key} item={item} />
        ))}
      </YStack>
      <MoreLink
        count={data.rows.length - ROW_LIMIT}
        onPress={onOpenPortfolio}
      />
    </TileFrame>
  );
}

// ---------- Loans ----------

function HealthFactorRow({
  entry,
  onPress,
}: {
  entry: IEarnDesktopAccountMarket;
  onPress?: () => void;
}) {
  const intl = useIntl();
  return (
    <TileRow
      onPress={onPress}
      icon={
        <Token
          size="md"
          tokenImageUri={entry.market.logoURI}
          networkId={entry.market.networkId}
          showNetworkIcon
        />
      }
      primary={<RowText>{getBorrowMarketLabel(entry.market)}</RowText>}
      secondary={
        <RowText subdued>
          {intl.formatMessage({ id: ETranslations.defi_health_factor })}
        </RowText>
      }
      right={
        <EarnText
          size="$bodyLgMedium"
          text={entry.healthFactor?.healthFactor.text}
        />
      }
    />
  );
}

function LoansTile({
  loans,
  onOpenMarket,
}: {
  loans: IEarnDesktopAccountMarket[];
  onOpenMarket: (entry?: IEarnDesktopAccountMarket) => void;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const surfaces = useEarnDesktopSurfaces();
  const totalBorrowed = useMemo(() => sumBorrowedFiat(loans), [loans]);
  const title = intl.formatMessage({ id: ETranslations.earn_loans__action });

  const [firstLoan] = loans;
  let rows: ReactNode[] = [];
  let moreCount = 0;
  if (loans.length > 1) {
    // Several markets: one health factor per market
    rows = loans
      .slice(0, ROW_LIMIT)
      .map((entry) => (
        <HealthFactorRow
          key={entry.market.marketAddress}
          entry={entry}
          onPress={() => onOpenMarket(entry)}
        />
      ));
    moreCount = loans.length - ROW_LIMIT;
  } else if (firstLoan) {
    const { market, reserves, accountId = '' } = firstLoan;
    const borrowed = (reserves?.borrowed?.assets ?? []).filter((asset) =>
      hasPositiveBorrowBalance(asset.borrowedAmount),
    );
    const supplied = reserves?.supplied?.assets ?? [];
    const all: ReactNode[] = [
      <HealthFactorRow key="health-factor" entry={firstLoan} />,
      ...borrowed.map((asset) => (
        <TileRow
          key={asset.reserveAddress}
          icon={
            <Token
              size="md"
              tokenImageUri={asset.token.logoURI}
              networkId={market.networkId}
              showNetworkIcon
            />
          }
          primary={
            <RowAmount
              amount={asset.borrowedAmount.amount ?? '0'}
              symbol={asset.token.symbol}
            />
          }
          secondary={<RowFiat value={asset.borrowedAmount.fiatValue ?? '0'} />}
          right={
            <Button
              testID={`earn-desktop-repay-${asset.reserveAddress}`}
              {...TILE_BUTTON_PROPS}
              onPress={() =>
                BorrowNavigation.pushToBorrowManagePosition(navigation, {
                  accountId,
                  networkId: market.networkId,
                  provider: market.provider,
                  marketAddress: market.marketAddress,
                  reserveAddress: asset.reserveAddress,
                  symbol: asset.token.symbol,
                  providerLogoURI: market.logoURI,
                  logoURI: asset.token.logoURI,
                  type: EManagePositionType.Repay,
                })
              }
            >
              {intl.formatMessage({ id: ETranslations.defi_repay })}
            </Button>
          }
        />
      )),
    ];
    if (supplied.length) {
      all.push(
        <TileRow
          key="supplied"
          icon={
            <XStack>
              {supplied.slice(0, 3).map((asset, index) => (
                <YStack
                  key={asset.reserveAddress}
                  ml={index ? -14 : 0}
                  borderRadius="$full"
                  borderWidth={2}
                  borderColor={surfaces.rest}
                >
                  <Token size="sm" tokenImageUri={asset.token.logoURI} />
                </YStack>
              ))}
            </XStack>
          }
          primary={
            <RowText>
              {intl.formatMessage({
                id: ETranslations.wallet_defi_asset_type_supplied,
              })}
            </RowText>
          }
          secondary={
            <EarnText
              size="$bodySm"
              color="$textSubdued"
              text={reserves?.supplied?.suppliedBalance?.title}
            />
          }
        />,
      );
    }
    rows = all.slice(0, ROW_LIMIT);
    moreCount = all.length - ROW_LIMIT;
  }

  return (
    <TileFrame>
      <TileHead title={title} onPress={() => onOpenMarket(firstLoan)} />
      <TileFiatValue value={totalBorrowed.toFixed()} />
      <YStack mt="$3">{rows}</YStack>
      <MoreLink count={moreCount} onPress={() => onOpenMarket(firstLoan)} />
    </TileFrame>
  );
}

// ---------- In your wallet ----------

type IHeldToken = {
  token: IRecommendAsset;
  amount: string;
  maxApr: number;
  rateColor: ComponentProps<typeof SizableText>['color'];
};

function WalletTile({
  heldTokens,
  onOpenToken,
  onOpenTokens,
}: {
  heldTokens: IHeldToken[];
  onOpenToken: (symbol: string) => void;
  onOpenTokens: () => void;
}) {
  const bestApr = Math.max(0, ...heldTokens.map((item) => item.maxApr));
  return (
    <TileFrame>
      <TileHead
        title={EARN_DESKTOP_DEMO_COPY.inYourWallet}
        onPress={onOpenTokens}
      />
      {/* The recommend list has no fiat value per token (backend ask 3), so
          the tile leads with the best rate instead of a dollar total */}
      <TileRateValue prefix={EARN_DESKTOP_DEMO_COPY.upTo} value={bestApr} />
      <YStack mt="$3">
        {heldTokens
          .slice(0, ROW_LIMIT)
          .map(({ token, amount, maxApr, rateColor }) => (
            <TileRow
              key={token.symbol}
              onPress={() => onOpenToken(token.symbol)}
              icon={<Token size="md" tokenImageUri={token.logoURI} />}
              primary={
                <RowAmount
                  amount={amount}
                  symbol={earnUtils.getDisplaySymbol(token)}
                />
              }
              secondary={<RowText subdued>{token.name}</RowText>}
              right={<RowUpTo value={maxApr} color={rateColor} />}
            />
          ))}
      </YStack>
      <MoreLink count={heldTokens.length - ROW_LIMIT} onPress={onOpenTokens} />
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
      secondary={<RowText subdued>{asset.name}</RowText>}
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

function OfferTile({
  kind,
  trendingAssets,
  fixedRateAssets,
  markets,
  onOpenTokens,
  onOpenBorrow,
}: {
  kind: IEarnDesktopOfferKind;
  trendingAssets: IEarnAvailableAsset[];
  fixedRateAssets: IEarnAvailableAsset[];
  markets: IEarnDesktopMarketReserves[];
  onOpenTokens: () => void;
  onOpenBorrow: (market?: IEarnDesktopMarketReserves['market']) => void;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const navigateToAsset = useNavigateToEarnAsset();

  const trending = useMemo(
    () => trendingAssets.slice(0, ROW_LIMIT),
    [trendingAssets],
  );
  const fixed = useMemo(
    () =>
      fixedRateAssets
        .toSorted((a, b) => getAssetMaxApr(b) - getAssetMaxApr(a))
        .slice(0, ROW_LIMIT),
    [fixedRateAssets],
  );
  const borrowOffers = useMemo(
    () => buildBorrowOffers(markets, ROW_LIMIT),
    [markets],
  );

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
              key={`${offer.market.marketAddress}-${offer.reserveAddress}`}
              onPress={() => onOpenBorrow(offer.market)}
              icon={
                <Token
                  size="md"
                  tokenImageUri={offer.logoURI}
                  networkId={offer.market.networkId}
                  showNetworkIcon
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

// ---------- The four tiles ----------

export function EarnDesktopTiles({
  investments,
  isPortfolioLoading,
  loans,
  isLoansLoading,
  walletTokens,
  isWalletLoading,
  markets,
  trendingAssets,
  fixedRateAssets,
  onOpenPortfolio,
  onOpenBorrow,
  onOpenTokens,
  onOpenToken,
}: {
  investments: IEarnPortfolioInvestment[];
  isPortfolioLoading: boolean;
  loans: IEarnDesktopAccountMarket[];
  isLoansLoading: boolean;
  walletTokens: IRecommendAsset[];
  isWalletLoading: boolean;
  markets: IEarnDesktopMarketReserves[];
  trendingAssets: IEarnAvailableAsset[];
  fixedRateAssets: IEarnAvailableAsset[];
  onOpenPortfolio: () => void;
  onOpenBorrow: (market?: IEarnDesktopMarketReserves['market']) => void;
  onOpenTokens: () => void;
  onOpenToken: (symbol: string) => void;
}) {
  const media = useMedia();
  const intl = useIntl();
  const { rewards, withdrawals } = useMemo(
    () => collectTileRows(investments),
    [investments],
  );
  const heldTokens = useMemo<IHeldToken[]>(() => {
    // The wallet list carries no rate colors, so a token takes its Earn
    // entry's, the one its row in the table below shows
    const earnAssetBySymbol = new Map(
      trendingAssets.map((asset) => [asset.symbol, asset]),
    );
    return walletTokens
      .map((token) => ({
        token,
        amount: extractAvailableAmount(token.available?.text) ?? '0',
        maxApr: getAssetMaxApr(token),
        rateColor: getAssetRateColor(
          earnAssetBySymbol.get(token.symbol) ?? token,
        ),
      }))
      .filter((item) => new BigNumber(item.amount).gt(0));
  }, [trendingAssets, walletTokens]);

  const offers = pickTileOffers({
    rewardsEmpty: !rewards.rows.length,
    withdrawalsEmpty: !withdrawals.rows.length,
    loansEmpty: !loans.length,
    walletEmpty: !heldTokens.length,
    poolsAvailable: false,
  });

  const renderOffer = (kind: IEarnDesktopOfferKind | undefined) =>
    kind ? (
      <OfferTile
        kind={kind}
        trendingAssets={trendingAssets}
        fixedRateAssets={fixedRateAssets}
        markets={markets}
        onOpenTokens={onOpenTokens}
        onOpenBorrow={onOpenBorrow}
      />
    ) : null;

  // Offers wait until the data says the tile is empty
  const portfolioPending = isPortfolioLoading && !investments.length;
  const renderRewards = () =>
    offers.rewards ? (
      renderOffer(offers.rewards)
    ) : (
      <PortfolioRowsTile
        title={intl.formatMessage({ id: ETranslations.earn_rewards })}
        data={rewards}
        onOpenPortfolio={onOpenPortfolio}
      />
    );
  const renderWithdrawals = () =>
    offers.withdrawals ? (
      renderOffer(offers.withdrawals)
    ) : (
      <PortfolioRowsTile
        title={EARN_DESKTOP_DEMO_COPY.withdrawals}
        data={withdrawals}
        onOpenPortfolio={onOpenPortfolio}
      />
    );
  const renderLoans = () =>
    offers.loans ? (
      renderOffer(offers.loans)
    ) : (
      <LoansTile
        loans={loans}
        onOpenMarket={(entry) => onOpenBorrow(entry?.market)}
      />
    );
  const renderWallet = () =>
    offers.wallet ? (
      renderOffer(offers.wallet)
    ) : (
      <WalletTile
        heldTokens={heldTokens}
        onOpenToken={onOpenToken}
        onOpenTokens={onOpenTokens}
      />
    );
  // An empty wallet has no offer of its own until Pools ships, so the tile
  // drops out and the others share the row
  const walletPending = isWalletLoading && !walletTokens.length;
  const showWallet = walletPending || heldTokens.length > 0 || !!offers.wallet;
  const tiles = [
    <TileSlot key="rewards">
      {portfolioPending ? <TileSkeleton /> : renderRewards()}
    </TileSlot>,
    <TileSlot key="withdrawals">
      {portfolioPending ? <TileSkeleton /> : renderWithdrawals()}
    </TileSlot>,
    <TileSlot key="loans">
      {isLoansLoading && !loans.length ? <TileSkeleton /> : renderLoans()}
    </TileSlot>,
    showWallet ? (
      <TileSlot key="wallet">
        {walletPending ? <TileSkeleton /> : renderWallet()}
      </TileSlot>
    ) : null,
  ].filter(Boolean);

  // Four across needs about 260px a tile for "0.09557 USDT" next to its
  // button; three fit from 1024
  const perRow =
    media.gtXl || (media.gtLg && tiles.length <= 3) ? tiles.length : 2;
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
