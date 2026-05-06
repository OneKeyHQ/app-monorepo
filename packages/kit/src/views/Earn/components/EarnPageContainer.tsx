import { useCallback, useMemo } from 'react';

import type { IBreadcrumbProps, IScrollViewProps } from '@onekeyhq/components';
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
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ETabRoutes } from '@onekeyhq/shared/src/routes';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { LegacyUniversalSearchInput } from '../../../components/TabPageHeader/LegacyUniversalSearchInput';

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
  contentContainerStyle?: IScrollViewProps['contentContainerStyle'];
  disableMaxWidth?: boolean;
  showTabPageHeader?: boolean;
  showBodyTitle?: boolean;
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
  contentContainerStyle,
  disableMaxWidth,
  showTabPageHeader = true,
  showBodyTitle = false,
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

  // In WebDapp mode, always use TabPageHeader for consistent mobile layout
  const shouldShowTabPageHeader =
    platformEnv.isWebDappMode || showTabPageHeader;

  // On iOS 26 push children, render via the native UINavigationBar so
  // the header gets the system Liquid Glass material and the
  // back-chevron sits in its proper iOS 26 circular glass container.
  // Tab roots (showBackButton=false) keep TabPageHeader because they
  // need account selector / notifications / search chrome that the
  // native bar can't host as a single row.
  const useNativeHeader =
    showBackButton && platformEnv.isNativeIOS26Plus;

  const renderNativeHeaderTitle = useCallback(
    () =>
      pageTitle ? (
        <XStack gap="$2" ai="center">
          {pageTitle}
        </XStack>
      ) : null,
    [pageTitle],
  );

  const renderNativeHeaderRight = useMemo(
    () =>
      customHeaderRightItems
        ? () => <XStack>{customHeaderRightItems}</XStack>
        : undefined,
    [customHeaderRightItems],
  );

  const body = (
    <Page.Body>
      <ScrollView
        contentContainerStyle={{
          py: media.gtMd ? '$6' : 0,
          ...contentContainerStyle,
        }}
        refreshControl={refreshControl}
      >
        <Page.Container
          padded={false}
          layout={disableMaxWidth ? 'full' : 'regular'}
        >
          {showBreadcrumb || showHeader ? (
            <XStack
              px="$pagePadding"
              pb={showBreadcrumb && showBodyTitle && pageTitle ? '$6' : '$5'}
              gap="$5"
              ai="center"
            >
              {showBreadcrumb ? <Breadcrumb {...breadcrumbProps} /> : null}
              {showHeader ? header : null}
            </XStack>
          ) : null}
          {showBreadcrumb && showBodyTitle && pageTitle ? (
            <XStack px="$pagePadding" pb="$5" gap="$3" ai="center">
              {pageTitle}
            </XStack>
          ) : null}
          {children}
        </Page.Container>
      </ScrollView>
    </Page.Body>
  );

  if (useNativeHeader) {
    return (
      <Page>
        <Page.Header
          headerShown
          headerTitle={renderNativeHeaderTitle}
          headerRight={renderNativeHeaderRight}
        />
        {body}
        {footer}
      </Page>
    );
  }

  return (
    <Page>
      {shouldShowTabPageHeader ? (
        <TabPageHeader
          sceneName={sceneName}
          tabRoute={tabRoute}
          customHeaderLeftItems={customHeaderLeft}
          customHeaderRightItems={customHeaderRightItems}
        />
      ) : (
        <YStack mx="$pagePadding" mt="$2" mb="$1">
          <Page.Header headerShown={false} />
          <LegacyUniversalSearchInput size="medium" initialTab="dapp" />
        </YStack>
      )}
      {body}
      {footer}
    </Page>
  );
}
