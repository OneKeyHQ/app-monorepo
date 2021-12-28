import React, { ComponentProps, FC, ReactNode, useCallback } from 'react';

import {
  SegmentedControl as BaseSegmentedControl,
  Segment,
} from 'react-native-resegmented-control';

import Box from '../Box';
import Icon, { ICON_NAMES } from '../Icon';
import { useThemeValue } from '../Provider/hooks';
import Typography from '../Typography';

type SegmentedControlItem = {
  label?: string | ReactNode;
  iconName?: ICON_NAMES;
  iconProps?: ComponentProps<typeof Icon>;
  value: string;
};

type SegmentedControlProps = {
  containerProps?: ComponentProps<typeof Box>;
  options: SegmentedControlItem[];
  defaultValue?: string;
  onChange?: (v: string) => void;
} & Omit<ComponentProps<typeof BaseSegmentedControl>, 'children'>;

const SegmentedControl: FC<SegmentedControlProps> = ({
  containerProps,
  options,
  defaultValue,
  onChange,
  ...rest
}) => {
  const fontColor = useThemeValue('text-subdued');
  const activeFontColor = useThemeValue('text-default');
  const activeBgColor = useThemeValue('surface-default');
  const bgColor = useThemeValue('surface-neutral-default');
  const shadowColor = useThemeValue('surface-default');
  const renderContent = useCallback<
    (i: SegmentedControlItem, active: boolean) => ReactNode
  >(({ label, iconProps = {}, iconName }, active) => {
    if (typeof label === 'string') {
      return (
        <Typography.Body2 color={active ? 'text-default' : 'text-subdued'}>
          {label}
        </Typography.Body2>
      );
    }
    if (iconName) {
      return (
        <Box p="2">
          <Icon
            {...iconProps}
            name={iconName}
            color={active ? 'icon-hovered' : 'icon-default'}
          />
        </Box>
      );
    }
    return label;
  }, []);

  return (
    <Box w="100%" {...containerProps}>
      <BaseSegmentedControl
        activeTintColor={activeBgColor}
        inactiveTintColor={bgColor}
        onChangeValue={onChange}
        initialSelectedName={defaultValue}
        style={{
          backgroundColor: bgColor,
        }}
        sliderStyle={{
          backgroundColor: activeBgColor,
          shadowColor,
        }}
        {...rest}
      >
        {options.map((option) => (
          <Segment
            activeTintColor={activeFontColor}
            inactiveTintColor={fontColor}
            name={option.value}
            key={option.value}
            content={({ active }: { active: boolean }) =>
              renderContent(option, active)
            }
          />
        ))}
      </BaseSegmentedControl>
    </Box>
  );
};

export default SegmentedControl;
