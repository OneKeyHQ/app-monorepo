import { FC, useCallback, useEffect, useMemo, useRef } from 'react';

import { nanoid } from '@reduxjs/toolkit';
import { ScrollView } from 'react-native';

import { Box, Button, Pressable, Typography } from '@onekeyhq/components';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../../hooks';
import {
  WebTab,
  addWebTab,
  closeWebTab,
  homeTab,
  setCurrentWebTab,
} from '../../../../store/reducers/webTabs';

const Tab: FC<WebTab> = ({ isCurrent, id, title }) => {
  const { dispatch } = backgroundApiProxy;
  const setCurrentTab = useCallback(() => {
    dispatch(setCurrentWebTab(id));
  }, [dispatch, id]);
  const closeTab = useCallback(() => {
    dispatch(closeWebTab(id));
  }, [dispatch, id]);
  return id === 'home' ? (
    <Button
      type="plain"
      w="52px"
      borderRadius={0}
      bg={isCurrent ? 'background-default' : 'background-hovered'}
      leftIconName="HomeSolid"
      iconSize={16}
      iconColor={isCurrent ? 'icon-hovered' : 'icon-default'}
      onPress={setCurrentTab}
      borderRightColor="border-default"
      borderRightWidth="0.5px"
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
    >
      <Typography.Caption
        maxW="82px"
        mr="10px"
        isTruncated
        color={isCurrent ? 'text-default' : 'text-subdued'}
      >
        {title}
      </Typography.Caption>
      <Button
        size="xs"
        type="plain"
        iconSize={12}
        leftIconName="CloseSolid"
        onPress={closeTab}
      />
    </Pressable>
  );
};

const addNewTab = () => {
  const { dispatch } = backgroundApiProxy;
  dispatch(
    addWebTab({
      ...homeTab,
      id: nanoid(),
    }),
  );
};

const AddTabButton: FC = () => (
  <Button
    borderRadius={0}
    type="plain"
    leftIconName="PlusSolid"
    onPress={addNewTab}
  />
);

const TabBarDesktop: FC = () => {
  const { tabs } = useAppSelector((s) => s.webTabs);
  const tabsExceptHome = useMemo(() => tabs.slice(1), [tabs]);
  const scrollRef = useRef<ScrollView>(null);
  const lastTabsLength = useRef<number>(tabs.length);
  useEffect(() => {
    if (tabs.length > lastTabsLength.current) {
      setTimeout(() => scrollRef.current?.scrollToEnd(), 30);
    }
    lastTabsLength.current = tabs.length;
  }, [tabs.length]);
  return (
    <Box flexDirection="row" w="100%" h="32px" alignItems="center">
      <Tab {...tabs[0]} />
      <ScrollView
        ref={scrollRef}
        style={{
          maxWidth: '100%',
          flexGrow: 0,
          height: 32,
        }}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {tabsExceptHome.map((tab) => (
          <Tab key={tab.id} {...tab} />
        ))}
      </ScrollView>
      <AddTabButton />
    </Box>
  );
};
TabBarDesktop.displayName = 'TabBarDesktop';

export default TabBarDesktop;
