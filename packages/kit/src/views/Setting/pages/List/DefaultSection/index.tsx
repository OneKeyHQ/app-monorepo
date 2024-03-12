import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useAddressBookList } from '@onekeyhq/kit/src/views/AddressBook/hooks/useAddressBook';
import { useAddressBookPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

const AddressBookItem = () => {
  const pick = useAddressBookList();
  const intl = useIntl();
  const [{ updateTimestamp }] = useAddressBookPersistAtom();
  const onPress = useCallback(async () => {
    if (!updateTimestamp) {
      Dialog.show({
        title: 'Encrypted storage',
        icon: 'PlaceholderOutline',
        description:
          'All your address book data is encrypted with your login password. ',
        tone: 'default',
        showConfirmButton: true,
        showCancelButton: true,
        onConfirm: async (inst) => {
          await inst.close();
          await pick();
        },
        confirmButtonProps: {
          testID: 'encrypted-storage-confirm',
        },
      });
    } else {
      await pick();
    }
  }, [pick, updateTimestamp]);
  return (
    <ListItem
      icon="BookOpenOutline"
      title={intl.formatMessage({ id: 'title__address_book' })}
      drillIn
      onPress={onPress}
    />
  );
};

export const DefaultSection = () => {
  const intl = useIntl();
  return (
    <YStack>
      <ListItem
        icon="LockOutline"
        title={intl.formatMessage({ id: 'action__lock_now' })}
        onPress={() => backgroundApiProxy.servicePassword.lockApp()}
      />
      <AddressBookItem />
      <ListItem
        icon="RepeatOutline"
        title="Migration"
        drillIn
        onPress={() => {}}
      />
      <ListItem
        icon="OnekeyLiteIllus"
        title="OneKey Lite"
        drillIn
        onPress={() => {}}
      />
      <ListItem
        icon="OnekeyKeyTagIllus"
        title="OneKey KeyTag"
        drillIn
        onPress={() => {}}
      />
    </YStack>
  );
};
