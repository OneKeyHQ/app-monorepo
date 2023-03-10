import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { Image } from 'react-native';

import { Box, Button, Pressable, Typography } from '@onekeyhq/components';
import ScrollableButtonGroup from '@onekeyhq/components/src/ScrollableButtonGroup/ScrollableButtonGroup';
import ShortcutsTooltip from '@onekeyhq/components/src/ShortcutsTooltip';
import dAppFavicon from '@onekeyhq/kit/assets/dapp_favicon.png';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ExplorerShortcutEvents,
  getShortcutsMap,
} from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import { useAppSelector } from '../../../../hooks';
import {
  dAddNewBlankWebTab,
  dCloseWebTab,
  dSetCurrentWebTab,
} from '../explorerActions';

import type { WebTab } from '../../../../store/reducers/webTabs';
import type { LayoutChangeEvent } from 'react-native';
import type Animated from 'react-native-reanimated';

const shortcutsMap = getShortcutsMap(platformEnv.isDesktopMac);
const Tab: FC<
  WebTab & {
    onLayout?: (e: LayoutChangeEvent) => void;
  }
> = ({ isCurrent, id, title, onLayout, favicon }) => {
  const setCurrentTab = useCallback(() => {
    dSetCurrentWebTab(id);
  }, [id]);
  const closeTab = useCallback(() => {
    dCloseWebTab(id);
  }, [id]);
  return id === 'home' ? (
    <Button
      type="plain"
      w="52px"
      borderRadius={0}
      bg={isCurrent ? 'background-default' : 'background-hovered'}
      leftIconName="HomeMini"
      iconSize={16}
      iconColor={isCurrent ? 'icon-hovered' : 'icon-default'}
      onPress={setCurrentTab}
      borderRightColor="border-default"
      borderRightWidth="0.5px"
      onLayout={onLayout}
    />
  ) : (
    <Pressable
      _hover={{
        bg: isCurrent ? 'background-default' : 'action-secondary-hovered',
      }}
      borderRightColor="border-default"
      borderRightWidth="0.5px"
      px="12px"
      bg={isCurrent ? 'background-default' : 'background-hovered'}
      onPress={setCurrentTab}
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      onLayout={onLayout}
    >
      <Image
        style={{ width: 16, height: 16, marginRight: 8 }}
        source={{ uri: favicon }}
        defaultSource={dAppFavicon}
      />
      <Typography.Caption
        maxW="82px"
        mr="10px"
        isTruncated
        color={isCurrent ? 'text-default' : 'text-subdued'}
      >
        {title}
      </Typography.Caption>
      <ShortcutsTooltip
        desc={shortcutsMap[ExplorerShortcutEvents.CloseTab].desc}
        keys={shortcutsMap[ExplorerShortcutEvents.CloseTab].keys}
      >
        <Button
          size="xs"
          type="plain"
          iconSize={12}
          leftIconName="XMarkMini"
          onPress={closeTab}
        />
      </ShortcutsTooltip>
    </Pressable>
  );
};

const AddTabButton = () => (
  <ShortcutsTooltip
    desc={shortcutsMap[ExplorerShortcutEvents.NewTabAndFocus].desc}
    keys={shortcutsMap[ExplorerShortcutEvents.NewTabAndFocus].keys}
  >
    <Button
      flex={1}
      borderRadius={0}
      type="plain"
      leftIconName="PlusMini"
      onPress={dAddNewBlankWebTab}
    />
  </ShortcutsTooltip>
);

const TabBarDesktop: FC = () => {
  const tabs = useAppSelector((s) => s.webTabs.tabs);
  const tabsExceptHome = useMemo(() => tabs.slice(1), [tabs]);
  const ref = useRef<Animated.ScrollView>(null);
  useEffect(() => {
    setTimeout(() => ref.current?.scrollToEnd(), 50);
  }, [ref, tabs.length]);
  return (
    <Box flexDirection="row" w="100%" h="32px" alignItems="center">
      <Tab {...tabs[0]} />
      <Box flex={1} h="32px">
        <ScrollableButtonGroup
          ref={ref}
          style={{
            maxWidth: '100%',
            flexGrow: 0,
            height: 32,
          }}
          leftButtonProps={{
            borderRadius: null,
          }}
          rightButtonProps={{
            borderRadius: null,
          }}
        >
          {tabsExceptHome.map((tab) => (
            <Tab key={tab.id} {...tab} />
          ))}
          <AddTabButton />
        </ScrollableButtonGroup>
      </Box>
    </Box>
  );
};
TabBarDesktop.displayName = 'TabBarDesktop';

export default TabBarDesktop;
