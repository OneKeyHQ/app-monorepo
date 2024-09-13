import { useCallback, useRef } from 'react';

import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
import { IconButton, SizableText, XStack, YStack } from '@onekeyhq/components';
import { showResourceDetailsDialog } from '@onekeyhq/kit/src/components/Resource';
import { useSendSelectedFeeInfoAtom } from '@onekeyhq/kit/src/states/jotai/contexts/sendConfirm';
import { InfoItem } from '@onekeyhq/kit/src/views/AssetDetails/pages/HistoryDetails/components/TxDetailsInfoItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function TronSpecialInfo({
  accountId,
  networkId,
}: {
  accountId: string;
  networkId: string;
}) {
  const intl = useIntl();
  const [selectedFeeInfo] = useSendSelectedFeeInfoAtom();

  const feeTron = selectedFeeInfo?.feeInfo?.feeTron;

  const resourceDialogInstance = useRef<IDialogInstance | null>(null);

  const handleResourceDetailsOnPress = useCallback(() => {
    if (resourceDialogInstance?.current) {
      return;
    }
    resourceDialogInstance.current = showResourceDetailsDialog({
      accountId,
      networkId,
      onClose: () => {
        resourceDialogInstance.current = null;
      },
    });
  }, [accountId, networkId]);

  if (!feeTron) return null;

  return (
    <InfoItem
      label={
        <XStack alignItems="center" gap="$1">
          <SizableText size="$bodyMdMedium">
            {intl.formatMessage({ id: ETranslations.global_resources })}
          </SizableText>
          <IconButton
            icon="QuestionmarkOutline"
            size="small"
            variant="tertiary"
            onPress={handleResourceDetailsOnPress}
          />
        </XStack>
      }
      renderContent={
        <YStack gap="$1.5">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage(
              {
                id: ETranslations.global_energy_bandwidth_num,
              },
              {
                num_1: feeTron.requiredEnergy ?? '0',
                num_2: feeTron.requiredBandwidth ?? '0',
              },
            )}
          </SizableText>
          <SizableText size="$bodyMd" color="$textDisabled">
            {intl.formatMessage({
              id: ETranslations.global_energy_bandwidth_transaction_desc,
            })}
          </SizableText>
        </YStack>
      }
    />
  );
}

export { TronSpecialInfo };
