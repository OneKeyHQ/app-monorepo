import React, { useState } from 'react';

import { Center, SegmentedControl, VStack } from '@onekeyhq/components';

const SegmentedControlGallery = () => {
  const [selectIndex, setSelectedIndex] = useState(0);
  return (
    <Center flex="1">
      <VStack space="2" w="248px">
        <SegmentedControl
          selectedIndex={selectIndex}
          onChange={setSelectedIndex}
          values={['private key', 'keystore']}
        />
      </VStack>
    </Center>
  );
};

export default SegmentedControlGallery;
