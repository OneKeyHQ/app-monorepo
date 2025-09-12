import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Checkbox,
  Dialog,
  SizableText,
  Stack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function PrimeSetMasterPasswordHintDialog({
  onContinue,
}: {
  onContinue: () => void;
}) {
  const [isChecked, setIsChecked] = useState(false);
  const intl = useIntl();

  const submit = useCallback(
    async (options: { preventClose?: () => void } = {}) => {
      if (!isChecked) {
        options?.preventClose?.();
        return;
      }
      onContinue();
    },
    [isChecked, onContinue],
  );

  return (
    <Stack>
      <YStack>
        <YStack gap="$2">
          <SizableText>
            {intl.formatMessage({
              id: ETranslations.prime_set_up_backup_password_description1,
            })}
          </SizableText>
          <SizableText>
            {intl.formatMessage({
              id: ETranslations.prime_set_up_backup_password_description2,
            })}
          </SizableText>
        </YStack>
      </YStack>
      <Stack pt="$2">
        <Checkbox
          label={intl.formatMessage({
            id: ETranslations.prime_i_understand,
          })}
          value={isChecked}
          onChange={() => {
            setIsChecked(!isChecked);
          }}
        />
      </Stack>
      <Dialog.Footer
        showCancelButton={false}
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_continue,
        })}
        confirmButtonProps={{
          disabled: !isChecked,
          // variant: 'destructive',
        }}
        onConfirm={async ({ preventClose }) => {
          await submit({ preventClose });
        }}
      />
    </Stack>
  );
}
