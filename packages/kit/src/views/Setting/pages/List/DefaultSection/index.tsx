import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAddressBookList } from '@onekeyhq/kit/src/views/AddressBook/hooks/useAddressBook';
import {
  useAddressBookPersistAtom,
  usePasswordPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

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
      testID="setting-address-book"
    />
  );
};

const LockNowButton = () => {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const [passwordSetting] = usePasswordPersistAtom();
  const onLock = useCallback(async () => {
    if (passwordSetting.isPasswordSet) {
      await backgroundApiProxy.servicePassword.lockApp();
    } else {
      await backgroundApiProxy.servicePassword.promptPasswordVerify();
      await backgroundApiProxy.servicePassword.lockApp();
    }
    navigation.popStack();
  }, [passwordSetting.isPasswordSet, navigation]);
  return (
    <ListItem
      icon="LockOutline"
      title={intl.formatMessage({ id: 'action__lock_now' })}
      onPress={onLock}
    />
  );
};

export const DefaultSection = () => (
  <YStack>
    <LockNowButton />
    <AddressBookItem />
    <ListItem
      icon="RepeatOutline"
      title="Migration"
      drillIn
      onPress={() => {}}
    />
    {platformEnv.isNative ? (
      <ListItem
        icon="OnekeyLiteOutline"
        title="OneKey Lite"
        drillIn
        onPress={() => {}}
      />): null}
      <ListItem
        icon="OnekeyKeytagOutline"
        title="OneKey KeyTag"
        drillIn
        onPress={() => {}}
      />
    </YStack>
  );
;
