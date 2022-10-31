import React from 'react';

import { SafeAreaView } from 'moti';

import { Box, Text, useIsVerticalLayout } from '@onekeyhq/components';

const Header = () => {
  const isSmallScreen = useIsVerticalLayout();

  return (
    <SafeAreaView>
      <Box
        width="full"
        height="44px"
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        paddingX={isSmallScreen ? '12px' : 0}
      >
        <Text typography={{ sm: 'Heading', md: 'PageHeading' }}>NFT</Text>
        {/* <IconButton type="basic" size="sm" name="SearchSolid" circle /> */}
      </Box>
    </SafeAreaView>
  );
};

export default Header;
