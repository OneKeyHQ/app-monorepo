/* eslint-disable no-nested-ternary */
import { FC } from 'react';

import { IMenuItemProps, Menu } from 'native-base';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import HStack from '../HStack';
import Icon, { ICON_NAMES } from '../Icon';
import { Text } from '../Typography';

interface CustomItemProps extends IMenuItemProps {
  icon?: ICON_NAMES;
  variant?: 'desctructive' | 'highlight';
  isDisabled?: boolean;
}

const CustomItem: FC<CustomItemProps> = ({
  children,
  variant,
  isDisabled,
  icon,
  ...rest
}) => (
  <Menu.Item isDisabled={isDisabled} {...rest}>
    <HStack flex={1} alignItems="center" space={3}>
      <Text
        flex={1}
        typography={platformEnv.isNative ? 'Body1' : 'Body2'}
        color={
          variant === 'desctructive'
            ? 'text-critical'
            : variant === 'highlight'
            ? 'interactive-default'
            : isDisabled
            ? 'text-disabled'
            : 'text-default'
        }
      >
        {children}
      </Text>
      {icon ? (
        <Icon
          name={icon}
          size={20}
          color={
            variant === 'desctructive'
              ? 'icon-critical'
              : variant === 'highlight'
              ? 'interactive-default'
              : isDisabled
              ? 'icon-disabled'
              : 'icon-default'
          }
        />
      ) : null}
    </HStack>
  </Menu.Item>
);

export default CustomItem;
