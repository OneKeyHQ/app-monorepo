import { useIsVerticalLayout } from '@onekeyhq/components';

import { HistoryRequest } from '../../../views/Help/Request/HistoryRequest';
import { ReplyTicket } from '../../../views/Help/Request/ReplyTicket';
import { SubmitRequest } from '../../../views/Help/Request/SubmitRequest';
import { TicketDetail } from '../../../views/Help/Request/TicketDetail';
import { HistoryRequestRoutes } from '../../../views/Help/Request/types';

import createStackNavigator from './createStackNavigator';

import type { HistoryRequestModalRoutesParams } from '../../../views/Help/Request/types';

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
