import { memo } from 'react';

import { Freeze } from 'react-freeze';
import { StyleSheet, View } from 'react-native';

import { Stack } from '@onekeyhq/components';

import DiscoverDashboard from '../../Dashboard';
import WebContent from '../Content/WebContent';
import {
  homeTab,
  useWebTabsActions,
  useWebTabsInfo,
} from '../Context/contextWebTabs';

import type { DAppItemType } from '../../types';

const styles = StyleSheet.create({
  blankPage: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
});

function TabbedWebContainerCmp() {
  const actions = useWebTabsActions();
  const { tabs, tab } = useWebTabsInfo();
  const showHome = tab?.url === homeTab.url;

  return (
    <Stack flex={1} zIndex={3}>
      {tabs.map((t) => (
        <Freeze key={t.id} freeze={!t.isCurrent}>
          <WebContent {...t} />
        </Freeze>
      ))}
      <Freeze freeze={!showHome}>
        <View style={styles.blankPage}>
          <DiscoverDashboard
            key="dashboard"
            onItemSelect={(dapp: DAppItemType) => {
              actions.openMatchDApp({ id: dapp._id, dapp });
            }}
          />
        </View>
      </Freeze>
    </Stack>
  );
}

const TabbedWebContainer = memo(TabbedWebContainerCmp);
export default TabbedWebContainer;
