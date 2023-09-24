import DemoCreateModalStack from './Modal/DemoCreateModal';
import DemoDoneModalStack from './Modal/DemoDoneModal';
import { DemoModalRoutes } from './Routes';

const modalStackScreenList = [
  {
    name: DemoModalRoutes.DemoCreateModal,
    component: DemoCreateModalStack,
  },
  {
    name: DemoModalRoutes.DemoDoneModal,
    component: DemoDoneModalStack,
  },
];
export default modalStackScreenList;
