import React, { FC } from 'react';

import { Box, ScrollView, useSafeAreaInsets } from '@onekeyhq/components';

const Overview: FC = () => {
  const inset = useSafeAreaInsets();
  return (
    <Box bg="background-default" flex="1">
      <ScrollView px="16px">
        <Box w="full" maxW={768} mx="auto" pb={inset.bottom} />
      </ScrollView>
    </Box>
  );
};

export default Overview;
