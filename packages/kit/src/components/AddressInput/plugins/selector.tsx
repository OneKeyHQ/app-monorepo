import { type FC, useCallback, useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import { ActionList, IconButton } from '@onekeyhq/components';
import { useAccountSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorTrigger';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions';
import { useAddressBookPick } from '@onekeyhq/kit/src/views/AddressBook/hooks/useAddressBook';
import type { IAddressItem } from '@onekeyhq/kit/src/views/AddressBook/type';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IAddressPluginProps } from '../types';

type ISelectorPluginProps = IAddressPluginProps & {
  networkId?: string;
  num?: number;
  onBeforeAccountSelectorOpen?: () => void;
  currentAddress?: string;
};

const AddressBookPlugin: FC<ISelectorPluginProps> = ({
  onChange,
  networkId,
  testID,
}) => {
  const pick = useAddressBookPick();
  const onPickContacts = useCallback(() => {
    void pick({
      networkId,
      onPick: (item: IAddressItem) => {
        onChange?.(item.address);
      },
    });
  }, [onChange, pick, networkId]);
  const intl = useIntl();

  return (
    <ActionList
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
  networkId,
  testID,
  num,
  onBeforeAccountSelectorOpen,
  currentAddress,
}) => {
  const intl = useIntl();
  const accountSelectorNum = num ?? 0;
  const accountSelectorOpen = useRef<boolean>(false);
  const showAddressBook = useAddressBookPick();
  const actions = useAccountSelectorActions();
  const {
    activeAccount: { account },
    showAccountSelector,
  } = useAccountSelectorTrigger({ num: accountSelectorNum, linkNetwork: true });

  useEffect(() => {
    if (account?.address && accountSelectorOpen.current) {
      onChange?.(account?.address);
    }
  }, [account, onChange]);

  const onContacts = useCallback(() => {
    void showAddressBook({
      networkId,
      onPick: (item: IAddressItem) => {
        onChange?.(item.address);
      },
    });
  }, [onChange, showAddressBook, networkId]);

  const onShowAccountSelector = useCallback(async () => {
    accountSelectorOpen.current = true;
    const activeAccount = actions.current.getActiveAccount({
      num: accountSelectorNum,
    });
    if (activeAccount.account?.address !== currentAddress) {
      await actions.current.clearSelectedAccount({
        num: accountSelectorNum,
        clearAccount: true,
      });
    }
    onBeforeAccountSelectorOpen?.();
    showAccountSelector();
  }, [
    onBeforeAccountSelectorOpen,
    showAccountSelector,
    actions,
    accountSelectorNum,
    currentAddress,
  ]);

  return (
    <ActionList
      title={intl.formatMessage({
        id: ETranslations.send_to_contacts_selecor_account_title,
      })}
      items={[
        {
          icon: 'WalletCryptoOutline' as const,
          label: intl.formatMessage({
            id: ETranslations.send_to_contacts_selecor_account,
          }),
          onPress: onShowAccountSelector,
        },
        {
          icon: 'ContactsOutline' as const,
          label: intl.formatMessage({
            id: ETranslations.send_to_contacts_selecor_address_book,
          }),
          onPress: onContacts,
        },
      ]}
      renderTrigger={
        <IconButton
          title={intl.formatMessage({
            id: ETranslations.send_to_contacts_tooltip,
          })}
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
  networkId,
  testID,
  num,
  onBeforeAccountSelectorOpen,
  currentAddress,
}) => {
  if (num !== undefined) {
    return (
      <AccountSelectorAddressBookPlugin
        onChange={onChange}
        num={num}
        networkId={networkId}
        onBeforeAccountSelectorOpen={onBeforeAccountSelectorOpen}
        testID={testID}
        currentAddress={currentAddress}
      />
    );
  }
  return (
    <AddressBookPlugin
      onChange={onChange}
      networkId={networkId}
      testID={testID}
    />
  );
};
