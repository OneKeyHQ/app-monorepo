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
  customHeaderRightItems?: React.ReactNode;
  maxWidth?: number | string;
  disableMaxWidth?: boolean;
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
  maxWidth,
  disableMaxWidth,
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
  const containerMaxWidth = useMemo(() => {
    if (disableMaxWidth) return undefined;
    if (maxWidth !== undefined) return maxWidth;
    return EARN_PAGE_MAX_WIDTH;
  }, [disableMaxWidth, maxWidth]);

  return (
    <Page>
      {media.gtMd ? (
        <TabPageHeader
          sceneName={sceneName}
          tabRoute={tabRoute}
          customHeaderLeftItems={customHeaderLeft}
          customHeaderRightItems={customHeaderRightItems}
        />
      ) : null}
      <Page.Body>
        <ScrollView
          contentContainerStyle={{ py: media.gtMd ? '$6' : 0 }}
          refreshControl={refreshControl}
        >
          <YStack w="100%" mx="auto" maxWidth={containerMaxWidth}>
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
