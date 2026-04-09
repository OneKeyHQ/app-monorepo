import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { usePreventRemove } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Badge,
  Page,
  ScrollView,
  SizableText,
  Stack,
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
          tabLabel: '⚡ 0 手续费',
          title: 'Perps 交易，0 手续费',
          description: '所有合约订单享受零费率交易体验，不收取任何手续费。',
          mediaUrl:
            'https://placehold.co/600x338/1e1b4b/a5b4fc?text=Perps+Zero+Fee',
          mediaType: 'image' as const,
          ctaText: '立即体验',
          ctaDeeplink: 'onekey-wallet://market_detail',
        },
        {
          tabLabel: '🔑 Keyless',
          title: 'Keyless 钱包，无需助记词',
          description: '用 iCloud / Google 账号直接创建钱包，安全便捷。',
          mediaUrl:
            'https://placehold.co/600x338/0f3460/7dd3fc?text=Keyless+Wallet',
          mediaType: 'image' as const,
          ctaText: '创建 Keyless 钱包',
          ctaDeeplink: 'onekey-wallet://url_account',
        },
        {
          tabLabel: '🔋 能量补贴',
          title: 'Tron 能量补贴',
          description: '首次转账 Tron 网络，享受能量补贴优惠。',
          mediaUrl:
            'https://placehold.co/600x338/064e3b/6ee7b7?text=Energy+Subsidy',
          mediaType: 'image' as const,
          ctaText: '了解更多',
          ctaDeeplink: 'onekey-wallet://market_detail',
        },
      ]
    : [];
  const features =
    appUpdateInfo.featuredChangelog?.features ?? mockFeatures;
  const activeFeature: IFeaturedItem | undefined = features[activeIndex];

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

  const versionDisplay = isPreInstall
    ? displayAppUpdateVersion(appUpdateInfo)
    : displayWhatsNewVersion();

  const ctaText = isPreInstall
    ? intl.formatMessage({
        id: shouldOpenStore
          ? ETranslations.update_update_now
          : ETranslations.update_download_and_verify_text,
      })
    : (activeFeature?.ctaText ??
      intl.formatMessage({ id: ETranslations.global_done }));

  if (!activeFeature) {
    return null;
  }

  return (
    <Page onClose={handleClose}>
      <Page.Header headerShown={false} />
      <Page.Body>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ px: '$5', pt: '$5', pb: '$2' }}
        >
          <Stack mb="$2.5" alignSelf="flex-start">
            <Badge badgeType="success" badgeSize="sm">
              {'NEW'}
            </Badge>
          </Stack>
          <SizableText size="$headingXl" mb="$1">
            {intl.formatMessage(
              { id: ETranslations.update_changelog_title },
              { ver: versionDisplay },
            )}
          </SizableText>
          {/* TODO: replace hardcoded subtitle with ETranslations key once added via Lokalise */}
          <SizableText size="$bodyMd" color="$textSubdued" mb="$4">
            {'\u672C\u6B21\u66F4\u65B0\u7684\u4EAE\u70B9\u529F\u80FD'}
          </SizableText>
          <FeaturedTabBar
            features={features}
            activeIndex={activeIndex}
            onTabPress={setActiveIndex}
          />
          <FeaturedMedia feature={activeFeature} />
          <SizableText size="$headingMd" mb="$1">
            {activeFeature.title}
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            {activeFeature.description}
          </SizableText>
        </ScrollView>
      </Page.Body>
      <FeaturedFooter
        ctaText={ctaText}
        onCtaPress={handleCtaPress}
      />
    </Page>
  );
}

export default FeaturedChangelog;
