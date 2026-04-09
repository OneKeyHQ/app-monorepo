import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { usePreventRemove } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Badge,
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
  displayAppUpdateVersion,
  displayWhatsNewVersion,
  getUpdateFileType,
} from '@onekeyhq/shared/src/appUpdate';
import type { IFeaturedItem } from '@onekeyhq/shared/src/appUpdate';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IAppUpdatePagesParamList } from '@onekeyhq/shared/src/routes';
import { EAppUpdateRoutes } from '@onekeyhq/shared/src/routes/appUpdate';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

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
  const {
    isPreInstall = false,
    isForceUpdate: isForceUpdateParam,
    latestVersion,
  } = route.params || {};

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
          ctaDeeplink: 'onekey-wallet://market_detail',
        },
        {
          tabLabel: 'Keyless',
          title: 'Keyless Wallet',
          description: 'Create a wallet with iCloud or Google — no seed phrase needed.',
          mediaUrl: '',
          mediaType: 'image' as const,
          ctaText: 'Create Keyless Wallet',
          ctaDeeplink: 'onekey-wallet://url_account',
        },
        {
          tabLabel: 'Energy Subsidy',
          title: 'Tron Energy Subsidy',
          description: 'Get energy subsidies for your first Tron transactions.',
          mediaUrl: '',
          mediaType: 'image' as const,
          ctaText: 'Learn More',
          ctaDeeplink: 'onekey-wallet://market_detail',
        },
      ]
    : [];
  const features =
    appUpdateInfo.featuredChangelog?.features ?? mockFeatures;

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
    isPreInstall &&
    updateFileType === EUpdateFileType.appShell &&
    !!storeUrl;

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
        // Fallback: no store URL and no download URL — just close
        navigation.popStack();
      }
    } else if (activeFeature?.ctaDeeplink) {
      navigation.popStack();
      setTimeout(() => {
        handleDeepLinkUrl({ url: activeFeature.ctaDeeplink });
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

  const versionDisplay = isPreInstall
    ? displayAppUpdateVersion(appUpdateInfo)
    : displayWhatsNewVersion();

  // TODO: replace fallback string with ETranslations key once added via Lokalise
  const headline =
    featuredChangelog?.headline ??
    `What's new in v${versionDisplay}`;
  const { subheadline } = featuredChangelog ?? {};

  const ctaText = isPreInstall
    ? intl.formatMessage({
        id: shouldOpenStore
          ? ETranslations.update_update_now
          : ETranslations.update_download_and_verify_text,
      })
    : (activeFeature?.ctaText ??
      intl.formatMessage({ id: ETranslations.global_done }));

  if (!activeFeature) {
    return (
      <Page>
        <Page.Header headerShown={false} />
        <Page.Body>
          <YStack flex={1} px="$5" pt="$5">
            <Skeleton width={48} height={20} borderRadius="$1" mb="$2.5" />
            <Skeleton.Heading3Xl w="60%" mb="$4" />
            <Skeleton width="100%" flex={1} borderRadius="$4" />
          </YStack>
        </Page.Body>
      </Page>
    );
  }

  return (
    <Page onClose={handleClose}>
      <Page.Header headerShown={false} />
      <Page.Body>
        <YStack flex={1}>
          {/* Top section: badge, title, subtitle, tabs */}
          <YStack px="$5" pt="$5" pb="$3">
            <Stack mb="$2.5" alignSelf="flex-start">
              <Badge badgeType="info" badgeSize="sm">
                {'New'}
              </Badge>
            </Stack>
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
            <Stack
              position="absolute"
              bottom={0}
              left={0}
              right={0}
            >
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.7)']}
                px="$4"
                pb="$4"
                pt="$16"
              >
                <SizableText size="$headingLg" color="$whiteA12" mb="$1">
                  {activeFeature.title}
                </SizableText>
                <SizableText size="$bodyMd" color="$whiteA11">
                  {activeFeature.description}
                </SizableText>
              </LinearGradient>
            </Stack>
          </FeaturedMedia>
          </Stack>
        </YStack>
      </Page.Body>
      <FeaturedFooter
        ctaText={ctaText}
        onCtaPress={handleCtaPress}
      />
    </Page>
  );
}

export default FeaturedChangelog;
