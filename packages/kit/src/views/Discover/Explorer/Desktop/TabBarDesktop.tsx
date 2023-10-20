import { memo, useCallback, useMemo } from 'react';

import { Image } from 'react-native';

import { IconButton, Stack, Text } from '@onekeyhq/components';
// @ts-expect-error
import dAppFavicon from '@onekeyhq/kit/assets/dapp_favicon.png';
import { DebugRenderTracker } from '@onekeyhq/kit/src/components/DebugRenderTracker';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  addBlankWebTabAtomWithWriteOnly,
  atomWebTabs,
  atomWebTabsMap,
  closeWebTabAtomWithWriteOnly,
  setCurrentWebTabAtomWithWriteOnly,
  useAtomWebTabs,
} from '../Context/contextWebTabs';
import { dismissWebviewKeyboard } from '../../explorerUtils';

import type { WebTab } from '../Context/contextWebTabs';
import type { LayoutChangeEvent } from 'react-native';

function useTabActions({ id }: { id: string }) {
  const [, setCurrentWebTabAction] = useAtomWebTabs(
    setCurrentWebTabAtomWithWriteOnly,
  );
  const setCurrentTab = useCallback(() => {
    if (platformEnv.isNative) {
      dismissWebviewKeyboard();
    }
    setCurrentWebTabAction(id);
  }, [id, setCurrentWebTabAction]);

  const [, closeWebTab] = useAtomWebTabs(closeWebTabAtomWithWriteOnly);
  const closeTab = useCallback(() => {
    closeWebTab(id);
  }, [id, closeWebTab]);

  return {
    setCurrentTab,
    closeTab,
  };
}

function HomeTab({ id }: WebTab) {
  const [map] = useAtomWebTabs(atomWebTabsMap);
  const tab = map[id || ''];
  const { setCurrentTab } = useTabActions({ id: tab.id });
  const ButtonContent = useMemo(
    () => (
      <DebugRenderTracker>
        <IconButton
          variant="primary"
          borderRadius={0}
          bg={tab?.isCurrent ? '$bg' : '$bgHover'}
          icon="HomeRoofSolid"
          onPress={setCurrentTab}
        />
      </DebugRenderTracker>
    ),
    [tab.isCurrent, setCurrentTab],
  );
  return <>{ButtonContent}</>;
}

function StandardTab({
  id,
  onLayout,
}: WebTab & { onLayout?: (e: LayoutChangeEvent) => void }) {
  const [map] = useAtomWebTabs(atomWebTabsMap);
  const tab = map[id || ''];
  const { setCurrentTab, closeTab } = useTabActions({ id: tab.id });

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
          onPress={setCurrentTab}
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
              closeTab();
            }}
          />
        </Stack>
      </DebugRenderTracker>
    ),
    [tab.isCurrent, tab.title, tab.favicon, setCurrentTab, closeTab, onLayout],
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
  const [, addBlankWebTab] = useAtomWebTabs(addBlankWebTabAtomWithWriteOnly);
  return (
    <IconButton
      borderRadius={0}
      onPress={() => addBlankWebTab()}
      icon="PlusSmallOutline"
    />
  );
};

function TabBarDesktop() {
  const [webTabs] = useAtomWebTabs(atomWebTabs);
  console.log('tabs ===>: ', webTabs);
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
