import { useEffect, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Button,
  Icon,
  IconButton,
  NumberSizeableText,
  Popover,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EarnTestIDs } from '../../testIDs';
import { getNumberColor } from '../../utils/getNumberColor';

import { EARN_DESKTOP_DEMO_COPY } from './earnDesktopHomeCopy';

import type { IEarnDesktopShares } from './earnDesktopHome.utils';

// Step 11 reads as text on both themes, and the legend reuses these colors
const SHARE_COLORS = ['$lime11', '$blue11', '$orange11'] as const;
const SECONDS_PER_DAY = 24 * 60 * 60;
// Past this the value formatter abbreviates, and extra digits read as noise
const TICKING_MAX_TOTAL = 1_000_000;

// The total keeps earning between refreshes: the five digits after the cents
// advance at the 24h estimate's per-second rate.
function useTickingTotal(total: number, earnings24h: number) {
  const perSecond = earnings24h > 0 ? earnings24h / SECONDS_PER_DAY : 0;
  const [anchor, setAnchor] = useState(() => ({ total, at: Date.now() }));
  const [now, setNow] = useState(() => Date.now());
  if (anchor.total !== total) {
    setAnchor({ total, at: Date.now() });
  }
  useEffect(() => {
    if (perSecond <= 0) {
      return undefined;
    }
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [perSecond]);
  const elapsedSeconds = Math.max(0, (now - anchor.at) / 1000);
  const value = total + perSecond * elapsedSeconds;
  const extraDigits =
    perSecond > 0 && total < TICKING_MAX_TOTAL
      ? value.toFixed(7).slice(-5)
      : undefined;
  return { value, extraDigits };
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

function ProtocolSplit({ shares }: { shares: IEarnDesktopShares }) {
  const restValue =
    shares.total - shares.top.reduce((sum, item) => sum + item.value, 0);
  return (
    <YStack gap="$3.5">
      <XStack h="$2.5" gap="$0.5" borderRadius="$full" overflow="hidden">
        {shares.top.map((item, index) => (
          <YStack key={item.key} flex={item.value} bg={SHARE_COLORS[index]} />
        ))}
        {shares.rest ? <YStack flex={restValue} bg="$neutral6" /> : null}
      </XStack>
      <XStack gap="$8" flexWrap="wrap">
        {shares.top.map((item, index) => (
          <YStack key={item.key} gap="$1">
            <XStack gap="$1.5" ai="center">
              <Token size="xs" tokenImageUri={item.logoURI} />
              <SizableText size="$bodyMd" color="$textSubdued">
                {item.name}
              </SizableText>
            </XStack>
            <SizableText size="$headingLg" color={SHARE_COLORS[index]}>
              {`${item.percent}%`}
            </SizableText>
          </YStack>
        ))}
        {shares.rest ? (
          <YStack gap="$1">
            <SizableText size="$bodyMd" color="$textSubdued">
              {EARN_DESKTOP_DEMO_COPY.more(shares.rest.count)}
            </SizableText>
            <SizableText size="$headingLg" color="$textSubdued">
              {`${shares.rest.percent}%`}
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
  shares,
  onOpenPortfolio,
  onOpenTokens,
  onOpenLoans,
  onOpenProtocols,
}: {
  totalFiatValue: string;
  earnings24h: string;
  shares: IEarnDesktopShares;
  onOpenPortfolio: () => void;
  onOpenTokens: () => void;
  onOpenLoans: () => void;
  onOpenProtocols: () => void;
}) {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const currency = settings.currencyInfo.symbol;
  const total = new BigNumber(totalFiatValue).toNumber() || 0;
  const earnings = new BigNumber(earnings24h).toNumber() || 0;
  const { value, extraDigits } = useTickingTotal(total, earnings);

  return (
    <YStack flex={1} minWidth={0} gap="$6" jc="space-between">
      <YStack gap="$2">
        <XStack
          testID={EarnTestIDs.portfolioEntry}
          role="button"
          ai="center"
          gap="$0.5"
          alignSelf="flex-start"
          cursor="pointer"
          userSelect="none"
          hoverStyle={{ opacity: 0.8 }}
          pressStyle={{ opacity: 0.6 }}
          onPress={onOpenPortfolio}
        >
          <SizableText size="$bodyLgMedium" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.earn_total_staked_value })}
          </SizableText>
          <Icon
            name="ChevronRightSmallOutline"
            size="$5"
            color="$iconSubdued"
          />
        </XStack>
        <XStack ai="flex-end" gap="$1">
          <NumberSizeableText
            size="$heading5xl"
            fontWeight={600}
            formatter="value"
            formatterOptions={{ currency }}
            numberOfLines={1}
          >
            {String(value)}
          </NumberSizeableText>
          {extraDigits ? (
            <SizableText
              size="$heading3xl"
              fontWeight={500}
              color="$textDisabled"
              mb="$0.5"
            >
              {extraDigits}
            </SizableText>
          ) : null}
        </XStack>
        <XStack ai="center" gap="$1.5">
          <NumberSizeableText
            size="$bodyMdMedium"
            formatter="value"
            formatterOptions={{
              currency,
              showPlusMinusSigns: earnings !== 0,
            }}
            color={getNumberColor(earnings24h)}
          >
            {earnings24h}
          </NumberSizeableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.earn_24h_earnings })}
          </SizableText>
          <Popover
            placement="bottom-start"
            renderTrigger={
              <IconButton
                testID="earn-desktop-24h-earnings-info"
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
      {shares.top.length ? <ProtocolSplit shares={shares} /> : null}
    </YStack>
  );
}
