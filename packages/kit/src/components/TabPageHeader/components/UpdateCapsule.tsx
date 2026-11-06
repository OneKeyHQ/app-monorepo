import { useCallback, useEffect, useId, useRef, useState } from 'react';
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
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useDownloadPackage } from '@onekeyhq/kit/src/components/AppUpdate';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import {
  EAppUpdateStatus,
  getAppUpdateProgressScope,
} from '@onekeyhq/shared/src/appUpdate';
import type { IAppUpdateInfo } from '@onekeyhq/shared/src/appUpdate';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { useDownloadProgress } from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import { EUpdateErrorCode } from '@onekeyhq/shared/src/modules3rdParty/auto-update/error';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import {
  peekDesktopUpdateBanner,
  startDesktopUpdateBanner,
} from '../../AppUpdate/AppUpdateForeground';
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
    @keyframes okUpdateShieldPulse { 0%, 100% { opacity: 1 } 50% { opacity: .55 } }
    @keyframes okUpdateNotifyExit { from { opacity: 1 } to { opacity: 0 } }
    @media (prefers-reduced-motion: reduce) { .ok-update-shield-pulse { animation: none !important } }
  `;
  document.head.appendChild(style);
}

function DownloadCircle({ percent }: { percent: number }) {
  return (
    <XStack width={20} height={20} alignItems="center" justifyContent="center">
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <circle
          cx="10"
          cy="10"
          r="8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          opacity="0.3"
        />
        <circle
          cx="10"
          cy="10"
          r="8"
          fill="none"
          stroke="currentColor"
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
  if (data.updateError?.code === EUpdateErrorCode.integrityFailed)
    return 'securityError';
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
    return 'error';
  }
  return 'download';
}

export function UpdateCapsule({
  data,
  showUpdate,
  onWhatsNew,
}: {
  data: IAppUpdateInfo;
  showUpdate: boolean;
  onWhatsNew: () => void;
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
  const { downloadPackage, installPackage } = useDownloadPackage();
  const percent = useDownloadProgress(getAppUpdateProgressScope(data));
  const mode = getCapsuleMode(data);

  const isVisibleHost = useCallback(
    () =>
      document.visibilityState === 'visible' &&
      Boolean(document.getElementById(anchorId)?.offsetParent),
    [anchorId],
  );

  useEffect(() => {
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
      clearTimeout(busyTimer.current);
      clearTimeout(notifyTimer.current);
    };
  }, [isVisibleHost]);

  useEffect(() => {
    const onOpenDetails = () => {
      if (!isRouteFocused || !isVisibleHost()) return;
      const button = document
        .getElementById(anchorId)
        ?.querySelector<HTMLButtonElement>(
          '[data-testid="header-update-details"]',
        );
      if (!button || button.disabled || button.inert) return;
      const rect = button.getBoundingClientRect();
      const topButton = document
        .elementsFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        )
        .map((element) =>
          element.closest('[data-testid="header-update-details"]'),
        )
        .find(Boolean);
      if (topButton !== button) return;
      button.focus();
      setOpen(true);
    };
    appEventBus.on(EAppEventBusNames.OpenAppUpdateDetails, onOpenDetails);
    return () => {
      appEventBus.off(EAppEventBusNames.OpenAppUpdateDetails, onOpenDetails);
    };
  }, [anchorId, isRouteFocused, isVisibleHost]);

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
    setOpen(false);
    setBusy(true);
    clearTimeout(busyTimer.current);
    busyTimer.current = setTimeout(() => setBusy(false), 3000);
  }, []);

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

  const retry = useCallback(async () => {
    if (await backgroundApiProxy.serviceAppUpdate.canDownloadCurrentTarget()) {
      await downloadPackage();
    }
  }, [downloadPackage]);

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
    stateLabel = intl.formatMessage({ id: ETranslations.global_update_failed });
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
        <Icon name="ShieldCheckDoneOutline" size="$5" color="$iconInverse" />
      </XStack>
    );
  } else if (mode === 'securityError') {
    detailIcon = (
      <Icon name="ShieldFailureSolid" size="$5" color="$iconInverse" />
    );
  } else if (mode === 'error') {
    detailIcon = <Icon name="ErrorOutline" size="$5" color="$iconInverse" />;
  } else {
    detailIcon = <Icon name="DotHorOutline" size="$4.5" color="$iconInverse" />;
  }
  const tooltip = stateLabel;
  const detailsButton = (
    <Button
      testID="header-update-details"
      variant={isError ? 'destructive' : 'accent'}
      childrenAsText={false}
      width={30}
      height={30}
      minWidth={30}
      p={0}
      borderRadius={isReady ? 0 : '$full'}
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

  if (completedVersion && visibleCompleted) {
    return (
      <Button
        id={anchorId}
        testID="header-update-completed"
        size="small"
        variant="accent"
        mr="$3"
        height={30}
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
        {intl.formatMessage(
          { id: ETranslations.app_update_updated__msg },
          { version: completedVersion },
        )}
      </Button>
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
    return (
      <Button
        id={anchorId}
        testID="header-update-button"
        size="small"
        variant="accent"
        mr="$3"
        height={30}
        loading={starting}
        onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
          keyboardStarting.current = event.key === 'Enter' || event.key === ' ';
        }}
        onPress={() => void startDownload()}
      >
        {intl.formatMessage({ id: ETranslations.global_update })}
      </Button>
    );
  }

  return (
    <YStack id={anchorId} mr="$3" position="relative">
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
                  name={
                    wide ? 'ShieldCheckDoneOutline' : 'RestartToUpdateCustom'
                  }
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
            'aria-label': detailsLabel,
            style: { transformOrigin: 'calc(100% - 15px) top' },
          }}
          renderTrigger={
            <Tooltip
              triggerAsChild
              placement="bottom"
              renderTrigger={<XStack>{detailsButton}</XStack>}
              renderContent={tooltip}
            />
          }
          renderContent={
            <YStack gap="$6">
              <XStack alignItems="center" justifyContent="space-between">
                <SizableText size="$headingSm">
                  OneKey {data.latestVersion}
                </SizableText>
                <Button
                  testID="header-update-whats-new"
                  size="small"
                  variant="tertiary"
                  iconAfter="ChevronRightSmallOutline"
                  onPress={closeAndShowWhatsNew}
                >
                  {intl.formatMessage({ id: ETranslations.settings_whats_new })}
                </Button>
              </XStack>
              <UpdateVerifyReceipt
                data={data}
                percent={percent}
                reducedMotion={reducedMotion}
              />
              {isReady ? (
                <SizableText size="$bodySm" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.app_update_installs_on_quit__desc,
                  })}
                </SizableText>
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
              {mode === 'error' ? (
                <YStack gap="$3">
                  <SizableText size="$bodyMd">{errorDescription}</SizableText>
                  {data.updateError?.code ===
                  EUpdateErrorCode.installLocation ? (
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
          }
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
