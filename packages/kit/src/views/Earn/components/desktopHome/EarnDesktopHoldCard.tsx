import type { ReactNode } from 'react';
import { useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar/NetworkAvatar';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { AprText } from '../AprText';

import { EARN_DESKTOP_DEMO_COPY } from './earnDesktopHomeCopy';
import {
  EarnDesktopSurfaceProvider,
  SurfaceToken,
  buildKeyboardPressProps,
  usePressableSurface,
} from './earnDesktopPressable';
import { useEarnDesktopSurfaces } from './useEarnDesktopSurfaces';

import type {
  IEarnDesktopHoldOffer,
  IEarnDesktopHoldRow,
} from './earnDesktopHome.utils';

// Five rows, then the rest open in place
const ROW_LIMIT = 5;
const ROW_HEIGHT = 64;
const ROW_GAP = '$3';
const ACTION_WIDTH = 72;
// The table's proportions below, so the two lists read alike
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
  apr: column(1.4, 'flex-end', 136),
};

// The best offer's rate, colored the way the table colors it
function OfferRate({
  offer,
  size = '$bodyLgMedium',
}: {
  offer: IEarnDesktopHoldOffer;
  size?: '$bodyLgMedium' | '$bodyMdMedium';
}) {
  if (offer.kind === 'lending') {
    return (
      <SizableText size={size}>{`${new BigNumber(offer.offer.apy).toFixed(
        2,
      )}%`}</SizableText>
    );
  }
  const { item } = offer;
  return (
    <AprText
      hideSuffix
      size={size}
      asset={{
        aprWithoutFee: item.provider.aprWithoutFee ?? '',
        aprInfo: item.aprInfo,
        rewardUnit: item.provider.rewardUnit,
      }}
    />
  );
}

// What the balance would earn in a year at that rate
function YearlyLine({ row }: { row: IEarnDesktopHoldRow }) {
  const [best] = row.offers;
  const yearlyUsd = new BigNumber(row.fiatValueUsd)
    .times(best.apr)
    .div(100)
    .toFixed();
  return (
    <XStack ai="baseline" gap="$1">
      <SizableText size="$bodySm" color="$textSubdued">
        ≈
      </SizableText>
      <Currency
        hideValue
        size="$bodySm"
        color="$textSubdued"
        formatter="value"
        sourceCurrency={USD_CURRENCY_ID}
        numberOfLines={1}
      >
        {yearlyUsd}
      </Currency>
      <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
        {EARN_DESKTOP_DEMO_COPY.aYear}
      </SizableText>
    </XStack>
  );
}

function RowBalance({ row }: { row: IEarnDesktopHoldRow }) {
  return (
    <>
      <NumberSizeableTextWrapper
        hideValue
        size="$bodyLgMedium"
        formatter="balance"
        numberOfLines={1}
      >
        {row.amount}
      </NumberSizeableTextWrapper>
      <Currency
        hideValue
        size="$bodySm"
        color="$textSubdued"
        formatter="value"
        sourceCurrency={USD_CURRENCY_ID}
        numberOfLines={1}
      >
        {row.fiatValueUsd}
      </Currency>
    </>
  );
}

function HoldRow({
  row,
  networkName,
  isWide,
  onPress,
}: {
  row: IEarnDesktopHoldRow;
  networkName?: string;
  isWide: boolean;
  onPress: () => void;
}) {
  const intl = useIntl();
  const { surface, isActive, handlers } = usePressableSurface(true);
  const [best] = row.offers;
  const symbol = row.token.symbol;
  const fixedLine = best.isFixedRate ? (
    <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
      {intl.formatMessage({ id: ETranslations.defi_fixed_rate })}
    </SizableText>
  ) : null;
  return (
    <EarnDesktopSurfaceProvider value={surface}>
      <XStack
        testID={`earn-desktop-hold-${row.networkId}-${symbol}`}
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
        {isWide ? (
          <>
            <XStack {...COLUMNS.asset} ai="center" gap="$3">
              <Token
                size="md"
                tokenImageUri={row.token.logoURI || row.asset.logoURI}
                borderRadius="$full"
              />
              <YStack flex={1} minWidth={0}>
                <SizableText size="$bodyLgMedium" numberOfLines={1}>
                  {symbol}
                </SizableText>
                {fixedLine}
              </YStack>
            </XStack>
            <XStack {...COLUMNS.network} ai="center" gap="$2">
              <NetworkAvatar networkId={row.networkId} size="$5" />
              <SizableText size="$bodyMd" numberOfLines={1} flexShrink={1}>
                {networkName ?? ''}
              </SizableText>
            </XStack>
            <YStack {...COLUMNS.balance}>
              <RowBalance row={row} />
            </YStack>
            <YStack {...COLUMNS.apr}>
              <OfferRate offer={best} />
              <YearlyLine row={row} />
            </YStack>
            <XStack w={ACTION_WIDTH} flexShrink={0} jc="flex-end">
              <Button
                testID={`earn-desktop-hold-earn-${row.networkId}-${symbol}`}
                size="small"
                variant="secondary"
                // Button stops the press at itself, so the row under it does
                // not open the same page a second time
                onPress={onPress}
              >
                {intl.formatMessage({ id: ETranslations.earn_title })}
              </Button>
            </XStack>
          </>
        ) : (
          <>
            {/* One column has no room for a network column: the badge and
                the second line carry the network */}
            <SurfaceToken
              size="md"
              tokenImageUri={row.token.logoURI || row.asset.logoURI}
              networkId={row.networkId}
            />
            <YStack flex={1} minWidth={0}>
              <SizableText size="$bodyLgMedium" numberOfLines={1}>
                {symbol}
              </SizableText>
              <SizableText
                size="$bodySm"
                color="$textSubdued"
                numberOfLines={1}
              >
                {networkName ?? ''}
              </SizableText>
            </YStack>
            <YStack ai="flex-end" flexShrink={1} minWidth={0}>
              <RowBalance row={row} />
            </YStack>
            <YStack ai="flex-end" flexShrink={0} minWidth={96}>
              <OfferRate offer={best} />
              <YearlyLine row={row} />
            </YStack>
          </>
        )}
      </XStack>
    </EarnDesktopSurfaceProvider>
  );
}

function HeaderLabel({
  children,
  align = 'left',
}: {
  children: string;
  align?: 'left' | 'right';
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

function MoreToggle({
  count,
  isExpanded,
  onPress,
}: {
  count: number;
  isExpanded: boolean;
  onPress: () => void;
}) {
  const intl = useIntl();
  // Subdued until hovered, the way the tile titles brighten
  const [isHovered, setIsHovered] = useState(false);
  return (
    <XStack
      testID="earn-desktop-hold-more"
      role="button"
      aria-expanded={isExpanded}
      alignSelf="flex-start"
      ai="center"
      gap="$0.5"
      h={44}
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
        {isExpanded
          ? intl.formatMessage({ id: ETranslations.global_show_less })
          : EARN_DESKTOP_DEMO_COPY.more(count)}
      </SizableText>
      <Icon
        name={isExpanded ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'}
        size="$4"
        color={isHovered ? '$icon' : '$iconSubdued'}
      />
    </XStack>
  );
}

function CardFrame({ children }: { children: ReactNode }) {
  const media = useMedia();
  const surfaces = useEarnDesktopSurfaces();
  return (
    <YStack
      bg={surfaces.rest}
      borderRadius="$5"
      borderCurve="continuous"
      px={media.gtMd ? '$5' : '$4'}
      pt="$4"
      pb="$1"
    >
      {children}
    </YStack>
  );
}

/**
 * Earns on your holding: what the wallet holds, a row per token per network,
 * with the best rate Earn has for it on that network. A row opens the deposit
 * page for that token on that network.
 */
export function EarnDesktopHoldCard({
  rows,
  networkNames,
  onOpenRow,
}: {
  rows: IEarnDesktopHoldRow[];
  networkNames: Map<string, string>;
  onOpenRow: (row: IEarnDesktopHoldRow) => void;
}) {
  const intl = useIntl();
  const media = useMedia();
  const isWide = media.gtMd;
  const [isExpanded, setIsExpanded] = useState(false);
  const shown = isExpanded ? rows : rows.slice(0, ROW_LIMIT);
  const moreCount = rows.length - ROW_LIMIT;
  // Every row deposited at its best rate
  const yearlyUsd = rows
    .reduce(
      (sum, row) =>
        sum.plus(
          new BigNumber(row.fiatValueUsd).times(row.offers[0].apr).div(100),
        ),
      new BigNumber(0),
    )
    .toFixed();
  return (
    <CardFrame>
      <SizableText size="$bodyMdMedium" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.earns_on_your_holding__title })}
      </SizableText>
      <XStack ai="baseline" gap="$1.5" mt="$0.5">
        <SizableText size="$bodyLg" color="$textSubdued">
          {EARN_DESKTOP_DEMO_COPY.upTo}
        </SizableText>
        <Currency
          hideValue
          size="$headingXl"
          fontWeight={500}
          formatter="value"
          sourceCurrency={USD_CURRENCY_ID}
          numberOfLines={1}
        >
          {yearlyUsd}
        </Currency>
        <SizableText size="$bodyLg" color="$textSubdued">
          {EARN_DESKTOP_DEMO_COPY.aYear}
        </SizableText>
      </XStack>
      {isWide ? (
        <XStack h="$8" ai="center" gap={ROW_GAP} mt="$3">
          <Stack {...COLUMNS.asset}>
            <HeaderLabel>
              {intl.formatMessage({ id: ETranslations.global_asset })}
            </HeaderLabel>
          </Stack>
          <Stack {...COLUMNS.network}>
            <HeaderLabel>
              {intl.formatMessage({ id: ETranslations.global_network })}
            </HeaderLabel>
          </Stack>
          <Stack {...COLUMNS.balance}>
            <HeaderLabel align="right">
              {intl.formatMessage({ id: ETranslations.global_wallet_balance })}
            </HeaderLabel>
          </Stack>
          <Stack {...COLUMNS.apr}>
            <HeaderLabel align="right">
              {intl.formatMessage({ id: ETranslations.defi_apr_apy })}
            </HeaderLabel>
          </Stack>
          <Stack w={ACTION_WIDTH} flexShrink={0} />
        </XStack>
      ) : null}
      <YStack mt={isWide ? 0 : '$2'}>
        {shown.map((row) => (
          <HoldRow
            key={row.key}
            row={row}
            networkName={networkNames.get(row.networkId)}
            isWide={isWide}
            onPress={() => onOpenRow(row)}
          />
        ))}
      </YStack>
      {moreCount > 0 ? (
        <MoreToggle
          count={moreCount}
          isExpanded={isExpanded}
          onPress={() => setIsExpanded((prev) => !prev)}
        />
      ) : (
        <YStack h="$3" />
      )}
    </CardFrame>
  );
}

// The loaded card's boxes, so the page keeps its height when the rows land
export function EarnDesktopHoldCardSkeleton() {
  return (
    <CardFrame>
      <Skeleton w={150} h={14} my={3} borderRadius="$2" />
      <Skeleton w={160} h={20} my={4} borderRadius="$2" />
      <YStack mt="$3" pb="$3">
        {Array.from({ length: 3 }).map((_, index) => (
          <XStack key={index} ai="center" gap="$3" h={ROW_HEIGHT}>
            <Skeleton w="$10" h="$10" radius="round" />
            <YStack flex={1} gap="$1.5">
              <Skeleton w="30%" h={14} borderRadius="$2" />
              <Skeleton w="18%" h={12} borderRadius="$2" />
            </YStack>
          </XStack>
        ))}
      </YStack>
    </CardFrame>
  );
}
