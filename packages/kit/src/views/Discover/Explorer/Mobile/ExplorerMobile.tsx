import { FC, useCallback, useMemo } from 'react';

import { useFocusEffect } from '@react-navigation/native';
import { Freeze } from 'react-freeze';

import { Box } from '@onekeyhq/components';

import WebContent from '../Content/WebContent';
import { useWebController } from '../Controller/useWebController';
import { MatchDAppItemType, webHandler } from '../explorerUtils';

import WebContainer from './WebContainer';

const showExplorerBar = webHandler !== 'browser';

const ExplorerMobile: FC = () => {
  const {
    openMatchDApp,
    gotoSite,
    tabs,
    incomingUrl,
    clearIncomingUrl,
    goBack,
  } = useWebController();

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

  const explorerContent = useMemo(
    () =>
      tabs.map((tab) => (
        <Freeze key={`${tab.id}-Freeze`} freeze={!tab.isCurrent}>
          <WebContent {...tab} />
        </Freeze>
      )),
    [tabs],
  );

  return (
    <Box flex={1} bg="background-default">
      <WebContainer
        explorerContent={explorerContent}
        showExplorerBar={showExplorerBar}
        onSearchSubmitEditing={onSearchSubmitEditing}
        onGoBack={goBack}
      />
    </Box>
  );
};

export default ExplorerMobile;
