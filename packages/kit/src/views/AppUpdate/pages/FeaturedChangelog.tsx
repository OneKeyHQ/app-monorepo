import { useCallback, useEffect, useRef, useState } from 'react';

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
  displayAppUpdateVersion,
  displayWhatsNewVersion,
} from '@onekeyhq/shared/src/appUpdate';
import type { IFeaturedItem } from '@onekeyhq/shared/src/appUpdate';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IAppUpdatePagesParamList } from '@onekeyhq/shared/src/routes';
import { EAppUpdateRoutes } from '@onekeyhq/shared/src/routes/appUpdate';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { handleDeepLinkUrl } from '../../../routes/config/deeplink';
import { isForceUpdateStrategy } from '../../../components/UpdateReminder/hooks';
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

  const features = appUpdateInfo.featuredChangelog?.features ?? [];
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

  const handleCtaPress = useCallback(() => {
    if (isPreInstall) {
      // Navigate to download & verify flow
      navigation.push(EAppUpdateRoutes.DownloadVerify);
    } else if (activeFeature?.ctaDeeplink) {
      // Close modal first, then navigate via deep link
      navigation.popStack();
      setTimeout(() => {
        handleDeepLinkUrl({ url: activeFeature.ctaDeeplink });
      }, 300);
    } else {
      // Fallback: just close the modal
      navigation.popStack();
    }
  }, [isPreInstall, navigation, activeFeature]);

  const versionDisplay = isPreInstall
    ? displayAppUpdateVersion(appUpdateInfo)
    : displayWhatsNewVersion();

  const ctaText = isPreInstall
    ? intl.formatMessage({ id: ETranslations.update_update_now })
    : (activeFeature?.ctaText ??
      intl.formatMessage({ id: ETranslations.global_done }));

  if (!activeFeature) {
    return null;
  }

  return (
    <Page onClose={handleClose}>
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
        isForceUpdate={isForceUpdate}
      />
    </Page>
  );
}

export default FeaturedChangelog;
