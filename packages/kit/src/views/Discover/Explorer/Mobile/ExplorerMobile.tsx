import type { FC } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { Freeze } from 'react-freeze';

import { Box, useSafeAreaInsets } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useIsFocusedAllInOne } from '../../../../hooks/useIsFocusedAllInOne';
import { TabRoutes } from '../../../../routes/routesEnum';
import { useExplorerSearch } from '../../hooks/useExplorerSearch';
import WebHomeContainer from '../Content/WebHomeContainer';
import { useIncomingUrl } from '../Controller/useIncomingUrl';
import { minimizeFloatingWindow } from '../explorerAnimation';

import FloatingContainer from './FloatingContainer';

const showFloatingContainer = platformEnv.isNative;

const ExplorerMobile: FC = () => {
  const { top } = useSafeAreaInsets();
  const { handleIncomingUrl } = useIncomingUrl();
  const [showContent, setShowContent] = useState(false);
  const [showHome, setShowHome] = useState(true);
  const beforeMinimize = useCallback(() => setShowHome(true), []);
  const { isFocused, rootTabFocused } = useIsFocusedAllInOne({
    rootTabName: TabRoutes.Discover,
  });
  const isFocusedInDiscoverTab = isFocused || rootTabFocused;

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

  const onSearch = useExplorerSearch();

  return (
    <Box flex="1" bg="background-default" mt={`${top}px`}>
      <Freeze freeze={!showHome}>
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
