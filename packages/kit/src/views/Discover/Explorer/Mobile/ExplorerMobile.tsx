import type { FC } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { Freeze } from 'react-freeze';

import { Box, useSafeAreaInsets } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useNavigation } from '../../../../hooks';
import { useIsFocusedInTab } from '../../../../hooks/useIsFocusedInTab';
import {
  ModalRoutes,
  RootRoutes,
  TabRoutes,
} from '../../../../routes/routesEnum';
import { DiscoverModalRoutes } from '../../type';
import WebHomeContainer from '../Content/WebHomeContainer';
import { gotoSite, openMatchDApp } from '../Controller/gotoSite';
import { useIncomingUrl } from '../Controller/useIncomingUrl';
import { minimizeFloatingWindow } from '../explorerAnimation';

import ExplorerBar from './ExplorerBarMobile';
import FloatingContainer from './FloatingContainer';

import type { ModalScreenProps } from '../../../../routes/types';
import type { DiscoverRoutesParams } from '../../type';
import type { MatchDAppItemType } from '../explorerUtils';

type NavigationProps = ModalScreenProps<DiscoverRoutesParams>;

const showFloatingContainer = platformEnv.isNative;

const ExplorerMobile: FC = () => {
  const { top } = useSafeAreaInsets();
  const { handleIncomingUrl } = useIncomingUrl();
  const [showContent, setShowContent] = useState(false);
  const [showHome, setShowHome] = useState(true);
  const beforeMinimize = useCallback(() => setShowHome(true), []);
  const isFocusedInDiscoverTab = useIsFocusedInTab(TabRoutes.Discover);

  useEffect(() => {
    if (isFocusedInDiscoverTab) {
      if (showContent) {
        handleIncomingUrl();
      } else {
        setTimeout(() => {
          setShowContent(true);
          handleIncomingUrl();
        }, 100);
      }
    } else {
      minimizeFloatingWindow({ before: beforeMinimize });
    }
  }, [beforeMinimize, handleIncomingUrl, isFocusedInDiscoverTab, showContent]);

  const navigation = useNavigation<NavigationProps['navigation']>();

  const onSearch = useCallback(
    ({
      isNewWindow,
      defaultUrl,
    }: {
      isNewWindow: boolean;
      defaultUrl?: string;
    }) => {
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Discover,
        params: {
          screen: DiscoverModalRoutes.SearchHistoryModal,
          params: {
            url: defaultUrl,
            onSelectorItem: (item: MatchDAppItemType | string) => {
              if (typeof item === 'string') {
                return gotoSite({
                  url: item,
                  isNewWindow,
                  userTriggered: true,
                });
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
        <ExplorerBar
          onSearch={() => onSearch({ isNewWindow: true, defaultUrl: '' })}
        />
        <WebHomeContainer alwaysOpenNewWindow />
      </Freeze>
      {showContent && showFloatingContainer && (
        <FloatingContainer
          afterMaximize={() => setShowHome(false)}
          beforeMinimize={beforeMinimize}
          onSearch={() => onSearch({ isNewWindow: false })}
        />
      )}
    </Box>
  );
};

export default ExplorerMobile;
