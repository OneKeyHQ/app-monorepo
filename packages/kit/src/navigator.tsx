import React from 'react';

import useAutoRedirectToRoute from './hooks/useAutoRedirectToRoute';
import RootStack from './routes/Root';

const Navigator = () => {
  useAutoRedirectToRoute();
  return <RootStack />;
};

export default Navigator;
