import React from 'react';

import { Box, Button, Searchbar } from '@onekeyhq/components/src';

const MarketSearch = () => {
  console.log('MarketSearch');
  // tode search content
  return (
    <Box flexDirection="row">
      <Searchbar />
      <Button type="plain">Cancel</Button>
    </Box>
  );
};

export default MarketSearch;
