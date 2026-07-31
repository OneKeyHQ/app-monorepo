import type { ComponentType } from 'react';
import { memo } from 'react';

import { useIsFocused } from '@react-navigation/native';

import type { ITabSubNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import { TabSubStackNavigator } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';

import { BasicSubSettingsModalStack } from './basicSubSettingsModalStack';

import type { RouteProp } from '@react-navigation/native';

const NotificationsSettingsPage = LazyLoadPage(
  () => import('../Notifications/NotificationsSettings'),
  undefined,
  true,
);

const ConnectionListPage = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/DAppConnection/pages/ConnectionList'),
  undefined,
  true,
);

function LinkTabSubStack({
  route,
  component,
}: {
  route: RouteProp<any, any>;
  component: ComponentType<any>;
}) {
  const isFocused = useIsFocused();
  const { name } = route;
  // The settings tab navigator mounts every screen eagerly (`lazy: false`).
  // Link panes host full feature pages that fetch on mount, so keep them
  // mounted only while focused — each visit re-mounts with fresh data, which
  // matches the modal presentation these pages were written for.
  if (!isFocused) {
    return null;
  }
  return (
    <TabSubStackNavigator
      config={[
        {
          name,
          component,
        },
        ...(BasicSubSettingsModalStack as unknown as ITabSubNavigatorConfig<
          any,
          any
        >[]),
      ]}
    />
  );
}

function BasicSubNotificationsSettings({
  route,
}: {
  route: RouteProp<any, any>;
}) {
  return (
    <LinkTabSubStack route={route} component={NotificationsSettingsPage} />
  );
}

export const SubNotificationsSettings = memo(BasicSubNotificationsSettings);

function BasicSubConnectionsSettings({
  route,
}: {
  route: RouteProp<any, any>;
}) {
  return <LinkTabSubStack route={route} component={ConnectionListPage} />;
}

export const SubConnectionsSettings = memo(BasicSubConnectionsSettings);
