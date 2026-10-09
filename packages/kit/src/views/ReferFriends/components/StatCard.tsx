import {
  IconButton,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { ColorTokens } from '@onekeyhq/components/src/shared/tamagui';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { useInviteListCardStyle } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/useInviteCardStyle';

export interface IStatCardProps {
  title: string;
  value: string;
  isCurrency?: boolean;
  // Show `value` in this currency instead of the wallet currency.
  fixedCurrency?: string;
  prefix?: string;
  subtitle?: string;
  showRefreshButton?: boolean;
  isLoading?: boolean;
  onRefresh?: () => void;
  isWide: boolean;
  fullWidth?: boolean;
  valueColor?: ColorTokens;
}

export function StatCard({
  title,
  value,
  isCurrency = true,
  fixedCurrency,
  prefix,
  subtitle,
  showRefreshButton,
  isLoading,
  onRefresh,
  isWide,
  fullWidth,
  valueColor = '$text',
}: IStatCardProps) {
  const { xl } = useMedia();
  const cardStyle = useInviteListCardStyle();
  const isMediumScreen = isWide && xl;

  const getValueSize = () => {
    if (fullWidth) {
      return '$heading4xl';
    }
    if (isMediumScreen) {
      return '$heading3xl';
    }
    return isWide ? '$heading4xl' : '$headingXl';
  };

  return (
    // Same card as the pages behind the invite home (tinted on compact
    // layouts); no decorative icon tile, so the figure leads.
    <YStack
      flex={fullWidth ? undefined : 1}
      flexBasis={fullWidth ? undefined : 0}
      minWidth={0}
      p={isWide ? '$5' : '$4'}
      {...cardStyle}
    >
      <YStack gap={subtitle ? '$2.5' : undefined}>
        <YStack>
          <XStack ai="center" jc="space-between" gap="$2">
            <SizableText
              size={isWide ? '$bodyLgMedium' : '$bodyMdMedium'}
              color="$textSubdued"
              numberOfLines={1}
              flexShrink={1}
            >
              {title}
            </SizableText>
            {showRefreshButton ? (
              <IconButton
                testID="refer-friends-get-value-size-icon-btn"
                icon="RefreshCcwOutline"
                variant="tertiary"
                size="small"
                loading={isLoading}
                onPress={onRefresh}
              />
            ) : null}
          </XStack>
          <XStack ai="baseline">
            {prefix ? (
              <SizableText size={getValueSize()} color={valueColor}>
                {prefix}
              </SizableText>
            ) : null}
            {isCurrency ? (
              <Currency
                size={getValueSize()}
                color={valueColor}
                formatter="value"
                sourceCurrency={fixedCurrency}
                targetCurrency={fixedCurrency}
              >
                {value}
              </Currency>
            ) : (
              <SizableText size={getValueSize()} color={valueColor}>
                {value}
              </SizableText>
            )}
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
