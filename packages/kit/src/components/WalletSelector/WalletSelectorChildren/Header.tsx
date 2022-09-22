import React, { FC } from 'react';

import {
  Box,
  IconButton,
  Spinner,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import { useAppSelector } from '../../../hooks';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { RootRoutes } from '../../../routes/routesEnum';

type HeaderProps = {
  title?: string;
};

const Header: FC<HeaderProps> = ({ title }) => {
  const isVerticalLayout = useIsVerticalLayout();
  const navigation = useAppNavigation();
  const { isLoading } = useAppSelector((s) => s.accountSelector);

  return (
    <>
      <Box
        flexDirection="row"
        alignItems="center"
        pt={{ base: 4, sm: 3 }}
        pr="15px"
        pb={{ base: 4, sm: 2 }}
        pl={4}
      >
        <Text
          flex={1}
          typography={isVerticalLayout ? 'PageHeading' : 'Heading'}
          mr={3}
          isTruncated
        >
          {title}
        </Text>
        {isLoading ? (
          <Spinner size="lg" />
        ) : (
          <IconButton
            circle
            name="PlusSolid"
            onPress={() => {
              navigation.navigate(RootRoutes.Onboarding);
            }}
          />
        )}
      </Box>
    </>
  );
};

export default Header;
