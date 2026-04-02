import { useCallback, useMemo, useState } from 'react';

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
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

let shouldShowHdOrHwAccountRemoveDialog = true;

function useRemoveAccountFn() {
  const [loading, setLoading] = useState(false);
  const actions = useAccountSelectorActions();

  const removeFn = useCallback(
    async ({
      indexedAccount,
      account,
      accountsCount,
      closeDialog,
    }: {
      indexedAccount: IDBIndexedAccount | undefined;
      account: IDBAccount | undefined;
      accountsCount: number;
      closeDialog?: (extra?: { flag?: string }) => Promise<void> | void;
    }) => {
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
        await closeDialog?.();
      }
    },
    [actions],
  );
  return {
    loading,
    removeFn,
  };
}

export function AccountRemoveDialog({
  indexedAccount,
  account,
  accountsCount,
}: {
  indexedAccount?: IDBIndexedAccount;
  account?: IDBAccount;
  accountsCount: number;
}) {
  const { loading, removeFn } = useRemoveAccountFn();
  const intl = useIntl();
  return (
    <Dialog.Footer
      confirmButtonProps={{
        variant: indexedAccount && !account ? 'primary' : 'destructive',
        loading,
      }}
      onConfirmText={intl.formatMessage({
        id: ETranslations.global_remove,
      })}
      onConfirm={async ({ close }) => {
        await removeFn({
          indexedAccount,
          account,
          accountsCount,
          closeDialog: close,
        });
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
  if (indexedAccount && !account) {
    shouldShowHdOrHwAccountRemoveDialog = false;
  }

  return Dialog.show({
    icon: 'ErrorOutline',
    tone: indexedAccount && !account ? 'default' : 'destructive',
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

  const { loading, removeFn } = useRemoveAccountFn();

  const label = useMemo(() => {
    if (platformEnv.isWebDappMode) {
      return intl.formatMessage({ id: ETranslations.explore_disconnect });
    }
    return intl.formatMessage({ id: ETranslations.global_remove });
  }, [intl]);

  const icon = useMemo(() => {
    if (platformEnv.isWebDappMode) {
      return 'BrokenLink2Outline' as const;
    }
    return 'DeleteOutline' as const;
  }, []);

  return (
    <ActionList.Item
      icon={icon}
      label={label}
      destructive
      isLoading={loading}
      onClose={onClose}
      onPress={async () => {
        let shouldShowDialog = true;

        if (account && !indexedAccount) {
          if (
            accountUtils.isWatchingAccount({ accountId: account.id }) ||
            accountUtils.isExternalAccount({
              accountId: account.id,
            })
          ) {
            shouldShowDialog = false;
          }
        }

        if (indexedAccount && !account) {
          shouldShowDialog = shouldShowHdOrHwAccountRemoveDialog;
        }

        if (shouldShowDialog) {
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
        } else {
          await removeFn({
            account,
            indexedAccount,
            accountsCount,
            closeDialog: onClose,
          });
        }
      }}
    />
  );
}
