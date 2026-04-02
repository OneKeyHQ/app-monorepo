import { useIntl } from 'react-intl';

import { Button, Dialog } from '@onekeyhq/components';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

export function LogoutButton() {
  const intl = useIntl();
  const { logout } = useOneKeyAuth();

  const handlePress = () => {
    Dialog.show({
      icon: 'InfoCircleOutline',
      title: intl.formatMessage({
        id: ETranslations.prime_onekeyid_log_out,
      }),
      description: intl.formatMessage({
        id: ETranslations.prime_onekeyid_log_out_description,
      }),
      onConfirmText: intl.formatMessage({
        id: ETranslations.prime_log_out,
      }),
      onConfirm: async () => {
        defaultLogger.prime.subscription.onekeyIdLogout({
          reason: 'Referral Logout Button',
        });
        await logout();
      },
    });
  };

  return (
    <Button
      variant="tertiary"
      size="small"
      icon="LogoutOutline"
      onPress={handlePress}
    >
      {intl.formatMessage({ id: ETranslations.prime_log_out })}
    </Button>
  );
}
