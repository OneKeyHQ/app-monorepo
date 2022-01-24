import React from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import { HistoryRequest } from '@onekeyhq/kit/src/views/Help/Request/HistoryRequest';
import { TicketDetail } from '@onekeyhq/kit/src/views/Help/Request/TicketDetail';
import { TicketType } from '@onekeyhq/kit/src/views/Help/Request/types';

export enum HistoryRequestRoutes {
  HistoryRequestModal = 'HistoryRequestModal',
  TicketDetailModal = 'TicketDetailModal',
}

export type HistoryRequestModalRoutesParams = {
  [HistoryRequestRoutes.HistoryRequestModal]: undefined;
  [HistoryRequestRoutes.TicketDetailModal]: { order: TicketType };
};

const HistoryRequestNavigator =
  createStackNavigator<HistoryRequestModalRoutesParams>();

const modalRoutes = [
  {
    name: HistoryRequestRoutes.HistoryRequestModal,
    component: HistoryRequest,
  },
  {
    name: HistoryRequestRoutes.TicketDetailModal,
    component: TicketDetail,
  },
];

const HistoryRequestModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <HistoryRequestNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <HistoryRequestNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </HistoryRequestNavigator.Navigator>
  );
};

export default HistoryRequestModalStack;
