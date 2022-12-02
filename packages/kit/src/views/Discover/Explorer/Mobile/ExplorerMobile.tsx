import { FC, useCallback, useState } from 'react';

import { useFocusEffect } from '@react-navigation/native';
import { Freeze } from 'react-freeze';

import { Box, useSafeAreaInsets } from '@onekeyhq/components';

import { useNavigation } from '../../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../../routes/routesEnum';
import { ModalScreenProps } from '../../../../routes/types';
import { DiscoverModalRoutes, DiscoverRoutesParams } from '../../type';
import WebHomeContainer from '../Content/WebHomeContainer';
import { gotoSite, openMatchDApp } from '../Controller/gotoSite';
import { useIncomingUrl } from '../Controller/useIncomingUrl';
import { minimizeFloatingWindow } from '../explorerAnimation';
import { MatchDAppItemType } from '../explorerUtils';

import ExplorerBar from './ExplorerBarMobile';
import FloatingContainer from './FloatingContainer';

type NavigationProps = ModalScreenProps<DiscoverRoutesParams>;

const ExplorerMobile: FC = () => {
  const { top } = useSafeAreaInsets();
  const { incomingUrl, clearIncomingUrl } = useIncomingUrl();
  const [showContent, setShowContent] = useState(false);
  const [showHome, setShowHome] = useState(true);
  const beforeMinimize = useCallback(() => setShowHome(true), []);

  useFocusEffect(
    useCallback(() => {
      if (incomingUrl) {
        gotoSite({ url: incomingUrl, isNewWindow: true });
        clearIncomingUrl();
      }
      if (!showContent) {
        setTimeout(() => {
          setShowContent(true);
        }, 100);
      }
      return () => {
        minimizeFloatingWindow({ before: beforeMinimize });
      };
    }, [beforeMinimize, clearIncomingUrl, incomingUrl, showContent]),
  );

  const navigation = useNavigation<NavigationProps['navigation']>();

  const onSearch = useCallback(
    (isNewWindow: boolean) => {
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Discover,
        params: {
          screen: DiscoverModalRoutes.SearchHistoryModal,
          params: {
            url: '',
            onSelectorItem: (item: MatchDAppItemType | string) => {
              if (typeof item === 'string') {
                return gotoSite({ url: item, isNewWindow });
              }
              openMatchDApp({ ...item, isNewWindow });
            },
          },
        },
      });
    },
    [navigation],
  );

  return (
    <Box flex={1} bg="background-default" mt={`${top}px`}>
      <Freeze freeze={!showHome}>
        <ExplorerBar onSearch={() => onSearch(true)} />
        <WebHomeContainer alwaysOpenNewWindow />
      </Freeze>
      {showContent && (
        <FloatingContainer
          afterMaximize={() => setShowHome(false)}
          beforeMinimize={beforeMinimize}
          onSearch={() => onSearch(false)}
        />
      )}
    </Box>
  );
};

export default ExplorerMobile;
