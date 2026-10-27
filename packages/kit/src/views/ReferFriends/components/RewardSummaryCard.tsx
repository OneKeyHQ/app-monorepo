import type { ReactNode } from 'react';

import { IconButton, SizableText, XStack, YStack } from '@onekeyhq/components';
import type { ISizableTextProps } from '@onekeyhq/components';
import type { ColorTokens } from '@onekeyhq/components/src/shared/tamagui';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { useInviteListCardStyle } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/useInviteCardStyle';

import { ReferFriendsTestIDs } from '../testIDs';

import { CompactFieldRow } from './CompactFieldRow';

export interface IRewardSummaryRow {
  label: string;
  value: string;
  // Plain text (counts) instead of a fiat amount.
  isCurrency?: boolean;
  // The currency `value` arrives in; it is shown in the wallet currency.
  sourceCurrency?: string;
  prefix?: string;
  // A quiet line under the value it explains.
  hint?: string;
}

// A reward figure: an optional prefix ("~"), then the amount in the wallet
// currency (converted from `sourceCurrency`), or plain text for counts.
export function RewardValue({
  value,
  isCurrency = true,
  sourceCurrency,
  prefix,
  size,
  color = '$text',
}: {
  value: string;
  isCurrency?: boolean;
  sourceCurrency?: string;
  prefix?: string;
  size: ISizableTextProps['size'];
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
        sourceCurrency={sourceCurrency}
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
  sourceCurrency,
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
  sourceCurrency?: string;
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
            testID={ReferFriendsTestIDs.rewardSummaryRefreshBtn}
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
        <RewardValue
          value={value}
          sourceCurrency={sourceCurrency}
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
            <CompactFieldRow key={row.label} label={row.label} hint={row.hint}>
              <RewardValue
                value={row.value}
                isCurrency={row.isCurrency}
                sourceCurrency={row.sourceCurrency}
                prefix={row.prefix}
                size="$bodyMdMedium"
              />
            </CompactFieldRow>
          ))}
        </YStack>
      ) : null}
    </YStack>
  );
}
