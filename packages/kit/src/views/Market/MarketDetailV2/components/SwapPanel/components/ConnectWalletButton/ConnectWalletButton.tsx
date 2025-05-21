import { useIntl } from 'react-intl';

import { Button } from '@onekeyhq/components';
import type { IButtonProps } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export interface IConnectWalletButtonProps extends IButtonProps {
  onConnect?: () => void;
}

export function ConnectWalletButton({
  onConnect,
  ...props
}: IConnectWalletButtonProps) {
  const intl = useIntl();
  return (
    <Button variant="primary" size="large" {...props} onPress={onConnect}>
      {intl.formatMessage({ id: ETranslations.global_connect_wallet })}
    </Button>
  );
}
