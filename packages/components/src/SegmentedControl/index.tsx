import type { ComponentProps, FC } from 'react';

import SegmentedControlBase from '@react-native-segmented-control/segmented-control';

import { useThemeValue } from '@onekeyhq/components';

import { Body2StrongProps } from '../Typography';

export type SegmentedControlProps = Omit<
  ComponentProps<typeof SegmentedControlBase>,
  'onChange'
> & {
  onChange?: (index: number) => void;
};

const SegmentedControl: FC<SegmentedControlProps> = ({ onChange, ...rest }) => {
  const fontColor = useThemeValue('text-subdued');
  const activeFontColor = useThemeValue('text-default');
  const activeBgColor = useThemeValue('surface-default');
  const bgColor = useThemeValue('surface-neutral-subdued');
  return (
    <SegmentedControlBase
      backgroundColor={bgColor}
      fontStyle={{
        color: fontColor,
        fontSize: Body2StrongProps.fontSize,
        fontWeight: Body2StrongProps.fontWeight as '100',
      }}
      activeFontStyle={{
        color: activeFontColor,
        // fontFamily: Body2StrongProps.fontFamily,
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

export default SegmentedControl;
