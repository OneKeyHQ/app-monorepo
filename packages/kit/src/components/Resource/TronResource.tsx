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

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { CircleProgress } from '../../views/Borrow/components/CircleProgress';

const TRON_RESOURCE_DOC_URL = 'https://help.onekey.so/articles/11461319';
const DONUT_COLOR = '#818cf8';
const DONUT_SIZE = 40;
const DONUT_STROKE = 4;

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
  type IResourceResult = {
    netAvailable: BigNumber;
    netTotal: BigNumber;
    energyAvailable: BigNumber;
    energyTotal: BigNumber;
  };
  const lastResultRef = useRef<IResourceResult | undefined>(undefined);

  return usePromiseResult(
    async () => {
      try {
        const accountAddress =
          await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
            accountId,
            networkId,
          });
        const [resources] =
          await backgroundApiProxy.serviceAccountProfile.sendProxyRequest<{
            EnergyLimit: number;
            EnergyUsed: number;
            NetLimit: number;
            NetUsed: number;
            freeEnergyLimit: number;
            freeEnergyUsed: number;
            freeNetLimit: number;
            freeNetUsed: number;
          }>({
            networkId,
            body: [
              {
                route: 'tronweb',
                params: {
                  method: 'trx.getAccountResources',
                  params: [accountAddress],
                },
              },
            ],
          });
        const netTotal = new BigNumber(resources.NetLimit ?? 0).plus(
          resources.freeNetLimit ?? 0,
        );
        const netAvailable = netTotal
          .minus(resources.NetUsed ?? 0)
          .minus(resources.freeNetUsed ?? 0);

        const energyTotal = new BigNumber(resources.EnergyLimit ?? 0).plus(
          resources.freeEnergyLimit ?? 0,
        );

        const energyAvailable = energyTotal
          .minus(resources.EnergyUsed ?? 0)
          .minus(resources.freeEnergyUsed ?? 0);

        const result = { netAvailable, netTotal, energyAvailable, energyTotal };
        lastResultRef.current = result;
        return result;
      } catch (e: unknown) {
        if (suppressErrors && e && typeof e === 'object') {
          // Suppress toast for silent background/polling refreshes.
          // @toastIfError sets autoToast=true before BackgroundApiProxyBase
          // schedules showToastOfError in a 50ms setTimeout. Clearing it here
          // (same object reference) prevents the toast while keeping the
          // previous result intact via the rethrow.
          (e as { autoToast?: boolean }).autoToast = false;
          // Return last known values so the card keeps showing valid data
          // instead of resetting to 0/0 on a transient network failure.
          return lastResultRef.current;
        }
        throw e;
      }
    },
    [accountId, networkId, suppressErrors],
    {
      watchLoading: true,
      pollingInterval,
    },
  );
}

function ResourceDetails({
  name,
  available,
  total,
}: {
  name: string;
  available: BigNumber;
  total: BigNumber;
}) {
  const percentage = total.isZero()
    ? 0
    : available.div(total).times(100).toNumber();

  return (
    <YStack gap="$2" flexGrow={1} flexBasis={0}>
      <Progress size="medium" value={percentage} minWidth={0} />
      <XStack justifyContent="space-between">
        <SizableText size="$bodySmMedium">{name}</SizableText>
        <XStack alignItems="center">
          <NumberSizeableText size="$bodySmMedium" formatter="marketCap">
            {available.toFixed()}
          </NumberSizeableText>
          <SizableText size="$bodySmMedium">/</SizableText>
          <NumberSizeableText size="$bodySmMedium" formatter="marketCap">
            {total.toFixed()}
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
  const { result, isLoading } = useTronAccountResources({
    accountId,
    networkId,
  });

  const { netAvailable, netTotal, energyAvailable, energyTotal } = result ?? {
    netAvailable: new BigNumber(0),
    netTotal: new BigNumber(0),
    energyAvailable: new BigNumber(0),
    energyTotal: new BigNumber(0),
  };

  return (
    <Stack gap="$5">
      <XStack justifyContent="flex-start">
        <Button
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
      {isLoading ? (
        <Skeleton h="$7" flex={1} width="100%" />
      ) : (
        <XStack gap="$4" flex={1}>
          <ResourceDetails
            name={intl.formatMessage({ id: ETranslations.global_energy })}
            total={energyTotal}
            available={energyAvailable}
          />
          <ResourceDetails
            name={intl.formatMessage({ id: ETranslations.global_bandwidth })}
            total={netTotal}
            available={netAvailable}
          />
        </XStack>
      )}
    </Stack>
  );
}

function DonutArc({
  name,
  available,
  total,
}: {
  name: string;
  available: BigNumber;
  total: BigNumber;
}) {
  const percentage = total.isZero()
    ? 0
    : Math.max(0, Math.min(available.div(total).times(100).toNumber(), 100));

  return (
    <YStack alignItems="center" gap="$0.5" flex={1}>
      <CircleProgress
        percentage={percentage}
        size={DONUT_SIZE}
        strokeWidth={DONUT_STROKE}
        progressColor={DONUT_COLOR}
      >
        <SizableText size="$bodyXs" fontWeight="600">
          {`${Math.round(percentage)}%`}
        </SizableText>
      </CircleProgress>
      <SizableText size="$headingSm">{name}</SizableText>
      <XStack alignItems="center">
        <NumberSizeableText
          size="$bodyXs"
          color="$textSubdued"
          formatter="marketCap"
        >
          {available.toFixed()}
        </NumberSizeableText>
        <SizableText size="$bodyXs" color="$textSubdued">
          {' / '}
        </SizableText>
        <NumberSizeableText
          size="$bodyXs"
          color="$textSubdued"
          formatter="marketCap"
        >
          {total.toFixed()}
        </NumberSizeableText>
      </XStack>
    </YStack>
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
    title: appLocale.intl.formatMessage({
      id: ETranslations.global_energy_bandwidth,
    }),
    description: appLocale.intl.formatMessage({
      id: ETranslations.global_energy_bandwidth_desc,
    }),
    icon: 'FlashOutline',
    renderContent: (
      <ResourceDetailsContent accountId={accountId} networkId={networkId} />
    ),
    showCancelButton: false,
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
}: {
  accountId: string;
  networkId: string;
}) {
  const intl = useIntl();
  const resourceDialogInstance = useRef<IDialogInstance | null>(null);
  const { result, isLoading, run } = useTronAccountResources({
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

  const { netAvailable, netTotal, energyAvailable, energyTotal } = result ?? {
    netAvailable: new BigNumber(0),
    netTotal: new BigNumber(0),
    energyAvailable: new BigNumber(0),
    energyTotal: new BigNumber(0),
  };

  return (
    <YStack
      w={220}
      h={108}
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
      {isLoading && !result ? (
        <Skeleton h="$7" flex={1} width="100%" />
      ) : (
        <XStack flex={1} alignItems="center" gap="$3">
          <DonutArc
            name={intl.formatMessage({ id: ETranslations.global_energy })}
            total={energyTotal}
            available={energyAvailable}
          />
          <DonutArc
            name={intl.formatMessage({ id: ETranslations.global_bandwidth })}
            total={netTotal}
            available={netAvailable}
          />
        </XStack>
      )}
    </YStack>
  );
}
