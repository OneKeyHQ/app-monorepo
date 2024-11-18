import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { IDialogShowProps } from '@onekeyhq/components';
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
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { openUrlInApp } from '@onekeyhq/shared/src/utils/openUrlUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../hooks/usePromiseResult';

const TRON_RESOURCE_DOC_URL =
  'https://help.onekey.so/hc/articles/11039593254799';

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
  const { result, isLoading } = usePromiseResult(
    async () => {
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

      return {
        netAvailable,
        netTotal,
        energyAvailable,
        energyTotal,
      };
    },
    [accountId, networkId],
    {
      watchLoading: true,
    },
  );

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
          onPress={() => openUrlInApp(TRON_RESOURCE_DOC_URL)}
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

export const showTronResourceDetailsDialog = ({
  accountId,
  networkId,
  ...dialogProps
}: IDialogShowProps & {
  accountId: string;
  networkId: string;
}) =>
  Dialog.show({
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
