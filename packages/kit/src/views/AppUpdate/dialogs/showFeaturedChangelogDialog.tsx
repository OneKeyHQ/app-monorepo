import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { Platform } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { Dialog } from '@onekeyhq/components';
import type { IDialogInstance } from '@onekeyhq/components';
import {
  appUpdatePersistAtom,
  useAppUpdatePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { jotaiDefaultStore } from '@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore';
import {
  EAppUpdateStatus,
  EUpdateFileType,
  getUpdateFileType,
  isAllowedFeaturedHref,
} from '@onekeyhq/shared/src/appUpdate';
import type { IFeaturedItem } from '@onekeyhq/shared/src/appUpdate';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EAppUpdateRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import { parseNotificationPayload } from '@onekeyhq/shared/src/utils/notificationsUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { isForceUpdateStrategy } from '../../../components/AppUpdate/updateStrategy';
import { useDownloadPackage } from '../../../components/AppUpdate/useDownloadPackage';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { handleDeepLinkUrl } from '../../../routes/config/deeplink';
import { FeaturedCarousel } from '../components/FeaturedCarousel';
import { FeaturedFooter } from '../components/FeaturedFooter';

export interface IShowFeaturedChangelogDialogParams {
  isPreInstall?: boolean;
}

function dispatchFeatureCta(activeFeature: IFeaturedItem | undefined) {
  if (!activeFeature) return;
  // Mode-driven dispatch (IWalletBanner pattern). payload is the canonical
  // carrier for the URL/JSON; fall back to href so backends that only set
  // href still work for the URL-opening modes.
  if (activeFeature.mode !== undefined) {
    parseNotificationPayload(
      activeFeature.mode,
      activeFeature.payload ?? activeFeature.href,
      () => {
        if (isAllowedFeaturedHref(activeFeature.href)) {
          handleDeepLinkUrl({ url: activeFeature.href });
        }
      },
    );
    return;
  }
  if (!isAllowedFeaturedHref(activeFeature.href)) return;
  if (activeFeature.hrefType === 'external') {
    openUrlExternal(activeFeature.href);
  } else {
    handleDeepLinkUrl({ url: activeFeature.href });
  }
}

function useFeaturedCta({
  isPreInstall,
  isLocked,
  activeFeature,
  closeDialog,
}: {
  isPreInstall: boolean;
  isLocked: boolean;
  activeFeature: IFeaturedItem | undefined;
  closeDialog: () => Promise<void>;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const [appUpdateInfo] = useAppUpdatePersistAtom();
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

  const ctaText = isPreInstall
    ? intl.formatMessage({
        id: shouldOpenStore
          ? ETranslations.update_update_now
          : ETranslations.update_download_and_verify_text,
      })
    : (activeFeature?.ctaText ??
      intl.formatMessage({ id: ETranslations.global_done }));

  const onCtaPress = useCallback(async () => {
    // Keep the dialog as the force-update blocker when there's no follow-on
    // route to take over (store / no-action). The download branch closes
    // because DownloadVerify takes over the blocker.
    const closeIfUnlocked = isLocked ? () => undefined : closeDialog;

    if (isPreInstall) {
      if (shouldOpenStore && storeUrl) {
        openUrlExternal(storeUrl);
        await closeIfUnlocked();
        return;
      }
      if (downloadUrl || jsBundle?.downloadUrl) {
        if (status === EAppUpdateStatus.notify) {
          void downloadPackage();
        }
        await closeDialog();
        setTimeout(() => {
          navigation.pushModal(EModalRoutes.AppUpdateModal, {
            screen: EAppUpdateRoutes.DownloadVerify,
            params: { isForceUpdate: isLocked },
          });
        }, 300);
        return;
      }
      await closeIfUnlocked();
      return;
    }

    await closeDialog();
    setTimeout(() => dispatchFeatureCta(activeFeature), 300);
  }, [
    isPreInstall,
    isLocked,
    shouldOpenStore,
    storeUrl,
    downloadUrl,
    jsBundle?.downloadUrl,
    status,
    downloadPackage,
    navigation,
    closeDialog,
    activeFeature,
  ]);

  return { ctaText, onCtaPress };
}

function useFeatures(): IFeaturedItem[] {
  const [appUpdateInfo] = useAppUpdatePersistAtom();
  // Memoize so a fresh `?? []` reference doesn't ripple through downstream
  // effects on every unrelated atom-field change.
  return useMemo(
    () => appUpdateInfo.featuredChangelog?.features ?? [],
    [appUpdateInfo.featuredChangelog?.features],
  );
}

function FeaturedChangelogContent({
  isPreInstall,
  isLocked,
  closeDialog,
}: {
  isPreInstall: boolean;
  isLocked: boolean;
  closeDialog: () => Promise<void>;
}) {
  const intl = useIntl();
  const features = useFeatures();

  const [activeFeature, setActiveFeature] = useState<IFeaturedItem | undefined>(
    features[0],
  );

  const { ctaText, onCtaPress } = useFeaturedCta({
    isPreInstall,
    isLocked,
    activeFeature,
    closeDialog,
  });

  // Drive an explicit pixel height on the dialog content. The dialog frame on
  // desktop (TMDialog.Content) doesn't transition auto-height when child layout
  // changes, so we give it a single child with a Reanimated-driven height that
  // smoothly animates per frame, and the frame's natural height tracks it.
  const totalCarouselHeight = useSharedValue(0);
  const [footerHeight, setFooterHeight] = useState(0);
  const dialogHeightStyle = useAnimatedStyle(() => {
    const carousel = totalCarouselHeight.value;
    if (carousel === 0 || footerHeight === 0) {
      return {};
    }
    return { height: carousel + footerHeight };
  });

  if (!features.length) return null;

  const badgeText = intl.formatMessage({
    id: ETranslations.settings_whats_new,
  });

  return (
    <Animated.View
      style={[
        {
          marginLeft: -20,
          marginRight: -20,
          marginBottom: -20,
          overflow: 'hidden',
          ...(Platform.OS !== 'web'
            ? {
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
              }
            : null),
        },
        dialogHeightStyle,
      ]}
    >
      <FeaturedCarousel
        features={features}
        badgeText={badgeText}
        showCloseButton={!isLocked}
        onClose={() => void closeDialog()}
        onActiveFeatureChange={setActiveFeature}
        totalHeight={totalCarouselHeight}
      />
      <FeaturedFooter
        ctaText={ctaText}
        onCtaPress={() => void onCtaPress()}
        showFullChangelog={!isLocked}
        isPreInstall={isPreInstall}
        closeDialog={closeDialog}
        onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
      />
    </Animated.View>
  );
}

export function showFeaturedChangelogDialog(
  params: IShowFeaturedChangelogDialogParams = {},
): IDialogInstance | undefined {
  const { isPreInstall = false } = params;

  // Synchronous atom read — safe because jotaiDefaultStore is always available
  // on the JS thread after app init.
  const info = jotaiDefaultStore.get(appUpdatePersistAtom.atom());
  const features = info.featuredChangelog?.features ?? [];
  if (features.length === 0) return undefined;

  // Prevent dismissal when a force-update is pending pre-install
  const isLocked = isForceUpdateStrategy(info.updateStrategy) && isPreInstall;

  const mountTime = Date.now();

  // Mutable ref so the closeDialog closure always sees the live instance.
  const instanceRef: { current: IDialogInstance | undefined } = {
    current: undefined,
  };
  const closeDialog = async () => {
    await instanceRef.current?.close();
  };

  const dialogInstance = Dialog.show({
    showFooter: false,
    showHeader: false,
    dismissOnOverlayPress: !isLocked,
    disableDrag: isLocked,
    disableSystemClose: isLocked,
    floatingPanelProps: { width: 480, overflow: 'hidden' },
    renderContent: (
      <FeaturedChangelogContent
        isPreInstall={isPreInstall}
        isLocked={isLocked}
        closeDialog={closeDialog}
      />
    ),
    onClose: async () => {
      defaultLogger.app.appUpdate.whatsNewClosed({
        durationMs: Date.now() - mountTime,
      });
      if (!isPreInstall) {
        setTimeout(() => {
          void backgroundApiProxy.serviceAppUpdate.fetchAppUpdateInfo(true);
        }, 250);
      }
    },
  });
  instanceRef.current = dialogInstance;

  return dialogInstance;
}
