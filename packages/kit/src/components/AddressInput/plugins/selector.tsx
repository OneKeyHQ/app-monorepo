import { type FC, useCallback, useContext, useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import { ActionList, IconButton } from '@onekeyhq/components';
import { useAccountSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorTrigger';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions';
import { useAddressBookPick } from '@onekeyhq/kit/src/views/AddressBook/hooks/useAddressBook';
import type { IAddressItem } from '@onekeyhq/kit/src/views/AddressBook/type';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EInputAddressChangeType } from '@onekeyhq/shared/types/address';

import { AddressInputContext } from '../AddressInputContext';

import type { IAddressPluginProps } from '../types';

type ISelectorPluginProps = IAddressPluginProps & {
  networkId?: string;
  accountId?: string;
  num?: number;
  onBeforeAccountSelectorOpen?: () => void;
  currentAddress?: string;
  clearNotMatch?: boolean;
};

const AddressBookPlugin: FC<ISelectorPluginProps> = ({
  onChange,
  onInputTypeChange,
  onExtraDataChange,
  networkId,
  testID,
  disabled,
}) => {
  const pick = useAddressBookPick();
  const onPickContacts = useCallback(() => {
    void pick({
      networkId,
      onPick: (item: IAddressItem) => {
        onChange?.(item.address);
        onInputTypeChange?.(EInputAddressChangeType.AddressBook);
        onExtraDataChange?.({
          memo: item.memo,
          note: item.note,
        });
      },
    });
  }, [pick, networkId, onChange, onInputTypeChange, onExtraDataChange]);
  const intl = useIntl();

  return (
    <ActionList
      disabled={disabled}
      title={intl.formatMessage({
        id: ETranslations.address_book_select_title,
      })}
      items={[
        {
          icon: 'ContactsOutline' as const,
          label: intl.formatMessage({ id: ETranslations.address_book_title }),
          onPress: onPickContacts,
        },
      ]}
      renderTrigger={
        <IconButton
          disabled={disabled}
          title={intl.formatMessage({
            id: ETranslations.send_to_contacts_tooltip,
          })}
          variant="tertiary"
          icon="DotVerOutline"
          testID={testID}
        />
      }
    />
  );
};

const AccountSelectorAddressBookPlugin: FC<ISelectorPluginProps> = ({
  onChange,
  onInputTypeChange,
  onExtraDataChange,
  networkId,
  accountId,
  testID,
  num,
  onBeforeAccountSelectorOpen,
  currentAddress,
  clearNotMatch,
  disabled,
}) => {
  const intl = useIntl();
  const accountSelectorNum = num ?? 0;
  const accountSelectorOpen = useRef<boolean>(false);
  const showAddressBook = useAddressBookPick();
  const actions = useAccountSelectorActions();
  const { hideNonBackedUpWallet } = useContext(AddressInputContext);
  const {
    activeAccount: { account },
    showAccountSelector,
  } = useAccountSelectorTrigger({
    num: accountSelectorNum,
    linkNetwork: true,
    hideNonBackedUpWallet,
  });

  useEffect(() => {
    if (account?.address && accountSelectorOpen.current) {
      onChange?.(account?.address);
      onInputTypeChange?.(EInputAddressChangeType.AccountSelector);
    }
  }, [account, onChange, onInputTypeChange, onExtraDataChange]);

  const onContacts = useCallback(() => {
    void showAddressBook({
      networkId,
      onPick: (item: IAddressItem) => {
        onChange?.(item.address);
        onInputTypeChange?.(EInputAddressChangeType.AddressBook);
        onExtraDataChange?.({
          memo: item.memo,
          note: item.note,
        });
      },
    });
  }, [
    showAddressBook,
    networkId,
    onChange,
    onInputTypeChange,
    onExtraDataChange,
  ]);

  const onShowAccountSelector = useCallback(async () => {
    accountSelectorOpen.current = true;
    let activeAccount = actions.current.getActiveAccount({
      num: accountSelectorNum,
    });
    if (clearNotMatch && activeAccount?.account?.address !== currentAddress) {
      await actions.current.clearSelectedAccount({
        num: accountSelectorNum,
        clearAccount: true,
      });
    }
    activeAccount = actions.current.getActiveAccount({
      num: accountSelectorNum,
    });
    let selectedAccount = actions.current.getSelectedAccount({
      num: accountSelectorNum,
    });
    if (!currentAddress || !activeAccount?.account?.address) {
      const focusedWalletId: string | undefined = accountId
        ? accountUtils.getWalletIdFromAccountId({
            accountId,
          })
        : undefined;
      if (focusedWalletId) {
        const updateFocusedWallet = async () =>
          actions.current.updateSelectedAccountFocusedWallet({
            num: accountSelectorNum,
            focusedWallet: focusedWalletId,
          });
        await updateFocusedWallet();
        activeAccount = actions.current.getActiveAccount({
          num: accountSelectorNum,
        });
        selectedAccount = actions.current.getSelectedAccount({
          num: accountSelectorNum,
        });
        console.log(activeAccount, selectedAccount);
        setTimeout(() => {
          void updateFocusedWallet();
        }, 0);
      }
    }
    onBeforeAccountSelectorOpen?.();
    showAccountSelector();
  }, [
    actions,
    accountSelectorNum,
    currentAddress,
    onBeforeAccountSelectorOpen,
    showAccountSelector,
    accountId,
    clearNotMatch,
  ]);

  return (
    <ActionList
      disabled={disabled}
      title={intl.formatMessage({
        id: ETranslations.send_to_contacts_selector_account_title,
      })}
      items={[
        {
          icon: 'WalletCryptoOutline' as const,
          label: intl.formatMessage({
            id: ETranslations.send_to_contacts_selector_account,
          }),
          onPress: onShowAccountSelector,
        },
        {
          icon: 'ContactsOutline' as const,
          label: intl.formatMessage({
            id: ETranslations.send_to_contacts_selector_address_book,
          }),
          onPress: onContacts,
        },
      ]}
      renderTrigger={
        <IconButton
          title={intl.formatMessage({
            id: ETranslations.send_to_contacts_tooltip,
          })}
          disabled={disabled}
          variant="tertiary"
          icon="PeopleCircleOutline"
          testID={testID}
        />
      }
    />
  );
};

export const SelectorPlugin: FC<ISelectorPluginProps> = ({
  onChange,
  onInputTypeChange,
  onExtraDataChange,
  networkId,
  accountId,
  testID,
  num,
  onBeforeAccountSelectorOpen,
  currentAddress,
  clearNotMatch,
  disabled,
}) => {
  if (num !== undefined) {
    return (
      <AccountSelectorAddressBookPlugin
        onChange={onChange}
        num={num}
        networkId={networkId}
        accountId={accountId}
        onBeforeAccountSelectorOpen={onBeforeAccountSelectorOpen}
        testID={testID}
        currentAddress={currentAddress}
        clearNotMatch={clearNotMatch}
        onInputTypeChange={onInputTypeChange}
        onExtraDataChange={onExtraDataChange}
        disabled={disabled}
      />
    );
  }
  return (
    <AddressBookPlugin
      onInputTypeChange={onInputTypeChange}
      onChange={onChange}
      networkId={networkId}
      testID={testID}
      disabled={disabled}
      onExtraDataChange={onExtraDataChange}
    />
  );
};
