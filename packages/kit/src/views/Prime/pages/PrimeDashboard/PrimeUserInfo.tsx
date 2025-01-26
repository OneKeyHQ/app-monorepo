import { StyleSheet } from 'react-native';

import { Badge, Icon, SizableText, XStack } from '@onekeyhq/components';

import { usePrimeAuthV2 } from '../../hooks/usePrimeAuthV2';

import { PrimeUserInfoMoreButton } from './PrimeUserInfoMoreButton';

export function PrimeUserInfo({
  doPurchase,
}: {
  doPurchase?: () => Promise<void>;
}) {
  const { user } = usePrimeAuthV2();
  const isPrime = user?.primeSubscription?.isActive;

  return (
    <XStack
      alignItems="center"
      gap="$2"
      px="$3.5"
      py={13}
      bg="$bg"
      borderWidth={StyleSheet.hairlineWidth}
      borderRadius="$3"
      flexWrap="wrap"
      borderColor="$borderSubdued"
      borderCurve="continuous"
      elevation={0.5}
    >
      <Icon name="PeopleOutline" color="$iconSubdued" size="$5" />
      <SizableText
        onPress={() => {
          // console.log(privy?.web?.user);
          // console.log(privy?.native?.user);
        }}
        flex={1}
        size="$bodyMdMedium"
        ellipsizeMode="middle"
        ellipse
      >
        {user?.email}
      </SizableText>
      {isPrime ? (
        <Badge bg="$brand3" badgeSize="sm">
          <Badge.Text color="$brand11">Prime</Badge.Text>
        </Badge>
      ) : (
        <Badge badgeType="default" badgeSize="sm">
          Free
        </Badge>
      )}
      <PrimeUserInfoMoreButton doPurchase={doPurchase} />
    </XStack>
  );
}
