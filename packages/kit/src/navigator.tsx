/* eslint-disable no-var,vars-on-top */
import React from 'react';

import { NavigationContainerRef } from '@react-navigation/native';

import useAutoRedirectToRoute from './hooks/useAutoRedirectToRoute';
import RootStack from './routes/Root';
import { RootRoutesParams } from './routes/types';

export type RootNavContainerRef = NavigationContainerRef<RootRoutesParams>;
export const navigationRef = React.createRef<RootNavContainerRef>();

declare global {
  var $navigationRef: typeof navigationRef;
}

global.$navigationRef = navigationRef;

const Navigator = () => {
  useAutoRedirectToRoute();
  return <RootStack />;
};

export default Navigator;
