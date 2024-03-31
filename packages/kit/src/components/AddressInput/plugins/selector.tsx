import { type FC, useCallback, useEffect, useRef } from 'react';

import { ActionList, IconButton } from '@onekeyhq/components';
import { useAccountSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorTrigger';
import { useAddressBookPick } from '@onekeyhq/kit/src/views/AddressBook/hooks/useAddressBook';
import type { IAddressItem } from '@onekeyhq/kit/src/views/AddressBook/type';

import type { IAddressPluginProps } from '../types';

type ISelectorPluginProps = IAddressPluginProps & {
  networkId?: string;
  num?: number;
  onBeforeAccountSelectorOpen?: () => void;
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

  return (
    <ActionList
      title="Select Address"
      items={[
        {
          icon: 'ContactsOutline' as const,
          label: 'Address Book',
          onPress: onPickContacts,
        },
      ]}
      renderTrigger={
        <IconButton
          title="Paste"
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
}) => {
  const accountSelectorOpen = useRef<boolean>(false);
  const pick = useAddressBookPick();
  const {
    activeAccount: { account },
    showAccountSelector,
  } = useAccountSelectorTrigger({ num: num ?? 0, linkNetwork: true });

  useEffect(() => {
    if (account?.address && accountSelectorOpen.current) {
      onChange?.(account?.address);
    }
  }, [account, onChange]);

  const onPickContacts = useCallback(() => {
    void pick({
      networkId,
      onPick: (item: IAddressItem) => {
        onChange?.(item.address);
      },
    });
  }, [onChange, pick, networkId]);

  return (
    <ActionList
      title="Select"
      items={[
        {
          icon: 'WalletCryptoOutline' as const,
          label: 'My Accounts',
          onPress: () => {
            accountSelectorOpen.current = true;
            onBeforeAccountSelectorOpen?.();
            showAccountSelector();
          },
        },
        {
          icon: 'ContactsOutline' as const,
          label: 'Address Book',
          onPress: onPickContacts,
        },
      ]}
      renderTrigger={
        <IconButton
          title="Paste"
          variant="tertiary"
          icon="DotVerOutline"
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
}) => {
  if (num !== undefined) {
    return (
      <AccountSelectorAddressBookPlugin
        onChange={onChange}
        num={num}
        networkId={networkId}
        onBeforeAccountSelectorOpen={onBeforeAccountSelectorOpen}
        testID={testID}
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
