import { Suspense, lazy, useCallback, useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  Spinner,
  Toast,
  getDialogInstances,
} from '@onekeyhq/components';
import type { IDialogInstance } from '@onekeyhq/components';
import {
  appIsLocked,
  useAppIsLockedAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock';
import {
  EAppUpdateStatus,
  EUpdateFileType,
  EUpdateStrategy,
  getUpdateFileType,
  isUsableUpdateDownloadUrl,
} from '@onekeyhq/shared/src/appUpdate';
import type { IAppUpdateInfo } from '@onekeyhq/shared/src/appUpdate';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import {
  hasBlockingUpdateOverlay,
  tryOpenUpdateDetails,
} from './updateDetailsHost';
import { isAutoUpdateStrategy, useAppUpdateInfo } from './useAppUpdate';

const LazyDetails = lazy(async () => {
  const { UpdateCapsule } =
    await import('../TabPageHeader/components/UpdateCapsule.desktop');
  return { default: UpdateCapsule };
});

function canShowPackageDetails(info: IAppUpdateInfo) {
  return (
    getUpdateFileType(info) === EUpdateFileType.appShell &&
    info.updateStrategy !== EUpdateStrategy.force &&
    info.updateStrategy !== EUpdateStrategy.seamless &&
    info.status !== EAppUpdateStatus.manualInstall &&
    !info.storeUrl &&
    isUsableUpdateDownloadUrl(info.downloadUrl)
  );
}

function UpdateMenuDetails({ close }: { close: () => Promise<void> }) {
  const { data, onViewReleaseInfo } = useAppUpdateInfo();
  useEffect(() => {
    if (
      data.status === EAppUpdateStatus.done ||
      data.updateStrategy === EUpdateStrategy.force
    )
      void close();
  }, [close, data.status, data.updateStrategy]);
  return (
    <Suspense fallback={<Spinner />}>
      <LazyDetails
        data={data}
        showUpdate
        detailsOnly
        onWhatsNew={() => {
          void close().then(onViewReleaseInfo);
        }}
      />
    </Suspense>
  );
}

export function useDesktopUpdateMenu() {
  const intl = useIntl();
  const { checkForUpdates, downloadPackage, onUpdateActionWithInfo } =
    useAppUpdateInfo();
  const [isLocked] = useAppIsLockedAtom();
  const lockedRef = useRef(isLocked);
  lockedRef.current = isLocked;
  const checking = useRef(false);
  const mounted = useRef(true);
  const dialog = useRef<IDialogInstance | undefined>(undefined);
  const checkAgain = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    if (isLocked) void dialog.current?.close();
  }, [isLocked]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      void dialog.current?.close();
    };
  }, []);

  useEffect(() => {
    let suppressEscapeKeyUp = false;
    const resetEscape = () => {
      suppressEscapeKeyUp = false;
    };
    const onEscape = (event: KeyboardEvent) => {
      const current = dialog.current;
      if (
        event.key !== 'Escape' ||
        event.isComposing ||
        event.keyCode === 229 ||
        !current ||
        lockedRef.current ||
        hasBlockingUpdateOverlay(true) ||
        getDialogInstances()
          .filter((instance) => instance.isExist())
          .at(-1) !== current
      )
        return;
      suppressEscapeKeyUp = true;
      event.preventDefault();
      event.stopImmediatePropagation();
      void current.close();
    };
    // Overlay's document capture handler otherwise swallows Escape on web.
    // Consume the paired keyup so the underlying page's back handler stays idle.
    const onEscapeKeyUp = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !suppressEscapeKeyUp) return;
      resetEscape();
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    globalThis.addEventListener('keydown', onEscape, true);
    globalThis.addEventListener('keyup', onEscapeKeyUp, true);
    globalThis.addEventListener('blur', resetEscape);
    return () => {
      globalThis.removeEventListener('keydown', onEscape, true);
      globalThis.removeEventListener('keyup', onEscapeKeyUp, true);
      globalThis.removeEventListener('blur', resetEscape);
    };
  }, []);

  const canPresent = useCallback(() => {
    if (!mounted.current || lockedRef.current) return false;
    if (hasBlockingUpdateOverlay(true)) {
      Toast.message({
        title: intl.formatMessage({
          id: ETranslations.app_update_finish_first__msg,
        }),
      });
      return false;
    }
    return true;
  }, [intl]);

  const openDetails = useCallback(
    (target: IAppUpdateInfo) => {
      if (!canPresent() || dialog.current) return;
      if (tryOpenUpdateDetails(target)) return;
      const previousFocus = document.activeElement;
      const close = async () => {
        await dialog.current?.close();
      };
      dialog.current = Dialog.show({
        testID: 'desktop-update-details-dialog',
        title: intl.formatMessage({
          id: ETranslations.app_update_details__title,
        }),
        showFooter: false,
        dismissOnOverlayPress: true,
        renderContent: <UpdateMenuDetails close={close} />,
        onClose: () => {
          dialog.current = undefined;
          requestAnimationFrame(() => {
            if (
              !dialog.current &&
              !lockedRef.current &&
              !hasBlockingUpdateOverlay(true) &&
              previousFocus instanceof HTMLElement &&
              previousFocus.isConnected &&
              !previousFocus.closest('[inert]')
            )
              previousFocus.focus();
          });
        },
      });
    },
    [canPresent, intl],
  );

  const showLatestVersion = useCallback(() => {
    dialog.current = Dialog.confirm({
      title: intl.formatMessage({
        id: ETranslations.update_app_update_latest_version,
      }),
      tone: 'success',
      icon: 'Ai3StarSolid',
      description: intl.formatMessage({
        id: ETranslations.update_app_up_to_date,
      }),
      onConfirmText: intl.formatMessage({ id: ETranslations.global_ok }),
      onClose: () => {
        dialog.current = undefined;
      },
    });
  }, [intl]);

  const handlePackageUpdate = useCallback(
    async (response: IAppUpdateInfo) => {
      const autoDownload =
        response.updateStrategy !== EUpdateStrategy.manual &&
        (await backgroundApiProxy.serviceSetting.getEnableAutoDownloadAppUpdate());
      if ((await appIsLocked.get()) || !canPresent()) return;
      if (response.status === EAppUpdateStatus.notify && !autoDownload) {
        onUpdateActionWithInfo(response);
      } else {
        openDetails(response);
      }
    },
    [canPresent, onUpdateActionWithInfo, openDetails],
  );

  const handleCheckResult = useCallback(
    async (isNeedUpdate: boolean, response: IAppUpdateInfo) => {
      if (isNeedUpdate && canShowPackageDetails(response)) {
        await handlePackageUpdate(response);
        return;
      }
      const auto = isAutoUpdateStrategy(
        response.updateStrategy ?? EUpdateStrategy.manual,
      );
      if (isNeedUpdate && auto) {
        const enabled =
          getUpdateFileType(response) !== EUpdateFileType.appShell ||
          (await backgroundApiProxy.serviceSetting.getEnableAutoDownloadAppUpdate());
        if ((await appIsLocked.get()) || !canPresent()) return;
        if (!enabled) {
          onUpdateActionWithInfo(response);
          return;
        }
        void downloadPackage?.();
      }
      if (isNeedUpdate && !auto) {
        onUpdateActionWithInfo(response);
      } else {
        showLatestVersion();
      }
    },
    [
      canPresent,
      downloadPackage,
      handlePackageUpdate,
      onUpdateActionWithInfo,
      showLatestVersion,
    ],
  );

  const showCheckRetry = useCallback(() => {
    dialog.current = Dialog.confirm({
      title: intl.formatMessage({ id: ETranslations.global_update_failed }),
      description: intl.formatMessage({
        id: ETranslations.global_network_error_help_text,
      }),
      onConfirmText: intl.formatMessage({ id: ETranslations.global_retry }),
      onConfirm: async ({ close }) => {
        await close();
        await checkAgain.current();
      },
      onClose: () => {
        dialog.current = undefined;
      },
    });
  }, [intl]);

  const handleCheckError = useCallback(async () => {
    if ((await appIsLocked.get()) || !canPresent()) return;
    const local = await backgroundApiProxy.serviceAppUpdate
      .getUpdateInfo()
      .catch(() => undefined);
    if (
      local &&
      local.status !== EAppUpdateStatus.notify &&
      local.status !== EAppUpdateStatus.done &&
      canShowPackageDetails(local)
    ) {
      if ((await appIsLocked.get()) || !canPresent()) return;
      openDetails(local);
      Toast.error({
        title: intl.formatMessage({ id: ETranslations.global_network_error }),
      });
      return;
    }
    showCheckRetry();
  }, [canPresent, intl, openDetails, showCheckRetry]);

  const onCheckUpdate = useCallback(async () => {
    if (checking.current || dialog.current || !canPresent()) return;
    checking.current = true;
    const loading = Toast.loading({
      title: intl.formatMessage({
        id: ETranslations.update_checking_for_updates,
      }),
      duration: Infinity,
    });
    defaultLogger.update.app.log('checkForUpdates');
    try {
      const { isNeedUpdate, response } = await checkForUpdates();
      if ((await appIsLocked.get()) || !canPresent()) return;
      if (!response)
        throw new OneKeyLocalError('Update check returned no result');
      await handleCheckResult(isNeedUpdate, response);
    } catch {
      await handleCheckError();
    } finally {
      loading?.close();
      checking.current = false;
    }
  }, [canPresent, checkForUpdates, handleCheckError, handleCheckResult, intl]);
  checkAgain.current = onCheckUpdate;
  return onCheckUpdate;
}
