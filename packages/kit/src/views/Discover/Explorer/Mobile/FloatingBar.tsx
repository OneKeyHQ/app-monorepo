import { FC } from 'react';

import Animated, {
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';

import {
  Box,
  Icon,
  NetImage,
  Pressable,
  Typography,
} from '@onekeyhq/components';

import { NetworkAccountSelectorTrigger } from '../../../../components/NetworkAccountSelector';
import { useWebTab } from '../Controller/useWebTabs';
import { FLOATINGWINDOW_MIN } from '../explorerUtils';

const InfoBar: FC<{
  favicon?: string;
  text?: string;
}> = ({ favicon, text }) => (
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
    <NetImage width="30px" height="30px" borderRadius="6px" src={favicon} />
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

const AddressBar: FC<{ onSearch: () => void }> = ({ onSearch }) => {
  const tab = useWebTab();
  return (
    <Box
      px="16px"
      h="56px"
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
      pb="7px"
    >
      <Icon name="ChevronDownSolid" />
      <Pressable
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
        onPress={onSearch}
      >
        <Typography.Body1 mx="6px" flex="1" color="text-subdued">
          {tab?.url.replace(/^(?:https?:\/\/)?(?:www\.)?/i, '')}
        </Typography.Body1>
        <NetworkAccountSelectorTrigger size="sm" type="basic" />
      </Pressable>
    </Box>
  );
};

const FloatingBar: FC<{
  favicon?: string;
  text?: string;
  expandAnim: Animated.SharedValue<number>;
  onSearch: () => void;
}> = ({ favicon, text, expandAnim, onSearch }) => (
  <>
    <Animated.View
      style={useAnimatedStyle(
        () => ({
          opacity: interpolate(expandAnim.value, [0, 1], [1, 0]),
          display: expandAnim.value === FLOATINGWINDOW_MIN ? 'flex' : 'none',
        }),
        [],
      )}
    >
      <InfoBar favicon={favicon} text={text} />
    </Animated.View>
    <Animated.View
      style={useAnimatedStyle(
        () => ({
          opacity: expandAnim.value,
          display: expandAnim.value === FLOATINGWINDOW_MIN ? 'none' : 'flex',
        }),
        [],
      )}
    >
      <AddressBar onSearch={onSearch} />
    </Animated.View>
  </>
);
FloatingBar.displayName = 'FloatingBar';
export default FloatingBar;
