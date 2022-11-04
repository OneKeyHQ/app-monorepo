import { FC } from 'react';

import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { Box, Icon, NetImage, Typography } from '@onekeyhq/components';

import { NetworkAccountSelectorTrigger } from '../../../../components/NetworkAccountSelector';
import { useWebTab } from '../Controller/useWebTabs';
import { FLOATINGWINDOW_MIN } from '../explorerUtils';

const InfoBar: FC<{
  leftImgSrc?: string;
  text?: string;
}> = ({ leftImgSrc, text }) => (
  <Box
    bg="surface-subdued"
    px="12px"
    py="8px"
    h="48px"
    w="full"
    borderTopLeftRadius="12px"
    borderTopRightRadius="12px"
    flexDirection="row"
    alignItems="center"
    justifyContent="space-between"
  >
    <NetImage width="30px" height="30px" borderRadius="6px" src={leftImgSrc} />
    <Typography.Body2Strong
      color="text-default"
      flex={1}
      textAlign="left"
      mx="8px"
    >
      {text}
    </Typography.Body2Strong>
    <Icon name="ExpandOutline" />
  </Box>
);

const AddressBar: FC = () => {
  const tab = useWebTab();
  return (
    <Box
      px="16px"
      py="7px"
      h="56px"
      w="full"
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
    >
      <Icon name="ChevronDownSolid" />
      <Box
        flex="1"
        bg="action-secondary-default"
        h="42px"
        borderRadius="12px"
        borderWidth="1px"
        borderColor="border-default"
        ml="12px"
        px="5px"
        py="5px"
        flexDirection="row"
        alignItems="center"
      >
        <Typography.Body1 mx="6px" flex="1" color="text-subdued">
          {tab?.url.replace(/^(?:https?:\/\/)?(?:www\.)?/i, '')}
        </Typography.Body1>
        <NetworkAccountSelectorTrigger size="sm" type="basic" />
      </Box>
    </Box>
  );
};

const FloatingBar: FC<{
  leftImgSrc?: string;
  text?: string;
  expandAnim: Animated.SharedValue<number>;
}> = ({ leftImgSrc, text, expandAnim }) => (
  <>
    <Animated.View
      style={useAnimatedStyle(
        () => ({
          display: expandAnim.value === FLOATINGWINDOW_MIN ? 'flex' : 'none',
        }),
        [],
      )}
    >
      <InfoBar leftImgSrc={leftImgSrc} text={text} />
    </Animated.View>
    <Animated.View
      style={useAnimatedStyle(
        () => ({
          display: expandAnim.value === FLOATINGWINDOW_MIN ? 'none' : 'flex',
        }),
        [],
      )}
    >
      <AddressBar />
    </Animated.View>
  </>
);
FloatingBar.displayName = 'FloatingBar';
export default FloatingBar;
