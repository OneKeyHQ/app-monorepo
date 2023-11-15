import { StyleSheet } from 'react-native';

import { Button, Stack } from '@onekeyhq/components';

import { homeTab, useWebTabsActions } from '../Context/contextWebTabs';

const styles = StyleSheet.create({
  blankPage: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
});

function TabbedWebContainerCmp() {
  const actions = useWebTabsActions();
  const { tabs, tab } = actions.getWebTabs();
  const showHome = tab?.url === homeTab.url;

  return (
    <Stack flex={1} zIndex={3}>
      <Button>HI World</Button>
      {tabs.map((t) => {
        console.log(t);
        return <Button key={t.id}>Hello World::::{t.url}</Button>;
        // return <WebContent key={t.id} {...t} />;
        // return (
        //   <Freeze key={t.id} freeze={!t.isCurrent;}>
        //     <WebContent {...t} />
        //   </Freeze>
        // );
      })}
      {/* <Freeze freeze={!showHome}>
        <View style={styles.blankPage}>
          <DiscoverDashboard
            key="dashboard"
            onItemSelect={(dapp: DAppItemType) => {
              actions.openMatchDApp({ id: dapp._id, dapp });
            }}
          />
        </View>
      </Freeze> */}
    </Stack>
  );
}

// const TabbedWebContainer = memo(TabbedWebContainerCmp);
// export default TabbedWebContainer;
export default TabbedWebContainerCmp;
