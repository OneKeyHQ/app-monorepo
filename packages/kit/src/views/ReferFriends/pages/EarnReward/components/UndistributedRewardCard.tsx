import { type FC, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  type IYStackProps,
  IconButton,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const MIN_DISPLAY_AMOUNT = 0.01;

interface IUndistributedRewardCardProps extends IYStackProps {
  value: string | number;
  showIcon?: boolean;
  onIconPress?: () => void;
}

export const UndistributedRewardCard: FC<IUndistributedRewardCardProps> = ({
  value,
  showIcon = false,
  onIconPress,
  ...rest
}) => {
  const intl = useIntl();

  const isMinDisplay = useMemo(() => {
    const bn = new BigNumber(value);
    return bn.isGreaterThan(0) && bn.isLessThan(MIN_DISPLAY_AMOUNT);
  }, [value]);

  return (
    <YStack gap="$1" testID="UndistributedRewardCard" {...rest}>
      <XStack
        ai="center"
        jc="space-between"
        gap="$2"
        pt={platformEnv.isNative ? '$10' : undefined}
      >
        <SizableText size="$bodyLg" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.referral_reward_undistributed,
          })}
        </SizableText>
        {showIcon ? (
          <IconButton
            icon="InfoCircleOutline"
            variant="tertiary"
            size="small"
            iconProps={{ color: '$iconSubdued' }}
            onPress={onIconPress}
          />
        ) : null}
      </XStack>
      {isMinDisplay ? (
        <SizableText size="$heading5xl">{`< $${MIN_DISPLAY_AMOUNT}`}</SizableText>
      ) : (
        <Currency formatter="value" size="$heading5xl">
          {value}
        </Currency>
      )}
    </YStack>
  );
};
