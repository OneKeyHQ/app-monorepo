import { ActionList } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { showRenameDialog } from '@onekeyhq/kit/src/components/RenameDialog';
import type {
  IDBAccount,
  IDBIndexedAccount,
} from '@onekeyhq/kit-bg/src/dbs/local/types';

export function AccountRenameButton({
  name,
  indexedAccount,
  account,
  onClose,
}: {
  name: string;
  indexedAccount?: IDBIndexedAccount;
  account?: IDBAccount;
  onClose?: () => void;
}) {
  const { serviceAccount } = backgroundApiProxy;

  return (
    <ActionList.Item
      icon="PencilOutline"
      label="Rename"
      onClose={onClose}
      onPress={async () => {
        showRenameDialog(name, {
          onSubmit: async (newName) => {
            if (indexedAccount?.id && newName) {
              await serviceAccount.setAccountName({
                indexedAccountId: indexedAccount?.id,
                name: newName,
              });
            } else if (account?.id && newName) {
              await serviceAccount.setAccountName({
                accountId: account.id,
                name: newName,
              });
            }
          },
        });
      }}
    />
  );
}
