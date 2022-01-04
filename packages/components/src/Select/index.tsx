import React, {
  ComponentProps,
  ReactNode,
  useCallback,
  useMemo,
  useState,
} from 'react';

import { flatten } from 'lodash';
import { Icon as NBIcon } from 'native-base';

import Box from '../Box';
import Icon, { ICON_NAMES } from '../Icon';
import { ChevronDown } from '../Icon/react/solid';
import Pressable from '../Pressable';
import { useIsVerticalLayout, useUserDevice } from '../Provider/hooks';
import Token from '../Token';
import Typography from '../Typography';

import Desktop from './Container/Desktop';
import Mobile from './Container/Mobile';

export type SelectItem<T = string> = {
  label: string;
  description?: string;
  value: T;
  tokenProps?: ComponentProps<typeof Token>;
  iconProps?: ComponentProps<typeof Icon>;
  OutlineIcon?: string;
  SolidIcon?: string;
  destructive?: boolean;
};

export type SelectGroupItem<T = string> = {
  title: string;
  options: SelectItem<T>[];
};

export type SelectProps<T = string> = {
  title?: string;
  headerShown?: boolean;
  options: (SelectItem<T> | SelectGroupItem<T>)[];
  value?: T;
  defaultValue?: T;
  containerProps?: ComponentProps<typeof Box>;
  triggerProps?: ComponentProps<typeof Pressable>;
  dropdownProps?: ComponentProps<typeof Box>;
  renderTrigger?: (activeItem: SelectItem<T>) => ReactNode;
  renderItem?: (
    item: SelectItem<T>,
    isActive: boolean,
    onChange?: (v: T, item: SelectItem<T>) => void,
  ) => ReactNode;
  dropdownPosition?: 'center' | 'left' | 'right';
  onChange?: (v: T, item: SelectItem<T>) => void;
  footer?: ReactNode;
  footerText?: string;
  footerIcon?: ICON_NAMES;
  onPressFooter?: () => void;
  onModalHide?: () => void;
  isTriggerPlain?: boolean;
  asAction?: boolean;
};

export type ChildProps<T> = Pick<
  SelectProps<T>,
  | 'dropdownProps'
  | 'options'
  | 'onChange'
  | 'title'
  | 'footer'
  | 'footerText'
  | 'footerIcon'
  | 'onPressFooter'
  | 'renderItem'
  | 'headerShown'
  | 'onModalHide'
  | 'isTriggerPlain'
  | 'asAction'
  | 'dropdownPosition'
> & {
  toggleVisible: () => void;
  visible: boolean;
  activeOption: SelectItem<T>;
};

const defaultProps = {
  headerShown: true,
  dropdownPosition: 'center',
  isTriggerPlain: false,
  asAction: false,
} as const;

function Select<T = string>({
  options,
  value,
  containerProps,
  triggerProps,
  dropdownProps,
  renderTrigger,
  renderItem,
  onChange,
  defaultValue,
  title,
  footer,
  footerText,
  footerIcon,
  onPressFooter,
  headerShown,
  isTriggerPlain,
  asAction,
  dropdownPosition,
}: SelectProps<T>) {
  const [visible, setVisible] = useState(false);
  const { size } = useUserDevice();
  const isSmallScreen = useIsVerticalLayout();
  const toggleVisible = useCallback(() => {
    setVisible((v) => !v);
  }, []);

  const [innerValue, setInnerValue] = useState<T | undefined>(defaultValue);
  const currentActiveValue = value ?? innerValue;

  const activeOption = useMemo(() => {
    if (
      (options as SelectGroupItem<T>[]).every((option) =>
        Array.isArray(option.options),
      )
    ) {
      const groupOptions = options as SelectGroupItem<T>[];
      const flattenedOptions = flatten(
        groupOptions.map((option) => option.options),
      );
      return (flattenedOptions.find(
        (option) => option.value === currentActiveValue,
      ) ?? {}) as SelectItem<T>;
    }

    return ((options as SelectItem<T>[]).find(
      (option) => option.value === currentActiveValue,
    ) ?? {}) as SelectItem<T>;
  }, [currentActiveValue, options]);

  const handleChange = useCallback(
    (v: SelectItem<T>['value'], option: SelectItem<T>) => {
      setInnerValue(v);
      onChange?.(v, option);
      toggleVisible();
    },
    [onChange, toggleVisible],
  );

  const container = useMemo(() => {
    const childContainerProps = {
      visible,
      options,
      toggleVisible,
      dropdownProps,
      title,
      footer,
      footerText,
      footerIcon,
      onPressFooter,
      activeOption,
      renderItem,
      headerShown,
      onChange: handleChange,
      asAction,
      dropdownPosition,
    };

    if (['SMALL', 'NORMAL'].includes(size)) {
      return <Mobile<T> {...childContainerProps} />;
    }
    return <Desktop<T> {...childContainerProps} />;
  }, [
    visible,
    size,
    toggleVisible,
    options,
    handleChange,
    dropdownProps,
    title,
    footer,
    footerText,
    footerIcon,
    onPressFooter,
    activeOption,
    renderItem,
    headerShown,
    asAction,
    dropdownPosition,
  ]);

  return (
    <Box w="full" position="relative" {...containerProps}>
      <Pressable
        w="full"
        onPress={toggleVisible}
        borderWidth={isTriggerPlain || renderTrigger ? undefined : '1'}
        borderColor={
          isTriggerPlain || renderTrigger ? undefined : 'border-default'
        }
        bg={
          isTriggerPlain || renderTrigger
            ? undefined
            : 'action-secondary-default'
        }
        borderRadius={renderTrigger ? undefined : 'xl'}
        _hover={
          // eslint-disable-next-line no-nested-ternary
          renderTrigger
            ? {}
            : isTriggerPlain
            ? { bg: 'surface-hovered' }
            : { borderColor: 'border-hovered' }
        }
        {...triggerProps}
      >
        {renderTrigger?.(activeOption) ?? (
          <Box
            display="flex"
            flexDirection="row"
            alignItems="center"
            // bg={visible ? 'surface-selected' : 'transparent'}
            py="2"
            pl="3"
            pr="2.5"
          >
            <Box display="flex" flexDirection="row" alignItems="center" mr="1">
              {!!activeOption.tokenProps && (
                <Box mr="3">
                  <Token
                    size={activeOption.description ? 8 : 6}
                    {...activeOption.tokenProps}
                  />
                </Box>
              )}
              {!!activeOption.iconProps && (
                <Box mr="3">
                  <Icon size={6} {...activeOption.iconProps} />
                </Box>
              )}
              <Box>
                {isSmallScreen ? (
                  <Typography.Body1 numberOfLines={1}>
                    {activeOption.label ?? '-'}
                  </Typography.Body1>
                ) : (
                  <Typography.Body2 numberOfLines={1}>
                    {activeOption.label ?? '-'}
                  </Typography.Body2>
                )}
                {activeOption.description && (
                  <Typography.Body2 color="text-subdued">
                    {activeOption.description ?? '-'}
                  </Typography.Body2>
                )}
              </Box>
            </Box>
            <NBIcon as={ChevronDown} size={5} color="icon-default" ml="auto" />
          </Box>
        )}
      </Pressable>
      {container}
    </Box>
  );
}

Select.defaultProps = defaultProps;

export default Select;
