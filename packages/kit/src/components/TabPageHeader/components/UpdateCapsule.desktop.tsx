import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  Popover,
  SizableText,
  Spinner,
  Toast,
  Tooltip,
  XStack,
  YStack,
  useMedia,
  useTheme,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useDownloadPackage } from '@onekeyhq/kit/src/components/AppUpdate';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import {
  EAppUpdateStatus,
  EUpdateFileType,
  getAppUpdateProgressScope,
  getUpdateFileType,
} from '@onekeyhq/shared/src/appUpdate';
import type { IAppUpdateInfo } from '@onekeyhq/shared/src/appUpdate';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EUpdateErrorCode,
  isRetryableUpdateError,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update/error';
import { useDownloadProgressDetails } from '@onekeyhq/shared/src/modules3rdParty/auto-update/index.desktop';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import {
  peekDesktopUpdateBanner,
  startDesktopUpdateBanner,
} from '../../AppUpdate/AppUpdateForeground';
import {
  hasBlockingUpdateOverlay,
  registerUpdateDetailsHost,
} from '../../AppUpdate/updateDetailsHost';
import { HEADER_WIDE_MEDIA_KEY } from '../headerLayout';

import { UpdateVerifyReceipt } from './UpdateVerifyReceipt';

const GITHUB_RELEASES = 'https://github.com/OneKeyHQ/app-monorepo/releases';
const FOCUS_STYLE = {
  outlineColor: '$focusRing',
  outlineStyle: 'solid',
  outlineWidth: 2,
  outlineOffset: -2,
} as const;

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      typeof globalThis.matchMedia === 'function' &&
      globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const media = globalThis.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

function ensureCapsuleStyles() {
  if (document.getElementById('ok-update-capsule-style')) return;
  const style = document.createElement('style');
  style.id = 'ok-update-capsule-style';
  style.textContent = `
    @keyframes okUpdateShieldPulse { 0%, 100% { opacity: 1 } 50% { opacity: .4 } }
    @keyframes okUpdateNotifyExit { from { opacity: 1 } to { opacity: 0 } }
    @media (prefers-reduced-motion: reduce) { .ok-update-shield-pulse { animation: none !important } }
  `;
  document.head.appendChild(style);
}

function DownloadCircle({ percent }: { percent: number }) {
  const theme = useTheme();
  return (
    <XStack width={20} height={20} alignItems="center" justifyContent="center">
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <circle
          cx="10"
          cy="10"
          r="8"
          fill="none"
          stroke={theme.neutral5.val}
          strokeWidth="2"
        />
        <circle
          cx="10"
          cy="10"
          r="8"
          fill="none"
          stroke={theme.iconSubdued.val}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="50.27"
          strokeDashoffset={
            50.27 * (1 - Math.max(0, Math.min(percent, 100)) / 100)
          }
          transform="rotate(-90 10 10)"
        />
      </svg>
    </XStack>
  );
}

type ICapsuleMode = 'download' | 'verify' | 'ready' | 'securityError' | 'error';

function getCapsuleMode(data: IAppUpdateInfo): ICapsuleMode {
  if (data.status === EAppUpdateStatus.ready) return 'ready';
  if (
    data.status === EAppUpdateStatus.downloadASC ||
    data.status === EAppUpdateStatus.verifyASC ||
    data.status === EAppUpdateStatus.verifyPackage
  )
    return 'verify';
  if (
    data.status === EAppUpdateStatus.failed ||
    data.status === EAppUpdateStatus.downloadASCFailed ||
    data.status === EAppUpdateStatus.verifyASCFailed ||
    data.status === EAppUpdateStatus.verifyPackageFailed ||
    data.status === EAppUpdateStatus.downloadPackageFailed ||
    data.status === EAppUpdateStatus.updateIncomplete
  ) {
    if (
      (data.updateError?.code === EUpdateErrorCode.integrityFailed ||
        data.updateError?.code === EUpdateErrorCode.securityRejected) &&
      getUpdateFileType(data) === EUpdateFileType.appShell
    ) {
      return 'securityError';
    }
    if (
      (data.status === EAppUpdateStatus.downloadPackageFailed ||
        data.status === EAppUpdateStatus.downloadASCFailed ||
        data.status === EAppUpdateStatus.verifyASCFailed ||
        data.status === EAppUpdateStatus.verifyPackageFailed) &&
      !data.downloadRetryExhausted &&
      data.updateError &&
      isRetryableUpdateError(data.updateError)
    ) {
      return data.status === EAppUpdateStatus.downloadPackageFailed
        ? 'download'
        : 'verify';
    }
    return 'error';
  }
  return 'download';
}

export function UpdateCapsule({
  data,
  showUpdate,
  onWhatsNew,
  detailsOnly = false,
}: {
  data: IAppUpdateInfo;
  showUpdate: boolean;
  onWhatsNew: () => void;
  detailsOnly?: boolean;
}) {
  const intl = useIntl();
  const anchorId = useId();
  const isRouteFocused = useRouteIsFocused();
  const reducedMotion = useReducedMotion();
  const wide = useMedia()[HEADER_WIDE_MEDIA_KEY];
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [moving, setMoving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [leavingNotify, setLeavingNotify] = useState(false);
  const [completedVersion, setCompletedVersion] = useState<string>();
  const [visibleCompleted, setVisibleCompleted] = useState<
    'shown' | 'exiting' | false
  >(false);
  const busyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const notifyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const previousStatus = useRef(data.status);
  const keyboardStarting = useRef(false);
  const { downloadPackage, downloadASC, verifyASC, installPackage } =
    useDownloadPackage();
  const progressScope = useMemo(
    () =>
      getAppUpdateProgressScope({
        latestVersion: data.latestVersion,
        jsBundleVersion: data.jsBundleVersion,
      }) ?? { latestVersion: data.latestVersion },
    [data.latestVersion, data.jsBundleVersion],
  );
  const progress = useDownloadProgressDetails(progressScope);
  const { percent } = progress;
  const mode = getCapsuleMode(data);

  const isVisibleHost = useCallback(() => {
    const host = document.getElementById(anchorId);
    return (
      isRouteFocused &&
      document.visibilityState === 'visible' &&
      Boolean(host?.offsetParent) &&
      !host?.closest('[inert]')
    );
  }, [anchorId, isRouteFocused]);

  useEffect(() => {
    if (detailsOnly) return;
    ensureCapsuleStyles();
    let interval: ReturnType<typeof setInterval> | undefined;
    const checkCompleted = () => {
      const pending = peekDesktopUpdateBanner();
      if (!pending) {
        setVisibleCompleted(false);
        if (interval) clearInterval(interval);
        interval = undefined;
        return;
      }
      if (!interval) interval = setInterval(checkCompleted, 100);
      if (!isVisibleHost()) {
        setVisibleCompleted(false);
        return;
      }
      const banner = pending.expiresAt ? pending : startDesktopUpdateBanner();
      if (!banner) return;
      const expiresAt = banner.expiresAt;
      if (!expiresAt) return;
      setCompletedVersion(banner.version);
      setVisibleCompleted(expiresAt - Date.now() <= 100 ? 'exiting' : 'shown');
    };
    checkCompleted();
    appEventBus.on(EAppEventBusNames.AppUpdateCompleted, checkCompleted);
    globalThis.addEventListener('focus', checkCompleted);
    document.addEventListener('visibilitychange', checkCompleted);
    return () => {
      appEventBus.off(EAppEventBusNames.AppUpdateCompleted, checkCompleted);
      globalThis.removeEventListener('focus', checkCompleted);
      document.removeEventListener('visibilitychange', checkCompleted);
      if (interval) clearInterval(interval);
    };
  }, [detailsOnly, isVisibleHost]);

  useEffect(
    () => () => {
      clearTimeout(busyTimer.current);
      clearTimeout(notifyTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (detailsOnly) return;
    return registerUpdateDetailsHost((target) => {
      if (
        target.latestVersion !== data.latestVersion ||
        target.jsBundleVersion !== data.jsBundleVersion ||
        !showUpdate ||
        !isVisibleHost()
      )
        return false;
      if (
        open &&
        document.activeElement?.closest(
          '[data-testid="update-details-content"]',
        )
      ) {
        return true;
      }
      if (hasBlockingUpdateOverlay()) return false;
      const button = document
        .getElementById(anchorId)
        ?.querySelector<HTMLButtonElement>(
          '[data-testid="header-update-details"]',
        );
      if (!button || button.disabled || button.inert) return false;
      const rect = button.getBoundingClientRect();
      const topButton = document
        .elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        )
        ?.closest('[data-testid="header-update-details"]');
      if (topButton !== button) return false;
      button.focus();
      setOpen(true);
      return true;
    });
  }, [
    anchorId,
    data.latestVersion,
    data.jsBundleVersion,
    detailsOnly,
    isVisibleHost,
    open,
    showUpdate,
  ]);

  useEffect(() => {
    if (!isRouteFocused) setOpen(false);
  }, [isRouteFocused]);

  useEffect(() => {
    if (
      previousStatus.current === EAppUpdateStatus.notify &&
      data.status !== EAppUpdateStatus.notify
    ) {
      setLeavingNotify(true);
      clearTimeout(notifyTimer.current);
      notifyTimer.current = setTimeout(() => setLeavingNotify(false), 100);
      if (keyboardStarting.current) {
        keyboardStarting.current = false;
        requestAnimationFrame(() => {
          document
            .getElementById(anchorId)
            ?.querySelector<HTMLButtonElement>(
              '[data-testid="header-update-details"]',
            )
            ?.focus();
        });
      }
    }
    previousStatus.current = data.status;
  }, [anchorId, data.status]);

  const showBusy = useCallback(() => {
    if (detailsOnly) {
      Toast.message({
        title: intl.formatMessage({
          id: ETranslations.app_update_finish_first__msg,
        }),
      });
      return;
    }
    setOpen(false);
    setBusy(true);
    clearTimeout(busyTimer.current);
    busyTimer.current = setTimeout(() => setBusy(false), 3000);
  }, [detailsOnly, intl]);

  const restart = useCallback(async () => {
    if (restarting) return;
    if (!(await backgroundApiProxy.serviceAppUpdate.canRestartForUpdate())) {
      showBusy();
      return;
    }
    setRestarting(true);
    try {
      await installPackage(
        () => {},
        () => {},
        { userInitiated: true, installSource: 'capsule' },
      );
    } finally {
      setRestarting(false);
    }
  }, [installPackage, restarting, showBusy]);

  const moveToApplications = useCallback(async () => {
    if (moving) return;
    if (!(await backgroundApiProxy.serviceAppUpdate.canRestartForUpdate())) {
      showBusy();
      return;
    }
    setMoving(true);
    try {
      await globalThis.desktopApiProxy.appUpdate.moveToApplicationsFolder();
    } catch {
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.app_update_cant_continue__msg,
        }),
      });
    } finally {
      setMoving(false);
    }
  }, [intl, moving, showBusy]);

  const retryInFlight = useRef(false);
  const retry = useCallback(async () => {
    if (retryInFlight.current) return;
    // Claim the in-flight slot synchronously: the awaits below are
    // interleaving points where a second click would otherwise pass the guard.
    retryInFlight.current = true;
    try {
      const isInvalidVerifyAscArtifact =
        data.updateError?.code === EUpdateErrorCode.integrityFailed ||
        data.updateError?.code === EUpdateErrorCode.securityRejected ||
        data.updateError?.code === EUpdateErrorCode.incompatible ||
        data.updateError?.code === EUpdateErrorCode.packageMissing;
      if (data.status !== EAppUpdateStatus.notify) {
        const preserveArtifact =
          data.status === EAppUpdateStatus.downloadASCFailed ||
          (data.status === EAppUpdateStatus.verifyASCFailed &&
            !isInvalidVerifyAscArtifact);
        await backgroundApiProxy.serviceAppUpdate
          .prepareUserUpdateRetry?.({ preserveArtifact })
          .catch(() => undefined);
      }
      // Enforce hard target safety gates (https://, non-store, BOOT_FAILED)
      // after clearing user-retryable freeze/exhaustion state.
      if (
        !(await backgroundApiProxy.serviceAppUpdate.canDownloadCurrentTarget())
      ) {
        return;
      }
      switch (data.status) {
        case EAppUpdateStatus.downloadASCFailed:
          // Installer is already on disk; only the ASC fetch failed. Resuming
          // downloadPackage() would clear downloadedEvent and re-download the
          // whole installer.
          await downloadASC();
          break;
        case EAppUpdateStatus.verifyASCFailed:
          if (isInvalidVerifyAscArtifact) {
            await downloadPackage({ userInitiated: true });
          } else {
            await verifyASC();
          }
          break;
        case EAppUpdateStatus.notify:
          await downloadPackage();
          break;
        default:
          await downloadPackage({ userInitiated: true });
          break;
      }
    } finally {
      retryInFlight.current = false;
    }
  }, [
    data.status,
    data.updateError?.code,
    downloadASC,
    downloadPackage,
    verifyASC,
  ]);

  const startDownload = useCallback(async () => {
    setStarting(true);
    try {
      await retry();
    } finally {
      setStarting(false);
    }
  }, [retry]);

  const closeAndShowWhatsNew = useCallback(() => {
    setOpen(false);
    onWhatsNew();
  }, [onWhatsNew]);

  const isReady = mode === 'ready';
  const isError = mode === 'error' || mode === 'securityError';
  const isRetrying =
    !isError &&
    Boolean(data.updateError && isRetryableUpdateError(data.updateError)) &&
    [
      EAppUpdateStatus.downloadPackageFailed,
      EAppUpdateStatus.downloadASCFailed,
      EAppUpdateStatus.verifyASCFailed,
      EAppUpdateStatus.verifyPackageFailed,
    ].includes(data.status);
  const detailsLabel = intl.formatMessage({
    id: ETranslations.app_update_details__title,
  });
  const restartLabel = intl.formatMessage({
    id: ETranslations.app_update_restart__action,
  });
  let stateLabel: string;
  if (mode === 'ready') {
    stateLabel = restartLabel;
  } else if (mode === 'verify') {
    stateLabel = intl.formatMessage({ id: ETranslations.update_verifying });
  } else if (isError) {
    stateLabel = intl.formatMessage({
      id:
        mode === 'securityError'
          ? ETranslations.app_update_verify_failed__msg
          : ETranslations.app_update_cant_continue__msg,
    });
  } else {
    stateLabel = intl.formatMessage(
      { id: ETranslations.update_downloading_package },
      { progress: percent },
    );
  }
  let errorDescription = intl.formatMessage({
    id: ETranslations.app_update_cant_continue__msg,
  });
  if (data.updateError?.code === EUpdateErrorCode.installLocation) {
    errorDescription = intl.formatMessage({
      id: ETranslations.app_update_move_to_applications__desc,
    });
  } else if (
    data.updateError?.code === EUpdateErrorCode.storageError &&
    data.updateError.step !== 'cleanup'
  ) {
    errorDescription = intl.formatMessage(
      { id: ETranslations.app_update_disk_space__desc },
      {
        size: `${intl.formatNumber(data.fileSize ? Math.ceil(data.fileSize / (1024 * 1024)) : 0)} MB`,
      },
    );
  }
  let detailIcon: ReactNode;
  if (mode === 'download') {
    detailIcon = <DownloadCircle percent={percent} />;
  } else if (mode === 'verify') {
    detailIcon = (
      <XStack
        className="ok-update-shield-pulse"
        style={
          reducedMotion
            ? undefined
            : { animation: 'okUpdateShieldPulse 1.4s ease-in-out infinite' }
        }
      >
        <Icon name="ShieldCheckDoneOutline" size="$5" color="$iconSubdued" />
      </XStack>
    );
  } else if (mode === 'securityError') {
    detailIcon = (
      <Icon name="ShieldExclamationOutline" size="$5" color="$iconCritical" />
    );
  } else if (mode === 'error') {
    detailIcon = <Icon name="ErrorOutline" size="$5" color="$iconCritical" />;
  } else {
    detailIcon = <Icon name="DotHorOutline" size="$4.5" color="$iconInverse" />;
  }
  const tooltip = stateLabel;
  const detailsButton = (
    <Button
      testID="header-update-details"
      variant={isReady ? 'accent' : 'tertiary'}
      m={0}
      childrenAsText={false}
      width={30}
      height={30}
      minWidth={30}
      p={0}
      borderRadius="$full"
      borderTopLeftRadius={isReady ? 0 : 15}
      borderBottomLeftRadius={isReady ? 0 : 15}
      aria-label={`${stateLabel} · ${detailsLabel}`}
      aria-haspopup="dialog"
      aria-disabled={restarting}
      tabIndex={restarting ? -1 : 0}
      focusVisibleStyle={FOCUS_STYLE}
      onPress={() => {
        if (!restarting) setOpen(true);
      }}
    >
      {detailIcon}
    </Button>
  );

  const detailsContent = (
    <YStack gap="$6" testID="update-details-content">
      <XStack alignItems="center" justifyContent="space-between">
        <SizableText size="$headingMd">OneKey {data.latestVersion}</SizableText>
        <Button
          testID="header-update-whats-new"
          size="small"
          variant="tertiary"
          iconAfter="ChevronRightSmallOutline"
          onPress={closeAndShowWhatsNew}
        >
          {intl.formatMessage({
            id: ETranslations.settings_whats_new,
          })}
        </Button>
      </XStack>
      <UpdateVerifyReceipt
        data={data}
        progress={progress}
        reducedMotion={reducedMotion}
      />
      {isReady ? (
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.app_update_installs_on_quit__desc,
          })}
        </SizableText>
      ) : null}
      {detailsOnly && isReady ? (
        <Button
          testID="update-details-restart"
          size="small"
          variant="accent"
          alignSelf="flex-start"
          disabled={restarting}
          onPress={() => void restart()}
          focusVisibleStyle={FOCUS_STYLE}
        >
          {restartLabel}
        </Button>
      ) : null}
      {mode === 'securityError' ? (
        <YStack gap="$3">
          <SizableText size="$bodyMd">
            {intl.formatMessage({
              id: ETranslations.app_update_verify_failed__msg,
            })}
          </SizableText>
          <SizableText size="$bodyMd">
            {intl.formatMessage({
              id: ETranslations.app_update_cant_continue__msg,
            })}
          </SizableText>
          <Button
            testID="header-update-github"
            size="small"
            variant="secondary"
            alignSelf="flex-start"
            onPress={() => openUrlExternal(GITHUB_RELEASES)}
          >
            {intl.formatMessage({
              id: ETranslations.app_update_download_from_github__action,
            })}
          </Button>
        </YStack>
      ) : null}
      {mode === 'error' || isRetrying ? (
        <YStack gap="$3">
          {!isRetrying ? (
            <SizableText size="$bodyMd" style={{ textWrap: 'pretty' }}>
              {errorDescription}
            </SizableText>
          ) : null}
          {data.updateError?.code === EUpdateErrorCode.installLocation ? (
            <Button
              testID="header-update-move-to-applications"
              size="small"
              variant="secondary"
              alignSelf="flex-start"
              disabled={moving}
              onPress={() => void moveToApplications()}
            >
              {intl.formatMessage({
                id: ETranslations.app_update_move_to_applications__action,
              })}
            </Button>
          ) : (
            <Button
              testID="header-update-retry"
              size="small"
              variant="secondary"
              alignSelf="flex-start"
              onPress={() => void retry()}
            >
              {intl.formatMessage({ id: ETranslations.global_retry })}
            </Button>
          )}
        </YStack>
      ) : null}
    </YStack>
  );

  if (detailsOnly) return detailsContent;

  if (completedVersion && visibleCompleted) {
    const completedLabel = intl.formatMessage(
      { id: ETranslations.app_update_updated__msg },
      { version: completedVersion },
    );
    return (
      <Tooltip
        triggerAsChild
        placement="bottom"
        renderContent={completedLabel}
        renderTrigger={
          <Button
            id={anchorId}
            testID="header-update-completed"
            size="small"
            variant="tertiary"
            childrenAsText={false}
            m={0}
            mr="$3"
            px={wide ? '$2.5' : 0}
            width={wide ? undefined : 30}
            height={30}
            borderRadius="$full"
            aria-label={completedLabel}
            onPress={closeAndShowWhatsNew}
            style={{
              opacity: visibleCompleted === 'exiting' ? 0 : 1,
              transform:
                visibleCompleted === 'exiting' && !reducedMotion
                  ? 'scale(.95)'
                  : undefined,
              transition: 'opacity 100ms ease-out, transform 100ms ease-out',
            }}
          >
            <Icon
              name="CheckRadioSolid"
              size="$4.5"
              color="$iconSuccess"
              mr={wide ? '$2' : 0}
            />
            {wide ? (
              <SizableText size="$bodyMdMedium" color="$text">
                {completedLabel}
              </SizableText>
            ) : null}
          </Button>
        }
      />
    );
  }

  if (!showUpdate)
    return (
      <XStack
        id={anchorId}
        position="absolute"
        width={0}
        height={0}
        pointerEvents="none"
      />
    );

  if (data.status === EAppUpdateStatus.notify) {
    const updateLabel = intl.formatMessage({ id: ETranslations.global_update });
    return (
      <Tooltip
        triggerAsChild
        placement="bottom"
        renderContent={updateLabel}
        renderTrigger={
          <Button
            id={anchorId}
            testID="header-update-button"
            size="small"
            variant="accent"
            mr="$3"
            height={30}
            width={wide ? undefined : 30}
            px={wide ? undefined : 0}
            icon={wide ? undefined : 'ArrowTopCircleOutline'}
            aria-label={updateLabel}
            loading={starting}
            onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
              keyboardStarting.current =
                event.key === 'Enter' || event.key === ' ';
            }}
            onPress={() => void startDownload()}
          >
            {wide ? updateLabel : null}
          </Button>
        }
      />
    );
  }

  return (
    <YStack id={anchorId} mr="$3" position="relative" flexShrink={0}>
      <XStack
        alignItems="center"
        height={30}
        overflow="hidden"
        borderRadius="$full"
        pointerEvents={restarting ? 'none' : 'auto'}
        style={{
          opacity: restarting ? 0.4 : 1,
          clipPath: isReady
            ? 'inset(0 round 15px)'
            : 'inset(0 0 0 calc(100% - 30px) round 15px)',
          transition: reducedMotion
            ? 'opacity 150ms ease'
            : 'clip-path 280ms cubic-bezier(.32,.72,0,1), opacity 150ms ease',
        }}
      >
        <Tooltip
          triggerAsChild
          placement="bottom"
          disabled={open}
          renderContent={restartLabel}
          renderTrigger={
            <Button
              testID="header-update-restart"
              variant="accent"
              childrenAsText={false}
              height={30}
              width={wide ? undefined : 30}
              px={wide ? '$2.5' : 0}
              borderRadius={0}
              borderTopLeftRadius={15}
              borderBottomLeftRadius={15}
              disabled={!isReady}
              aria-hidden={!isReady}
              aria-disabled={restarting || !isReady}
              inert={!isReady || restarting}
              tabIndex={isReady && !restarting ? 0 : -1}
              aria-label={restartLabel}
              onPress={() => void restart()}
              focusVisibleStyle={FOCUS_STYLE}
              style={{
                opacity: isReady ? 1 : 0,
                transition: reducedMotion
                  ? 'opacity 150ms ease'
                  : 'opacity 170ms ease-out 70ms',
              }}
            >
              {restarting && !reducedMotion ? (
                <XStack
                  width={18}
                  height={18}
                  alignItems="center"
                  justifyContent="center"
                  mr={wide ? '$2' : 0}
                >
                  <Spinner size="small" color="$iconInverse" />
                </XStack>
              ) : (
                <Icon
                  name={wide ? 'ShieldCheckDoneSolid' : 'RestartToUpdateCustom'}
                  size="$4.5"
                  color="$iconInverse"
                  mr={wide ? '$2' : 0}
                />
              )}
              {wide ? (
                <SizableText size="$bodyMdMedium" color="$textInverse">
                  {restartLabel}
                </SizableText>
              ) : null}
            </Button>
          }
        />
        <XStack
          width={1}
          height={30}
          bg="$bgAccent"
          alignItems="center"
          justifyContent="center"
          opacity={isReady ? 1 : 0}
        >
          <XStack width={1} height={16} bg="$textInverse" opacity={0.28} />
        </XStack>
        <Popover
          title={detailsLabel}
          showHeader={false}
          placement="bottom-end"
          offset={6}
          open={open}
          onOpenChange={setOpen}
          floatingPanelProps={{
            width: '$96',
            maxWidth: 384,
            p: '$5',
            bg: '$bg',
            role: 'dialog',
            trapFocus: true,
            'aria-label': detailsLabel,
            style: { transformOrigin: 'calc(100% - 15px) top' },
          }}
          renderTrigger={
            <Tooltip
              triggerAsChild
              placement="bottom"
              disabled={open}
              renderTrigger={<XStack>{detailsButton}</XStack>}
              renderContent={tooltip}
            />
          }
          renderContent={detailsContent}
        />
      </XStack>
      {leavingNotify ? (
        <Button
          testID="header-update-notify-exit"
          variant="accent"
          position="absolute"
          right={0}
          height={30}
          style={{
            animation: reducedMotion
              ? 'none'
              : 'okUpdateNotifyExit 100ms ease forwards',
            opacity: reducedMotion ? 0 : undefined,
          }}
          tabIndex={-1}
          aria-hidden
        >
          {' '}
          {intl.formatMessage({ id: ETranslations.global_update })}{' '}
        </Button>
      ) : null}
      {busy ? (
        <YStack
          position="absolute"
          top={36}
          right={0}
          width={246}
          p="$3"
          borderRadius="$3"
          bg="$bgStrong"
        >
          <SizableText size="$bodySm">
            {intl.formatMessage({
              id: ETranslations.app_update_finish_first__msg,
            })}
          </SizableText>
        </YStack>
      ) : null}
    </YStack>
  );
}
