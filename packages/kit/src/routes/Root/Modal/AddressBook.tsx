import { useIsVerticalLayout } from '@onekeyhq/components';

import EditAddress from '../../../views/AddressBook/EditAddress';
import EnterAddress from '../../../views/AddressBook/EnterAddress';
import AddressBookModal from '../../../views/AddressBook/Listing';
import NewAddress from '../../../views/AddressBook/NewAddress';
import PickAddress from '../../../views/AddressBook/PickAddress';
import { AddressBookRoutes } from '../../../views/AddressBook/routes';

import createStackNavigator from './createStackNavigator';

import type { AddressBookRoutesParams } from '../../../views/AddressBook/routes';

const AddressBookNavigator = createStackNavigator<AddressBookRoutesParams>();

const modalRoutes = [
  {
    name: AddressBookRoutes.NewAddressRoute,
    component: NewAddress,
  },
  {
    name: AddressBookRoutes.PickAddressRoute,
    component: PickAddress,
  },
  {
    name: AddressBookRoutes.EditAddressRoute,
    component: EditAddress,
  },
  {
    name: AddressBookRoutes.EnterAddressRoute,
    component: EnterAddress,
  },
  {
    name: AddressBookRoutes.NewPickAddressRoute,
    component: AddressBookModal,
  },
];

const AddressBookModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <AddressBookNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <AddressBookNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </AddressBookNavigator.Navigator>
  );
};

export default AddressBookModalStack;
