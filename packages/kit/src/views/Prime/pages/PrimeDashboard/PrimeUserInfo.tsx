import { type ComponentProps } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import { getDisplayEmailOrUnknown } from '@onekeyhq/kit/src/components/OneKeyAuth/oneKeyIdDisplayEmailUtils';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';

// import { usePrimeAuthV2 } from '../../hooks/usePrimeAuthV2';

import { PrimeUserBadge } from '../../components/PrimeUserBadge';

import { PrimeBillingIssueAlert } from './PrimeBillingIssueAlert';
import { PrimeUserInfoMoreButton } from './PrimeUserInfoMoreButton';

export function PrimeUserInfo({
  onBeforeLogout,
  onLogoutSuccess,
  ...stackProps
}: {
  onBeforeLogout?: () => void;
  onLogoutSuccess?: () => Promise<void>;
} & ComponentProps<typeof YStack>) {
  const { user } = useOneKeyAuth();
  const intl = useIntl();
  const displayEmail = getDisplayEmailOrUnknown({
    intl,
    displayEmail: user?.displayEmail,
  });
  return (
    <YStack
      bg="$bg"
      borderWidth={StyleSheet.hairlineWidth}
      borderRadius="$3"
      borderColor="$borderSubdued"
      borderCurve="continuous"
      elevation={0.5}
      overflow="hidden"
      {...stackProps}
    >
      <XStack alignItems="center" gap="$2" px="$3.5" py={13} flexWrap="wrap">
        <Icon name="PeopleOutline" color="$iconSubdued" size="$5" />
        <SizableText
          onPress={() => {
            //
          }}
          flex={1}
          size="$bodyMdMedium"
          ellipsizeMode="middle"
          ellipsis
        >
          {displayEmail}
        </SizableText>
        <PrimeUserBadge showFreeStatus={false} showIcon={false} />
        <PrimeUserInfoMoreButton
          onBeforeLogout={onBeforeLogout}
          onLogoutSuccess={onLogoutSuccess}
        />
      </XStack>
      <PrimeBillingIssueAlert />
    </YStack>
  );
}
