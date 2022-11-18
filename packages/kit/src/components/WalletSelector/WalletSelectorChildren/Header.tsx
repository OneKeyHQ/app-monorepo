import React, { FC } from 'react';

import { Box, Text } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

type HeaderProps = {
  title?: string;
};

const Header: FC<HeaderProps> = ({ title }) => (
  <>
    <Box
      flexDirection="row"
      alignItems="center"
      py={platformEnv.isNative ? 4 : 3}
      pr="15px"
      pl={4}
    >
      <Text
        flex={1}
        typography={platformEnv.isNative ? 'PageHeading' : 'Heading'}
        mr={3}
        isTruncated
      >
        {title}
      </Text>
    </Box>
  </>
);

export default Header;
