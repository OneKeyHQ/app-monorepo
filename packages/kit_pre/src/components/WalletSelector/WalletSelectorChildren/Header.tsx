import type { FC } from 'react';

import { Box, IconButton, Text } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useNavigationActions } from '../../../hooks';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { RootRoutes } from '../../../routes/routesEnum';
import { EOnboardingRoutes } from '../../../views/Onboarding/routes/enums';

type HeaderProps = {
  title?: string;
};

const Header: FC<HeaderProps> = ({ title }) => {
  const navigation = useAppNavigation();
  const { closeWalletSelector } = useNavigationActions();

  return (
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
      <IconButton
        circle
        name="PlusMini"
        onPress={() => {
          navigation.navigate(RootRoutes.Onboarding, {
            screen: EOnboardingRoutes.Welcome,
          });
          setTimeout(() => {
            closeWalletSelector();
          }, 300);
        }}
      />
    </Box>
  );
};

export default Header;
