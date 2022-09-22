import React, { FC } from 'react';

import { Box, IconButton, Text } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { RootRoutes } from '../../../routes/routesEnum';

type HeaderProps = {
  title?: string;
};

const Header: FC<HeaderProps> = ({ title }) => {
  const navigation = useAppNavigation();

  return (
    <>
      <Box
        flexDirection="row"
        alignItems="center"
        pt={platformEnv.isNative ? 4 : 3}
        pr="15px"
        pb={platformEnv.isNative ? 4 : 2}
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
        <IconButton
          circle
          name="PlusSolid"
          onPress={() => {
            navigation.navigate(RootRoutes.Onboarding);
          }}
        />
      </Box>
    </>
  );
};

export default Header;
