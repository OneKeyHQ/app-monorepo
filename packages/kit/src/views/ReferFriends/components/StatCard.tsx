import { StyleSheet } from 'react-native';

import type { IKeyOfIcons, IStackStyle } from '@onekeyhq/components';
import {
  Icon,
  IconButton,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { ColorTokens } from '@onekeyhq/components/src/shared/tamagui';
import { Currency } from '@onekeyhq/kit/src/components/Currency';

export interface IStatCardProps {
  icon: IKeyOfIcons;
  iconBgColor: IStackStyle['bg'];
  iconColor: ColorTokens;
  title: string;
  value: string;
  isCurrency?: boolean;
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
  icon,
  iconBgColor,
  iconColor,
  title,
  value,
  isCurrency = true,
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
  const isMediumScreen = isWide && xl;

  const getValueSize = () => {
    if (fullWidth) {
      return '$heading4xl';
    }
    if (isMediumScreen) {
      return '$heading3xl';
    }
    return isWide ? '$heading5xl' : '$headingXl';
  };

  return (
    <YStack
      flex={fullWidth ? undefined : 1}
      flexBasis={fullWidth ? undefined : 0}
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
              <SizableText size={getValueSize()} color={valueColor}>
                {prefix}
              </SizableText>
            ) : null}
            {isCurrency ? (
              <Currency
                size={getValueSize()}
                color={valueColor}
                formatter="value"
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
