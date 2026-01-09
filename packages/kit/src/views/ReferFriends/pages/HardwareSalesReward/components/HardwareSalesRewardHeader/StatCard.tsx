import { StyleSheet } from 'react-native';

import type { IStackStyle } from '@onekeyhq/components';
import {
  Icon,
  IconButton,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { ColorTokens } from '@onekeyhq/components/src/shared/tamagui';
import { Currency } from '@onekeyhq/kit/src/components/Currency';

export interface IStatCardProps {
  icon: 'CoinOutline' | 'ClockTimeHistoryOutline' | 'HourglassOutline';
  iconBgColor: IStackStyle['bg'];
  iconColor: ColorTokens;
  title: string;
  amount: string;
  prefix?: string;
  subtitle?: string;
  showRefreshButton?: boolean;
  isLoading?: boolean;
  onRefresh?: () => void;
  isWide: boolean;
  fullWidth?: boolean;
}

export function StatCard({
  icon,
  iconBgColor,
  iconColor,
  title,
  amount,
  prefix,
  subtitle,
  showRefreshButton,
  isLoading,
  onRefresh,
  isWide,
  fullWidth,
}: IStatCardProps) {
  const getAmountSize = () => {
    if (fullWidth) {
      return '$heading4xl';
    }
    return isWide ? '$heading5xl' : '$headingXl';
  };

  return (
    <YStack
      flex={fullWidth ? undefined : 1}
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      borderRadius="$3"
      p={isWide ? '$5' : '$4'}
      gap={isWide ? '$5' : '$4'}
    >
      <XStack jc="space-between" ai="center">
        <Stack bg={iconBgColor} p="$2" borderRadius="$2">
          <Icon name={icon} size="$5" color={iconColor} />
        </Stack>
        {showRefreshButton ? (
          <IconButton
            icon="RefreshCcwOutline"
            variant="tertiary"
            size="small"
            loading={isLoading}
            onPress={onRefresh}
          />
        ) : null}
      </XStack>

      <YStack gap={subtitle ? '$2.5' : undefined}>
        <YStack>
          <SizableText
            size={isWide ? '$bodyLgMedium' : '$bodyMdMedium'}
            color="$textSubdued"
          >
            {title}
          </SizableText>
          <XStack ai="baseline">
            {prefix ? (
              <SizableText size={getAmountSize()} color="$text">
                {prefix}
              </SizableText>
            ) : null}
            <Currency size={getAmountSize()} color="$text" formatter="value">
              {amount}
            </Currency>
          </XStack>
        </YStack>
        {subtitle ? (
          <SizableText
            size={isWide ? '$bodyMd' : '$bodySm'}
            color="$textSubdued"
          >
            {subtitle}
          </SizableText>
        ) : null}
      </YStack>
    </YStack>
  );
}
