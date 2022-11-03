import { FC, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { Box, IconButton, Pressable, Typography } from '@onekeyhq/components';
import useNavigation from '@onekeyhq/kit/src/hooks/useNavigation';
import {
  DiscoverModalRoutes,
  DiscoverRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/Discover';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';

import { homeTab } from '../../../../store/reducers/webTabs';
import { useWebTab } from '../Controller/useWebTabs';
import { ExplorerViewProps, MatchDAppItemType } from '../explorerUtils';
import { showWebMoreMenu } from '../MoreMenu';

import ExplorerBar from './ExplorerBarMobile';

type NavigationProps = ModalScreenProps<DiscoverRoutesParams>;

const Mobile: FC<ExplorerViewProps> = ({
  onSearchSubmitEditing,
  explorerContent,
}) => (
  <Box flex="1">
    <ExplorerBar onSearchSubmitEditing={onSearchSubmitEditing} />
    <Box flex={1}>{explorerContent}</Box>
  </Box>
);

export default Mobile;
