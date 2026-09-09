import { memo } from 'react';

import { TabSubStackNavigator } from '@onekeyhq/components/src/layouts/Navigation/Navigator';

import { SearchViewPage } from './SearchView';
import { SubSettingsPage } from './SubSettingsPage';
import { buildSubSettingsPaneStack } from './subSettingsStack';

import type { RouteProp } from '@react-navigation/native';

function BasicSubSettings({ route }: { route: RouteProp<any, any> }) {
  return (
    <TabSubStackNavigator
      config={buildSubSettingsPaneStack(route.name as string, SubSettingsPage)}
    />
  );
}
export const SubSettings = memo(BasicSubSettings);

function BasicSubSearchSettings({ route }: { route: RouteProp<any, any> }) {
  return (
    <TabSubStackNavigator
      config={buildSubSettingsPaneStack(route.name as string, SearchViewPage)}
    />
  );
}

export const SubSearchSettings = memo(BasicSubSearchSettings);
