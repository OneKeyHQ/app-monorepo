import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Stack } from '@onekeyhq/components';
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
} from '@onekeyhq/shared/src/appUpdate';
import type { IFeaturedItem } from '@onekeyhq/shared/src/appUpdate';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EAppUpdateRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { ENotificationPushMessageMode } from '@onekeyhq/shared/types/notification';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  isForceUpdateStrategy,
  useDownloadPackage,
} from '../../../components/UpdateReminder/hooks';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { handleDeepLinkUrl } from '../../../routes/config/deeplink';
import { FeaturedCarousel } from '../components/FeaturedCarousel';
import { FeaturedFooter } from '../components/FeaturedFooter';

export interface IShowFeaturedChangelogDialogParams {
  isPreInstall?: boolean;
}

const ALLOWED_HREF_SCHEMES = new Set([
  'https:',
  'http:',
  'onekey-wallet:',
  'onekey:',
]);

function isAllowedHref(href: string | undefined): href is string {
  if (!href) return false;
  try {
    return ALLOWED_HREF_SCHEMES.has(new URL(href).protocol);
  } catch {
    return false;
  }
}

function useFeaturedCta({
  isPreInstall,
  activeFeature,
  closeDialog,
}: {
  isPreInstall: boolean;
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
    if (isPreInstall) {
      if (shouldOpenStore && storeUrl) {
        openUrlExternal(storeUrl);
        await closeDialog();
        return;
      }
      if (downloadUrl || jsBundle?.downloadUrl) {
        if (status === EAppUpdateStatus.notify) {
          void downloadPackage();
        }
        await closeDialog();
        // Wait for close animation before pushing — same 300ms used by old page
        setTimeout(() => {
          navigation.pushModal(EModalRoutes.AppUpdateModal, {
            screen: EAppUpdateRoutes.DownloadVerify,
          });
        }, 300);
        return;
      }
      await closeDialog();
      return;
    }

    const href = activeFeature?.href;
    if (!isAllowedHref(href)) {
      await closeDialog();
      return;
    }

    await closeDialog();
    setTimeout(() => {
      if (
        activeFeature?.hrefType === 'external' ||
        activeFeature?.mode === ENotificationPushMessageMode.openInBrowser
      ) {
        openUrlExternal(href);
      } else {
        handleDeepLinkUrl({ url: href });
      }
    }, 300);
  }, [
    isPreInstall,
    shouldOpenStore,
    storeUrl,
    downloadUrl,
    jsBundle?.downloadUrl,
    status,
    downloadPackage,
    navigation,
    closeDialog,
    activeFeature?.href,
    activeFeature?.hrefType,
    activeFeature?.mode,
  ]);

  const isForceUpdate = isForceUpdateStrategy(appUpdateInfo.updateStrategy);

  return { ctaText, onCtaPress, isForceUpdate };
}

function FeaturedChangelogContent({
  isPreInstall,
  closeDialog,
}: {
  isPreInstall: boolean;
  closeDialog: () => Promise<void>;
}) {
  const intl = useIntl();
  const [appUpdateInfo] = useAppUpdatePersistAtom();
  const features = appUpdateInfo.featuredChangelog?.features ?? [];

  const [activeFeature, setActiveFeature] = useState<IFeaturedItem | undefined>(
    features[0],
  );

  const { ctaText, onCtaPress, isForceUpdate } = useFeaturedCta({
    isPreInstall,
    activeFeature,
    closeDialog,
  });

  if (!features.length) return null;

  const badgeText = intl.formatMessage({
    id: isPreInstall
      ? ETranslations.settings_update_available
      : ETranslations.settings_whats_new,
  });

  const isLockedUI = isForceUpdate && isPreInstall;

  return (
    <Stack mx="$-5" mb="$-5">
      <FeaturedCarousel
        features={features}
        badgeText={badgeText}
        showCloseButton={!isLockedUI}
        onClose={() => void closeDialog()}
        onActiveFeatureChange={(feature) => setActiveFeature(feature)}
      />
      <FeaturedFooter
        ctaText={ctaText}
        onCtaPress={() => void onCtaPress()}
        showFullChangelog={!isLockedUI}
        closeDialog={closeDialog}
      />
    </Stack>
  );
}

export function showFeaturedChangelogDialog(
  params: IShowFeaturedChangelogDialogParams = {},
): IDialogInstance | undefined {
  const { isPreInstall = false } = params;

  // Synchronous atom read — safe because jotaiDefaultStore is always available
  // on the JS thread after app init. Pattern taken from discovery/actions.ts.
  const info = jotaiDefaultStore.get(appUpdatePersistAtom.atom());
  const features = info.featuredChangelog?.features ?? [];
  if (features.length === 0) return undefined;

  const isForceUpdate = isForceUpdateStrategy(info.updateStrategy);
  // Prevent dismissal when a force-update is pending pre-install
  const isLocked = isForceUpdate && isPreInstall;

  const mountTime = Date.now();

  // Use a mutable ref object so the closeDialog closure always sees the live instance.
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
    floatingPanelProps: { width: 480, overflow: 'hidden' },
    renderContent: (
      <FeaturedChangelogContent
        isPreInstall={isPreInstall}
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
