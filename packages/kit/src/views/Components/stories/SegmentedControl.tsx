import React from 'react';

import { Center, SegmentedControl, VStack } from '@onekeyhq/components';

const SegmentedControlGallery = () => (
  <Center flex="1">
    <VStack space="2" w="248px">
      <SegmentedControl
        containerProps={{
          width: 100,
        }}
        options={[
          { label: 'One', value: 'one' },
          { label: 'Two', value: 'two' },
        ]}
        defaultValue="one"
      />
      <SegmentedControl
        containerProps={{
          width: 100,
        }}
        options={[
          {
            iconName: 'EyeOffOutline',
            value: 'one',
          },
          {
            iconName: 'EyeOutline',
            value: 'two',
          },
        ]}
        defaultValue="one"
      />
      <SegmentedControl
        containerProps={{
          width: '100%',
        }}
        options={[
          { label: 'private key', value: 'one' },
          { label: 'keystore', value: 'two' },
        ]}
        defaultValue="one"
      />
    </VStack>
  </Center>
);

export default SegmentedControlGallery;
