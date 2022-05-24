import React, { FC, useState } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';

import { ManageNetworkRoutes, ManageNetworkRoutesParams } from '../types';

import { ListView } from './ListView';
import { SortableView } from './SortableView';

type RouteProps = RouteProp<
  ManageNetworkRoutesParams,
  ManageNetworkRoutes.Listing
>;

export const Listing: FC = () => {
  const { onEdited } = useRoute<RouteProps>().params || {};
  const [editable, setEditable] = useState(false);
  return editable ? (
    <SortableView
      onPress={() => {
        onEdited?.();
        setEditable(false);
      }}
    />
  ) : (
    <ListView onPress={() => setEditable(true)} />
  );
};

export default Listing;
