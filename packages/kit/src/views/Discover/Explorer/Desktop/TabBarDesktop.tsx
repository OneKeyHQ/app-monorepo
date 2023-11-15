import { memo, useMemo } from 'react';

import { Image } from 'react-native';

import { IconButton, Stack, Text } from '@onekeyhq/components';
// @ts-expect-error
import dAppFavicon from '@onekeyhq/kit/assets/dapp_favicon.png';
import { DebugRenderTracker } from '@onekeyhq/kit/src/components/DebugRenderTracker';

import {
  atomWebTabs,
  useAtomWebTabs,
  useWebTabsActions,
  useWebTabsMapAtom,
} from '../Context/contextWebTabs';

import type { WebTab } from '../Context/contextWebTabs';
import type { LayoutChangeEvent } from 'react-native';

function HomeTab({ id }: WebTab) {
  const actions = useWebTabsActions();
  // const [map] = useAtomWebTabs(atomWebTabsMap);
  const [map] = useWebTabsMapAtom();
  const tab = map[id || ''];
  const ButtonContent = useMemo(
    () => (
      <DebugRenderTracker>
        <IconButton
          variant="primary"
          borderRadius={0}
          bg={tab?.isCurrent ? '$bg' : '$bgHover'}
          icon="HomeRoofSolid"
          onPress={() => actions.setCurrentWebTab(tab.id)}
        />
      </DebugRenderTracker>
    ),
    [actions, tab.id, tab?.isCurrent],
  );
  return <>{ButtonContent}</>;
}

function StandardTab({
  id,
  onLayout,
}: WebTab & { onLayout?: (e: LayoutChangeEvent) => void }) {
  const actions = useWebTabsActions();
  const [map] = useWebTabsMapAtom();
  const tab = map[id || ''];

  const Content = useMemo(
    () => (
      <DebugRenderTracker>
        <Stack
          height="32px"
          hoverStyle={{
            bg: tab.isCurrent ? '$bg' : '$bgPrimaryHover',
          }}
          borderRightColor="$border"
          borderRightWidth="0.5px"
          px="$3"
          bg={tab.isCurrent ? '$bg' : '$bgHover'}
          onPress={() => actions.setCurrentWebTab(tab.id)}
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          onLayout={onLayout}
        >
          <Image
            style={{ width: 16, height: 16, marginRight: 8 }}
            source={{ uri: tab?.favicon }}
            defaultSource={dAppFavicon}
          />
          <Text
            maxWidth="82px"
            marginRight="10px"
            color={tab?.isCurrent ? '$text' : '$textSubdued'}
            variant="$bodySmMedium"
          >
            {tab?.title}
          </Text>
          <IconButton
            icon="CrossedSmallOutline"
            size="small"
            onPress={(e) => {
              e.stopPropagation();
              actions.closeWebTab(tab.id);
            }}
          />
        </Stack>
      </DebugRenderTracker>
    ),
    [tab.isCurrent, tab?.favicon, tab?.title, tab.id, onLayout, actions],
  );

  return <>{Content}</>;
}

function SelectedTabCmp({
  tab,
  onLayout,
}: {
  tab: WebTab;
  onLayout?: (e: LayoutChangeEvent) => void;
}) {
  if (tab.id === 'home') {
    return <HomeTab {...tab} />;
  }
  return <StandardTab {...tab} onLayout={onLayout} />;
}

const TabWithMemo = memo(SelectedTabCmp);

function Tab({
  tab,
  onLayout,
}: {
  tab: WebTab;
  onLayout?: (e: LayoutChangeEvent) => void;
}) {
  return (
    <DebugRenderTracker>
      <TabWithMemo tab={tab} onLayout={onLayout} />
    </DebugRenderTracker>
  );
}

const AddTabButton = () => {
  const actions = useWebTabsActions();
  return (
    <IconButton
      borderRadius={0}
      onPress={() => actions.addBlankWebTab()}
      icon="PlusSmallOutline"
    />
  );
};

function TabBarDesktop() {
  const [webTabs] = useAtomWebTabs(atomWebTabs);
  return (
    <Stack flexDirection="row" w="100%" h="$8" alignItems="center">
      {webTabs.tabs?.map((tab) => (
        <Tab key={tab.id} tab={tab} />
      ))}
      <AddTabButton />
    </Stack>
  );
}

export default TabBarDesktop;
