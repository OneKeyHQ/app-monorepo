import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Checkbox,
  Dialog,
  SizableText,
  Stack,
  YStack,
  useForm,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

export function PrimeForgetMasterPasswordDialog({
  promiseId,
}: {
  promiseId: number;
}) {
  const intl = useIntl();

  const [isChecked, setIsChecked] = useState(false);

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
      <Dialog.Title>Forget Master Password</Dialog.Title>
      <Dialog.Description>
        <YStack gap="$2">
          <Stack>
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
          </Stack>
        </YStack>
      </Dialog.Description>
      <Stack pt="$4">
        <Checkbox
          label="I confirm that I have forgotten my password and want to delete all cloud data."
          value={isChecked}
          onChange={() => {
            setIsChecked(!isChecked);
          }}
        />
      </Stack>
      <Dialog.Footer
        showCancelButton
        onConfirmText="Delete Cloud Data"
        confirmButtonProps={{
          disabled: !isChecked,
        }}
        onConfirm={async ({ preventClose }) => {
          await submit({ preventClose });
        }}
      />
    </Stack>
  );
}
