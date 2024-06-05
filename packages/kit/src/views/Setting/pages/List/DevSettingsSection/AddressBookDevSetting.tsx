import { useCallback } from 'react';

import { Dialog } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { SectionPressItem } from './SectionPressItem';

export const AddressBookDevSetting = () => {
  const onPress = useCallback(async () => {
    Dialog.show({
      title: 'Tamper Address Book',
      description:
        'This is a feature specific to development environments. Function used to simulate address data being tampered with',
      confirmButtonProps: {
        variant: 'destructive',
      },
      onConfirm: () => {
        void backgroundApiProxy.serviceAddressBook.__dangerTamperVerifyHashForTest();
      },
    });
  }, []);
  return (
    <SectionPressItem
      title="Hack Address Book"
      testID="temper-address-book"
      onPress={onPress}
    />
  );
};
