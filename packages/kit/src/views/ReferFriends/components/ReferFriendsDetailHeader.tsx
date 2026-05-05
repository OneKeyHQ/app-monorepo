import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';

import {
  NavBackButton,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { TabPageHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { TabPageHeaderContainer } from '../../Market/MarketDetailV2/components/MarketDetailHeader/TabPageHeaderContainer';

import { BreadcrumbSection } from './BreadcrumbSection';
import { REFER_FRIENDS_PAGE_MAX_WIDTH } from './ReferFriendsPageContainer';

interface IReferFriendsDetailHeaderProps {
  title: string;
  toolbar?: ReactNode;
}

export function ReferFriendsDetailHeader({
  title,
  toolbar,
}: IReferFriendsDetailHeaderProps) {
  const { md } = useMedia();
  const navigation = useAppNavigation();

  const handleBackPress = useCallback(() => {
    navigation.pop();
  }, [navigation]);

  const customHeaderLeft = useMemo(
    () => (
      <XStack gap="$3" ai="center">
        <NavBackButton onPress={handleBackPress} />
      </XStack>
    ),
    [handleBackPress],
  );

  if (platformEnv.isNative || md) {
    return (
      <>
        <TabPageHeaderContainer>
          <XStack flex={1} ai="center" gap="$3">
            <NavBackButton onPress={handleBackPress} />
            <SizableText size="$headingLg" numberOfLines={1} flexShrink={1}>
              {title}
            </SizableText>
          </XStack>
        </TabPageHeaderContainer>
        {toolbar ? (
          <XStack px="$5" pb="$2" pt="$2" jc="space-between" ai="center">
            {toolbar}
          </XStack>
        ) : null}
      </>
    );
  }

  return (
    <>
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.ReferFriends}
        customHeaderLeftItems={customHeaderLeft}
        hideSearch
      />
      <YStack
        width="100%"
        maxWidth={REFER_FRIENDS_PAGE_MAX_WIDTH}
        alignSelf="center"
      >
        <XStack px="$5" pt="$5" jc="space-between" ai="center">
          <BreadcrumbSection secondItemLabel={title} />
        </XStack>
        {toolbar ? (
          <XStack px="$5" pb="$2" pt="$4" jc="space-between" ai="center">
            {toolbar}
          </XStack>
        ) : null}
      </YStack>
    </>
  );
}
