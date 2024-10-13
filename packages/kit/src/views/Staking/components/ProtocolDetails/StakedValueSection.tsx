import type { ComponentProps } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  NumberSizeableText,
  Progress,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IStakeProtocolDetails } from '@onekeyhq/shared/types/staking';

type IStakedValueInfoProps = {
  value: number;
  stakedNumber: number;
  availableNumber: number;
  tokenSymbol: string;
  stakeButtonProps?: ComponentProps<typeof Button>;
  withdrawButtonProps?: ComponentProps<typeof Button>;
};

function StakedValueInfo({
  value = 0,
  stakedNumber = 0,
  availableNumber = 0,
  tokenSymbol,
  stakeButtonProps,
  withdrawButtonProps,
}: IStakedValueInfoProps) {
  const totalNumber = stakedNumber + availableNumber;
  const intl = useIntl();
  const media = useMedia();
  const [
    {
      currencyInfo: { symbol: currency },
    },
  ] = useSettingsPersistAtom();
  return (
    <YStack gap="$6">
      <YStack gap="$2">
        <SizableText size="$headingLg">
          {intl.formatMessage({ id: ETranslations.earn_staked_value })}
        </SizableText>
        <XStack gap="$2">
          <NumberSizeableText
            flex={1}
            size="$heading4xl"
            color={value === 0 ? '$textDisabled' : '$text'}
            formatter="value"
            formatterOptions={{ currency }}
          >
            {value || 0}
          </NumberSizeableText>
          {media.gtMd ? (
            <XStack gap="$2">
              <Button {...withdrawButtonProps}>
                {intl.formatMessage({ id: ETranslations.global_withdraw })}
              </Button>
              <Button {...stakeButtonProps}>
                {intl.formatMessage({ id: ETranslations.earn_stake })}
              </Button>
            </XStack>
          ) : null}
        </XStack>
      </YStack>
      <YStack gap="$1.5">
        <YStack my="$1.5">
          <Progress
            colors={['$bgSuccessStrong', '$bgInverse']}
            size="medium"
            gap={2}
            value={totalNumber === 0 ? 0 : (stakedNumber / totalNumber) * 100}
          />
        </YStack>
        <XStack justifyContent="space-between">
          <YStack gap="$0.5">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.earn_staked })}
            </SizableText>
            <NumberSizeableText
              size="$bodyLgMedium"
              formatter="balance"
              formatterOptions={{ tokenSymbol }}
            >
              {stakedNumber || 0}
            </NumberSizeableText>
          </YStack>
          <YStack gap="$0.5">
            <SizableText size="$bodyMd" color="$textSuccess" textAlign="right">
              {intl.formatMessage({ id: ETranslations.global_available })}
            </SizableText>
            <NumberSizeableText
              size="$bodyLgMedium"
              formatter="balance"
              formatterOptions={{ tokenSymbol }}
            >
              {availableNumber || 0}
            </NumberSizeableText>
          </YStack>
        </XStack>
      </YStack>
    </YStack>
  );
}

export const StakedValueSection = ({
  details,
  stakeButtonProps,
  withdrawButtonProps,
}: {
  details?: IStakeProtocolDetails;
  stakeButtonProps?: ComponentProps<typeof Button>;
  withdrawButtonProps?: ComponentProps<typeof Button>;
}) => {
  if (!details) {
    return null;
  }
  const props: IStakedValueInfoProps = {
    value: Number(details.stakedFiatValue),
    stakedNumber: Number(details.staked),
    availableNumber: Number(details.available),
    tokenSymbol: details.token.info.symbol,
  };
  return (
    <StakedValueInfo
      {...props}
      stakeButtonProps={stakeButtonProps}
      withdrawButtonProps={withdrawButtonProps}
    />
  );
};
