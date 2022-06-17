import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';

import EditAddress from '../../views/AddressBook/EditAddress';
import EnterAddress from '../../views/AddressBook/EnterAddress';
import NewAddress from '../../views/AddressBook/NewAddress';
import PickAddress from '../../views/AddressBook/PickAddress';
import {
  AddressBookRoutes,
  AddressBookRoutesParams,
} from '../../views/AddressBook/routes';

import createStackNavigator from './createStackNavigator';

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
