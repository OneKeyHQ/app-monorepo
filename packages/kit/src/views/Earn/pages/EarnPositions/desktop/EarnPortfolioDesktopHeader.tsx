import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useReducedMotion } from 'react-native-reanimated';

import {
  Icon,
  IconButton,
  SizableText,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { DottedUnderlineText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/DottedUnderline';
import { EarnTooltip } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnTooltip';
import {
  settingsValuePersistAtom,
  useSettingsPersistAtom,
  useSettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IEarnTextTooltip } from '@onekeyhq/shared/types/staking';

import { ANIMATE_ONLY_BG_COLOR } from '../../../components/desktopHome/earnDesktopColorEase';
import { buildKeyboardPressProps } from '../../../components/desktopHome/earnDesktopPressable';
import { SkeletonLine } from '../../../components/desktopHome/EarnDesktopProtocolSplit';
import {
  EarnEarnings24hLine,
  TEXT_BEFORE_ICON_SPACE,
} from '../../../components/desktopHome/EarnEarnings24hLine';
import { TickingTotalValue } from '../../../components/desktopHome/EarnTickingTotal';

// The DeFi home's Net Worth size and line: the number pressed there is the
// number this page opens on
const TOTAL_FONT_SIZE = 48;

/**
 * The wide My portfolio's top: Net Worth leads the page as it leads the DeFi
 * home (its size, its moving digits, the day's earnings under it, the eye
 * and the refresh), with the scope note under it. Rewards, the page's second
 * figure, stands at the row's other end with what can be claimed now, or
 * goes into its tab (`showsRewards` off)
 */
export function EarnPortfolioDesktopHeader({
  netWorth,
  earnings24h,
  change24h = 0,
  showsRewards,
  rewardsFiatValue,
  claimableFiatValue,
  isLoading,
  isActive,
  isRefreshing,
  onRefresh,
  onOpenClaimable,
}: {
  netWorth: string;
  /** What the home states under its Net Worth; none where it hasn't shown one */
  earnings24h?: string;
  change24h?: number;
  showsRewards: boolean;
  rewardsFiatValue: string;
  /** The part of Rewards ready to claim */
  claimableFiatValue: string;
  /** A first load: the figures wait for every protocol */
  isLoading: boolean;
  /** The page is the one in view: the total moves */
  isActive: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  /** Rewards' Claimable list */
  onOpenClaimable: () => void;
}) {
  const intl = useIntl();
  const reduceMotion = useReducedMotion();
  const [settings] = useSettingsPersistAtom();
  const currency = settings.currencyInfo.symbol;
  const [{ hideValue: isHidden }] = useSettingsValuePersistAtom();
  const handleToggleHideValue = useCallback(async () => {
    const current = await settingsValuePersistAtom.get();
    await settingsValuePersistAtom.set({ hideValue: !current.hideValue });
  }, []);
  const total = new BigNumber(netWorth).toNumber() || 0;
  const rewardsLabel = intl.formatMessage({ id: ETranslations.earn_rewards });
  // Product (OK-64463): Rewards alone explains what it counts
  const rewardsTooltip = useMemo<IEarnTextTooltip>(
    () => ({
      type: 'text',
      data: {
        description: {
          text: intl.formatMessage({
            id: ETranslations.earn_portfolio_rewards_tooltip__desc,
          }),
        },
      },
    }),
    [intl],
  );
  const hasClaimable = new BigNumber(claimableFiatValue).gt(0);

  let earningsRow: React.ReactNode = null;
  if (isLoading) {
    earningsRow = <SkeletonLine height={20} width={180} barHeight={14} />;
  } else if (earnings24h !== undefined) {
    earningsRow = (
      <EarnEarnings24hLine
        earnings24h={earnings24h}
        currency={currency}
        isHidden={isHidden}
      />
    );
  }

  return (
    <XStack px="$5" pt="$2" pb="$6" gap="$10" jc="space-between">
      <YStack gap="$2" minWidth={0} flexShrink={1}>
        <XStack ai="center" gap="$1">
          <SizableText
            size="$bodyLgMedium"
            color="$textSubdued"
            mr={TEXT_BEFORE_ICON_SPACE}
          >
            {intl.formatMessage({ id: ETranslations.defi_net_worth })}
          </SizableText>
          <YStack my="$-1">
            <IconButton
              testID="earn-my-portfolio-hide-value"
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
        {isLoading ? (
          <SkeletonLine height={TOTAL_FONT_SIZE} width={209} barHeight={40} />
        ) : (
          <XStack ai="center" gap="$3" alignSelf="flex-start" maxWidth="100%">
            <YStack
              testID="earn-my-portfolio-net-worth"
              h={TOTAL_FONT_SIZE}
              jc="center"
              minWidth={0}
              flexShrink={1}
            >
              <TickingTotalValue
                total={total}
                change24h={change24h}
                isRunning={isActive && !isHidden}
                currency={currency}
                fontSize={TOTAL_FONT_SIZE}
                isHidden={isHidden}
              />
            </YStack>
            <IconButton
              testID="earn-my-portfolio-refresh"
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
          </XStack>
        )}
        {earningsRow}
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.earn_defi_scope_note__desc })}
        </SizableText>
      </YStack>
      {showsRewards ? (
        <YStack ai="flex-end" gap="$2" flexShrink={0}>
          <EarnTooltip
            title={rewardsLabel}
            tooltip={rewardsTooltip}
            renderTrigger={
              <DottedUnderlineText
                size="$bodyLgMedium"
                color="$textSubdued"
                numberOfLines={1}
              >
                {rewardsLabel}
              </DottedUnderlineText>
            }
          />
          {isLoading ? (
            <SkeletonLine height={TOTAL_FONT_SIZE} width={96} barHeight={28} />
          ) : (
            // On the Net Worth's baseline, a step under it in size
            <YStack
              testID="earn-my-portfolio-rewards"
              h={TOTAL_FONT_SIZE}
              jc="flex-end"
            >
              <NumberSizeableTextWrapper
                hideValue
                size="$heading3xl"
                formatter="value"
                formatterOptions={{ currency }}
                numberOfLines={1}
              >
                {rewardsFiatValue}
              </NumberSizeableTextWrapper>
            </YStack>
          )}
          {!isLoading && hasClaimable ? (
            <XStack
              testID="earn-my-portfolio-claimable"
              role="button"
              ai="center"
              gap="$1"
              pl="$2"
              mr="$-1"
              borderRadius="$2"
              cursor="pointer"
              userSelect="none"
              hoverStyle={{ bg: '$bgHover' }}
              pressStyle={{ bg: '$bgActive' }}
              transition={reduceMotion ? undefined : 'quick'}
              animateOnly={ANIMATE_ONLY_BG_COLOR}
              onPress={onOpenClaimable}
              {...buildKeyboardPressProps(onOpenClaimable)}
            >
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({ id: ETranslations.earn_claimable })}
              </SizableText>
              <NumberSizeableTextWrapper
                hideValue
                size="$bodyMdMedium"
                formatter="value"
                formatterOptions={{ currency }}
              >
                {claimableFiatValue}
              </NumberSizeableTextWrapper>
              <Icon
                name="ChevronRightSmallOutline"
                size="$5"
                color="$iconSubdued"
              />
            </XStack>
          ) : null}
        </YStack>
      ) : null}
    </XStack>
  );
}

/**
 * Rewards' figure in its tab, after the name: the tab says what it holds.
 * Pointing at it says what Rewards counts (OK-64463)
 */
export function EarnPortfolioRewardsTabFigure({
  value,
  isLoading,
}: {
  value: string;
  isLoading: boolean;
}) {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  if (isLoading) {
    return null;
  }
  return (
    <Tooltip
      placement="top"
      renderContent={intl.formatMessage({
        id: ETranslations.earn_portfolio_rewards_tooltip__desc,
      })}
      renderTrigger={
        <YStack testID="earn-my-portfolio-tab-rewards-figure">
          <NumberSizeableTextWrapper
            hideValue
            size="$bodyLgMedium"
            color="$textSubdued"
            formatter="value"
            formatterOptions={{ currency: settings.currencyInfo.symbol }}
            numberOfLines={1}
          >
            {value}
          </NumberSizeableTextWrapper>
        </YStack>
      }
    />
  );
}
