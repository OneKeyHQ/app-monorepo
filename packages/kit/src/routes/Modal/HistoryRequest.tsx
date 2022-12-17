import { useIsVerticalLayout } from '@onekeyhq/components';
import { HistoryRequest } from '@onekeyhq/kit/src/views/Help/Request/HistoryRequest';
import { ReplyTicket } from '@onekeyhq/kit/src/views/Help/Request/ReplyTicket';
import { SubmitRequest } from '@onekeyhq/kit/src/views/Help/Request/SubmitRequest';
import { TicketDetail } from '@onekeyhq/kit/src/views/Help/Request/TicketDetail';
import type { HistoryRequestModalRoutesParams } from '@onekeyhq/kit/src/views/Help/Request/types';
import { HistoryRequestRoutes } from '@onekeyhq/kit/src/views/Help/Request/types';

import createStackNavigator from './createStackNavigator';

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
  {
    name: HistoryRequestRoutes.ReplyTicketModel,
    component: ReplyTicket,
  },
  {
    name: HistoryRequestRoutes.SubmitRequestModal,
    component: SubmitRequest,
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
