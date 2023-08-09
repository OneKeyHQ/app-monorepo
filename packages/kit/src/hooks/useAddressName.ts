import { useMemo } from 'react';

import { selectContacts, selectRuntimeAccounts } from '../store/selectors';

import { useAppSelector } from './redux';

function useAddressName({ address }: { address?: string }): string | undefined {
  const contactsRecords = useAppSelector(selectContacts);
  const accounts = useAppSelector(selectRuntimeAccounts);
  return useMemo(() => {
    if (!address) {
      return;
    }
    for (let i = 0; i < accounts.length; i += 1) {
      const account = accounts[i];
      if (account.address === address) {
        return account.name;
      }
    }
    const contacts = Object.values(contactsRecords);
    for (let i = 0; i < contacts.length; i += 1) {
      const contact = contacts[i];
      if (contact.address === address) {
        return contact.name;
      }
    }
    return undefined;
  }, [address, contactsRecords, accounts]);
}

export { useAddressName };
