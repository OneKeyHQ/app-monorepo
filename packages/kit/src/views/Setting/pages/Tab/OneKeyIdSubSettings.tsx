import { memo } from 'react';

import type { ITabSubNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import { TabSubStackNavigator } from '@onekeyhq/components/src/layouts/Navigation/Navigator';

import { OneKeyIdSettingsPage } from '../OneKeyId';

import { BasicSubSettingsModalStack } from './basicSubSettingsModalStack';

import type { RouteProp } from '@react-navigation/native';

function BasicOneKeyIdSubSettings({ route }: { route: RouteProp<any, any> }) {
  const { name } = route;
  return (
    <TabSubStackNavigator
      config={[
        {
          name,
          component: OneKeyIdSettingsPage,
        },
        ...(BasicSubSettingsModalStack as unknown as ITabSubNavigatorConfig<
          any,
          any
        >[]),
      ]}
    />
  );
}

export const OneKeyIdSubSettings = memo(BasicOneKeyIdSubSettings);
