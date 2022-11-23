import { memo, useCallback, useMemo } from 'react';

import { Freeze } from 'react-freeze';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';
import ViewShot from 'react-native-view-shot';

import { homeTab } from '../../../../store/reducers/webTabs';
import DiscoverHome from '../../Home';
import WebContent from '../Content/WebContent';
import { openMatchDApp } from '../Controller/gotoSite';
import { useNotifyChanges } from '../Controller/useNotifyChanges';
import { useWebTabs } from '../Controller/useWebTabs';
import {
  setThumbnailRatio,
  showTabGridAnim,
  tabViewShotRef,
  targetPreviewHeight,
  targetPreviewWidth,
  targetPreviewX,
  targetPreviewY,
} from '../explorerAnimation';

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  const onLayout = useCallback(
    ({
      nativeEvent: {
        layout: { width, height },
      },
    }) => {
      setThumbnailRatio(height / width);
    },
    [],
  );

  return (
    <ViewShot style={styles.container} ref={tabViewShotRef} onLayout={onLayout}>
      {content}
      <View
        style={{
          ...StyleSheet.absoluteFillObject,
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
    </ViewShot>
  );
});
WebTabFront.displayName = 'WebTabFront';
export default WebTabFront;
