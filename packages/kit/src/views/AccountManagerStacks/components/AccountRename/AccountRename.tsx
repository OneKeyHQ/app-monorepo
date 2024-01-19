import { ActionList, ListItem } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { showRenameDialog } from '@onekeyhq/kit/src/components/RenameDialog';
import type {
  IDBAccount,
  IDBIndexedAccount,
} from '@onekeyhq/kit-bg/src/dbs/local/types';

export function AccountRenameButton({
  account,
  accounts,
}: {
  account: IDBIndexedAccount | IDBAccount;
  accounts: (IDBIndexedAccount | IDBAccount)[];
}) {
  const { serviceAccount } = backgroundApiProxy;
  return (
    <ActionList
      title={account.name}
      renderTrigger={<ListItem.IconButton icon="DotHorOutline" />}
      items={[
        {
          icon: 'PencilOutline',
          label: 'Rename',
          onPress: async () => {
            showRenameDialog(account.name, {
              onCheckRepeat: async (name) =>
                !!accounts.find((a) => a.name === name),
              onSubmit: async (name) => {
                if (account?.id && name) {
                  await serviceAccount.setAccountName({
                    indexedAccountId: account?.id,
                    name,
                  });
                }
              },
            });
          },
        },
      ]}
    />
  );
}
