import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { ActionList } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { showRenameDialog } from '@onekeyhq/kit/src/components/RenameDialog';
import type {
  IDBAccount,
  IDBIndexedAccount,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EChangeHistoryContentType,
  EChangeHistoryEntityType,
} from '@onekeyhq/shared/src/types/changeHistory';

import type { CompositeNavigationProp } from '@react-navigation/native';

export function AccountRenameButton({
  name,
  indexedAccount,
  account,
  onClose,
}: {
  name: string;
  indexedAccount?: IDBIndexedAccount;
  account?: IDBAccount;
  onClose: () => void;
}) {
  const intl = useIntl();
  const navigation = useNavigation<CompositeNavigationProp<any, any>>();
  const { serviceAccount } = backgroundApiProxy;

  return (
    <ActionList.Item
      icon="PencilOutline"
      label={intl.formatMessage({ id: ETranslations.global_rename })}
      onClose={onClose}
      onPress={async () => {
        showRenameDialog(name, {
          indexedAccount,
          nameHistoryInfo: {
            entityId: indexedAccount?.id || account?.id || '',
            entityType: indexedAccount?.id
              ? EChangeHistoryEntityType.IndexedAccount
              : EChangeHistoryEntityType.Account,
            contentType: EChangeHistoryContentType.Name,
          },
          onSubmit: async (newName) => {
            if (indexedAccount?.id && newName) {
              await serviceAccount.setAccountName({
                indexedAccountId: indexedAccount?.id,
                name: newName,
                shouldCheckDuplicate: true,
              });
            } else if (account?.id && newName) {
              await serviceAccount.setAccountName({
                accountId: account.id,
                name: newName,
                shouldCheckDuplicate: true,
              });
            }
          },
        });
      }}
    />
  );
}
