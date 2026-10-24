import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Icon,
  IconButton,
  PROPORTIONAL_NUMS,
  Popover,
  SizableText,
  XStack,
  YStack,
  getFontSize,
} from '@onekeyhq/components';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { convertFiat } from '@onekeyhq/kit/src/utils/fiatConvert';
import {
  settingsValuePersistAtom,
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
  useSettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EarnTestIDs } from '../../testIDs';
import { getNumberColor } from '../../utils/getNumberColor';

import { EARN_DESKTOP_DEMO_COPY } from './earnDesktopHomeCopy';
import { buildKeyboardPressProps } from './earnDesktopPressable';
import {
  ProtocolSplit,
  ProtocolSplitSkeleton,
  SkeletonLine,
} from './EarnDesktopProtocolSplit';

import type { IEarnDesktopShares } from './earnDesktopHome.utils';

const SECONDS_PER_DAY = 24 * 60 * 60;
// The wallet home's balance size, with the same line height. A total too long
// for the hero beside the banner takes the largest of these that fits, the way
// a phone's auto-sizing label shrinks, and keeps the 48px line
const TOTAL_FONT_SIZES = [48, 44, 40] as const;
type ITotalFontSize = (typeof TOTAL_FONT_SIZES)[number];
const TOTAL_FONT_SIZE: ITotalFontSize = 48;
const MIN_TOTAL_FONT_SIZE: ITotalFontSize = 40;
// The chevron keeps about the same proportion to the number
const CHEVRON_SIZE = {
  48: { token: '$8', px: 32 },
  44: { token: '$7', px: 28 },
  40: { token: '$6', px: 24 },
} as const;
// The entry's left padding and the gap before the chevron
const ENTRY_PADDING_WIDTH = 14;
// The refresh button after the entry (36px) and the gap before it, as the
// wallet home places its own
const REFRESH_WIDTH = 12 + 36;
// Growing back needs this much room, so a total ticking over the edge of a
// size does not flip between two
const GROW_SPARE_WIDTH = 8;
const MIN_TICK_MS = 1000;
const MAX_TICK_MS = 60_000;
// How far a hidden amount's asterisks drop, as a share of their size
const ASTERISK_DROP = 0.16;

// The total keeps moving between refreshes at the estimated daily change's
// per-second rate. It shows cents only, so it re-renders about when the next
// cent accrues, between once a second and once a minute. It stands still while
// hidden, loading or off screen
function useTickingTotal(total: number, change24h: number, isRunning: boolean) {
  const perSecond = change24h > 0 ? change24h / SECONDS_PER_DAY : 0;
  const [anchor, setAnchor] = useState(() => ({ total, at: Date.now() }));
  const [now, setNow] = useState(() => Date.now());
  if (anchor.total !== total) {
    setAnchor({ total, at: Date.now() });
  }
  const tickMs =
    perSecond > 0 && isRunning
      ? Math.min(MAX_TICK_MS, Math.max(MIN_TICK_MS, 10 / perSecond))
      : 0;
  useEffect(() => {
    if (!tickMs) {
      return undefined;
    }
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(timer);
  }, [tickMs]);
  const elapsedSeconds = Math.max(0, (now - anchor.at) / 1000);
  return total + perSecond * elapsedSeconds;
}

function TotalValue({
  value,
  currency,
  fontSize,
  isHidden,
}: {
  value: number;
  currency: string;
  fontSize: number;
  isHidden: boolean;
}) {
  const textProps = {
    numberOfLines: 1,
    fontSize,
    lineHeight: fontSize,
    fontWeight: 500,
    fontVariant: PROPORTIONAL_NUMS,
  } as const;
  // The currency sign's side bearing, so the glyph, not its box, lines up
  // with the label and the buttons. A shift rather than a margin, which would
  // take the width from the number and cut it short
  const x = -Math.round(fontSize / 21);
  if (isHidden) {
    // Asterisks sit at the cap height; lowered, they center on the line the
    // digits fill
    return (
      <SizableText
        {...textProps}
        x={x}
        y={Math.round(fontSize * ASTERISK_DROP)}
      >
        ****
      </SizableText>
    );
  }
  const amount = (
    <NumberSizeableTextWrapper
      {...textProps}
      splitDecimal
      formatter="value"
      formatterOptions={{ currency }}
    >
      {String(Math.abs(value))}
    </NumberSizeableTextWrapper>
  );
  // The value formatter writes a negative as "< 0.01", so the sign goes in
  // front of the formatted amount
  return value < 0 ? (
    <XStack ai="baseline" minWidth={0} x={x}>
      <SizableText {...textProps}>-</SizableText>
      {amount}
    </XStack>
  ) : (
    <YStack minWidth={0} x={x}>
      {amount}
    </YStack>
  );
}

export function EarnDesktopHero({
  totalFiatValue,
  earnings24h,
  borrowInterest24h,
  shares,
  readyToEarn,
  isLoading,
  isRefreshing,
  hasPositions,
  isActive,
  minHeight,
  onOpenPortfolio,
  onRefresh,
  rewards,
  onHeightChange,
}: {
  totalFiatValue: string;
  earnings24h: string;
  borrowInterest24h: number;
  shares: IEarnDesktopShares;
  /**
   * Without positions: what the wallet's tokens that can earn here are
   * worth, about what they would earn in a year at their rows' rates (USD),
   * and the split by token. The hero shows these in place of a zero
   */
  readyToEarn?: {
    valueUsd: number;
    yearlyUsd: number;
    shares: IEarnDesktopShares;
  };
  /** Until every source has answered for this account once */
  isLoading: boolean;
  isRefreshing?: boolean;
  /** Without positions there are no earnings to state */
  hasPositions: boolean;
  isActive: boolean;
  /** The banner card's shortest height, when the banner sits beside */
  minHeight?: number;
  onOpenPortfolio: () => void;
  /** The page's refresh, the one pulling down runs on the phone */
  onRefresh?: () => void;
  /** The rewards to claim, in the row under the totals */
  rewards?: ReactNode;
  onHeightChange?: (height: number) => void;
}) {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const currency = settings.currencyInfo.symbol;
  const total = new BigNumber(totalFiatValue).toNumber() || 0;
  const earnings = new BigNumber(earnings24h).toNumber() || 0;
  const [{ hideValue: isHidden }] = useSettingsValuePersistAtom();
  // Net worth grows by the earnings less what the loans accrue
  const value = useTickingTotal(
    total,
    earnings - borrowInterest24h,
    isActive && !isHidden && !isLoading,
  );
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const isReadyToEarn = !isLoading && !hasPositions && Boolean(readyToEarn);
  const toShownCurrency = (usd: number) =>
    new BigNumber(
      convertFiat({
        value: usd,
        sourceCurrency: USD_CURRENCY_ID,
        targetCurrency: settings.currencyInfo.id,
        currencyMap,
      }),
    ).toNumber() || 0;
  const shownValue =
    isReadyToEarn && readyToEarn
      ? toShownCurrency(readyToEarn.valueUsd)
      : value;
  const handleToggleHideValue = useCallback(async () => {
    const current = await settingsValuePersistAtom.get();
    await settingsValuePersistAtom.set({ hideValue: !current.hideValue });
  }, []);
  const label = isReadyToEarn
    ? EARN_DESKTOP_DEMO_COPY.readyToEarn
    : intl.formatMessage({
        id: ETranslations.defi_net_worth,
      });

  // The size comes from an unseen copy of the total at 64px: the text scales
  // with its size, so the largest size that fits is known in one step, with
  // no frame of a cut-off number
  const [heroWidth, setHeroWidth] = useState(0);
  const [fullWidth, setFullWidth] = useState(0);
  const [fontSize, setFontSize] = useState<ITotalFontSize>(TOTAL_FONT_SIZE);
  if (heroWidth && fullWidth) {
    const fits = (size: ITotalFontSize) =>
      (fullWidth * size) / TOTAL_FONT_SIZE +
        (isReadyToEarn ? 0 : ENTRY_PADDING_WIDTH + CHEVRON_SIZE[size].px) +
        (onRefresh ? REFRESH_WIDTH : 0) +
        (size > fontSize ? GROW_SPARE_WIDTH : 0) <=
      heroWidth;
    const nextFontSize = TOTAL_FONT_SIZES.find(fits) ?? MIN_TOTAL_FONT_SIZE;
    if (nextFontSize !== fontSize) {
      setFontSize(nextFontSize);
    }
  }

  let earningsRow: ReactNode = null;
  if (isLoading) {
    earningsRow = <SkeletonLine height={20} width={180} barHeight={14} />;
  } else if (hasPositions) {
    earningsRow = (
      <XStack ai="center" gap="$1.5">
        <NumberSizeableTextWrapper
          hideValue
          size="$bodyMdMedium"
          formatter="value"
          formatterOptions={{
            currency,
            showPlusMinusSigns: earnings !== 0,
          }}
          color={isHidden ? '$textSubdued' : getNumberColor(earnings24h)}
          y={
            isHidden
              ? Math.round(getFontSize('$bodyMdMedium') * ASTERISK_DROP)
              : undefined
          }
        >
          {earnings24h}
        </NumberSizeableTextWrapper>
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.earn_24h_earnings })}
        </SizableText>
        <Popover
          placement="bottom-start"
          renderTrigger={
            <IconButton
              testID="earn-desktop-24h-earnings-info"
              hotKey
              aria-label={intl.formatMessage({ id: ETranslations.global_info })}
              variant="tertiary"
              size="small"
              icon="InfoCircleOutline"
            />
          }
          title={intl.formatMessage({ id: ETranslations.earn_24h_earnings })}
          renderContent={
            <SizableText px="$pagePadding" py="$4">
              {intl.formatMessage({
                id: ETranslations.earn_24h_earnings_tooltip,
              })}
            </SizableText>
          }
        />
      </XStack>
    );
  }

  if (isReadyToEarn && readyToEarn) {
    const yearly = toShownCurrency(readyToEarn.yearlyUsd);
    // Under a cent the value formatter writes "< 0.01", a bound already, so
    // no "≈" goes in front, as on the rows below
    const isUnderCent = yearly > 0 && yearly < 0.01;
    earningsRow = (
      <XStack ai="center" gap="$1.5">
        <XStack ai="baseline" gap="$1">
          {isHidden || !isUnderCent ? (
            <SizableText size="$bodyMdMedium">≈</SizableText>
          ) : null}
          <NumberSizeableTextWrapper
            hideValue
            size="$bodyMdMedium"
            formatter="value"
            formatterOptions={{ currency }}
            y={
              isHidden
                ? Math.round(getFontSize('$bodyMdMedium') * ASTERISK_DROP)
                : undefined
            }
          >
            {String(yearly)}
          </NumberSizeableTextWrapper>
        </XStack>
        <SizableText size="$bodyMd" color="$textSubdued">
          {EARN_DESKTOP_DEMO_COPY.aYear}
        </SizableText>
        <Popover
          placement="bottom-start"
          renderTrigger={
            <IconButton
              testID="earn-desktop-ready-to-earn-info"
              hotKey
              aria-label={intl.formatMessage({ id: ETranslations.global_info })}
              variant="tertiary"
              size="small"
              icon="InfoCircleOutline"
            />
          }
          title={EARN_DESKTOP_DEMO_COPY.readyToEarn}
          renderContent={
            <SizableText px="$pagePadding" py="$4">
              {EARN_DESKTOP_DEMO_COPY.readyToEarnInfo}
            </SizableText>
          }
        />
      </XStack>
    );
  }

  let split: ReactNode = null;
  if (isLoading) {
    split = <ProtocolSplitSkeleton />;
  } else if (shares.top.length) {
    split = <ProtocolSplit shares={shares} />;
  } else if (isReadyToEarn && readyToEarn?.shares.top.length) {
    split = <ProtocolSplit shares={readyToEarn.shares} />;
  }

  return (
    // Never shorter than the banner beside it: without positions the buttons
    // then sit on the banner's bottom edge instead of above an empty gap
    <YStack
      flex={1}
      minWidth={0}
      minHeight={minHeight}
      jc="space-between"
      gap="$6"
      onLayout={(event) => {
        const { height, width } = event.nativeEvent.layout;
        setHeroWidth(Math.round(width));
        onHeightChange?.(Math.round(height));
      }}
    >
      {/* Unseen, at full size, so the total's size is picked before it shows */}
      {isLoading ? null : (
        <XStack
          position="absolute"
          t={0}
          l={0}
          opacity={0}
          pointerEvents="none"
          aria-hidden
          onLayout={(event) =>
            setFullWidth(Math.ceil(event.nativeEvent.layout.width))
          }
        >
          <TotalValue
            value={shownValue}
            currency={currency}
            fontSize={TOTAL_FONT_SIZE}
            isHidden={isHidden}
          />
        </XStack>
      )}
      <YStack gap="$2">
        {/* The eye hides and shows values the way pressing the wallet home
            balance does */}
        <XStack ai="center" gap="$1">
          <SizableText size="$bodyLgMedium" color="$textSubdued">
            {label}
          </SizableText>
          <YStack my="$-1">
            <IconButton
              testID="earn-desktop-hide-value"
              // Without it the button swallows every key, Tab included
              hotKey
              aria-label={intl.formatMessage({
                id: isHidden
                  ? ETranslations.perp_simple_show_assets__action
                  : ETranslations.perp_simple_hide_assets__action,
              })}
              variant="tertiary"
              size="small"
              icon={isHidden ? 'EyeOffOutline' : 'EyeOutline'}
              onPress={handleToggleHideValue}
            />
          </YStack>
        </XStack>
        {/* As on the phone, the total and its chevron open Positions. The
            highlight pads the number evenly: the chevron's own margin is its
            right side, and the negative margins keep the number in place */}
        {isLoading ? (
          // The wallet home's balance skeleton
          <SkeletonLine height={TOTAL_FONT_SIZE} width={209} barHeight={40} />
        ) : (
          // The refresh button follows the total, as on the wallet home
          <XStack ai="center" gap="$3" alignSelf="flex-start" maxWidth="100%">
            {isReadyToEarn ? (
              // Not a way into My portfolio, which has nothing yet
              <YStack
                testID="earn-desktop-ready-to-earn"
                h={TOTAL_FONT_SIZE}
                jc="center"
                minWidth={0}
                flexShrink={1}
              >
                <TotalValue
                  value={shownValue}
                  currency={currency}
                  fontSize={fontSize}
                  isHidden={isHidden}
                />
              </YStack>
            ) : (
              <XStack
                testID={EarnTestIDs.portfolioEntry}
                role="button"
                aria-label={label}
                ai="center"
                gap="$1"
                minWidth={0}
                flexShrink={1}
                pl="$2.5"
                ml="$-2.5"
                py="$1"
                my="$-1"
                borderRadius="$3"
                cursor="pointer"
                userSelect="none"
                hoverStyle={{ bg: '$bgHover' }}
                pressStyle={{ bg: '$bgActive' }}
                onPress={onOpenPortfolio}
                {...buildKeyboardPressProps(onOpenPortfolio)}
              >
                {/* Every size keeps the 48px line, so nothing below moves */}
                <YStack
                  h={TOTAL_FONT_SIZE}
                  jc="center"
                  minWidth={0}
                  flexShrink={1}
                >
                  <TotalValue
                    value={value}
                    currency={currency}
                    fontSize={fontSize}
                    isHidden={isHidden}
                  />
                </YStack>
                <Icon
                  name="ChevronRightSmallOutline"
                  size={CHEVRON_SIZE[fontSize].token}
                  color="$iconSubdued"
                  flexShrink={0}
                />
              </XStack>
            )}
            {onRefresh ? (
              <IconButton
                testID="earn-desktop-refresh"
                hotKey
                aria-label={intl.formatMessage({
                  id: ETranslations.global_refresh,
                })}
                icon="RefreshCcwOutline"
                variant="tertiary"
                loading={isRefreshing}
                onPress={onRefresh}
              />
            ) : null}
          </XStack>
        )}
        {earningsRow}
      </YStack>
      {isLoading || isReadyToEarn ? null : rewards}
      {split}
    </YStack>
  );
}
