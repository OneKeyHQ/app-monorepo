import type { IDialogShowProps } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  NumberSizeableText,
  Progress,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useIntl } from 'react-intl';
import { openUrl } from '../../utils/openUrl';

const TRON_RESOURCE_DOC_URL =
  'https://developers.tron.network/docs/resource-model';

function ResourceDetails({
  name,
  usage,
  total,
}: {
  name: string;
  usage: number;
  total: number;
}) {
  return (
    <YStack gap="$2" flex={1}>
      <Progress size="medium" value={100} />
      <XStack justifyContent="space-between">
        <SizableText size="$bodySmMedium">{name}</SizableText>
        <XStack alignItems="center">
          <NumberSizeableText size="$bodySmMedium" formatter="marketCap">
            {usage}
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
  const { result, isLoading } = usePromiseResult(
    async () => {
      const r =
        await backgroundApiProxy.serviceAccountProfile.fetchAccountDetails({
          accountId,
          networkId,
          withTronAccountResources: true,
        });
      return r;
    },
    [accountId, networkId],
    {
      watchLoading: true,
    },
  );

  return (
    <Stack gap="$5">
      <XStack justifyContent="flex-start">
        <Button
          size="small"
          variant="tertiary"
          icon="QuestionmarkOutline"
          onPress={() => openUrl(TRON_RESOURCE_DOC_URL)}
        >
          {intl.formatMessage({ id: ETranslations.global_learn_more })}
        </Button>
      </XStack>
      <XStack gap="$4" flex={1}>
        <ResourceDetails
          name={intl.formatMessage({ id: ETranslations.global_energy })}
          usage={0.5}
          total={1}
        />
        <ResourceDetails
          name={intl.formatMessage({ id: ETranslations.global_bandwidth })}
          usage={0.5}
          total={1}
        />
      </XStack>
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
      id: ETranslations.global_done,
    }),
    onConfirm: async ({ close }) => {
      await close();
    },
    ...dialogProps,
  });
