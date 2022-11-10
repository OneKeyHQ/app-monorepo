import { memo, useMemo } from 'react';

import { Freeze } from 'react-freeze';
import { View } from 'react-native';
import ViewShot from 'react-native-view-shot';

import { Box } from '@onekeyhq/components';

import { homeTab } from '../../../../store/reducers/webTabs';
import DiscoverHome from '../../Home';
import WebContent from '../Content/WebContent';
import { useNotifyChanges } from '../Controller/useNotifyChanges';
import { useWebController } from '../Controller/useWebController';
import { tabViewShotRef } from '../explorerAnimation';

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
    <ViewShot style={{ flex: 1 }} ref={tabViewShotRef}>
      {content}
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
    </ViewShot>
  );
});
WebTabFront.displayName = 'WebTabFront';
export default WebTabFront;
