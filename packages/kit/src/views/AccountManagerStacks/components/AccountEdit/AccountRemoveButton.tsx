import { useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { ActionList, Dialog } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import type { IAccountSelectorContextData } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useAccountSelectorActions,
  useAccountSelectorContextData,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type {
  IDBAccount,
  IDBIndexedAccount,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

export function AccountRemoveDialog({
  indexedAccount,
  account,
  accountsCount,
}: {
  indexedAccount?: IDBIndexedAccount;
  account?: IDBAccount;
  accountsCount: number;
}) {
  const intl = useIntl();
  const actions = useAccountSelectorActions();
  const [loading, setLoading] = useState(false);
  return (
    <Dialog.Footer
      confirmButtonProps={{
        variant: 'destructive',
        loading,
      }}
      onConfirm={async ({ close }) => {
        try {
          setLoading(true);
          await actions.current.removeAccount({
            indexedAccount,
            account,
            isRemoveLastOthersAccount: accountsCount <= 1,
          });
          // Toast.success({
          //   title: intl.formatMessage({
          //     // TODO remove success not changed success
          //     id: ETranslations.feedback_change_saved,
          //   }),
          // });
        } finally {
          setLoading(false);
          await close();
        }
      }}
    />
  );
}

export function showAccountRemoveDialog({
  title,
  accountsCount,
  description,
  config,
  indexedAccount,
  account,
}: {
  title: string;
  description: string;
  accountsCount: number;
  indexedAccount?: IDBIndexedAccount;
  account?: IDBAccount;
  config: IAccountSelectorContextData | undefined;
}) {
  return Dialog.show({
    icon: 'ErrorOutline',
    tone: 'destructive',
    title,
    description,
    renderContent: config ? (
      <AccountSelectorProviderMirror enabledNum={[0]} config={config}>
        <AccountRemoveDialog
          accountsCount={accountsCount}
          account={account}
          indexedAccount={indexedAccount}
        />
      </AccountSelectorProviderMirror>
    ) : null,
  });
}

export function AccountRemoveButton({
  name,
  accountsCount,
  indexedAccount,
  account,
  onClose,
}: {
  name: string;
  accountsCount: number;
  indexedAccount?: IDBIndexedAccount;
  account?: IDBAccount;
  onClose: () => void;
}) {
  const intl = useIntl();
  const { config } = useAccountSelectorContextData();

  const desc = useMemo(() => {
    if (indexedAccount) {
      return intl.formatMessage({
        id: ETranslations.global_remove_account_desc,
      });
    }
    if (account) {
      const walletId = accountUtils.getWalletIdFromAccountId({
        accountId: account.id,
      });
      if (walletId && accountUtils.isImportedWallet({ walletId })) {
        return intl.formatMessage({
          id: ETranslations.remove_private_key_account_desc,
        });
      }
    }
    return intl.formatMessage({ id: ETranslations.remove_account_desc });
  }, [account, indexedAccount, intl]);

  return (
    <ActionList.Item
      icon="DeleteOutline"
      label={intl.formatMessage({ id: ETranslations.global_remove })}
      destructive
      onClose={onClose}
      onPress={async () => {
        showAccountRemoveDialog({
          accountsCount,
          config,
          title: intl.formatMessage(
            { id: ETranslations.global_remove_account_name },
            {
              account: name,
            },
          ),
          description: desc,
          account,
          indexedAccount,
        });
      }}
    />
  );
}
