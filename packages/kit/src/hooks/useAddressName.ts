import { useMemo } from 'react';

import { useContacts } from '../views/AddressBook/hooks';

import { useAppSelector } from './redux';

function useAddressName({ address }: { address?: string }): string | undefined {
  const contactsRecords = useContacts();
  const accounts = useAppSelector((s) => s.runtime.accounts);
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
    for (let i = 0; i < contactsRecords.length; i += 1) {
      const contact = contactsRecords[i];
      if (contact.address === address) {
        return contact.name;
      }
    }
    return undefined;
  }, [address, contactsRecords, accounts]);
}

export { useAddressName };
