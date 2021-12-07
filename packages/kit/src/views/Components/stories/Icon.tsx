import React from 'react';

import { Typography, Center, Icon, FlatList } from '@onekeyhq/components';
import Icons, { ICON_NAMES } from '@onekeyhq/components/src/Icon/Icons';

const IconGallery = () => (
  <FlatList
    data={Object.keys(Icons)}
    renderItem={({ item }) => (
      <Center p="4">
        <Icon name={item as ICON_NAMES} />
        <Typography.Body1>{item}</Typography.Body1>
      </Center>
    )}
    keyExtractor={(item) => item}
  />
);

export default IconGallery;
