import { TabSubStackNavigator } from '@onekeyhq/components/src/layouts/Navigation/Navigator';

import { SearchViewPage } from './SearchView';
import { SubSettingsPage } from './SubSettingsPage';

import type { ISettingsConfig } from './config';

export function SubSettings({
  name,
  settingsConfig,
}: {
  name: string;
  settingsConfig: ISettingsConfig;
}) {
  return (
    <TabSubStackNavigator
      // eslint-disable-next-line react/no-unstable-nested-components
      config={[
        {
          name,
          // eslint-disable-next-line react/no-unstable-nested-components
          component: () => (
            <SubSettingsPage name={name} settingsConfig={settingsConfig} />
          ),
        },
      ]}
    />
  );
}

export function SubSearchSettings({ name }: { name: string }) {
  return (
    <TabSubStackNavigator
      config={[
        {
          name,
          // eslint-disable-next-line react/no-unstable-nested-components
          component: () => <SearchViewPage />,
        },
      ]}
    />
  );
}
