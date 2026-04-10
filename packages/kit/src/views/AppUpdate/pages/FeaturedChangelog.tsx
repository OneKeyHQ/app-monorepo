import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { usePreventRemove } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  LinearGradient,
  Page,
  SizableText,
  Skeleton,
  Stack,
  YStack,
} from '@onekeyhq/components';
import { useAppUpdatePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppUpdateStatus,
  EUpdateFileType,
  getUpdateFileType,
} from '@onekeyhq/shared/src/appUpdate';
import type { IFeaturedItem } from '@onekeyhq/shared/src/appUpdate';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IAppUpdatePagesParamList } from '@onekeyhq/shared/src/routes';
import { EAppUpdateRoutes } from '@onekeyhq/shared/src/routes/appUpdate';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { ENotificationPushMessageMode } from '@onekeyhq/shared/types/notification';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { handleDeepLinkUrl } from '../../../routes/config/deeplink';
import {
  isForceUpdateStrategy,
  useDownloadPackage,
} from '../../../components/UpdateReminder/hooks';
import { FeaturedFooter } from '../components/FeaturedFooter';
import { FeaturedMedia } from '../components/FeaturedMedia';
import { FeaturedTabBar } from '../components/FeaturedTabBar';

function FeaturedChangelog({
  route,
}: IPageScreenProps<
  IAppUpdatePagesParamList,
  EAppUpdateRoutes.FeaturedChangelog
>) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { isPreInstall = false, isForceUpdate: isForceUpdateParam } =
    route.params || {};

  const [appUpdateInfo] = useAppUpdatePersistAtom();
  const [activeIndex, setActiveIndex] = useState(0);
  const mountTimeRef = useRef(Date.now());

  // TODO: Remove __DEV__ mock before release
  const mockFeatures: IFeaturedItem[] = __DEV__
    ? [
        {
          tabLabel: 'Zero Fees',
          title: 'Perps Trading, Zero Fees',
          description: 'Enjoy zero-fee trading on all perpetual contracts.',
          mediaUrl: '',
          mediaType: 'image' as const,
          ctaText: 'Try Now',
          href: 'onekey-wallet://market_detail',
          hrefType: 'internal' as const,
        },
        {
          tabLabel: 'Keyless',
          title: 'Keyless Wallet',
          description:
            'Create a wallet with iCloud or Google — no seed phrase needed.',
          mediaUrl: '',
          mediaType: 'image' as const,
          ctaText: 'Create Keyless Wallet',
          href: 'onekey-wallet://url_account',
          hrefType: 'internal' as const,
        },
        {
          tabLabel: 'Energy Subsidy',
          title: 'Tron Energy Subsidy',
          description: 'Get energy subsidies for your first Tron transactions.',
          mediaUrl: '',
          mediaType: 'image' as const,
          ctaText: 'Learn More',
          href: 'onekey-wallet://market_detail',
          hrefType: 'internal' as const,
        },
      ]
    : [];
  const features = appUpdateInfo.featuredChangelog?.features ?? mockFeatures;

  // #2/#3: Clamp activeIndex when features array changes
  const clampedIndex = Math.min(activeIndex, Math.max(features.length - 1, 0));
  useEffect(() => {
    if (clampedIndex !== activeIndex) {
      setActiveIndex(clampedIndex);
    }
  }, [clampedIndex, activeIndex]);

  const activeFeature: IFeaturedItem | undefined = features[clampedIndex];

  const isForceUpdate = appUpdateInfo
    ? isForceUpdateStrategy(appUpdateInfo.updateStrategy)
    : isForceUpdateParam;

  // Prevent back navigation when force update + pre-install
  usePreventRemove(!!isForceUpdate && !!isPreInstall, () => {});

  // Log duration on unmount
  useEffect(() => {
    const mountTime = mountTimeRef.current;
    return () => {
      defaultLogger.app.appUpdate.whatsNewClosed({
        durationMs: Date.now() - mountTime,
      });
    };
  }, []);

  const handleClose = useCallback(() => {
    if (!isPreInstall) {
      setTimeout(() => {
        void backgroundApiProxy.serviceAppUpdate.fetchAppUpdateInfo(true);
      }, 250);
    }
  }, [isPreInstall]);

  const { downloadPackage } = useDownloadPackage();

  const { storeUrl, downloadUrl, jsBundle, status } = appUpdateInfo;

  const updateFileType = useMemo(
    () =>
      getUpdateFileType({
        latestVersion: appUpdateInfo.latestVersion,
        jsBundleVersion: appUpdateInfo.jsBundleVersion,
      }),
    [appUpdateInfo.latestVersion, appUpdateInfo.jsBundleVersion],
  );
  const shouldOpenStore =
    isPreInstall && updateFileType === EUpdateFileType.appShell && !!storeUrl;

  const handleCtaPress = useCallback(() => {
    if (isPreInstall) {
      if (shouldOpenStore && storeUrl) {
        openUrlExternal(storeUrl);
      } else if (downloadUrl || jsBundle?.downloadUrl) {
        if (status === EAppUpdateStatus.notify) {
          void downloadPackage();
        }
        navigation.push(EAppUpdateRoutes.DownloadVerify);
      } else {
        navigation.popStack();
      }
    } else if (activeFeature?.href) {
      navigation.popStack();
      // Wait for popStack animation before dispatching to avoid navigation conflicts
      setTimeout(() => {
        if (
          activeFeature.hrefType === 'external' ||
          activeFeature.mode === ENotificationPushMessageMode.openInBrowser
        ) {
          openUrlExternal(activeFeature.href);
        } else {
          handleDeepLinkUrl({ url: activeFeature.href });
        }
      }, 300);
    } else {
      navigation.popStack();
    }
  }, [
    isPreInstall,
    shouldOpenStore,
    storeUrl,
    downloadUrl,
    jsBundle?.downloadUrl,
    status,
    downloadPackage,
    navigation,
    activeFeature,
  ]);

  const featuredChangelog = appUpdateInfo.featuredChangelog;

  // TODO: replace fallback string with ETranslations key once added via Lokalise
  const headline = featuredChangelog?.headline ?? "You're going to like this";
  const { subheadline } = featuredChangelog ?? {};

  const ctaText = isPreInstall
    ? intl.formatMessage({
        id: shouldOpenStore
          ? ETranslations.update_update_now
          : ETranslations.update_download_and_verify_text,
      })
    : (activeFeature?.ctaText ??
      intl.formatMessage({ id: ETranslations.global_done }));

  const headerTitle = intl.formatMessage({
    id: isPreInstall
      ? ETranslations.settings_update_available
      : ETranslations.settings_whats_new,
  });

  if (!activeFeature) {
    return (
      <Page>
        <Page.Header title={headerTitle} />
        <Page.Body>
          <YStack flex={1} px="$5" pt="$5">
            <Skeleton.Heading3Xl w="60%" mb="$4" />
            <Skeleton width="100%" flex={1} borderRadius="$4" />
          </YStack>
        </Page.Body>
        <FeaturedFooter
          ctaText={intl.formatMessage({ id: ETranslations.global_done })}
          onCtaPress={() => navigation.popStack()}
        />
      </Page>
    );
  }

  return (
    <Page onClose={handleClose}>
      <Page.Header title={headerTitle} />
      <Page.Body>
        <YStack flex={1}>
          <YStack px="$5" pt={0} pb="$3">
            <SizableText
              size="$heading3xl"
              mb={subheadline ? '$1' : '$4'}
              numberOfLines={1}
            >
              {headline}
            </SizableText>
            {subheadline ? (
              <SizableText size="$bodyMd" color="$textSubdued" mb="$4">
                {subheadline}
              </SizableText>
            ) : null}
            <FeaturedTabBar
              features={features}
              activeIndex={activeIndex}
              onTabPress={setActiveIndex}
            />
          </YStack>

          {/* Media fills remaining space, with gradient + text overlay */}
          <Stack flex={1} px="$5" pb={0}>
            <FeaturedMedia feature={activeFeature}>
              {activeFeature.title || activeFeature.description ? (
                <Stack position="absolute" bottom={0} left={0} right={0}>
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.7)']}
                    px="$4"
                    pb="$4"
                    pt="$16"
                  >
                    {activeFeature.title ? (
                      <SizableText size="$headingLg" color="$whiteA12" mb="$1">
                        {activeFeature.title}
                      </SizableText>
                    ) : null}
                    {activeFeature.description ? (
                      <SizableText size="$bodyMd" color="$whiteA11">
                        {activeFeature.description}
                      </SizableText>
                    ) : null}
                  </LinearGradient>
                </Stack>
              ) : null}
            </FeaturedMedia>
          </Stack>
        </YStack>
      </Page.Body>
      <FeaturedFooter ctaText={ctaText} onCtaPress={handleCtaPress} />
    </Page>
  );
}

export default FeaturedChangelog;
