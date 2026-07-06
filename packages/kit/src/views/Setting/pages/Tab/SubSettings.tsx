import { memo } from 'react';

import type { ITabSubNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import { TabSubStackNavigator } from '@onekeyhq/components/src/layouts/Navigation/Navigator';

import { BasicSubSettingsModalStack } from './basicSubSettingsModalStack';
import { SearchViewPage } from './SearchView';
import { SubSettingsPage } from './SubSettingsPage';

import type { RouteProp } from '@react-navigation/native';

function BasicSubSettings({ route }: { route: RouteProp<any, any> }) {
  const { name } = route;
  return (
    <TabSubStackNavigator
      config={[
        {
          name,
          component: SubSettingsPage,
        },
        ...(BasicSubSettingsModalStack as unknown as ITabSubNavigatorConfig<
          any,
          any
        >[]),
      ]}
    />
  );
}
export const SubSettings = memo(BasicSubSettings);

function BasicSubSearchSettings({ route }: { route: RouteProp<any, any> }) {
  const { name } = route;
  return (
    <TabSubStackNavigator
      config={[
        {
          name,
          // eslint-disable-next-line react/no-unstable-nested-components
          component: SearchViewPage,
        },
        ...(BasicSubSettingsModalStack as unknown as ITabSubNavigatorConfig<
          any,
          any
        >[]),
      ]}
    />
  );
}

export const SubSearchSettings = memo(BasicSubSearchSettings);
