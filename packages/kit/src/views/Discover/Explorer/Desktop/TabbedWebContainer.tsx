import { memo, useCallback } from 'react';

import { useFocusEffect } from '@react-navigation/native';
import { Freeze } from 'react-freeze';
import { StyleSheet, View } from 'react-native';

import { Box } from '@onekeyhq/components';

import { homeTab } from '../../../../store/reducers/webTabs';
import DiscoverHome from '../../Home';
import WebContent from '../Content/WebContent';
import { gotoSite, onItemSelect, openMatchDApp } from '../Controller/gotoSite';
import { useIncomingUrl } from '../Controller/useIncomingUrl';
import { useNotifyChanges } from '../Controller/useNotifyChanges';
import { useWebTabs } from '../Controller/useWebTabs';

const styles = StyleSheet.create({
  blankPage: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
});
const TabbedWebContainer = memo(() => {
  useNotifyChanges();
  const { tabs, tab } = useWebTabs();
  const { incomingUrl, clearIncomingUrl } = useIncomingUrl();

  const showHome = tab?.url === homeTab.url;
  useFocusEffect(
    useCallback(() => {
      if (incomingUrl) {
        gotoSite({ url: incomingUrl, isNewWindow: true, userTriggered: true });
        clearIncomingUrl();
      }
    }, [clearIncomingUrl, incomingUrl]),
  );

  return (
    <Box flex={1} zIndex={3}>
      {tabs.map((t) => (
        <Freeze key={t.id} freeze={!t.isCurrent}>
          <WebContent {...t} />
        </Freeze>
      ))}
      <Freeze freeze={!showHome}>
        <View style={styles.blankPage}>
          <DiscoverHome
            onItemSelect={onItemSelect}
            onItemSelectHistory={openMatchDApp}
          />
        </View>
      </Freeze>
    </Box>
  );
});
TabbedWebContainer.displayName = 'TabbedWebContainer';
export default TabbedWebContainer;
