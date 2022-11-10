import { FC, useMemo } from 'react';

import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import {
  Box,
  IconButton,
  Image,
  NetImage,
  Pressable,
  Typography,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import {
  WebTab,
  closeWebTab,
  setCurrentWebTab,
} from '../../../../store/reducers/webTabs';
import { useWebTabs } from '../Controller/useWebTabs';
import {
  MAX_OR_SHOW,
  showTabGrid,
  showTabGridAnim,
} from '../explorerAnimation';

const CELL_GAP = 16;

const WebTabCard: FC<
  WebTab & {
    width: number;
  }
> = ({ width, isCurrent, title, favicon, id }) => (
  <Pressable
    w={width}
    h={width}
    borderRadius="12px"
    borderWidth="1px"
    borderColor={isCurrent ? 'interactive-default' : 'border-subdued'}
    overflow="hidden"
    onPress={() => {
      if (!isCurrent) {
        backgroundApiProxy.dispatch(setCurrentWebTab(id));
      }
      showTabGrid();
    }}
  >
    <Box
      bg="surface-subdued"
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
        mx="4px"
      >
        {title}
      </Typography.CaptionStrong>
      <IconButton
        name="CloseSolid"
        onPress={() => {
          backgroundApiProxy.dispatch(closeWebTab(id));
        }}
      />
    </Box>
    {/* TODO thumbnail */}
    <Image />
  </Pressable>
);

const WebTabGrid = () => {
  const tabs = useWebTabs();
  const { width } = useWindowDimensions();
  const cellWidth = width - CELL_GAP * 3;

  const content = useMemo(() => {
    const cells = [];
    tabs.forEach((tab) => {
      if (tab.isCurrent) {
        cells.unshift(<WebTabCard key={tab.id} {...tab} width={cellWidth} />);
      } else {
        cells.push(<WebTabCard key={tab.id} {...tab} width={cellWidth} />);
      }
    });
  }, [cellWidth, tabs]);

  return (
    <Animated.ScrollView
      style={[
        StyleSheet.absoluteFill,
        useAnimatedStyle(() => ({
          zIndex: showTabGridAnim.value === MAX_OR_SHOW ? 1 : -1,
        })),
      ]}
      contentContainerStyle={{
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingRight: CELL_GAP,
      }}
    >
      {content}
    </Animated.ScrollView>
  );
};
WebTabGrid.displayName = 'WebTabGrid';
export default WebTabGrid;
