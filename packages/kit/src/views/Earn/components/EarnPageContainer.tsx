import { useCallback, useMemo } from 'react';

import type { IBreadcrumbProps } from '@onekeyhq/components';
import {
  Breadcrumb,
  NavBackButton,
  Page,
  ScrollView,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { TabPageHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { ETabRoutes } from '@onekeyhq/shared/src/routes';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { EARN_PAGE_MAX_WIDTH } from '../EarnConfig';

import type { RefreshControlProps } from 'react-native';

interface IEarnPageContainerProps {
  pageTitle?: React.ReactNode;
  header?: React.ReactNode;
  children: React.ReactNode;
  breadcrumbProps?: IBreadcrumbProps;
  sceneName: EAccountSelectorSceneName;
  tabRoute: ETabRoutes;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  showBackButton?: boolean;
  footer?: React.ReactNode;
}

export function EarnPageContainer({
  pageTitle,
  children,
  breadcrumbProps,
  sceneName,
  tabRoute,
  refreshControl,
  showBackButton = false,
  footer,
  header,
}: IEarnPageContainerProps) {
  const media = useMedia();
  const navigation = useAppNavigation();

  const handleBack = useCallback(() => {
    navigation.pop();
  }, [navigation]);

  const customHeaderLeft = useMemo(() => {
    if (showBackButton) {
      return (
        <XStack gap="$3" ai="center">
          <NavBackButton onPress={handleBack} />
          {pageTitle}
        </XStack>
      );
    }
    return pageTitle ? (
      <XStack gap="$3" ai="center">
        {pageTitle}
      </XStack>
    ) : null;
  }, [pageTitle, showBackButton, handleBack]);

  return (
    <Page>
      <TabPageHeader
        sceneName={sceneName}
        tabRoute={tabRoute}
        customHeaderLeftItems={customHeaderLeft}
      />
      <Page.Body>
        <ScrollView
          contentContainerStyle={{ py: '$6' }}
          refreshControl={refreshControl}
        >
          <YStack w="100%" maxWidth={EARN_PAGE_MAX_WIDTH} mx="auto">
            <XStack px="$5" pb="$5" gap="$5" ai="center">
              {breadcrumbProps && media.gtSm ? (
                <Breadcrumb {...breadcrumbProps} />
              ) : null}
              {header ? <>{header}</> : null}
            </XStack>
            {children}
          </YStack>
        </ScrollView>
      </Page.Body>
      {footer}
    </Page>
  );
}
