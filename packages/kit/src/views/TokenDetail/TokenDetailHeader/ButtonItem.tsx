import { useMemo } from 'react';

import { TouchableWithoutFeedback, View } from 'react-native';

import type { ICON_NAMES } from '@onekeyhq/components';
import {
  Box,
  Icon,
  IconButton,
  Pressable,
  Typography,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { ThemeToken } from '@onekeyhq/components/src/Provider/theme';
import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Token as TokenType } from '@onekeyhq/engine/src/types/token';

import type { MessageDescriptor } from 'react-intl';

type ISingleChainInfo = {
  network: Network;
  account: Account;
  token: TokenType;
};
export type IButtonItem = {
  id: MessageDescriptor['id'];
  onPress: (params: ISingleChainInfo) => unknown;
  icon: ICON_NAMES;
  visible?: () => boolean;
};

export const ButtonItem = ({
  icon,
  text,
  onPress,
  isDisabled,
  color = 'icon-default',
}: {
  icon: ICON_NAMES;
  text: string;
  onPress?: () => unknown;
  isDisabled?: boolean;
  color?: ThemeToken;
}) => {
  const isVertical = useIsVerticalLayout();
  const content = useMemo(() => {
    let ele = (
      <VStack
        mx={isVertical ? 0 : 3}
        alignItems="center"
        justifyContent="center"
      >
        {typeof onPress === 'function' ? (
          <TouchableWithoutFeedback>
            <IconButton
              circle
              size={isVertical ? 'lg' : 'sm'}
              name={icon}
              type="basic"
              isDisabled={isDisabled}
              onPress={onPress}
              w={isVertical ? '42px' : '34px'}
              h={isVertical ? '42px' : '34px'}
              iconColor={color}
            />
          </TouchableWithoutFeedback>
        ) : (
          <Box
            p={isVertical ? 2 : 1.5}
            alignItems="center"
            justifyContent="center"
            borderWidth="1px"
            borderRadius="999px"
            borderColor="border-default"
            bg="action-secondary-default"
            w={isVertical ? '42px' : '34px'}
            h={isVertical ? '42px' : '34px'}
          >
            <Icon name={icon} size={isVertical ? 24 : 20} color={color} />
          </Box>
        )}
        <Typography.CaptionStrong
          textAlign="center"
          mt="8px"
          color={isDisabled ? 'text-disabled' : 'text-default'}
        >
          {text}
        </Typography.CaptionStrong>
      </VStack>
    );

    if (typeof onPress === 'function') {
      ele = (
        <Pressable
          style={{ flex: isVertical ? 1 : undefined }}
          onTouchStart={onPress}
        >
          {ele}
        </Pressable>
      );
    }

    return ele;
  }, [icon, isVertical, text, onPress, isDisabled, color]);

  return content;
};
