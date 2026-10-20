import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Button,
  Icon,
  IconButton,
  PROPORTIONAL_NUMS,
  Popover,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import {
  settingsValuePersistAtom,
  useSettingsPersistAtom,
  useSettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EarnTestIDs } from '../../testIDs';
import { getNumberColor } from '../../utils/getNumberColor';

import { formatSharePercent } from './earnDesktopHome.utils';
import { EARN_DESKTOP_DEMO_COPY } from './earnDesktopHomeCopy';
import { buildKeyboardPressProps } from './earnDesktopPressable';

import type { IEarnDesktopShares } from './earnDesktopHome.utils';

// Lightness steps, the biggest share brightest. Color on this page means
// status (earnings, risk), so the protocols' logos tell them apart instead
const SHARE_COLORS = ['$neutral11', '$neutral9', '$neutral7'] as const;
const REST_SHARE_COLOR = '$neutral5';
const SECONDS_PER_DAY = 24 * 60 * 60;
// A third over the wallet home's 48px balance, so Net Worth leads the page;
// the line height matches the size. A total too long for the hero beside the
// banner (1024px) steps down to the wallet home's size
const TOTAL_FONT_SIZE = 64;
const COMPACT_TOTAL_FONT_SIZE = 48;
// The width of the entry around the number: its left padding, the gap and the
// chevron, at each size
const ENTRY_CHROME_WIDTH = { 64: 54, 48: 46 } as const;
const MIN_TICK_MS = 1000;
const MAX_TICK_MS = 60_000;

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

function HeroButton({
  icon,
  label,
  testID,
  onPress,
}: {
  icon: IKeyOfIcons;
  label: string;
  testID: string;
  onPress: () => void;
}) {
  return (
    <Button
      testID={testID}
      size="medium"
      variant="secondary"
      icon={icon}
      borderRadius="$full"
      onPress={onPress}
    >
      {label}
    </Button>
  );
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
      <SizableText {...textProps} x={x} y={Math.round(fontSize * 0.16)}>
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

// Skeletons in the loaded hero's boxes, so nothing below moves as it loads
function SkeletonLine({
  height,
  width,
  barHeight,
}: {
  height: number;
  width: number | string;
  barHeight: number;
}) {
  return (
    <YStack h={height} jc="center">
      <Skeleton w={width} h={barHeight} borderRadius="$2" />
    </YStack>
  );
}

function ProtocolSplitSkeleton() {
  return (
    <YStack gap="$3.5">
      <Skeleton h="$2.5" w="100%" borderRadius="$full" />
      <XStack gap="$8">
        {Array.from({ length: 3 }).map((_, index) => (
          <YStack key={index} gap="$1">
            <SkeletonLine height={20} width={96} barHeight={14} />
            <SkeletonLine height={24} width={40} barHeight={16} />
          </YStack>
        ))}
      </XStack>
    </YStack>
  );
}

function ProtocolSplit({ shares }: { shares: IEarnDesktopShares }) {
  const restValue =
    shares.total - shares.top.reduce((sum, item) => sum + item.value, 0);
  return (
    <YStack gap="$3.5">
      <XStack h="$2.5" gap="$0.5" borderRadius="$full" overflow="hidden">
        {shares.top.map((item, index) => (
          <YStack key={item.key} flex={item.value} bg={SHARE_COLORS[index]} />
        ))}
        {shares.rest ? <YStack flex={restValue} bg={REST_SHARE_COLOR} /> : null}
      </XStack>
      <XStack gap="$8" flexWrap="wrap">
        {shares.top.map((item) => (
          <YStack key={item.key} gap="$1">
            <XStack gap="$1.5" ai="center">
              <Token size="xs" tokenImageUri={item.logoURI} />
              <SizableText size="$bodyMd" color="$textSubdued">
                {item.name}
              </SizableText>
            </XStack>
            <SizableText size="$bodyLgMedium">
              {formatSharePercent(item.percent)}
            </SizableText>
          </YStack>
        ))}
        {shares.rest ? (
          <YStack gap="$1">
            <SizableText size="$bodyMd" color="$textSubdued">
              {EARN_DESKTOP_DEMO_COPY.more(shares.rest.count)}
            </SizableText>
            <SizableText size="$bodyLgMedium">
              {formatSharePercent(shares.rest.percent)}
            </SizableText>
          </YStack>
        ) : null}
      </XStack>
    </YStack>
  );
}

export function EarnDesktopHero({
  totalFiatValue,
  earnings24h,
  borrowInterest24h,
  shares,
  isLoading,
  hasPositions,
  isActive,
  onOpenPortfolio,
  onOpenTokens,
  onOpenLoans,
  onOpenProtocols,
  onHeightChange,
}: {
  totalFiatValue: string;
  earnings24h: string;
  borrowInterest24h: number;
  shares: IEarnDesktopShares;
  /** Until every source has answered for this account once */
  isLoading: boolean;
  /** Without positions there are no earnings to state */
  hasPositions: boolean;
  isActive: boolean;
  onOpenPortfolio: () => void;
  onOpenTokens: () => void;
  onOpenLoans: () => void;
  onOpenProtocols: () => void;
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
  const handleToggleHideValue = useCallback(async () => {
    const current = await settingsValuePersistAtom.get();
    await settingsValuePersistAtom.set({ hideValue: !current.hideValue });
  }, []);
  const label = intl.formatMessage({
    id: ETranslations.defi_net_worth,
  });

  // The entry hugs the total, so at the hero's full width it has been cut
  // short: step down a size. Back up once the full size would fit with room
  const [heroWidth, setHeroWidth] = useState(0);
  const [entryWidth, setEntryWidth] = useState(0);
  const [isCompact, setIsCompact] = useState(false);
  if (heroWidth && entryWidth) {
    if (!isCompact && entryWidth >= heroWidth - 1) {
      setIsCompact(true);
    } else if (isCompact) {
      const fullWidth =
        ((entryWidth - ENTRY_CHROME_WIDTH[48]) * TOTAL_FONT_SIZE) /
          COMPACT_TOTAL_FONT_SIZE +
        ENTRY_CHROME_WIDTH[64];
      if (fullWidth < heroWidth - 24) {
        setIsCompact(false);
      }
    }
  }
  const fontSize = isCompact ? COMPACT_TOTAL_FONT_SIZE : TOTAL_FONT_SIZE;

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

  let split: ReactNode = null;
  if (isLoading) {
    split = <ProtocolSplitSkeleton />;
  } else if (shares.top.length) {
    split = <ProtocolSplit shares={shares} />;
  }

  return (
    // Gaps tight enough that the 64px total leaves the hero, and the banner
    // that takes its height, as tall as the 48px one did
    <YStack
      flex={1}
      minWidth={0}
      gap="$4"
      onLayout={(event) => {
        const { height, width } = event.nativeEvent.layout;
        setHeroWidth(Math.round(width));
        onHeightChange?.(Math.round(height));
      }}
    >
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
          <SkeletonLine height={TOTAL_FONT_SIZE} width={240} barHeight={44} />
        ) : (
          <XStack
            testID={EarnTestIDs.portfolioEntry}
            role="button"
            aria-label={label}
            ai="center"
            gap="$1"
            alignSelf="flex-start"
            maxWidth="100%"
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
            onLayout={(event) =>
              setEntryWidth(Math.round(event.nativeEvent.layout.width))
            }
            {...buildKeyboardPressProps(onOpenPortfolio)}
          >
            {/* The compact size keeps the 64px line, so nothing below moves */}
            <YStack h={TOTAL_FONT_SIZE} jc="center" minWidth={0} flexShrink={1}>
              <TotalValue
                value={value}
                currency={currency}
                fontSize={fontSize}
                isHidden={isHidden}
              />
            </YStack>
            <Icon
              name="ChevronRightSmallOutline"
              size={isCompact ? '$8' : '$10'}
              color="$iconSubdued"
              flexShrink={0}
            />
          </XStack>
        )}
        {earningsRow}
      </YStack>
      <XStack gap="$2" flexWrap="wrap">
        <HeroButton
          icon="DollarOutline"
          label={intl.formatMessage({ id: ETranslations.earn_tokens__title })}
          testID={EarnTestIDs.homeShortcut('tokens')}
          onPress={onOpenTokens}
        />
        <HeroButton
          icon="HandCoinsOutline"
          label={intl.formatMessage({ id: ETranslations.earn_loans__action })}
          testID={EarnTestIDs.borrowEntryButton}
          onPress={onOpenLoans}
        />
        <HeroButton
          icon="FileTextOutline"
          label={intl.formatMessage({
            id: ETranslations.earn_protocols__title,
          })}
          testID={EarnTestIDs.homeShortcut('protocols')}
          onPress={onOpenProtocols}
        />
      </XStack>
      {split}
    </YStack>
  );
}
