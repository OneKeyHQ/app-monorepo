import { useState } from 'react';

import {
  ActionList,
  Dialog,
  Input,
  ListItem,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type {
  IDBAccount,
  IDBIndexedAccount,
} from '@onekeyhq/kit-bg/src/dbs/local/types';

function AccountRenameDialog({
  account,
}: {
  account: IDBIndexedAccount | IDBAccount;
}) {
  const { serviceAccount } = backgroundApiProxy;
  const media = useMedia();
  const [name, setName] = useState(account?.name || '');
  return (
    <>
      <Input
        value={name}
        onChangeText={setName}
        size={media.gtMd ? 'medium' : 'large'}
        autoFocus
      />
      <Dialog.Footer
        confirmButtonProps={{
          disabled: !name,
        }}
        onConfirm={async () => {
          if (account?.id && name) {
            await serviceAccount.setAccountName({
              indexedAccountId: account?.id,
              name,
            });
          }
        }}
      />
    </>
  );
}

export function AccountRenameButton({
  account,
}: {
  account: IDBIndexedAccount | IDBAccount;
}) {
  return (
    <ActionList
      title={account.name}
      renderTrigger={<ListItem.IconButton icon="DotHorOutline" />}
      items={[
        {
          icon: 'PencilOutline',
          label: 'Rename',
          onPress: () => {
            Dialog.show({
              title: 'Rename',
              renderContent: <AccountRenameDialog account={account} />,
            });
          },
        },
      ]}
    />
  );
}
