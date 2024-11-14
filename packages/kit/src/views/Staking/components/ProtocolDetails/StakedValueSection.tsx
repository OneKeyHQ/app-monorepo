import type { ComponentProps } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
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
    <YStack gap="$8">
      <YStack>
        <SizableText size="$headingLg" pt="$2">
          {intl.formatMessage({ id: ETranslations.earn_staked_value })}
        </SizableText>
        <XStack gap="$2" pt="$2" pb="$1">
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
        <NumberSizeableText
          size="$bodyLgMedium"
          formatter="balance"
          color="$textSubdued"
          formatterOptions={{ tokenSymbol }}
        >
          {stakedNumber || 0}
        </NumberSizeableText>
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
    <>
      <StakedValueInfo
        {...props}
        stakeButtonProps={stakeButtonProps}
        withdrawButtonProps={withdrawButtonProps}
      />

      <Divider />
    </>
  );
};
