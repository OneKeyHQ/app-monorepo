import React, { ComponentProps, FC, ReactNode, useCallback } from 'react';

import { Center } from 'native-base';
import {
  SegmentedControl as BaseSegmentedControl,
  Segment,
} from 'react-native-resegmented-control';

import { isWeb } from '@onekeyhq/shared/src/platformEnv';

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
        <Center padding="6px" ml="3px" w="full" h="full">
          <Typography.Body2Strong
            color={active ? 'text-default' : 'text-subdued'}
            textAlign="center"
          >
            {label}
          </Typography.Body2Strong>
        </Center>
      );
    }
    if (iconName) {
      return (
        <Center padding="6px" ml="3px" w="full" h="full">
          <Icon
            size={20}
            {...iconProps}
            name={iconName}
            color={active ? 'icon-hovered' : 'icon-default'}
          />
        </Center>
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
            // @ts-expect-error Web should able to accept inline-block
            style={{
              display: isWeb() ? 'inline-block' : 'flex',
              minWidth: `${100 / options.length}%`,
            }}
          />
        ))}
      </BaseSegmentedControl>
    </Box>
  );
};

export default SegmentedControl;
