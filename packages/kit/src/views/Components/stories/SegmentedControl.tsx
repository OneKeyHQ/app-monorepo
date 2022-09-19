import React, { useState } from 'react';

import {
  Center,
  ScrollView,
  SegmentedControl,
  VStack,
} from '@onekeyhq/components';

const SegmentedControlGallery = () => {
  const [selectIndex, setSelectedIndex] = useState(0);
  return (
    <Center flex="1">
      <ScrollView
        horizontal
        w="248px"
        borderWidth={1}
        h={30}
        borderRadius="12px"
      >
        <SegmentedControl
          selectedIndex={selectIndex}
          onChange={setSelectedIndex}
          values={[
            'privatekey4243',
            'keystore',
            'privatekey',
            'keystore',
            'privatekey-----',
            'key',
            'privatekey',
            'keystore',
            'pr',
            'keystore',
          ]}
          tabStyle={{
            width: '120px',
          }}
        />
      </ScrollView>
    </Center>
  );
};

export default SegmentedControlGallery;
