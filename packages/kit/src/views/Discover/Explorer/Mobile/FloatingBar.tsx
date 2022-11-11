import { FC } from 'react';

import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import {
  Box,
  Icon,
  NetImage,
  Pressable,
  Typography,
} from '@onekeyhq/components';

import { NetworkAccountSelectorTrigger } from '../../../../components/NetworkAccountSelector';
import { useWebTab } from '../Controller/useWebTabs';
import { MIN_OR_HIDE, expandAnim } from '../explorerAnimation';

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
    <NetImage
      key={favicon}
      width="30px"
      height="30px"
      borderRadius="6px"
      src={favicon}
    />
    <Typography.Body2Strong
      color="text-default"
      flex={1}
      textAlign="left"
      mx="8px"
      numberOfLines={1}
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
      bg="surface-subdued"
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
        <Typography.Body1
          mx="6px"
          flex="1"
          color="text-subdued"
          numberOfLines={1}
        >
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
  onSearch: () => void;
}> = ({ favicon, text, onSearch }) => (
  <>
    <Animated.View
      style={useAnimatedStyle(
        () => ({
          opacity: 1 - expandAnim.value,
          display: expandAnim.value === MIN_OR_HIDE ? 'flex' : 'none',
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
          display: expandAnim.value === MIN_OR_HIDE ? 'none' : 'flex',
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
