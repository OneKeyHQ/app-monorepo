import { memo, useMemo } from 'react';

import { Freeze } from 'react-freeze';
import { StyleSheet, View } from 'react-native';

import { homeTab } from '../../../../store/observable/webTabs';
import DiscoverHome from '../../Home';
import WebContent from '../Content/WebContent';
import { onItemSelect, openMatchDApp } from '../Controller/gotoSite';
import { useNotifyChanges } from '../Controller/useNotifyChanges';
import { useWebTabs } from '../Controller/useWebTabs';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  blankPage: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
});
const WebTabFront = memo(() => {
  useNotifyChanges();
  const { tabs, tab } = useWebTabs();

  const showHome = tab?.url === homeTab.url;
  const content = useMemo(
    () =>
      tabs.slice(1).map((t) => (
        <Freeze key={t.id} freeze={!t.isCurrent}>
          <WebContent {...t} />
        </Freeze>
      )),
    [tabs],
  );

  return (
    <View style={styles.container}>
      {content}
      <Freeze freeze={!showHome}>
        <View style={styles.blankPage}>
          <DiscoverHome
            onItemSelect={onItemSelect}
            onItemSelectHistory={openMatchDApp}
          />
        </View>
      </Freeze>
    </View>
  );
});
WebTabFront.displayName = 'WebTabFront';
export default WebTabFront;
