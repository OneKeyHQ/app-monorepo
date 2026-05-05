import { useCallback } from 'react';

import { Dialog } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { TestAccountList } from './TestAccountList';

export function TestAccountsDevSetting() {
  const [devSettings] = useDevSettingsPersistAtom();
  const testAccounts = devSettings.settings?.testAccounts || [];

  const handlePress = useCallback(() => {
    Dialog.show({
      title: 'Test Accounts for OneKey ID',
      renderContent: <TestAccountList />,
      showFooter: false,
    });
  }, []);

  return (
    <ListItem
      icon="PeopleOutline"
      title="Test Accounts for OneKey ID"
      subtitle={`${testAccounts.length} accounts configured`}
      titleProps={{ color: '$textCritical' }}
      drillIn
      onPress={handlePress}
    />
  );
}
