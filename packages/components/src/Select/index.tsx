import React, {
  ComponentProps,
  ReactNode,
  useCallback,
  useMemo,
  useState,
} from 'react';

import { flatten } from 'lodash';

import Box from '../Box';
import Icon, { ICON_NAMES } from '../Icon';
import Pressable from '../Pressable';
import { useUserDevice } from '../Provider/hooks';
import Token from '../Token';
import Typography from '../Typography';

import Desktop from './Container/Desktop';
import Mobile from './Container/Mobile';

export type SelectItem<T = string> = {
  label: string;
  value: T;
  tokenProps?: ComponentProps<typeof Token>;
  iconProps?: ComponentProps<typeof Icon>;
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
> & {
  toggleVisible: () => void;
  visible: boolean;
  activeOption: SelectItem<T>;
};

function getTriggerAlignSelf(
  dropdownPosition: SelectProps['dropdownPosition'],
) {
  if (dropdownPosition === 'left') return 'flex-end';
  if (dropdownPosition === 'right') return 'flex-start';
  return 'center';
}

const defaultProps = {
  headerShown: true,
  dropdownPosition: 'center',
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
  dropdownPosition,
}: SelectProps<T>) {
  const [visible, setVisible] = useState(false);
  const { size } = useUserDevice();
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
  ]);

  return (
    <Box width="100%" position="relative" {...containerProps}>
      <Pressable
        display="flex"
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        borderRadius="12px"
        borderColor="border-default"
        bg={visible ? 'surface-selected' : 'transparent'}
        py="2"
        px="3"
        width="100%"
        onPress={toggleVisible}
        alignSelf={getTriggerAlignSelf(dropdownPosition)}
        {...triggerProps}
      >
        {renderTrigger?.(activeOption) ?? (
          <>
            {!!activeOption.tokenProps && (
              <Box mr="2">
                <Token size={6} {...activeOption.tokenProps} />
              </Box>
            )}
            {!!activeOption.iconProps && (
              <Box mr="2">
                <Icon size={6} {...activeOption.iconProps} />
              </Box>
            )}
            <Typography.Body2 numberOfLines={1} flex="1" mr="1">
              {activeOption.label ?? '-'}
            </Typography.Body2>
            <Icon name="ChevronDownOutline" size={16} />
          </>
        )}
      </Pressable>
      {container}
    </Box>
  );
}

Select.defaultProps = defaultProps;

export default Select;
