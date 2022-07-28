import { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, IconButton, Typography } from '@onekeyhq/components';
import {
  HomeRoutes,
  HomeRoutesParams,
  ModalRoutes,
  RootRoutes,
  RootRoutesParams,
} from '@onekeyhq/kit/src/routes/types';
import { ManageTokenRoutes } from '@onekeyhq/kit/src/views/ManageTokens/types';

import { useNavigation } from '../../../hooks';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  RootRoutesParams,
  RootRoutes.Root
> &
  NativeStackNavigationProp<HomeRoutesParams, HomeRoutes.ScreenTokenDetail>;

const AssetsListHeader: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      pb={3}
    >
      <Typography.Heading>
        {intl.formatMessage({ id: 'asset__tokens' })}
      </Typography.Heading>
      <Box flexDirection="row">
        <IconButton
          onPress={() =>
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.ManageToken,
              params: { screen: ManageTokenRoutes.Listing },
            })
          }
          size="sm"
          name="CogSolid"
          type="plain"
          circle
        >
          <Typography.Button2>
            {intl.formatMessage({ id: 'title__settings' })}
          </Typography.Button2>
        </IconButton>
      </Box>
    </Box>
  );
};
AssetsListHeader.displayName = 'AssetsListHeader';

export default AssetsListHeader;
