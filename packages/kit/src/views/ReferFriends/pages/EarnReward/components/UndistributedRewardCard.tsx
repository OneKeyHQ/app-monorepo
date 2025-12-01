import type { FC } from 'react';

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
            iconColor="$iconSubdued"
            onPress={onIconPress}
          />
        ) : null}
      </XStack>
      <Currency formatter="value" size="$heading5xl">
        {value}
      </Currency>
    </YStack>
  );
};
