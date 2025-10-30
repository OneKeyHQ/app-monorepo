import { useMemo } from 'react';

import type { IBreadcrumbProps } from '@onekeyhq/components';
import {
  Breadcrumb,
  Page,
  ScrollView,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { TabPageHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import type { ETabRoutes } from '@onekeyhq/shared/src/routes';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { EARN_PAGE_MAX_WIDTH } from '../EarnConfig';

import type { RefreshControlProps } from 'react-native';

interface IEarnPageContainerProps {
  pageTitle?: React.ReactNode;
  children: React.ReactNode;
  breadcrumbProps?: IBreadcrumbProps;
  sceneName: EAccountSelectorSceneName;
  tabRoute: ETabRoutes;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}

export function EarnPageContainer({
  pageTitle,
  children,
  breadcrumbProps,
  sceneName,
  tabRoute,
  refreshControl,
}: IEarnPageContainerProps) {
  const customHeaderLeft = useMemo(
    () =>
      pageTitle ? (
        <XStack gap="$3" ai="center">
          {pageTitle}
        </XStack>
      ) : null,
    [pageTitle],
  );

  return (
    <Page>
      <TabPageHeader sceneName={sceneName} tabRoute={tabRoute} />
      <Page.Body>
        <ScrollView
          contentContainerStyle={{ py: '$6' }}
          refreshControl={refreshControl}
        >
          <YStack w="100%" maxWidth={EARN_PAGE_MAX_WIDTH} mx="auto">
            <YStack px="$5" pb="$5" gap="$5">
              {breadcrumbProps ? <Breadcrumb {...breadcrumbProps} /> : null}
              {customHeaderLeft}
            </YStack>
            {children}
          </YStack>
        </ScrollView>
      </Page.Body>
    </Page>
  );
}
