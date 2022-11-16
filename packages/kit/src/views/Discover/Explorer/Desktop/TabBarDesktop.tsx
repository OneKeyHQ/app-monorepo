import { FC, useCallback, useEffect, useMemo } from 'react';

import { LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedRef } from 'react-native-reanimated';

import { Box, Button, Pressable, Typography } from '@onekeyhq/components';
import ScrollableButtonGroup from '@onekeyhq/components/src/ScrollableButtonGroup/ScrollableButtonGroup';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../../hooks';
import {
  WebTab,
  addWebTab,
  closeWebTab,
  homeTab,
  setCurrentWebTab,
} from '../../../../store/reducers/webTabs';

const Tab: FC<
  WebTab & {
    onLayout?: (e: LayoutChangeEvent) => void;
  }
> = ({ isCurrent, id, title, onLayout }) => {
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
    }),
  );
};

const AddTabButton: FC = () => (
  <Button
    flex={1}
    borderRadius={0}
    type="plain"
    leftIconName="PlusSolid"
    onPress={addNewTab}
  />
);

const TabBarDesktop: FC = () => {
  const { tabs } = useAppSelector((s) => s.webTabs);
  const tabsExceptHome = useMemo(() => tabs.slice(1), [tabs]);
  const ref = useAnimatedRef<Animated.ScrollView>();
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
