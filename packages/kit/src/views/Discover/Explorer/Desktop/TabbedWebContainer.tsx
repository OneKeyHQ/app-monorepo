import { memo, useCallback } from 'react';

import { useFocusEffect } from '@react-navigation/native';
import { Freeze } from 'react-freeze';
import { View } from 'react-native';

import { Box } from '@onekeyhq/components';

import { homeTab } from '../../../../store/reducers/webTabs';
import DiscoverHome from '../../Home';
import WebContent from '../Content/WebContent';
import { useNotifyChanges } from '../Controller/useNotifyChanges';
import { useWebController } from '../Controller/useWebController';

const TabbedWebContainer = memo(() => {
  useNotifyChanges();
  const {
    gotoSite,
    tabs,
    incomingUrl,
    clearIncomingUrl,
    currentTab,
    openMatchDApp,
  } = useWebController();

  const showHome = currentTab.url === homeTab.url;
  useFocusEffect(
    useCallback(() => {
      if (incomingUrl) {
        gotoSite({ url: incomingUrl, isNewWindow: true });
        clearIncomingUrl();
      }
    }, [clearIncomingUrl, gotoSite, incomingUrl]),
  );

  return (
    <Box flex={1} zIndex={3}>
      {tabs.map((tab) => (
        <Freeze key={tab.id} freeze={!tab.isCurrent}>
          <WebContent {...tab} />
        </Freeze>
      ))}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          right: 0,
          zIndex: showHome ? 1 : -1,
        }}
      >
        <DiscoverHome
          onItemSelect={(dapp) => {
            openMatchDApp({ id: dapp._id, dapp });
          }}
          onItemSelectHistory={openMatchDApp}
        />
      </View>
    </Box>
  );
});
TabbedWebContainer.displayName = 'TabbedWebContainer';
export default TabbedWebContainer;
