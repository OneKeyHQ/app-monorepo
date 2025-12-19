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
  customHeaderRightItems?: React.ReactNode;
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
  customHeaderRightItems,
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

  const showBreadcrumb = useMemo(
    () => breadcrumbProps && media.gtSm,
    [breadcrumbProps, media],
  );
  const showHeader = useMemo(() => header, [header]);

  return (
    <Page>
      <TabPageHeader
        sceneName={sceneName}
        tabRoute={tabRoute}
        customHeaderLeftItems={customHeaderLeft}
        customHeaderRightItems={customHeaderRightItems}
      />
      <Page.Body>
        <ScrollView
          contentContainerStyle={{ py: '$6' }}
          refreshControl={refreshControl}
        >
          <YStack w="100%" mx="auto">
            {showBreadcrumb || showHeader ? (
              <XStack px="$3" pb="$5" gap="$5" ai="center">
                {showBreadcrumb ? <Breadcrumb {...breadcrumbProps} /> : null}
                {showHeader ? header : null}
              </XStack>
            ) : null}
            {children}
          </YStack>
        </ScrollView>
      </Page.Body>
      {footer}
    </Page>
  );
}
