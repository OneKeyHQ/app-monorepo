import { useMemo } from 'react';

import { ScrollView } from 'react-native';

import type { IBreadcrumbProps } from '@onekeyhq/components';
import { Breadcrumb, Page, XStack, YStack } from '@onekeyhq/components';
import { TabPageHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

export function EarnPageContainer({
  pageTitle,
  children,
  breadcrumbProps,
}: {
  pageTitle?: React.ReactNode;
  children: React.ReactNode;
  breadcrumbProps?: IBreadcrumbProps;
}) {
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
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.Earn}
      />
      <Page.Body>
        <ScrollView contentContainerStyle={{ paddingVertical: 24 }}>
          <YStack px="$5" pb="$5" gap="$5">
            {breadcrumbProps ? <Breadcrumb {...breadcrumbProps} /> : null}
            {customHeaderLeft}
          </YStack>
          {children}
        </ScrollView>
      </Page.Body>
    </Page>
  );
}
