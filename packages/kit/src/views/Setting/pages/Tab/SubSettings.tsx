import { memo } from 'react';

import { TabSubStackNavigator } from '@onekeyhq/components/src/layouts/Navigation/Navigator';

import { SearchViewPage } from './SearchView';
import { SubSettingsPage } from './SubSettingsPage';

import type { ISettingsConfig } from './config';

function BasicSubSettings({
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
export const SubSettings = memo(BasicSubSettings);

function BasicSubSearchSettings({ name }: { name: string }) {
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

export const SubSearchSettings = memo(BasicSubSearchSettings);
