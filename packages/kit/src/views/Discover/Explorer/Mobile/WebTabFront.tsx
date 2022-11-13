import { memo, useMemo } from 'react';

import { Freeze } from 'react-freeze';
import { StyleSheet, View } from 'react-native';
import ViewShot from 'react-native-view-shot';

import { homeTab } from '../../../../store/reducers/webTabs';
import DiscoverHome from '../../Home';
import WebContent from '../Content/WebContent';
import { useNotifyChanges } from '../Controller/useNotifyChanges';
import { useWebController } from '../Controller/useWebController';
import { setThumbnailRatio, tabViewShotRef } from '../explorerAnimation';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

const WebTabFront = memo(() => {
  useNotifyChanges();
  const { tabs, currentTab, openMatchDApp } = useWebController();

  const showHome = currentTab.url === homeTab.url;
  const content = useMemo(
    () =>
      tabs.slice(1).map((tab) => (
        <Freeze key={tab.id} freeze={!tab.isCurrent}>
          <WebContent {...tab} />
        </Freeze>
      )),
    [tabs],
  );

  return (
    <ViewShot
      style={styles.container}
      ref={tabViewShotRef}
      onLayout={({
        nativeEvent: {
          layout: { width, height },
        },
      }) => {
        setThumbnailRatio(height / width);
      }}
    >
      {content}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            zIndex: showHome ? 1 : -1,
          },
        ]}
      >
        <DiscoverHome
          onItemSelect={(dapp) => {
            openMatchDApp({ id: dapp._id, dapp });
          }}
          onItemSelectHistory={openMatchDApp}
        />
      </View>
    </ViewShot>
  );
});
WebTabFront.displayName = 'WebTabFront';
export default WebTabFront;
