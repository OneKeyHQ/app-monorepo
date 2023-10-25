import { memo, useMemo } from 'react';

import { Freeze } from 'react-freeze';
import { StyleSheet, View } from 'react-native';

import { Stack } from '@onekeyhq/components';

import { onItemSelect } from '../../Controller/gotoSite';
import { useWebTabs } from '../../Controller/useWebTabs';
import DiscoverDashboard from '../../Dashboard';
import WebContent from '../Content/WebContent';
import { homeTab } from '../Context/contextWebTabs';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  blankPage: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
});

function WebTabContainerCmp() {
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
    <Stack flex={1} zIndex={3}>
      {content}
      <Freeze freeze={!showHome}>
        <View style={styles.blankPage}>
          <DiscoverDashboard key="dashboard" onItemSelect={onItemSelect} />
        </View>
      </Freeze>
    </Stack>
  );
}

const WebTabContainer = memo(WebTabContainerCmp);
export default WebTabContainer;
