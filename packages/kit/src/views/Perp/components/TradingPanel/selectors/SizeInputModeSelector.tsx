import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  Popover,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';

export interface ISizeInputModeSelectorProps {
  value: 'token' | 'usd' | 'margin';
  onChange: (value: 'token' | 'usd' | 'margin') => void;
  tokenSymbol: string;
}

export function SizeInputModeSelector({
  value,
  onChange,
  tokenSymbol,
}: ISizeInputModeSelectorProps) {
  const intl = useIntl();
  const isTokenSelected = value === 'token';
  const isUsdSelected = value === 'usd' || value === 'margin';
  const { gtMd } = useMedia();

  const handleUsdCardPress = useCallback(() => {
    if (!isUsdSelected) {
      onChange('usd');
    }
  }, [isUsdSelected, onChange]);

  const renderRadioItem = (
    label: string,
    checked: boolean,
    onPress: () => void,
  ) => (
    <XStack
      alignItems="center"
      gap="$2"
      cursor="pointer"
      onPress={(e) => {
        e.stopPropagation();
        onPress();
      }}
    >
      <XStack
        w="$3"
        h="$3"
        borderRadius="$full"
        borderWidth={1.5}
        borderColor={checked ? '$borderActive' : '$borderStrong'}
        bg={checked ? '$bgPrimary' : 'transparent'}
        alignItems="center"
        justifyContent="center"
      >
        {checked ? (
          <XStack w="$1.5" h="$1.5" borderRadius="$full" bg="$iconInverse" />
        ) : null}
      </XStack>
      <SizableText size="$bodySmMedium" color="$text">
        {label}
      </SizableText>
    </XStack>
  );

  const trigger = (
    <XStack alignItems="center" gap="$1" cursor="pointer" userSelect="none">
      <SizableText size="$bodyMdMedium" color="$textSubdued">
        {value === 'token' ? tokenSymbol || 'Token' : 'USD'}
      </SizableText>
      <Icon
        name="ChevronTriangleDownSmallOutline"
        size="$4"
        color="$iconSubdued"
      />
    </XStack>
  );

  return (
    <Popover
      title={intl.formatMessage({
        id: ETranslations.perp_size_input_title,
      })}
      placement="bottom-end"
      renderTrigger={trigger}
      renderContent={
        <YStack p="$4" gap="$4">
          {gtMd ? (
            <SizableText size="$bodySmMedium" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.perp_size_input_title,
              })}
            </SizableText>
          ) : null}
          <YStack
            p="$3"
            gap="$2.5"
            borderRadius="$3"
            borderWidth={1}
            borderColor={isTokenSelected ? '$borderActive' : '$borderSubdued'}
            cursor="pointer"
            onPress={() => onChange('token')}
            hoverStyle={{
              bg: '$bgHover',
            }}
          >
            <YStack gap="$1">
              <SizableText size="$headingSm" color="$text">
                {tokenSymbol || 'Token'}
              </SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage(
                  { id: ETranslations.perp_size_input_token_desc },
                  {
                    token: tokenSymbol || 'Token',
                  },
                )}
              </SizableText>
            </YStack>
          </YStack>

          <YStack
            p="$3"
            gap="$2.5"
            borderRadius="$3"
            borderWidth={1}
            borderColor={isUsdSelected ? '$borderActive' : '$borderSubdued'}
            cursor="pointer"
            onPress={handleUsdCardPress}
            hoverStyle={{
              bg: '$bgHover',
            }}
          >
            <YStack gap="$1">
              <SizableText size="$headingSm" color="$text">
                USD
              </SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.perp_size_input_usd_desc,
                })}
              </SizableText>
            </YStack>

            <XStack gap="$6">
              {renderRadioItem(
                intl.formatMessage({
                  id: ETranslations.perp_size_input_usd_order_size,
                }),
                value === 'usd',
                () => onChange('usd'),
              )}
              {renderRadioItem(
                intl.formatMessage({
                  id: ETranslations.perp_size_input_usd_order_cost,
                }),
                value === 'margin',
                () => onChange('margin'),
              )}
            </XStack>
          </YStack>
        </YStack>
      }
    />
  );
}
