import { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useReducedMotion } from 'react-native-reanimated';

import {
  IconButton,
  SizableText,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import {
  settingsValuePersistAtom,
  useSettingsPersistAtom,
  useSettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ANIMATE_ONLY_BG_COLOR } from '../../../components/desktopHome/earnDesktopColorEase';
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
 * home (its size, the day's earnings under it, the eye and the refresh),
 * with the scope note under it. The total is written to its cents, without
 * the home's moving digits after them (the user, 11-12), and cut where the
 * home cuts it, so the two pages read the same amount. Rewards, the page's
 * second figure, is in its tab
 */
export function EarnPortfolioDesktopHeader({
  netWorth,
  earnings24h,
  change24h = 0,
  isLoading,
  isActive,
  isRefreshing,
  onRefresh,
}: {
  netWorth: string;
  /** What the home states under its Net Worth; none where it hasn't shown one */
  earnings24h?: string;
  /** What the home's total grows by in a day: the cents follow it */
  change24h?: number;
  /** A first load: the figures wait for every protocol */
  isLoading: boolean;
  /** The page is the one in view: the total keeps up with the home's */
  isActive: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
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
    <YStack px="$5" pt="$2" pb="$6" gap="$2">
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
              hidesDigits
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
  );
}

/**
 * Rewards' figure in its tab, after the name: the tab says what it holds.
 * Pointing at it says what Rewards counts (OK-64463). The hover trigger
 * takes the press that lands on it, so it opens the tab itself
 */
export function EarnPortfolioRewardsTabFigure({
  value,
  isLoading,
  onPress,
}: {
  value: string;
  isLoading: boolean;
  /** Opens the tab, as a press on its name does */
  onPress: () => void;
}) {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  if (isLoading) {
    return null;
  }
  return (
    <Tooltip
      placement="top"
      onPress={onPress}
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
