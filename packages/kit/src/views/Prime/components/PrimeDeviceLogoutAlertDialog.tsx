import { useEffect } from 'react';

import { Dialog, SizableText, Stack } from '@onekeyhq/components';

import { useDebounce } from '../../../hooks/useDebounce';
import { usePrimeAuthV2 } from '../hooks/usePrimeAuthV2';

export function PrimeDeviceLogoutAlertDialog() {
  const { logout } = usePrimeAuthV2();

  const logoutDebounced = useDebounce(logout, 600, {
    leading: false,
    trailing: true,
  });

  useEffect(() => {
    void logoutDebounced();
  }, [logoutDebounced]);

  return (
    <Stack>
      <Dialog.Title>OneKey Prime log out.</Dialog.Title>

      <Stack pt="$4">
        <SizableText>
          This device been deactivated from another device. If this wasn't you,
          please check your email security.
        </SizableText>
      </Stack>
      <Dialog.Footer
        showCancelButton
        showConfirmButton={false}
        onCancelText="Got it"
        onCancel={async () => {
          //
        }}
      />
    </Stack>
  );
}
