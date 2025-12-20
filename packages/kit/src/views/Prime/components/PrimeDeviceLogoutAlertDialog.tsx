import { useEffect } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, SizableText, Stack } from '@onekeyhq/components';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { useDebounce } from '../../../hooks/useDebounce';

export function PrimeDeviceLogoutAlertDialog() {
  const intl = useIntl();

  const { logout } = useOneKeyAuth();

  const logoutDebounced = useDebounce(logout, 600, {
    leading: false,
    trailing: true,
  });

  useEffect(() => {
    defaultLogger.prime.subscription.onekeyIdLogout({
      reason: 'Logout when PrimeDeviceLogoutAlertDialog is shown',
    });
    void logoutDebounced();
  }, [logoutDebounced]);

  /*
    Toast.success({
      title: intl.formatMessage({
        id: ETranslations.prime_onekeyid_been_log_out,
      }),
      message: intl.formatMessage({
        id: ETranslations.prime_onekeyid_been_log_out_desc,
      }),
    });
  */

  return (
    <Stack>
      <Dialog.Title>
        {intl.formatMessage({
          id: ETranslations.prime_onekeyid_been_log_out,
        })}
      </Dialog.Title>

      <Stack pt="$4">
        <SizableText>
          {intl.formatMessage({
            id: ETranslations.prime_onekeyid_been_log_out_desc,
          })}
        </SizableText>
      </Stack>
      <Dialog.Footer
        showCancelButton
        showConfirmButton={false}
        onCancelText={intl.formatMessage({
          id: ETranslations.global_got_it,
        })}
        onCancel={async () => {
          //
        }}
      />
    </Stack>
  );
}
