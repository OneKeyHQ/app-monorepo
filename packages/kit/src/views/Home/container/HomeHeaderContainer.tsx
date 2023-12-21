import { useCallback } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { Avatar, Icon, Skeleton, Text, XStack } from '@onekeyhq/components';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../routes/Modal/type';
import { EAccountManagerStacksRoutes } from '../../AccountManagerStacks/types';

import type { ITabHomeParamList } from '../router/types';

function HomeHeaderContainer() {
  const navigation = useAppNavigation<IPageNavigationProp<ITabHomeParamList>>();

  const navigateAccountManagerStacks = useCallback(() => {
    navigation.pushModal(EModalRoutes.AccountManagerStacks, {
      screen: EAccountManagerStacksRoutes.AccountSelectorStack,
    });
  }, [navigation]);
  return (
    <XStack
      role="button"
      alignItems="center"
      p="$1.5"
      mx="$-1.5"
      borderRadius="$2"
      hoverStyle={{
        bg: '$bgHover',
      }}
      pressStyle={{
        bg: '$bgActive',
      }}
      onPress={navigateAccountManagerStacks}
      maxWidth="$40"
    >
      <Avatar size="$6" borderRadius="$1">
        <Avatar.Image src="https://placehold.co/120x120?text=A" />
        <Avatar.Fallback>
          <Skeleton w="$6" h="$6" />
        </Avatar.Fallback>
      </Avatar>
      <Text flex={1} variant="$bodyMdMedium" pl="$2" pr="$1" numberOfLines={1}>
        Account 1
      </Text>
      <Icon name="ChevronGrabberVerOutline" size="$5" color="$iconSubdued" />
    </XStack>
  );
}

export { HomeHeaderContainer };
