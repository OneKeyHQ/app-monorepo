import { FC, ReactNode, useMemo } from 'react';

import { Image as NBImage } from 'native-base';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import {
  Box,
  IconButton,
  NetImage,
  Pressable,
  Typography,
  useThemeValue,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import {
  WebTab,
  closeWebTab,
  homeTab,
  setCurrentWebTab,
} from '../../../../store/reducers/webTabs';
import { useWebTabs } from '../Controller/useWebTabs';
import {
  MAX_OR_SHOW,
  hideTabGrid,
  showTabGridAnim,
} from '../explorerAnimation';

const CELL_GAP = 16;

const WebTabCard: FC<
  WebTab & {
    width: number;
  }
> = ({ width, isCurrent, title, favicon, id, thumbnail }) => (
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
        backgroundApiProxy.dispatch(setCurrentWebTab(id));
      }
      hideTabGrid();
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
        name="CloseSolid"
        onPress={() => {
          backgroundApiProxy.dispatch(closeWebTab(id));
        }}
      />
    </Box>
    <NBImage key={thumbnail} flex={1} resizeMode="cover" src={thumbnail} />
  </Pressable>
);
const WebTabGrid = () => {
  const tabs = useWebTabs();
  const { width } = useWindowDimensions();
  const cellWidth = (width - CELL_GAP * 3) / 2;

  const content = useMemo(() => {
    const cells: ReactNode[] = [];
    tabs.forEach((tab) => {
      if (tab.id === homeTab.id) {
        return;
      }
      if (tab.isCurrent) {
        cells.unshift(<WebTabCard key={tab.id} {...tab} width={cellWidth} />);
      } else {
        cells.push(<WebTabCard key={tab.id} {...tab} width={cellWidth} />);
      }
    });
    return cells;
  }, [cellWidth, tabs]);

  return (
    <Animated.ScrollView
      style={[
        {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: useThemeValue('background-default'),
        },
        useAnimatedStyle(() => ({
          zIndex: showTabGridAnim.value === MAX_OR_SHOW ? 1 : -1,
          opacity: showTabGridAnim.value,
        })),
      ]}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        flexGrow: 1,
        flexDirection: 'row',
        justifyContent: 'flex-start',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        paddingVertical: CELL_GAP,
        paddingRight: CELL_GAP,
      }}
    >
      {content}
    </Animated.ScrollView>
  );
};
WebTabGrid.displayName = 'WebTabGrid';
export default WebTabGrid;
