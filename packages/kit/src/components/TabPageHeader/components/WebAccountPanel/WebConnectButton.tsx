import { useIntl } from 'react-intl';

import { Button } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useAccountSelectorTrigger } from '../../../AccountSelector/hooks/useAccountSelectorTrigger';

export function WebConnectButton() {
  const intl = useIntl();
  const { showAccountSelector } = useAccountSelectorTrigger({
    num: 0,
    showConnectWalletModalInDappMode: true,
  });

  return (
    <Button
      variant="primary"
      size="medium"
      h="$8"
      onPress={showAccountSelector}
      testID="web-connect-button"
    >
      {intl.formatMessage({ id: ETranslations.global_connect })}
    </Button>
  );
}
