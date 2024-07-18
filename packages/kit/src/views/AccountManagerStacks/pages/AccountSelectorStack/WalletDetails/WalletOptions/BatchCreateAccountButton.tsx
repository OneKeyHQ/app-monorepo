import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslationsMock } from '@onekeyhq/shared/src/locale';
import {
  EAccountManagerStacksRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

import { WalletOptionItem } from './WalletOptionItem';

export function BatchCreateAccountButton({
  wallet,
}: {
  wallet: IDBWallet | undefined;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();

  return (
    <WalletOptionItem
      testID="AccountSelector-WalletOption-Backup"
      icon="Back10Outline"
      label={intl.formatMessage({ id: ETranslationsMock.batch_create_account })}
      onPress={() => {
        if (process.env.NODE_ENV !== 'production') {
          navigation.pushModal(EModalRoutes.AccountManagerStacks, {
            screen: EAccountManagerStacksRoutes.BatchCreateAccountForm,
            params: {
              walletId: wallet?.id || '',
            },
          });
        } else {
          Toast.error({
            title: 'Not implement yet',
          });
        }
      }}
    />
  );
}
