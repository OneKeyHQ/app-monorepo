import { useIntl } from 'react-intl';

import { Dialog, SizableText, Stack, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function SpeedUpTransactionContent() {
  const intl = useIntl();

  return (
    <Stack gap="$1">
      <SizableText size="$bodyLg" color="$text">
        {intl.formatMessage({
          id: ETranslations.tx_accelerate_speed_up_with_accelerator_dialog_note_title,
        })}
      </SizableText>
      <Stack gap="$3">
        <XStack alignItems="flex-start">
          <XStack m="$2.5" w="$1" h="$1" borderRadius="$full" bg="$text" />
          <SizableText size="$bodyLg" color="$text">
            {intl.formatMessage(
              {
                id: ETranslations.tx_accelerate_speed_up_with_accelerator_dialog_note_fee_cal,
              },
              {
                accelerator: 'F2Pool',
              },
            )}
          </SizableText>
        </XStack>

        <XStack alignItems="flex-start">
          <XStack m="$2.5" w="$1" h="$1" borderRadius="$full" bg="$text" />
          <SizableText>
            {intl.formatMessage(
              {
                id: ETranslations.tx_accelerate_speed_up_with_accelerator_dialog_note_service_provide_by,
              },
              {
                accelerator: 'F2Pool',
              },
            )}
          </SizableText>
        </XStack>
        <XStack alignItems="flex-start">
          <XStack m="$2.5" w="$1" h="$1" borderRadius="$full" bg="$text" />
          <SizableText>
            {intl.formatMessage({
              id: ETranslations.tx_accelerate_speed_up_with_accelerator_dialog_fee_refund,
            })}
          </SizableText>
        </XStack>
      </Stack>
    </Stack>
  );
}

export function showBtcSpeedUpTxDialog({
  title,
  description,
  onConfirm,
}: {
  title: string;
  description: string;
  onConfirm: () => Promise<void>;
}) {
  return Dialog.show({
    title,
    description,
    renderContent: <SpeedUpTransactionContent />,
    onConfirm,
  });
}
