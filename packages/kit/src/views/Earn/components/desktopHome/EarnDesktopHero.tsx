import type { ReactNode } from 'react';
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useReducedMotion } from 'react-native-reanimated';

import {
  Icon,
  IconButton,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_HEIGHT } from '@onekeyhq/components/src/utils/animationConstants';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  settingsValuePersistAtom,
  useSettingsPersistAtom,
  useSettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EarnTestIDs } from '../../testIDs';

import { ANIMATE_ONLY_BG_COLOR } from './earnDesktopColorEase';
import { buildKeyboardPressProps } from './earnDesktopPressable';
import {
  ProtocolSplit,
  ProtocolSplitEmpty,
  ProtocolSplitSkeleton,
  SkeletonLine,
} from './EarnDesktopProtocolSplit';
import { EarnDesktopRewardPillsSkeleton } from './EarnDesktopRewardPills';
import { warmEarnPositions } from './earnDesktopWarm';
import {
  EarnEarnings24hLine,
  TEXT_BEFORE_ICON_SPACE,
} from './EarnEarnings24hLine';
import { TickingTotalValue } from './EarnTickingTotal';

import type { IEarnDesktopShares } from './earnDesktopHome.utils';

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
// The hero's gap between its rows ($6). The rewards row takes the one above
// it into its own height, so the two ease in and out as one
const HERO_GAP = 24;
const REWARDS_EASE_MS = 250;
const REWARDS_EASE = ['smooth', { duration: REWARDS_EASE_MS }] as [
  'smooth',
  { duration: number },
];
// Past the ease and its last layout report
const REWARDS_SETTLE_MS = REWARDS_EASE_MS + 100;
// Whether an account had rewards to claim when its hero last loaded: while
// it loads again, their row keeps its place unless they are known to be none
const hadRewardsByAccount = new Map<string, boolean>();

/**
 * The rewards row's place under the totals. While the hero loads it keeps the
 * row's room with placeholder pills, as the rest of the hero does, unless the
 * account is known to have none; then it eases to the row's own height (none
 * when there is nothing to claim) instead of moving the page at once
 */
function RewardsRow({
  isLoading,
  isReserved,
  onHasRow,
  onEase,
  children,
}: {
  isLoading: boolean;
  isReserved: boolean;
  /** Known once loaded: whether there is a row */
  onHasRow: (hasRow: boolean) => void;
  /** The height the hero is about to gain or lose as the row eases */
  onEase: (delta: number) => void;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const contentRef = useRef<unknown>(null);
  // The row's own height, measured; until then the box takes its content's
  const [rowHeight, setRowHeight] = useState<number>();
  let content: ReactNode = children;
  if (isLoading) {
    content = isReserved ? <EarnDesktopRewardPillsSkeleton /> : null;
  }
  // Read before the change paints, so the box never shows a height its
  // content no longer has
  useLayoutEffect(() => {
    const element = contentRef.current as HTMLElement | null;
    const rect = element?.getBoundingClientRect?.();
    if (rect) {
      setRowHeight(Math.round(rect.height));
    }
  }, [children, isLoading, isReserved]);
  const height = rowHeight ? HERO_GAP + rowHeight : 0;
  const heightRef = useRef<number | undefined>(undefined);
  useLayoutEffect(() => {
    if (rowHeight === undefined) {
      return;
    }
    const previous = heightRef.current;
    heightRef.current = height;
    if (previous !== undefined && previous !== height && !reduceMotion) {
      onEase(height - previous);
    }
  }, [height, onEase, reduceMotion, rowHeight]);
  useEffect(() => {
    if (!isLoading && rowHeight !== undefined) {
      onHasRow(rowHeight > 0);
    }
  }, [isLoading, onHasRow, rowHeight]);
  return (
    <YStack
      mt={-HERO_GAP}
      h={rowHeight === undefined ? undefined : height}
      overflow="hidden"
      transition={reduceMotion ? undefined : REWARDS_EASE}
      animateOnly={ANIMATE_ONLY_HEIGHT}
    >
      <YStack pt={HERO_GAP}>
        <YStack
          ref={contentRef as never}
          onLayout={(event) =>
            setRowHeight(Math.round(event.nativeEvent.layout.height))
          }
        >
          {content}
        </YStack>
      </YStack>
    </YStack>
  );
}

function BasicEarnDesktopHero({
  totalFiatValue,
  earnings24h,
  borrowInterest24h,
  shares,
  isLoading,
  isRefreshing,
  hasPositions,
  isActive,
  minHeight,
  onOpenPortfolio,
  onRefresh,
  rewards,
  onOpenProtocols,
  hidesSplit,
  onHeightChange,
}: {
  totalFiatValue: string;
  earnings24h: string;
  borrowInterest24h: number;
  shares: IEarnDesktopShares;
  /** Until every source has answered for this account once */
  isLoading: boolean;
  isRefreshing?: boolean;
  /**
   * Without positions every part shows its own empty state: the total and
   * the day's earnings at zero, the split as its bare track
   */
  hasPositions: boolean;
  isActive: boolean;
  /** The banner card's shortest height, when the banner sits beside */
  minHeight?: number;
  onOpenPortfolio: () => void;
  /** The page's refresh, the one pulling down runs on the phone */
  onRefresh?: () => void;
  /** The rewards to claim, in the row under the totals */
  rewards?: ReactNode;
  /** A share of the split opens its protocols' positions */
  onOpenProtocols?: (keys: string[]) => void;
  /** The phone layout leaves the split by protocol out */
  hidesSplit?: boolean;
  onHeightChange?: (height: number) => void;
}) {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const currency = settings.currencyInfo.symbol;
  const total = new BigNumber(totalFiatValue).toNumber() || 0;
  const earnings = new BigNumber(earnings24h).toNumber() || 0;
  const [{ hideValue: isHidden }] = useSettingsValuePersistAtom();
  // Net worth grows by the earnings less what the loans accrue
  const change24h = earnings - borrowInterest24h;
  const isTicking = isActive && !isHidden && !isLoading;
  const handleToggleHideValue = useCallback(async () => {
    const current = await settingsValuePersistAtom.get();
    await settingsValuePersistAtom.set({ hideValue: !current.hideValue });
  }, []);
  const label = intl.formatMessage({
    id: ETranslations.defi_net_worth,
  });
  const reduceMotion = useReducedMotion();

  const { activeAccount } = useActiveAccount({ num: 0 });
  const accountKey =
    activeAccount.indexedAccount?.id || activeAccount.account?.id || '';
  const handleHasRewards = useCallback(
    (hasRow: boolean) => hadRewardsByAccount.set(accountKey, hasRow),
    [accountKey],
  );
  // While the rewards row eases, the banner beside keeps one height:
  // following every frame would lay its carousel out again at each one. A
  // row closing gives the banner its new height at once, as the hero shrinks
  // to it; one opening gives it once the hero has grown, since a banner
  // taller than the hero would push the page down ahead of the ease
  const heroHeightRef = useRef(0);
  const easeUntilRef = useRef(0);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => () => clearTimeout(settleTimerRef.current), []);
  const handleRewardsEase = useCallback(
    (delta: number) => {
      easeUntilRef.current = Date.now() + REWARDS_SETTLE_MS;
      if (delta < 0) {
        onHeightChange?.(heroHeightRef.current + delta);
      }
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = setTimeout(
        () => onHeightChange?.(heroHeightRef.current),
        REWARDS_SETTLE_MS,
      );
    },
    [onHeightChange],
  );

  // The size comes from an unseen copy of the total at 64px: the text scales
  // with its size, so the largest size that fits is known in one step, with
  // no frame of a cut-off number
  const [heroWidth, setHeroWidth] = useState(0);
  const [fullWidth, setFullWidth] = useState(0);
  const [fontSize, setFontSize] = useState<ITotalFontSize>(TOTAL_FONT_SIZE);
  if (heroWidth && fullWidth) {
    const fits = (size: ITotalFontSize) =>
      (fullWidth * size) / TOTAL_FONT_SIZE +
        ENTRY_PADDING_WIDTH +
        CHEVRON_SIZE[size].px +
        (onRefresh ? REFRESH_WIDTH : 0) +
        (size > fontSize ? GROW_SPARE_WIDTH : 0) <=
      heroWidth;
    const nextFontSize = TOTAL_FONT_SIZES.find(fits) ?? MIN_TOTAL_FONT_SIZE;
    if (nextFontSize !== fontSize) {
      setFontSize(nextFontSize);
    }
  }

  // Without positions the day's earnings read zero, as they do for
  // positions that have earned nothing yet
  const earningsRow: ReactNode = isLoading ? (
    <SkeletonLine height={20} width={180} barHeight={14} />
  ) : (
    <EarnEarnings24hLine
      earnings24h={earnings24h}
      currency={currency}
      isHidden={isHidden}
    />
  );

  let split: ReactNode = null;
  if (hidesSplit) {
    split = null;
  } else if (isLoading) {
    split = <ProtocolSplitSkeleton />;
  } else if (shares.top.length) {
    split = (
      <ProtocolSplit
        shares={shares}
        onOpenProtocols={onOpenProtocols}
        onWarm={warmEarnPositions}
      />
    );
  } else if (!hasPositions) {
    split = <ProtocolSplitEmpty />;
  }

  return (
    // Never shorter than the banner beside it: without positions the split's
    // bare track then sits on the banner's bottom edge, as the legend does
    // with positions
    <YStack
      flex={1}
      minWidth={0}
      minHeight={minHeight}
      jc="space-between"
      gap="$6"
      onLayout={(event) => {
        const { height, width } = event.nativeEvent.layout;
        setHeroWidth(Math.round(width));
        heroHeightRef.current = Math.round(height);
        if (Date.now() >= easeUntilRef.current) {
          onHeightChange?.(heroHeightRef.current);
        }
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
          <TickingTotalValue
            total={total}
            change24h={change24h}
            isRunning={isTicking}
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
          <SizableText
            size="$bodyLgMedium"
            color="$textSubdued"
            mr={TEXT_BEFORE_ICON_SPACE}
          >
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
              transition={reduceMotion ? undefined : 'quick'}
              animateOnly={ANIMATE_ONLY_BG_COLOR}
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
              transition={reduceMotion ? undefined : 'quick'}
              animateOnly={ANIMATE_ONLY_BG_COLOR}
              onPress={onOpenPortfolio}
              onHoverIn={warmEarnPositions}
              onFocus={warmEarnPositions}
              {...buildKeyboardPressProps(onOpenPortfolio)}
            >
              {/* Every size keeps the 48px line, so nothing below moves */}
              <YStack
                h={TOTAL_FONT_SIZE}
                jc="center"
                minWidth={0}
                flexShrink={1}
              >
                <TickingTotalValue
                  total={total}
                  change24h={change24h}
                  isRunning={isTicking}
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
                transition={reduceMotion ? undefined : 'quick'}
                animateOnly={ANIMATE_ONLY_BG_COLOR}
                onPress={onRefresh}
              />
            ) : null}
          </XStack>
        )}
        {earningsRow}
      </YStack>
      <RewardsRow
        isLoading={isLoading}
        isReserved={hadRewardsByAccount.get(accountKey) !== false}
        onHasRow={handleHasRewards}
        onEase={handleRewardsEase}
      >
        {rewards}
      </RewardsRow>
      {split}
    </YStack>
  );
}

export const EarnDesktopHero = memo(BasicEarnDesktopHero);
