import * as React from 'react';
import { useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { Dimensions } from 'react-native';

import { FlatList } from '@onekeyhq/components';

import { useHeaderHide } from '../components';

import AnnualPage1 from './Page1';
import AnnualPage2 from './Page2';
import AnnualPage3 from './Page3';
import AnnualPage4 from './Page4';
import AnnualPage5 from './Page5';
import AnnualPage6 from './Page6';
import AnnualPage7 from './Page7';

import type { HomeRoutes, HomeRoutesParams } from '../../../routes/types';
import type { RouteProp } from '@react-navigation/core';

type NavigationProps = RouteProp<HomeRoutesParams, HomeRoutes.AnnualReport>;

const AnnualReport = () => {
  useHeaderHide();
  const route = useRoute<NavigationProps>();
  const [height, setHeight] = useState(Dimensions.get('window').height);

  return (
    <FlatList
      pagingEnabled
      data={[
        AnnualPage1,
        AnnualPage2,
        AnnualPage3,
        AnnualPage4,
        AnnualPage5,
        AnnualPage6,
        AnnualPage7,
      ]}
      keyExtractor={(item) => String(item)}
      onLayout={(e) => {
        setHeight(e.nativeEvent.layout.height);
      }}
      renderItem={({ item }) =>
        React.createElement(item, { height, params: route.params })
      }
    />
  );
};

export default AnnualReport;
