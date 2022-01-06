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
  // const shadowColor = useThemeValue('surface-default');
  const renderContent = useCallback<
    (i: SegmentedControlItem, active: boolean) => ReactNode
  >(({ label, iconProps = {}, iconName }, active) => {
    if (typeof label === 'string') {
      return (
        <Typography.Body2Strong
          ml="3px"
          color={active ? 'text-default' : 'text-subdued'}
        >
          {label}
        </Typography.Body2Strong>
      );
    }
    if (iconName) {
      return (
        <Box ml="3px">
          <Icon
            size={20}
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
    <Box bgColor={bgColor} pr={0.5} borderRadius="12px" {...containerProps}>
      <BaseSegmentedControl
        activeTintColor={activeBgColor}
        inactiveTintColor={bgColor}
        onChangeValue={onChange}
        initialSelectedName={defaultValue}
        style={{
          backgroundColor: bgColor,
          height: 36,
          borderRadius: 12,
        }}
        sliderStyle={{
          backgroundColor: activeBgColor,
          height: 32,
          borderRadius: 10,
          /* 
            note:
            do not define the shadow radius, otherwise the shadow will not work properly
          */
          shadowColor: '#000000',
          shadowOffset: {
            width: 0,
            height: 1,
          },
          shadowOpacity: 0.05,
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
            style={{
              padding: 6,
            }}
          />
        ))}
      </BaseSegmentedControl>
    </Box>
  );
};

export default SegmentedControl;
