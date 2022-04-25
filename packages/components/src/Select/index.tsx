import React, {
  ComponentProps,
  ReactElement,
  ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';

import { flatten } from 'lodash';
import { Icon as NBIcon } from 'native-base';
import { ColorType } from 'native-base/lib/typescript/components/types';

import { setHaptics } from '../../../kit/src/hooks/setHaptics';
import Box from '../Box';
import Icon, { ICON_NAMES } from '../Icon';
import { ChevronDown } from '../Icon/react/solid';
import Pressable from '../Pressable';
import { useUserDevice } from '../Provider/hooks';
import Token from '../Token';
import { Text } from '../Typography';
import { addNewRef, removeOldRef } from '../utils/SelectAutoHide';

import DesktopWithRef from './Container/Desktop';
import Mobile from './Container/Mobile';

import type { DesktopRef } from './Container/Desktop';

export type SelectItem<T = string> = {
  label: string;
  description?: string | ReactElement<any, any>;
  value: T;
  tokenProps?: ComponentProps<typeof Token>;
  iconProps?: ComponentProps<typeof Icon>;
  OutlineIcon?: string;
  SolidIcon?: string;
  destructive?: boolean;
  color?: ColorType;
  badge?: string;
  trailing?: ReactNode;
};

export type SelectGroupItem<T = string> = {
  title: string;
  options: SelectItem<T>[];
};

export type IDropdownPosition =
  | 'center'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'top-center';
export type IDropdownProps = ComponentProps<typeof Box>;
export type SelectProps<T = string> = {
  title?: string;
  headerShown?: boolean;
  options: (SelectItem<T> | SelectGroupItem<T>)[];
  value?: T;
  defaultValue?: T;
  containerProps?: ComponentProps<typeof Box>;
  triggerProps?: ComponentProps<typeof Pressable>;
  dropdownProps?: IDropdownProps;
  renderTrigger?: (
    activeItem: SelectItem<T>,
    isHovered: boolean,
    isFocused: boolean,
    isPressed: boolean,
    visible: boolean,
  ) => ReactNode;
  renderItem?: (
    item: SelectItem<T>,
    isActive: boolean,
    onChange?: (v: T, item: SelectItem<T>) => void,
  ) => ReactNode;
  dropdownPosition?: IDropdownPosition;
  onChange?: (v: T, item: SelectItem<T>) => void;
  footer?: ReactNode;
  footerText?: string;
  footerIcon?: ICON_NAMES;
  onPressFooter?: () => void;
  onModalHide?: () => void;
  isTriggerPlain?: boolean;
  triggerSize?: 'xl' | 'default' | string | undefined;
  activatable?: boolean;
  visible?: boolean | undefined;
  onVisibleChange?: (visible: boolean) => void;
  triggerEle?: HTMLElement | null;
  setPositionOnlyMounted?: boolean;
  positionTranslateY?: number;
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
  | 'triggerSize'
  | 'activatable'
  | 'dropdownPosition'
  | 'triggerEle'
  | 'setPositionOnlyMounted'
  | 'positionTranslateY'
> & {
  toggleVisible: () => void;
  visible: boolean;
  activeOption: SelectItem<T>;
};

const defaultProps = {
  headerShown: true,
  dropdownPosition: 'center',
  isTriggerPlain: false,
  triggerSize: 'default',
  activatable: true,
  visible: undefined,
  onVisibleChange: null,
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
  triggerSize,
  activatable,
  dropdownPosition,
  visible: selectVisible,
  onVisibleChange,
  setPositionOnlyMounted,
  positionTranslateY,
}: SelectProps<T>) {
  const triggerRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const { size } = useUserDevice();
  const toggleVisible = useCallback(() => {
    // if (platformEnv.isBrowser) {
    //   const event = new Event('click');
    //   window.dispatchEvent(event);
    // }
    const newVisible = !(selectVisible === undefined ? visible : selectVisible);
    setVisible(newVisible);
    onVisibleChange?.(newVisible);
  }, [onVisibleChange, selectVisible, visible]);

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
      toggleVisible();
      setTimeout(() => onChange?.(v, option), 300);
    },
    [onChange, toggleVisible],
  );

  const handlePressFooter = useCallback(() => {
    toggleVisible();
    onPressFooter?.();
  }, [onPressFooter, toggleVisible]);

  // const DesktopWithRefComp = DesktopWithRef<T>();
  const DesktopWithRefComp = React.useRef(DesktopWithRef<T>()).current;

  const desktopRef = React.useRef<DesktopRef | null>(null);
  const setRef = React.useCallback((ref: DesktopRef | null) => {
    // Since we know there's a ref, we'll update `refs` to use it.
    if (ref) {
      // store the ref in this toast instance to be able to remove it from the array later when the ref becomes null.
      desktopRef.current = ref;
      addNewRef(ref);
    } else {
      // remove the this ref, wherever it is in the array.
      removeOldRef(desktopRef.current);
    }
  }, []);

  const container = useMemo(() => {
    const childContainerProps = {
      visible: selectVisible === undefined ? visible : selectVisible,
      options,
      toggleVisible,
      dropdownProps,
      title,
      footer,
      footerText,
      footerIcon,
      activeOption,
      renderItem,
      headerShown,
      onChange: handleChange,
      activatable,
      dropdownPosition,
      onPressFooter: handlePressFooter,
      triggerEle: triggerRef?.current,
      setPositionOnlyMounted,
      positionTranslateY,
    };

    if (['SMALL', 'NORMAL'].includes(size)) {
      return <Mobile<T> {...childContainerProps} />;
    }
    return <DesktopWithRefComp ref={setRef} {...childContainerProps} />;
  }, [
    selectVisible,
    visible,
    options,
    toggleVisible,
    dropdownProps,
    title,
    footer,
    footerText,
    footerIcon,
    activeOption,
    renderItem,
    headerShown,
    handleChange,
    activatable,
    dropdownPosition,
    handlePressFooter,
    setPositionOnlyMounted,
    positionTranslateY,
    size,
    DesktopWithRefComp,
    setRef,
  ]);

  return (
    <Box ref={triggerRef} position="relative" {...containerProps}>
      <Pressable
        onPress={() => {
          setHaptics();
          toggleVisible();
        }}
        {...triggerProps}
      >
        {({ isHovered, isFocused, isPressed }) =>
          renderTrigger?.(
            activeOption,
            isHovered,
            isFocused,
            isPressed,
            visible,
          ) ?? (
            <Box
              display="flex"
              flexDirection="row"
              alignItems="center"
              py={triggerSize === 'xl' ? 3 : 2}
              pl="3"
              pr="2.5"
              borderWidth={isTriggerPlain ? undefined : '1'}
              borderColor={
                // eslint-disable-next-line no-nested-ternary
                isTriggerPlain
                  ? undefined
                  : // eslint-disable-next-line no-nested-ternary
                  visible
                  ? 'focused-default'
                  : isHovered
                  ? 'border-hovered'
                  : 'border-default'
              }
              borderRadius="xl"
              bg={
                // eslint-disable-next-line no-nested-ternary
                visible
                  ? 'surface-selected'
                  : // eslint-disable-next-line no-nested-ternary
                  isHovered
                  ? 'surface-hovered'
                  : isTriggerPlain
                  ? undefined
                  : 'surface-default'
              }
            >
              <Box
                display="flex"
                flex={1}
                flexDirection="row"
                alignItems="center"
                mr="1"
              >
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
                <Box flex={1}>
                  <Text
                    typography={
                      triggerSize === 'xl'
                        ? 'Body1'
                        : // triggerSize === 'default'
                          { sm: 'Body1', md: 'Body2' }
                    }
                    numberOfLines={1}
                    flex={1}
                    isTruncated
                  >
                    {activeOption.label ?? '-'}
                  </Text>
                  {activeOption.description && (
                    <Text typography="Body2" color="text-subdued">
                      {activeOption.description ?? '-'}
                    </Text>
                  )}
                </Box>
              </Box>
              <NBIcon
                as={ChevronDown}
                size={5}
                color="icon-default"
                ml="auto"
              />
            </Box>
          )
        }
      </Pressable>
      {container}
    </Box>
  );
}

Select.defaultProps = defaultProps;

export default Select;
