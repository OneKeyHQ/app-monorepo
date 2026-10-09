import { useCallback, useEffect, useRef } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IDialogInstance, IDialogShowProps } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  NumberSizeableText,
  Progress,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useDialogInstance,
} from '@onekeyhq/components';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { openUrlInApp } from '@onekeyhq/shared/src/utils/openUrlUtils';
import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import type { ITronAccountResources } from '@onekeyhq/shared/types/tron';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { CircleProgress } from '../../views/Borrow/components/CircleProgress';

const TRON_RESOURCE_DOC_URL = 'https://help.onekey.so/articles/11461319';
const DONUT_COLOR = '#818cf8';
const DONUT_SIZE = 20;
const DONUT_STROKE = 2;

// available is already in [0, total], and the ring/bar consumers clamp
// internally, so no extra clamp is needed here.
function getResourcePercentage(available: string, total: string) {
  const totalValue = new BigNumber(total);
  return totalValue.isZero()
    ? 0
    : new BigNumber(available).div(totalValue).times(100).toNumber();
}

function useTronAccountResources({
  accountId,
  networkId,
  pollingInterval,
  suppressErrors = false,
}: {
  accountId: string;
  networkId: string;
  pollingInterval?: number;
  suppressErrors?: boolean;
}) {
  // Per-account cache (OK-64027). On an account switch the hook paints this
  // account's last known figures synchronously — or nothing, for an account
  // never read — so the previous account's values never stand in while the
  // fresh read is in flight, and a revisit does not wait on the network.
  const swrKey = swrKeys.tronAccountResources({ accountId, networkId });

  return usePromiseResult(
    async () => {
      try {
        return await backgroundApiProxy.serviceAccountProfile.fetchTronAccountResources(
          { accountId, networkId },
        );
      } catch (e: unknown) {
        if (suppressErrors && e && typeof e === 'object') {
          // Suppress toast for silent background/polling refreshes.
          // @toastIfError sets autoToast=true before BackgroundApiProxyBase
          // schedules showToastOfError in a 50ms setTimeout. Clearing it here
          // (same object reference) prevents the toast.
          (e as { autoToast?: boolean }).autoToast = false;
          // Keep this account's last known values instead of resetting the
          // card on a transient network failure. The cache is keyed per
          // account, so a previous account's figures can never leak in.
          return swrCacheUtils.get<ITronAccountResources>(swrKey);
        }
        throw e;
      }
    },
    [accountId, networkId, suppressErrors, swrKey],
    {
      pollingInterval,
      swrKey,
    },
  );
}

function ResourceDetails({
  name,
  available,
  total,
}: {
  name: string;
  available: string;
  total: string;
}) {
  const percentage = getResourcePercentage(available, total);

  return (
    <YStack gap="$2" flexGrow={1} flexBasis={0}>
      <Progress size="medium" value={percentage} minWidth={0} />
      <XStack justifyContent="space-between">
        <SizableText size="$bodySmMedium">{name}</SizableText>
        <XStack alignItems="center">
          <NumberSizeableText size="$bodySmMedium" formatter="marketCap">
            {available}
          </NumberSizeableText>
          <SizableText size="$bodySmMedium">/</SizableText>
          <NumberSizeableText size="$bodySmMedium" formatter="marketCap">
            {total}
          </NumberSizeableText>
        </XStack>
      </XStack>
    </YStack>
  );
}

function ResourceDetailsContent({
  accountId,
  networkId,
}: {
  accountId: string;
  networkId: string;
}) {
  const intl = useIntl();
  const dialogInstance = useDialogInstance();
  const { result } = useTronAccountResources({
    accountId,
    networkId,
  });

  return (
    <Stack gap="$5">
      <XStack justifyContent="flex-start">
        <Button
          testID="resource-dialog-instance-btn"
          flex={1}
          textAlign="left"
          justifyContent="flex-start"
          size="small"
          variant="tertiary"
          icon="QuestionmarkOutline"
          onPress={() => {
            openUrlInApp(TRON_RESOURCE_DOC_URL);
            void dialogInstance.close();
          }}
        >
          {intl.formatMessage({
            id: ETranslations.global_energy_bandwidth_learn,
          })}
        </Button>
      </XStack>
      {result ? (
        <XStack gap="$4" flex={1}>
          <ResourceDetails
            name={intl.formatMessage({ id: ETranslations.global_energy })}
            total={result.energyTotal}
            available={result.energyAvailable}
          />
          <ResourceDetails
            name={intl.formatMessage({ id: ETranslations.global_bandwidth })}
            total={result.netTotal}
            available={result.netAvailable}
          />
        </XStack>
      ) : (
        <Skeleton h="$7" flex={1} width="100%" />
      )}
    </Stack>
  );
}

function ResourceRow({
  name,
  available,
  total,
}: {
  name: string;
  available: string;
  total: string;
}) {
  const percentage = getResourcePercentage(available, total);

  // Full-width row: ring + name on the left, available/total on the right.
  // Two rows stack inside the compact 88pt card. Giving each label the full
  // card width (instead of two cramped side-by-side columns) prevents
  // truncation for long localized resource names.
  return (
    <XStack alignItems="center" gap="$2.5">
      <CircleProgress
        percentage={percentage}
        size={DONUT_SIZE}
        strokeWidth={DONUT_STROKE}
        progressColor={DONUT_COLOR}
      >
        {/* Ring-only accent; exact figures are shown as text on the right. */}
        <Stack />
      </CircleProgress>
      <SizableText size="$bodyMdMedium" numberOfLines={1} flex={1}>
        {name}
      </SizableText>
      <XStack alignItems="center" gap="$0.5" flexShrink={0}>
        <NumberSizeableText
          size="$bodyMd"
          color="$textSubdued"
          formatter="marketCap"
        >
          {available}
        </NumberSizeableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          /
        </SizableText>
        <NumberSizeableText
          size="$bodyMd"
          color="$textSubdued"
          formatter="marketCap"
        >
          {total}
        </NumberSizeableText>
      </XStack>
    </XStack>
  );
}

// Mirrors ResourceRow (ring, name, figures) at the same row height so the
// card does not reflow when the first values replace it.
function ResourceRowSkeleton() {
  return (
    <XStack alignItems="center" gap="$2.5" h={DONUT_SIZE}>
      <Skeleton w={DONUT_SIZE} h={DONUT_SIZE} radius="round" />
      <Skeleton h="$3" w="$14" />
      <Stack flex={1} />
      <Skeleton h="$3" w="$16" />
    </XStack>
  );
}

export function showTronResourceDetailsDialog({
  accountId,
  networkId,
  ...dialogProps
}: IDialogShowProps & {
  accountId: string;
  networkId: string;
}) {
  return Dialog.show({
    // eslint-disable-next-line onekey/no-app-locale-main-thread
    title: appLocale.intl.formatMessage({
      id: ETranslations.global_energy_bandwidth,
    }),
    // eslint-disable-next-line onekey/no-app-locale-main-thread
    description: appLocale.intl.formatMessage({
      id: ETranslations.global_energy_bandwidth_desc,
    }),
    icon: 'FlashOutline',
    renderContent: (
      <ResourceDetailsContent accountId={accountId} networkId={networkId} />
    ),
    showCancelButton: false,
    // eslint-disable-next-line onekey/no-app-locale-main-thread
    onConfirmText: appLocale.intl.formatMessage({
      id: ETranslations.global_ok,
    }),
    onConfirm: async ({ close }) => {
      await close();
    },
    ...dialogProps,
  });
}

export function TronResourceBannerCard({
  accountId,
  networkId,
  width,
  height,
}: {
  accountId: string;
  networkId: string;
  width: number;
  height: number;
}) {
  const intl = useIntl();
  const resourceDialogInstance = useRef<IDialogInstance | null>(null);
  const { result, run } = useTronAccountResources({
    accountId,
    networkId,
    pollingInterval: 30_000,
    suppressErrors: true,
  });

  const handlePress = useCallback(() => {
    if (resourceDialogInstance.current) return;
    resourceDialogInstance.current = showTronResourceDetailsDialog({
      accountId,
      networkId,
      onClose: () => {
        resourceDialogInstance.current = null;
        void run();
      },
    });
  }, [accountId, networkId, run]);

  useEffect(() => {
    const handler = () => void run({ triggerByDeps: true });
    appEventBus.on(EAppEventBusNames.AccountDataUpdate, handler);
    appEventBus.on(EAppEventBusNames.HistoryTxStatusChanged, handler);
    return () => {
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, handler);
      appEventBus.off(EAppEventBusNames.HistoryTxStatusChanged, handler);
    };
  }, [run]);

  return (
    <YStack
      w={width}
      h={height}
      p="$4"
      my="$px"
      bg="$bgSubdued"
      borderRadius="$4"
      borderCurve="continuous"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      focusable
      focusVisibleStyle={{
        outlineColor: '$focusRing',
        outlineWidth: 2,
        outlineStyle: 'solid',
        outlineOffset: -2,
      }}
      outlineWidth={1}
      outlineColor="$neutral3"
      outlineStyle="solid"
      $platform-native={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$neutral3',
      }}
      onPress={handlePress}
      userSelect="none"
      justifyContent="center"
    >
      {/* No result means no read has landed for this account yet: keep the
          skeleton rather than painting a 0/0 placeholder for the first
          frames before the loading state starts (OK-64027). */}
      {result ? (
        <YStack gap="$3">
          <ResourceRow
            name={intl.formatMessage({ id: ETranslations.global_energy })}
            total={result.energyTotal}
            available={result.energyAvailable}
          />
          <ResourceRow
            name={intl.formatMessage({ id: ETranslations.global_bandwidth })}
            total={result.netTotal}
            available={result.netAvailable}
          />
        </YStack>
      ) : (
        <YStack gap="$3">
          <ResourceRowSkeleton />
          <ResourceRowSkeleton />
        </YStack>
      )}
    </YStack>
  );
}
