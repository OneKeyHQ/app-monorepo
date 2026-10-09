import type { ReactNode } from 'react';

import { IconButton, SizableText, XStack, YStack } from '@onekeyhq/components';
import type { ColorTokens } from '@onekeyhq/components/src/shared/tamagui';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { useInviteListCardStyle } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/useInviteCardStyle';

export interface IRewardSummaryRow {
  label: string;
  value: string;
  // Plain text (counts) instead of a fiat amount.
  isCurrency?: boolean;
  // Show `value` in this currency instead of the wallet currency.
  fixedCurrency?: string;
  prefix?: string;
  // A quiet line under the value it explains.
  hint?: string;
}

function SummaryValue({
  value,
  isCurrency = true,
  fixedCurrency,
  prefix,
  size,
  color = '$text',
}: {
  value: string;
  isCurrency?: boolean;
  fixedCurrency?: string;
  prefix?: string;
  size: '$heading3xl' | '$bodyMdMedium';
  color?: ColorTokens;
}) {
  let content: ReactNode = (
    <SizableText size={size} color={color} numberOfLines={1}>
      {value}
    </SizableText>
  );
  if (isCurrency) {
    content = (
      <Currency
        size={size}
        color={color}
        formatter="value"
        numberOfLines={1}
        sourceCurrency={fixedCurrency}
        targetCurrency={fixedCurrency}
      >
        {value}
      </Currency>
    );
  }
  return (
    <XStack ai="baseline">
      {prefix ? (
        <SizableText size={size} color={color}>
          {prefix}
        </SizableText>
      ) : null}
      {content}
    </XStack>
  );
}

// Compact reward pages sum their figures up in one card, like the invite
// home's earnings card: the lead amount with its hint, then the other
// figures as label/value rows, each hint under the value it explains.
export function RewardSummaryCard({
  title,
  value,
  valueText,
  valueColor,
  fixedCurrency,
  prefix,
  hint,
  rows = [],
  isLoading,
  onRefresh,
}: {
  title: string;
  value: string;
  // Replaces the formatted amount, e.g. "< $0.01".
  valueText?: string;
  valueColor?: ColorTokens;
  fixedCurrency?: string;
  prefix?: string;
  hint?: string;
  rows?: IRewardSummaryRow[];
  isLoading?: boolean;
  onRefresh?: () => void;
}) {
  const cardStyle = useInviteListCardStyle();
  return (
    // Rows bring 8px of their own under the text, so the card closes 16px
    // from the last line either way.
    <YStack px="$4" pt="$4" pb={rows.length ? '$2' : '$4'} {...cardStyle}>
      <XStack ai="center" jc="space-between" gap="$3" minHeight={28}>
        <SizableText
          size="$bodyMd"
          color="$textSubdued"
          numberOfLines={1}
          flexShrink={1}
        >
          {title}
        </SizableText>
        {onRefresh ? (
          <IconButton
            testID="refer-friends-reward-summary-refresh-btn"
            icon="RefreshCcwOutline"
            variant="tertiary"
            size="small"
            loading={isLoading}
            onPress={onRefresh}
          />
        ) : null}
      </XStack>
      {valueText ? (
        <SizableText size="$heading3xl" color={valueColor} numberOfLines={1}>
          {valueText}
        </SizableText>
      ) : (
        <SummaryValue
          value={value}
          fixedCurrency={fixedCurrency}
          prefix={prefix}
          size="$heading3xl"
          color={valueColor}
        />
      )}
      {hint ? (
        <SizableText size="$bodySm" color="$textSubdued" pt="$1">
          {hint}
        </SizableText>
      ) : null}
      {rows.length ? (
        <YStack pt="$3">
          {rows.map((row) => (
            <XStack
              key={row.label}
              minHeight={36}
              py="$1"
              ai="center"
              jc="space-between"
              gap="$3"
            >
              <SizableText
                size="$bodyMd"
                color="$textSubdued"
                numberOfLines={1}
                flexShrink={1}
              >
                {row.label}
              </SizableText>
              <YStack ai="flex-end" gap="$0.5" flexShrink={0}>
                <SummaryValue
                  value={row.value}
                  isCurrency={row.isCurrency}
                  fixedCurrency={row.fixedCurrency}
                  prefix={row.prefix}
                  size="$bodyMdMedium"
                />
                {row.hint ? (
                  <SizableText
                    size="$bodySm"
                    color="$textSubdued"
                    numberOfLines={1}
                  >
                    {row.hint}
                  </SizableText>
                ) : null}
              </YStack>
            </XStack>
          ))}
        </YStack>
      ) : null}
    </YStack>
  );
}
