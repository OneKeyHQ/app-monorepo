import type { FC, ReactElement, ReactNode } from 'react';
import { Children, Fragment, cloneElement } from 'react';

import { useIntl } from 'react-intl';

import type { ICON_NAMES } from '@onekeyhq/components';
import { Menu } from '@onekeyhq/components';

import type { IMenuProps } from 'native-base';
import type { MessageDescriptor } from 'react-intl';

export type IBaseMenuOptions = (
  | {
      id: MessageDescriptor['id'];
      intlValues?: Record<string | number, string>;
      onPress: () => void;
      icon?: ICON_NAMES;
      closeOnSelect?: boolean;
      extraChildren?: ReactNode;
      isDisabled?: boolean;
      variant?: 'desctructive' | 'highlight';
    }
  | false
  | undefined
  | (() => ReactElement)
)[];

export type IMenu = Omit<IMenuProps, 'trigger'>;
interface IBaseMenu extends IMenu {
  options: IBaseMenuOptions;
  menuWidth?: number;
}

const BaseMenu: FC<IBaseMenu> = ({
  options,
  children,
  placement = 'bottom right',
  menuWidth,
  ...rest
}) => {
  const intl = useIntl();
  return (
    <Menu
      w={menuWidth || 190}
      placement={placement}
      trigger={(triggerProps) =>
        cloneElement(Children.only(children as ReactElement), triggerProps)
      }
      {...rest}
    >
      {options.filter(Boolean).map((option, index) => {
        if (typeof option === 'function') {
          return <Fragment key={index}>{option()}</Fragment>;
        }
        const {
          onPress,
          id,
          intlValues,
          closeOnSelect = true,
          ...menuItemProps
        } = option;
        return (
          <Menu.CustomItem
            key={index}
            {...menuItemProps}
            onPress={() => {
              onPress();
              if (!closeOnSelect) {
                return false;
              }
            }}
          >
            {intl.formatMessage(
              {
                id,
              },
              intlValues,
            )}
          </Menu.CustomItem>
        );
      })}
    </Menu>
  );
};

export default BaseMenu;
