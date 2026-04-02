import { useIntl } from 'react-intl';

import {
  Divider,
  Icon,
  NumberSizeableText,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export interface IRewardDetailTooltipProps {
  rewards?: Array<{
    token: {
      logoURI: string;
      symbol: string;
    };
    amount: string;
    fiatValue: string;
  }>;
  iconSize?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

export function RewardDetailTooltip({
  rewards,
  iconSize = '$5',
  placement = 'top',
}: IRewardDetailTooltipProps) {
  const intl = useIntl();

  return (
    <Popover.Tooltip
      iconSize={iconSize}
      placement={placement}
      title={intl.formatMessage({
        id: ETranslations.referral_earn_reward_details,
      })}
      renderContent={
        <YStack borderRadius="$3" overflow="hidden">
          <YStack px="$5">
            {rewards?.map(({ token, fiatValue, amount }, index) => {
              return (
                <XStack
                  key={index}
                  gap="$2"
                  h={48}
                  ai="center"
                  jc="space-between"
                  py={5}
                >
                  <XStack gap="$2.5" ai="center">
                    <Token size="sm" tokenImageUri={token.logoURI} />
                    <SizableText size="$bodyMdMedium">
                      {token.symbol.toUpperCase()}
                    </SizableText>
                  </XStack>
                  <YStack ai="flex-end">
                    <NumberSizeableText
                      formatter="balance"
                      size="$bodyMdMedium"
                    >
                      {amount}
                    </NumberSizeableText>
                    <Currency
                      formatter="balance"
                      size="$bodySmMedium"
                      color="$textSubdued"
                    >
                      {fiatValue}
                    </Currency>
                  </YStack>
                </XStack>
              );
            })}
          </YStack>
          <Divider />
          <XStack ai="center" gap="$2" py="$2.5" px="$5" bg="$bgSubdued">
            <Stack>
              <Icon color="$iconSubdued" size="$5" name="InfoCircleOutline" />
            </Stack>
            <SizableText flex={1} size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.referral_earn_reward_details_desc,
              })}
            </SizableText>
          </XStack>
        </YStack>
      }
    />
  );
}
