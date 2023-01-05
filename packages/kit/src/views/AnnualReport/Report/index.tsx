import * as React from 'react';
import { useState } from 'react';

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

const AnnualReport = () => {
  useHeaderHide();
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
      renderItem={({ item }) => React.createElement(item, { height })}
    />
  );
};

export default AnnualReport;
