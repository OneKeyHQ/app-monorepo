import React, { FC } from 'react';

import { Box, IconButton } from '@onekeyhq/components/src';

export const DetailActions: FC = () => {
  console.log('333');
  return (
    <Box flex={1} flexDirection="row">
      <IconButton
        ml="4"
        size="base"
        name="StarSolid"
        iconSize={20}
        iconColor="icon-warning"
        onPress={() => {}}
      />
      <IconButton
        ml="4"
        size="base"
        name="BellSolid"
        iconSize={20}
        iconColor="icon-default"
        onPress={() => {}}
      />
      <IconButton
        ml="4"
        size="base"
        name="ShareSolid"
        iconSize={20}
        iconColor="icon-default"
        onPress={() => {}}
      />
    </Box>
  );
};
