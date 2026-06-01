import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { HardwareErrorCode as ThirdPartyHwErrorCode } from '@onekeyfe/hwk-adapter-core';
import { useIntl } from 'react-intl';

import {
  Button,
  DialogContainer,
  Portal,
  Progress,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IThirdPartyHardwareRecoveryAction } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { EHardwareVendor } from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import {
  type ILedgerAppInstallRecoveryItem,
  mergeLedgerAppInstallRequests,
} from './hardwareRecoveryActionUtils';

type IInstallStatus = 'pending' | 'installing' | 'success' | 'failed';

const RECOVERY_EVENT_DEBOUNCE_MS = 400;
const INSTALLING_STATE_MIN_VISIBLE_MS = 600;

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForInstallingStateToPaint() {
  await wait(32);
}

async function waitForMinimumInstallingState(startedAt: number) {
  const remaining = INSTALLING_STATE_MIN_VISIBLE_MS - (Date.now() - startedAt);
  if (remaining > 0) {
    await wait(remaining);
  }
}

function getInstallFailureMessage(
  payload: unknown,
  outOfMemoryMessage: string,
): string | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }
  const record = payload as Record<string, unknown>;
  if (
    record.code === ThirdPartyHwErrorCode.DeviceOutOfMemory ||
    record._tag === 'OutOfMemoryDAError'
  ) {
    return outOfMemoryMessage;
  }
  if (typeof record.message === 'string') {
    return record.message;
  }
  if (typeof record.error === 'string') {
    return record.error;
  }
  return undefined;
}

function HardwareRecoveryActionContainerCmp() {
  const intl = useIntl();
  const [items, setItems] = useState<ILedgerAppInstallRecoveryItem[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, IInstallStatus>>(
    {},
  );
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const [failureMessageMap, setFailureMessageMap] = useState<
    Record<string, string | undefined>
  >({});
  const [isInstalling, setIsInstalling] = useState(false);

  const itemsRef = useRef(items);
  const statusMapRef = useRef(statusMap);
  const eventBufferRef = useRef<IThirdPartyHardwareRecoveryAction[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  itemsRef.current = items;
  statusMapRef.current = statusMap;

  const open = items.length > 0;

  const title = useMemo(
    () =>
      intl.formatMessage({
        id: ETranslations.global_warning,
      }),
    [intl],
  );

  const description = useMemo(() => {
    if (!items.length) {
      return undefined;
    }
    return intl.formatMessage({
      id: ETranslations.hardware_third_party_app_install_required_desc,
    });
  }, [intl, items]);

  const outOfMemoryMessage = useMemo(
    () =>
      intl.formatMessage({
        id: ETranslations.hardware_third_party_device_out_of_memory__msg,
      }),
    [intl],
  );

  const hasFailedItems = useMemo(
    () => items.some((item) => statusMap[item.key] === 'failed'),
    [items, statusMap],
  );

  const hasInstallableItems = useMemo(
    () =>
      items.some((item) => {
        const status = statusMap[item.key] ?? 'pending';
        return status !== 'success' && status !== 'installing';
      }),
    [items, statusMap],
  );

  const flushEvents = useCallback(() => {
    const events = eventBufferRef.current;
    eventBufferRef.current = [];
    if (!events.length) {
      return;
    }
    setItems((prev) => mergeLedgerAppInstallRequests(prev, events));
  }, []);

  useEffect(() => {
    const listener = (event: IThirdPartyHardwareRecoveryAction) => {
      eventBufferRef.current.push(event);
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
      flushTimerRef.current = setTimeout(
        flushEvents,
        RECOVERY_EVENT_DEBOUNCE_MS,
      );
    };
    appEventBus.on(
      EAppEventBusNames.ThirdPartyHardwareRecoveryAction,
      listener,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.ThirdPartyHardwareRecoveryAction,
        listener,
      );
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
    };
  }, [flushEvents]);

  useEffect(() => {
    const listener = (event: {
      vendor: EHardwareVendor;
      connectId: string;
      appName: string;
      progress: number;
    }) => {
      const matchedItem = itemsRef.current.find(
        (item) =>
          item.vendor === event.vendor &&
          item.appName === event.appName &&
          (!item.connectId || item.connectId === event.connectId),
      );
      if (!matchedItem) {
        return;
      }
      setProgressMap((prev) => ({
        ...prev,
        [matchedItem.key]: Math.round(event.progress * 100),
      }));
    };
    appEventBus.on(
      EAppEventBusNames.ThirdPartyHardwareAppInstallProgress,
      listener,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.ThirdPartyHardwareAppInstallProgress,
        listener,
      );
    };
  }, []);

  const close = useCallback(() => {
    if (isInstalling) {
      return;
    }
    setItems([]);
    setStatusMap({});
    setProgressMap({});
    setFailureMessageMap({});
  }, [isInstalling]);

  const installItem = useCallback(
    async (item: ILedgerAppInstallRecoveryItem): Promise<boolean> => {
      const startedAt = Date.now();
      setStatusMap((prev) => ({ ...prev, [item.key]: 'installing' }));
      setProgressMap((prev) => ({ ...prev, [item.key]: 0 }));
      setFailureMessageMap((prev) => ({ ...prev, [item.key]: undefined }));
      await waitForInstallingStateToPaint();
      try {
        const result =
          (await backgroundApiProxy.serviceHardware.thirdPartyHardwareInstallApp(
            {
              vendor: item.vendor,
              connectId: item.connectId,
              appName: item.appName,
            },
          )) as { success: boolean; payload?: unknown };
        await waitForMinimumInstallingState(startedAt);
        if (result.success) {
          setProgressMap((prev) => ({ ...prev, [item.key]: 100 }));
          setStatusMap((prev) => ({ ...prev, [item.key]: 'success' }));
          return true;
        }
        setStatusMap((prev) => ({ ...prev, [item.key]: 'failed' }));
        setFailureMessageMap((prev) => ({
          ...prev,
          [item.key]: getInstallFailureMessage(
            result.payload,
            outOfMemoryMessage,
          ),
        }));
        return false;
      } catch (error) {
        await waitForMinimumInstallingState(startedAt);
        setStatusMap((prev) => ({ ...prev, [item.key]: 'failed' }));
        setFailureMessageMap((prev) => ({
          ...prev,
          [item.key]: (error as Error)?.message,
        }));
        return false;
      }
    },
    [outOfMemoryMessage],
  );

  const installAll = useCallback(async () => {
    setIsInstalling(true);
    const processedKeys = new Set<string>();
    let hasFailed = false;
    let hasNextItem = true;
    try {
      while (hasNextItem) {
        const nextItem = itemsRef.current.find((item) => {
          const status = statusMapRef.current[item.key] ?? 'pending';
          return (
            status !== 'success' &&
            status !== 'installing' &&
            !processedKeys.has(item.key)
          );
        });
        if (!nextItem) {
          hasNextItem = false;
        } else {
          processedKeys.add(nextItem.key);
          const success = await installItem(nextItem);
          hasFailed = hasFailed || !success;
        }
      }
    } finally {
      setIsInstalling(false);
      if (!hasFailed) {
        setItems([]);
        setStatusMap({});
        setProgressMap({});
        setFailureMessageMap({});
      }
    }
  }, [installItem]);

  const content = useMemo(
    () => (
      <Stack>
        <YStack gap="$3">
          {description ? (
            <SizableText size="$bodyMd" color="$textSubdued">
              {description}
            </SizableText>
          ) : null}
          {items.map((item) => {
            const status = statusMap[item.key] ?? 'pending';
            const progress = progressMap[item.key] ?? 0;
            const failureMessage = failureMessageMap[item.key];
            return (
              <YStack key={item.key} gap="$2">
                <XStack alignItems="center" justifyContent="space-between">
                  <YStack flex={1} pr="$3">
                    <SizableText size="$bodyMdMedium">
                      {item.appName}
                    </SizableText>
                  </YStack>
                  <SizableText size="$bodySm" color="$textSubdued">
                    {status === 'installing'
                      ? `${intl.formatMessage({
                          id: ETranslations.update_installing,
                        })} ${progress}%`
                      : null}
                    {status === 'success'
                      ? intl.formatMessage({
                          id: ETranslations.global_success,
                        })
                      : null}
                    {status === 'failed'
                      ? intl.formatMessage({
                          id: ETranslations.update_installation_failed,
                        })
                      : null}
                    {status === 'pending'
                      ? intl.formatMessage({
                          id: ETranslations.global_pending,
                        })
                      : null}
                  </SizableText>
                </XStack>
                {status === 'installing' ? (
                  <Progress animated value={progress} w="100%" />
                ) : null}
                {status === 'failed' && failureMessage ? (
                  <SizableText size="$bodySm" color="$textCritical">
                    {failureMessage}
                  </SizableText>
                ) : null}
              </YStack>
            );
          })}
        </YStack>

        <XStack mt="$5" gap="$3" justifyContent="flex-end">
          <Button
            testID="hardware-recovery-action-close-btn"
            disabled={isInstalling}
            onPress={close}
          >
            {intl.formatMessage({ id: ETranslations.global_close })}
          </Button>
          <Button
            testID="hardware-recovery-action-install-btn"
            variant="primary"
            loading={isInstalling}
            disabled={isInstalling || !hasInstallableItems}
            onPress={() => void installAll()}
          >
            {intl.formatMessage({
              id: hasFailedItems
                ? ETranslations.global_retry
                : ETranslations.global_install,
            })}
          </Button>
        </XStack>
      </Stack>
    ),
    [
      close,
      description,
      failureMessageMap,
      installAll,
      intl,
      hasFailedItems,
      hasInstallableItems,
      isInstalling,
      items,
      progressMap,
      statusMap,
    ],
  );

  return (
    <Portal.Body container={Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL}>
      <DialogContainer
        open={open}
        title={title}
        renderContent={content}
        showFooter={false}
        dismissOnOverlayPress={false}
        disableDrag={isInstalling}
        onClose={async () => close()}
      />
    </Portal.Body>
  );
}

export const HardwareRecoveryActionContainer = memo(
  HardwareRecoveryActionContainerCmp,
);
