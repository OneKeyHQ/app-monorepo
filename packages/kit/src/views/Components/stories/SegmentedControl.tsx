import { useState } from 'react';

import { Center, SegmentedControl } from '@onekeyhq/components';

const SegmentedControlGallery = () => {
  const [selectIndex, setSelectedIndex] = useState(0);
  return (
    <Center flex="1">
      <SegmentedControl
        selectedIndex={selectIndex}
        onChange={setSelectedIndex}
        values={['private key', 'keystore']}
        tabStyle={{
          width: '120px',
        }}
      />
    </Center>
  );
};

export default SegmentedControlGallery;
