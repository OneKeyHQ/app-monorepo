import { useCallback } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  Icon,
  Image,
  SizableText,
  Skeleton,
  XStack,
} from '@onekeyhq/components';

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
      <Image size="$6" borderRadius="$1">
        <Image.Source src="https://placehold.co/120x120?text=A" />
        <Image.Fallback>
          <Skeleton w="$6" h="$6" />
        </Image.Fallback>
      </Image>
      <SizableText
        flex={1}
        size="$bodyMdMedium"
        pl="$2"
        pr="$1"
        numberOfLines={1}
      >
        Account 1
      </SizableText>
      <Icon name="ChevronGrabberVerOutline" size="$5" color="$iconSubdued" />
    </XStack>
  );
}

export { HomeHeaderContainer };
