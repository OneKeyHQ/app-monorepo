import { useIntl } from 'react-intl';

import { Button } from '@onekeyhq/components';
import type { IButtonProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function NotificationsTestButton({ ...rest }: IButtonProps) {
  const intl = useIntl();
  return (
    <Button
      onPress={() => {
        void backgroundApiProxy.serviceNotification.showNotification({
          title: 'test message',
          description: 'This is a test message',
        });
      }}
      {...rest}
    >
      {intl.formatMessage({ id: ETranslations.global_test })}
    </Button>
  );
}

export default NotificationsTestButton;
