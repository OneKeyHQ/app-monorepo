import { TabSubStackNavigator } from '@onekeyhq/components/src/layouts/Navigation/Navigator';

import { SubSettingsPage } from './SettingListSubModal';

export function SubSettings({ name }: { name: string }) {
  return (
    <TabSubStackNavigator
      // eslint-disable-next-line react/no-unstable-nested-components
      config={[{ name, component: () => <SubSettingsPage name={name} /> }]}
    />
  );
}
