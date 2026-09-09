import { useIntl } from 'react-intl';

import { Dialog, SizableText, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function PrimeDeviceLogoutAlertDialog() {
  const intl = useIntl();

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
        cancelButtonProps={{
          testID: 'prime-login-device-logout-dismiss-btn',
        }}
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
