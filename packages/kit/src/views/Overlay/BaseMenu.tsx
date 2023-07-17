import type { FC, ReactElement, ReactNode } from 'react';
import { Children, Fragment, cloneElement, useCallback } from 'react';

import { useIntl } from 'react-intl';
import { initialWindowMetrics } from 'react-native-safe-area-context';

import type { ICON_NAMES } from '@onekeyhq/components';
import { Menu } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IMenuProps } from 'native-base';
import type { MessageDescriptor } from 'react-intl';

export type ValidOption = {
  onPress?: () => void;
  icon?: ICON_NAMES;
  intlValues?: Record<string | number, string>;
  closeOnSelect?: boolean;
  extraChildren?: ReactNode;
  isDisabled?: boolean;
  variant?: 'desctructive' | 'highlight';
  value?: string | number;
} & (
  | { textValue: string }
  | {
      id: MessageDescriptor['id'];
    }
);

export type SingleOption =
  | false
  | undefined
  | (() => ReactElement)
  | ValidOption;

// https://github.com/th3rdwave/react-native-safe-area-context/issues/124#issuecomment-1018323396
export const defaultMenuOffset = platformEnv.isNativeAndroid
  ? initialWindowMetrics?.insets.top
  : 0;

export type IBaseMenuOptions = (
  | SingleOption
  | {
      type: 'group';
      title: MessageDescriptor['id'];
      children: SingleOption[];
    }
  | {
      type: 'radio';
      defaultValue?: string | number;
      value?: string | number;
      onChange?: (value: string | number) => void;
      title: MessageDescriptor['id'];
      children: SingleOption[];
    }
  | {
      type: 'checkbox';
      defaultValue?: string | number | string[] | number[];
      value?: string | number | string[] | number[];
      onChange?: (value: string | number | string[] | number[]) => void;
      title: MessageDescriptor['id'];
      children: SingleOption[];
    }
)[];

export type IMenu = Omit<IMenuProps, 'trigger'>;
interface IBaseMenu extends IMenu {
  options: IBaseMenuOptions;
  menuWidth?: number;
}

const BaseMenu: FC<IBaseMenu> = ({
  options,
  children,
  menuWidth,
  // eslint-disable-next-line react/prop-types
  placement = 'bottom right',
  ...rest
}) => {
  const intl = useIntl();
  const renderSingleOption = useCallback(
    (validOption: ValidOption, index: number) => {
      const {
        onPress,
        closeOnSelect = true,
        value,
        intlValues,
        ...menuItemProps
      } = validOption;

      if (value !== undefined) {
        return (
          <Menu.ItemOption
            key={index}
            value={value}
            {...menuItemProps}
            onPress={() => {
              onPress?.();
              if (!closeOnSelect) {
                return false;
              }
            }}
          >
            {'textValue' in validOption
              ? validOption.textValue
              : intl.formatMessage(
                  {
                    id: validOption.id,
                  },
                  intlValues,
                )}
          </Menu.ItemOption>
        );
      }
      return (
        <Menu.CustomItem
          key={index}
          {...menuItemProps}
          onPress={() => {
            onPress?.();
            if (!closeOnSelect) {
              return false;
            }
          }}
        >
          {'textValue' in validOption
            ? validOption.textValue
            : intl.formatMessage(
                {
                  id: validOption.id,
                },
                intlValues,
              )}
        </Menu.CustomItem>
      );
    },
    [intl],
  );
  const renderGroupChildren = useCallback(
    (groupChildren: SingleOption[]) =>
      groupChildren.filter(Boolean).map((child, index) => {
        if (typeof child === 'function') {
          return <Fragment key={index}>{child()}</Fragment>;
        }
        return renderSingleOption(child, index);
      }),
    [renderSingleOption],
  );
  return (
    <Menu
      w={menuWidth || 190}
      offset={rest.offset ?? defaultMenuOffset}
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
        if ('type' in option) {
          if (option.type === 'group') {
            return (
              <Menu.Group
                key={index}
                title={intl.formatMessage({
                  id: option.title,
                })}
              >
                {renderGroupChildren(option.children)}
              </Menu.Group>
            );
          }
          return (
            <Menu.OptionGroup
              type={option.type}
              key={index}
              title={intl.formatMessage({
                id: option.title,
              })}
              defaultValue={option.defaultValue}
              value={option.value}
              onChange={option.onChange}
            >
              {renderGroupChildren(option.children)}
            </Menu.OptionGroup>
          );
        }

        return renderSingleOption(option, index);
      })}
    </Menu>
  );
};

export default BaseMenu;
