import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { DottedUnderlineText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/DottedUnderline';
import { EarnTooltip } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnTooltip';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IEarnTextTooltip } from '@onekeyhq/shared/types/staking';

import { usePortfolioTableLayout } from './portfolioTableLayout';

/**
 * One figure with its label. A label that carries an explanation is marked
 * the way every explained figure in Earn is, a dotted rule, and opens it in
 * the tooltip sheet; the padding the negative margin takes back makes the
 * label a finger's height to tap without moving it.
 */
function TotalCell({
  label,
  value,
  tooltip,
  fill,
  isLoading,
}: {
  label: string;
  value: string;
  tooltip?: IEarnTextTooltip;
  /** the phone splits the row in half; the wide layout keeps the pair together */
  fill: boolean;
  isLoading: boolean;
}) {
  const currencyInfo = useCurrency();
  return (
    <YStack flex={fill ? 1 : undefined} gap="$1" minWidth={0}>
      {tooltip ? (
        <EarnTooltip
          title={label}
          tooltip={tooltip}
          renderTrigger={
            <Stack py="$3" my="$-3">
              <DottedUnderlineText
                size="$bodyMd"
                color="$textSubdued"
                numberOfLines={1}
              >
                {label}
              </DottedUnderlineText>
            </Stack>
          }
        />
      ) : (
        <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
          {label}
        </SizableText>
      )}
      {isLoading ? (
        // In the figure's own box ($heading2xl's line), so nothing moves
        // when the figure comes in
        <YStack h={32} jc="center">
          <Skeleton w={112} h={20} borderRadius="$2" />
        </YStack>
      ) : (
        <NumberSizeableTextWrapper
          hideValue
          size="$heading2xl"
          formatter="value"
          formatterOptions={{ currency: currencyInfo.symbol }}
          numberOfLines={1}
        >
          {value}
        </NumberSizeableTextWrapper>
      )}
    </YStack>
  );
}

/**
 * The two figures at the top of the page: what the user holds in OneKey DeFi
 * and what is owed to them (claimable + pending), plus the scope footnote.
 */
export function PortfolioTotalsHeader({
  defiAssetsFiatValue,
  rewardsFiatValue,
  isLoading = false,
}: {
  defiAssetsFiatValue: string;
  rewardsFiatValue: string;
  /** a first load: both figures wait for every protocol */
  isLoading?: boolean;
}) {
  const intl = useIntl();
  const isTableLayout = usePortfolioTableLayout();
  // Product (OK-64463): Rewards alone explains what it counts; DeFi Assets
  // has the footnote below and no tooltip.
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
  return (
    <YStack px="$5" pt="$2" pb="$4" gap="$3">
      <XStack gap={isTableLayout ? '$16' : '$4'}>
        <TotalCell
          // On web the home's name for the same figure (demo 10-29)
          label={intl.formatMessage({
            id: platformEnv.isNative
              ? ETranslations.earn_defi_assets__title
              : ETranslations.defi_net_worth,
          })}
          value={defiAssetsFiatValue}
          fill={!isTableLayout}
          isLoading={isLoading}
        />
        <TotalCell
          label={intl.formatMessage({ id: ETranslations.earn_rewards })}
          value={rewardsFiatValue}
          tooltip={rewardsTooltip}
          fill={!isTableLayout}
          isLoading={isLoading}
        />
      </XStack>
      <SizableText size="$bodySm" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.earn_defi_scope_note__desc })}
      </SizableText>
    </YStack>
  );
}
