import { useIntl } from 'react-intl';

import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';
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
      label={intl.formatMessage({ id: ETranslations.global_bulk_add_accounts })}
      onPress={() => {
        navigation.pushModal(EModalRoutes.AccountManagerStacks, {
          screen: EAccountManagerStacksRoutes.BatchCreateAccountForm,
          params: {
            walletId: wallet?.id || '',
          },
        });
      }}
    />
  );
}
