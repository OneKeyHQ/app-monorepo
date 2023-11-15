import { memo, useMemo } from 'react';

import { Freeze } from 'react-freeze';
import { StyleSheet, View } from 'react-native';

import { Stack } from '@onekeyhq/components';

import DiscoverDashboard from '../../Dashboard';
import WebContent from '../Content/WebContent';
import {
  homeTab,
  useWebTabsActions,
  useWebTabsInfo,
  useWebTabsMapAtom,
} from '../Context/contextWebTabs';

import BrowserBottomBar from './BrowserBottomBar';

import type { DAppItemType } from '../../types';
import type { WebTab } from '../Context/contextWebTabs';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  blankPage: {
    ...StyleSheet.absoluteFillObject,
    bottom: 56,
    backgroundColor: '#ffffff',
    zIndex: 1,
  },
});

function WebContentWithFreeze({ tab }: { tab: WebTab }) {
  const [map] = useWebTabsMapAtom();
  const freshTab = map[tab.id || ''];
  const content = useMemo(
    () => (
      <Freeze key={tab.id} freeze={!freshTab.isCurrent}>
        <WebContent {...tab} />
        <BrowserBottomBar showHome={() => {}} />
      </Freeze>
    ),
    [freshTab.isCurrent, tab],
  );
  return <>{content}</>;
}

function WebTabContainerCmp() {
  const actions = useWebTabsActions();
  const { tabs, tab } = useWebTabsInfo();
  const showHome = tab?.url === homeTab.url;
  const content = useMemo(
    () => tabs.slice(1).map((t) => <WebContentWithFreeze tab={t} />),
    [tabs],
  );

  return (
    <Stack flex={1} zIndex={3}>
      {content}
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

const WebTabContainer = memo(WebTabContainerCmp);
export default WebTabContainer;
