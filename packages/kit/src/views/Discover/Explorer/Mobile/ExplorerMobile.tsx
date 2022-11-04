import { FC, useCallback, useState } from 'react';

import { useFocusEffect } from '@react-navigation/native';
import { Freeze } from 'react-freeze';

import { Box } from '@onekeyhq/components';

import { SingleWebContainer } from '../Content/WebContainer';
import { useWebController } from '../Controller/useWebController';
import { MatchDAppItemType } from '../explorerUtils';

import ExplorerBar from './ExplorerBarMobile';
import FloatingContainer from './FloatingContainer';

const ExplorerMobile: FC = () => {
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

  const onSearchSubmitEditing = (dapp: MatchDAppItemType | string) => {
    if (typeof dapp === 'string') {
      return gotoSite({ url: dapp });
    }
    openMatchDApp(dapp);
  };

  const [showHome, setShowHome] = useState(true);

  return (
    <Box flex={1} bg="background-default">
      <Freeze freeze={!showHome}>
        <ExplorerBar onSearchSubmitEditing={onSearchSubmitEditing} />
        <SingleWebContainer />
      </Freeze>
      <FloatingContainer
        onMaximize={() => setShowHome(false)}
        onMinimize={() => setShowHome(true)}
      />
    </Box>
  );
};

export default ExplorerMobile;
