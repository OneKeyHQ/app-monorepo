import { FC, useCallback, useState } from 'react';

import { useFocusEffect } from '@react-navigation/native';
import { Freeze } from 'react-freeze';

import { Box, useSafeAreaInsets } from '@onekeyhq/components';

import { useNavigation } from '../../../../hooks';
import {
  DiscoverModalRoutes,
  DiscoverRoutesParams,
} from '../../../../routes/Modal/Discover';
import { ModalRoutes, RootRoutes } from '../../../../routes/routesEnum';
import { ModalScreenProps } from '../../../../routes/types';
import WebHomeContainer from '../Content/WebHomeContainer';
import { useWebController } from '../Controller/useWebController';
import { MatchDAppItemType } from '../explorerUtils';

import ExplorerBar from './ExplorerBarMobile';
import FloatingContainer from './FloatingContainer';

type NavigationProps = ModalScreenProps<DiscoverRoutesParams>;

const ExplorerMobile: FC = () => {
  const { top } = useSafeAreaInsets();
  const { openMatchDApp, gotoSite, incomingUrl, clearIncomingUrl } =
    useWebController();

  useFocusEffect(
    useCallback(() => {
      if (incomingUrl) {
        gotoSite({ url: incomingUrl, isNewWindow: true });
        clearIncomingUrl();
      }
    }, [clearIncomingUrl, gotoSite, incomingUrl]),
  );

  const navigation = useNavigation<NavigationProps['navigation']>();

  const onSearch = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Discover,
      params: {
        screen: DiscoverModalRoutes.SearchHistoryModal,
        params: {
          url: '',
          onSelectorItem: (item: MatchDAppItemType | string) => {
            if (typeof item === 'string') {
              return gotoSite({ url: item });
            }
            openMatchDApp(item);
          },
        },
      },
    });
  }, [gotoSite, navigation, openMatchDApp]);

  const [showHome, setShowHome] = useState(true);

  return (
    <Box flex={1} bg="background-default" mt={`${top}px`}>
      <Box flex={1} bg="background-default">
        <Freeze freeze={!showHome}>
          <ExplorerBar onSearch={onSearch} />
          <WebHomeContainer alwaysOpenNewWindow />
        </Freeze>
      </Box>
      <FloatingContainer
        onMaximize={() => setShowHome(false)}
        onMinimize={() => setShowHome(true)}
        onSearch={onSearch}
      />
    </Box>
  );
};

export default ExplorerMobile;
