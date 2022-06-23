import React, { ComponentProps, FC } from 'react';

import SegmentedControl from '@react-native-segmented-control/segmented-control';

import { useThemeValue } from '../Provider/hooks';
import { Body2StrongProps } from '../Typography';

type SegmentedControlProps = Omit<
  ComponentProps<typeof SegmentedControl>,
  'onChange'
> & {
  onChange?: (index: number) => void;
};

const SegmentedControlIOS: FC<SegmentedControlProps> = ({
  onChange,
  ...rest
}) => {
  const fontColor = useThemeValue('text-subdued');
  const activeFontColor = useThemeValue('text-default');
  const activeBgColor = useThemeValue('surface-default');
  const bgColor = useThemeValue('surface-neutral-default');
  return (
    <SegmentedControl
      backgroundColor={bgColor}
      fontStyle={{
        color: fontColor,
        fontFamily: Body2StrongProps.fontFamily,
        fontSize: Body2StrongProps.fontSize,
        fontWeight: Body2StrongProps.fontWeight as '100',
      }}
      activeFontStyle={{
        color: activeFontColor,
        fontFamily: Body2StrongProps.fontFamily,
        fontSize: Body2StrongProps.fontSize,
        fontWeight: Body2StrongProps.fontWeight as '100',
      }}
      tintColor={activeBgColor}
      style={{ height: 36 }}
      {...rest}
      onChange={(e) => onChange?.(e.nativeEvent.selectedSegmentIndex)}
    />
  );
};

export default SegmentedControlIOS;
