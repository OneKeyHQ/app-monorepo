import type { FC, ReactElement } from 'react';
import { Children, cloneElement } from 'react';

import { useIntl } from 'react-intl';

import type { ICON_NAMES } from '@onekeyhq/components';
import { Menu } from '@onekeyhq/components';

import type { IMenuProps } from 'native-base';
import type { MessageDescriptor } from 'react-intl';

type IMenuOptions = (
  | {
      id: MessageDescriptor['id'];
      intlValues?: Record<string, string>;
      onPress: () => void;
      icon: ICON_NAMES;
    }
  | false
  | undefined
)[];

export type IMenu = Omit<IMenuProps, 'trigger'>;
interface IBaseMenu extends IMenu {
  options: IMenuOptions;
}

const BaseMenu: FC<IBaseMenu> = ({
  options,
  children,
  placement = 'bottom right',
  ...rest
}) => {
  const intl = useIntl();
  return (
    <Menu
      w={190}
      placement={placement}
      trigger={(triggerProps) =>
        cloneElement(Children.only(children as ReactElement), triggerProps)
      }
      {...rest}
    >
      {options
        .filter(Boolean)
        .map(({ onPress, icon, id, intlValues }, index) => (
          <Menu.CustomItem key={index} icon={icon} onPress={onPress}>
            {intl.formatMessage(
              {
                id,
              },
              intlValues,
            )}
          </Menu.CustomItem>
        ))}
    </Menu>
  );
};

export default BaseMenu;
