import { useState } from 'react';

import {
  ActionList,
  Dialog,
  Input,
  ListItem,
  useMedia,
} from '@onekeyhq/components';
import type { IDBIndexedAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

function AccountRenameDialog({
  indexedAccount,
}: {
  indexedAccount: IDBIndexedAccount;
}) {
  const { serviceAccount } = backgroundApiProxy;
  const media = useMedia();
  const [name, setName] = useState(indexedAccount?.name || '');
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
          if (indexedAccount?.id && name) {
            await serviceAccount.setAccountName({
              indexedAccountId: indexedAccount?.id,
              name,
            });
          }
        }}
      />
    </>
  );
}

export function AccountRenameButton({
  indexedAccount,
}: {
  indexedAccount: IDBIndexedAccount;
}) {
  return (
    <ActionList
      title={indexedAccount.name}
      renderTrigger={<ListItem.IconButton icon="DotHorOutline" />}
      items={[
        {
          icon: 'PencilOutline',
          label: 'Rename',
          onPress: () => {
            Dialog.show({
              title: 'Rename',
              renderContent: (
                <AccountRenameDialog indexedAccount={indexedAccount} />
              ),
            });
          },
        },
      ]}
    />
  );
}
