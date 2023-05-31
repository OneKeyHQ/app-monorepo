import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Image, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  scrollTo,
  useAnimatedRef,
  useAnimatedStyle,
  useDerivedValue,
} from 'react-native-reanimated';

import {
  Box,
  IconButton,
  NetImage,
  Pressable,
  Typography,
  useThemeValue,
} from '@onekeyhq/components';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';

import useBackHandler from '../../../../hooks/useBackHandler';
import { useWebTabs } from '../Controller/useWebTabs';
import { dCloseWebTab, dSetCurrentWebTab } from '../explorerActions';
import {
  MIN_OR_HIDE,
  WEB_TAB_CELL_GAP,
  hideTabGrid,
  showTabGridAnim,
  tabGridRefs,
  tabGridScrollY,
} from '../explorerAnimation';

import type { WebTab } from '../../../../store/reducers/webTabs';

const styles = StyleSheet.create({
  image: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    paddingVertical: WEB_TAB_CELL_GAP,
    paddingRight: WEB_TAB_CELL_GAP,
  },
});
const WebTabCard: FC<
  WebTab & {
    width: number;
  }
> = ({ width, isCurrent, title, favicon, id }) => {
  const [thumbnail, setThumbnail] = useState('');
  useEffect(() => {
    const updateThumbnail = (tabId: string, url: string) => {
      if (tabId === id) {
        setThumbnail(url);
      }
    };
    appUIEventBus.on(
      AppUIEventBusNames.WebTabThumbnailUpdated,
      updateThumbnail,
    );
    return () => {
      appUIEventBus.removeListener(
        AppUIEventBusNames.WebTabThumbnailUpdated,
        updateThumbnail,
      );
    };
  }, [id]);
  return (
    <Pressable
      w={width}
      h={width}
      borderRadius="12px"
      borderWidth="1px"
      borderColor={isCurrent ? 'interactive-default' : 'border-subdued'}
      overflow="hidden"
      ml={`${WEB_TAB_CELL_GAP}px`}
      mt={`${WEB_TAB_CELL_GAP}px`}
      onPress={() => {
        if (!isCurrent) {
          dSetCurrentWebTab(id);
        }
        hideTabGrid(id);
      }}
    >
      <Box
        flex={1}
        collapsable={false}
        ref={(ref) => {
          // @ts-ignore
          tabGridRefs[id] = ref;
        }}
      >
        <Box
          bg="surface-default"
          px="9px"
          h="32px"
          w="full"
          borderTopLeftRadius="12px"
          borderTopRightRadius="12px"
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <NetImage
            key={favicon}
            width="18px"
            height="18px"
            borderRadius="4px"
            src={favicon}
          />
          <Typography.CaptionStrong
            color="text-default"
            flex={1}
            textAlign="left"
            numberOfLines={1}
            mx="4px"
          >
            {title}
          </Typography.CaptionStrong>
          <IconButton
            size="sm"
            type="plain"
            name="XMarkMini"
            onPress={() => {
              dCloseWebTab(id);
            }}
          />
        </Box>
        {!!thumbnail && (
          <Image
            style={styles.image}
            resizeMode="cover"
            source={{ uri: thumbnail }}
          />
        )}
      </Box>
    </Pressable>
  );
};
const WebTabGrid = () => {
  const { tabs } = useWebTabs();
  const { width } = useWindowDimensions();
  const cellWidth = (width - WEB_TAB_CELL_GAP * 3) / 2;
  const listRef = useAnimatedRef<Animated.FlatList<WebTab>>();
  const [delayedRender, setDelayedRender] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setDelayedRender(true);
    }, 100);
  }, []);

  useBackHandler(
    useCallback(() => {
      if (showTabGridAnim.value !== MIN_OR_HIDE) {
        hideTabGrid();
        return true;
      }
      return false;
    }, []),
  );

  useDerivedValue(() => {
    scrollTo(listRef, 0, tabGridScrollY.value, true);
  }, []);

  const data = useMemo(() => tabs.slice(1), [tabs]);
  const renderItem = useCallback(
    ({ item: tab }: { item: WebTab }) => (
      <WebTabCard key={tab.id} {...tab} width={cellWidth} />
    ),
    [cellWidth],
  );
  const keyExtractor = useCallback((item: WebTab) => item.id, []);
  const backgroundColor = useThemeValue('background-default');
  const animStyle = useAnimatedStyle(() => ({
    opacity: showTabGridAnim.value,
  }));

  return delayedRender ? (
    <Animated.FlatList
      ref={listRef}
      style={[
        {
          ...StyleSheet.absoluteFillObject,
          backgroundColor,
        },
        animStyle,
      ]}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.contentContainer}
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
    />
  ) : null;
};
WebTabGrid.displayName = 'WebTabGrid';
export default WebTabGrid;
