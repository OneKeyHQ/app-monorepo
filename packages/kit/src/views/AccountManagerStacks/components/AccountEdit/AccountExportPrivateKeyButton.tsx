import { useIntl } from 'react-intl';

import { ActionList } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type {
  IDBAccount,
  IDBIndexedAccount,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EAccountManagerStacksRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../../../hooks/useAppNavigation';

export function AccountExportPrivateKeyButton({
  indexedAccount,
  account,
  onClose,
}: {
  indexedAccount?: IDBIndexedAccount;
  account?: IDBAccount;
  onClose?: () => void;
}) {
  const intl = useIntl();
  const { serviceAccount } = backgroundApiProxy;
  const navigation = useAppNavigation();

  return (
    <ActionList.Item
      icon="PencilOutline"
      label={intl.formatMessage({ id: ETranslations.global_private_key })}
      onClose={onClose}
      onPress={async () => {
        navigation.pushModal(EModalRoutes.AccountManagerStacks, {
          screen: EAccountManagerStacksRoutes.ExportPrivateKeysPage,
          params: {
            indexedAccount,
            account,
          },
        });
      }}
    />
  );
}
