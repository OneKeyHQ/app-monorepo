import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { Image, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  scrollTo,
  useAnimatedRef,
  useAnimatedStyle,
  useDerivedValue,
} from 'react-native-reanimated';

import {
  Box,
  Center,
  IconButton,
  NetImage,
  Pressable,
  Typography,
  useThemeValue,
} from '@onekeyhq/components';

import useBackHandler from '../../../../hooks/useBackHandler';
import { webTabsActions } from '../../../../store/observable/webTabs';
import { useWebTabs } from '../Controller/useWebTabs';
import {
  MIN_OR_HIDE,
  WEB_TAB_CELL_GAP,
  hideTabGrid,
  showTabGridAnim,
  tabGridRefs,
  tabGridScrollY,
} from '../explorerAnimation';

import type { WebTab } from '../../../../store/observable/webTabs';

const styles = StyleSheet.create({
  image: {
    flex: 1,
  },
  contentContainer: {
    // flexGrow: 1,
    // flexDirection: 'row',
    // justifyContent: 'flex-start',
    // // flexWrap: 'wrap',
    // alignItems: 'flex-start',
    paddingVertical: WEB_TAB_CELL_GAP,
    // paddingRight: WEB_TAB_CELL_GAP,
  },
});

const ListHeaderComponent = ({ num }: { num: number }) => {
  const intl = useIntl();
  return (
    <Center>
      <Typography.Heading>
        {intl.formatMessage({ id: 'title__str_tabs' }, { '0': num })}
      </Typography.Heading>
    </Center>
  );
};

const WebTabCard: FC<WebTab> = ({ isCurrent, title, favicon, id, url }) => (
  <Pressable
    w="full"
    px="2"
    mt={`${WEB_TAB_CELL_GAP}px`}
    onPress={() => {
      if (!isCurrent) {
        webTabsActions.setCurrentWebTab(id);
      }
      hideTabGrid(id);
    }}
  >
    <Box
      w="full"
      py="2"
      bg="surface-default"
      borderRadius="12px"
      borderWidth="1px"
      borderColor={isCurrent ? 'interactive-default' : 'border-subdued'}
      overflow="hidden"
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
          px="2"
          w="full"
          borderTopLeftRadius="12px"
          borderTopRightRadius="12px"
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <NetImage
            key={favicon}
            width="40px"
            height="40px"
            borderRadius="12px"
            src={favicon}
          />
          <Box flex="1" ml="8px" mr="4px">
            <Typography.CaptionStrong
              color="text-default"
              flex={1}
              textAlign="left"
              numberOfLines={1}
            >
              {title || 'Unknown'}
            </Typography.CaptionStrong>
            <Typography.Body2 color="text-subdued">{url}</Typography.Body2>
          </Box>
          <IconButton
            size="sm"
            type="plain"
            name="XMarkMini"
            onPress={() => {
              webTabsActions.closeWebTab(id);
            }}
          />
        </Box>
      </Box>
    </Box>
  </Pressable>
);
const WebTabGrid = () => {
  const { tabs } = useWebTabs();
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
    ({ item: tab }: { item: WebTab }) => <WebTabCard {...tab} />,
    [],
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
      numColumns={1}
      ListHeaderComponent={<ListHeaderComponent num={data.length} />}
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
