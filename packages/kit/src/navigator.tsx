/* eslint-disable no-var,vars-on-top */
import React from 'react';

import { NavigationContainerRef } from '@react-navigation/native';

import RootStack from './routes/Root';
import { RootRoutesParams } from './routes/types';

export type RootNavContainerRef = NavigationContainerRef<RootRoutesParams>;
export const navigationRef = React.createRef<RootNavContainerRef>();

declare global {
  var $navigationRef: typeof navigationRef;
}

// update navigationRef.current at <NavigationContainer />
global.$navigationRef = navigationRef;

const Navigator = () => <RootStack />;

export default Navigator;
