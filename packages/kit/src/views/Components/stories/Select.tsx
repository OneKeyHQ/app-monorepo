import React from 'react';

import { Select, Center } from '@onekeyhq/components';

const SelectGallery = () => (
  <Center flex="1" bg="background-hovered">
    <Select>
      <Select.Item label="UX Research" value="ux" />
      <Select.Item label="Web Development" value="web" />
      <Select.Item label="Cross Platform Development" value="cross" />
      <Select.Item label="UI Designing" value="ui" />
      <Select.Item label="Backend Development" value="backend" />
    </Select>
  </Center>
);

export default SelectGallery;
