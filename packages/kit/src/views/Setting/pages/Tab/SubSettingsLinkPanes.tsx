import type { ComponentType } from 'react';
import { memo } from 'react';

import { useNavigationState } from '@react-navigation/native';

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
  const activeRouteName = useNavigationState(
    (state) => state.routes[state.index]?.name,
  );
  const { name } = route;
  // The settings tab navigator mounts every screen eagerly (`lazy: false`).
  // Link panes host full feature pages that fetch on mount, so mount them only
  // while their tab is selected — each visit re-mounts with fresh data. Key off
  // the tab navigator's own state, NOT `useIsFocused`: hierarchical focus also
  // drops when another modal covers the settings modal (or an iPad drill-down
  // pushes onto the outer settings stack), and unmounting there loses in-flight
  // state such as the connection pane's account-change observer.
  if (activeRouteName !== name) {
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
