import type { FC } from 'react';
import { useEffect, useMemo, useState } from 'react';

import {
  BackHandler,
  Image,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import {
  Box,
  IconButton,
  NetImage,
  Pressable,
  Typography,
  useThemeValue,
} from '@onekeyhq/components';
import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { useWebTabs } from '../Controller/useWebTabs';
import { dCloseWebTab, dSetCurrentWebTab } from '../explorerActions';
import {
  MIN_OR_HIDE,
  hideTabGrid,
  showTabGridAnim,
  tabGridRefs,
} from '../explorerAnimation';

import type { WebTab } from '../../../../store/reducers/webTabs';

const CELL_GAP = 16;
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
    paddingVertical: CELL_GAP,
    paddingRight: CELL_GAP,
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
    appEventBus.on(AppEventBusNames.WebTabThumbnailUpdated, updateThumbnail);
    return () => {
      appEventBus.removeListener(
        AppEventBusNames.WebTabThumbnailUpdated,
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
      ml={`${CELL_GAP}px`}
      mt={`${CELL_GAP}px`}
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
  const cellWidth = (width - CELL_GAP * 3) / 2;

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (showTabGridAnim.value !== MIN_OR_HIDE) {
          hideTabGrid();
          return true;
        }
        return false;
      },
    );

    return () => subscription.remove();
  }, []);

  const content = useMemo(
    () =>
      tabs
        .slice(1)
        .map((tab) => <WebTabCard key={tab.id} {...tab} width={cellWidth} />),
    [cellWidth, tabs],
  );

  return (
    <Animated.ScrollView
      style={[
        {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: useThemeValue('background-default'),
        },
        useAnimatedStyle(() => ({
          opacity: showTabGridAnim.value,
        })),
      ]}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.contentContainer}
    >
      {content}
    </Animated.ScrollView>
  );
};
WebTabGrid.displayName = 'WebTabGrid';
export default WebTabGrid;
