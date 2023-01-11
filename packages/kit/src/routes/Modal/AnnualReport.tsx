import { useIsVerticalLayout } from '@onekeyhq/components';

import ShareModal from '../../views/AnnualReport/ShareModal';
import { AnnualReportModal } from '../../views/AnnualReport/types';

import createStackNavigator from './createStackNavigator';

import type { AnnualReportModalParams } from '../../views/AnnualReport/types';

const AnnualModalNavigator = createStackNavigator<AnnualReportModalParams>();

const modalRoutes = [
  {
    name: AnnualReportModal.ShareModal,
    component: ShareModal,
  },
];

const AnnualModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <AnnualModalNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <AnnualModalNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </AnnualModalNavigator.Navigator>
  );
};

export default AnnualModalStack;
export { AnnualReportModal };
export type { AnnualReportModalParams };
