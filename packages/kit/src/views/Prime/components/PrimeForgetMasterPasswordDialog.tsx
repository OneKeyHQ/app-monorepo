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

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

export function PrimeForgetMasterPasswordDialog({
  promiseId,
}: {
  promiseId: number;
}) {
  const [isChecked, setIsChecked] = useState(false);
  const intl = useIntl();

  const submit = useCallback(
    async (options: { preventClose?: () => void } = {}) => {
      if (!isChecked) {
        options?.preventClose?.();
        return;
      }
      try {
        console.log('submit', promiseId);
        await backgroundApiProxy.servicePrime.resolveForgetMasterPasswordDialog(
          {
            promiseId,
          },
        );
      } catch (error) {
        options?.preventClose?.();
        throw error;
      }
    },
    [isChecked, promiseId],
  );

  return (
    <Stack>
      {/* <Dialog.Icon icon="EmailOutline" /> */}
      {/* <Dialog.Title>Forget Master Password</Dialog.Title> */}
      <Dialog.Description>
        <YStack gap="$2">
          {/* <Stack>
            <SizableText>
              We do not store your password and cannot recover it for you.
            </SizableText>
          </Stack>

          <Stack>
            <SizableText>
              Please confirm that you have forgotten your password and are
              willing to delete all cloud data.
            </SizableText>
          </Stack>

          <Stack>
            <SizableText>
              If you need more information, please check the master password
              help documentation.
            </SizableText>
          </Stack> */}

          <Stack>
            <SizableText>
              {intl.formatMessage({
                id: ETranslations.prime_reset_backup_password_description,
              })}
            </SizableText>
          </Stack>
        </YStack>
      </Dialog.Description>
      <Stack pt="$2">
        <Checkbox
          label={intl.formatMessage({
            id: ETranslations.prime_reset_backup_password_checkbox_label,
          })}
          value={isChecked}
          onChange={() => {
            setIsChecked(!isChecked);
          }}
        />
      </Stack>
      <Dialog.Footer
        showCancelButton
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_delete,
        })}
        confirmButtonProps={{
          disabled: !isChecked,
          variant: 'destructive',
        }}
        onConfirm={async ({ preventClose }) => {
          await submit({ preventClose });
        }}
      />
    </Stack>
  );
}
