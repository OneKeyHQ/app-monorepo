import type { ReactElement } from 'react';
import { useCallback } from 'react';

import { styled } from '@onekeyhq/components/src/shared/tamagui';
import type { GetProps } from '@onekeyhq/components/src/shared/tamagui';

import { SizableText, XStack, YStack } from '../../primitives';

import type { IXStackProps } from '../../primitives';

export interface ISegmentControlProps extends IXStackProps {
  fullWidth?: boolean;
  value: string | number;
  options: {
    label: string | ReactElement;
    value: string | number;
    testID?: string;
  }[];
  onChange: (value: string | number) => void;
  segmentControlItemStyleProps?: GetProps<typeof YStack>;
  slotBackgroundColor?: IXStackProps['backgroundColor'];
  activeBackgroundColor?: GetProps<typeof YStack>['bg'];
  activeTextColor?: string;
  inactiveTextColor?: string;
}

function SegmentControlItem({
  label,
  value,
  onChange,
  active,
  disabled,
  activeBackgroundColor,
  activeTextColor,
  inactiveTextColor,
  testID,
  ...rest
}: {
  label: string | ReactElement;
  value: string | number;
  active: boolean;
  disabled?: boolean;
  onChange: (value: string | number) => void;
  activeBackgroundColor?: GetProps<typeof YStack>['bg'];
  activeTextColor?: string;
  inactiveTextColor?: string;
} & GetProps<typeof YStack>) {
  const handleChange = useCallback(() => {
    onChange(value);
  }, [onChange, value]);
  return (
    <YStack
      py="$1.5"
      px="$3.5"
      $gtMd={{ zIndex: 4 }}
      onPress={handleChange}
      borderRadius="$full"
      borderCurve="continuous"
      userSelect="none"
      focusable={!disabled}
      focusVisibleStyle={{
        outlineWidth: 2,
        outlineColor: '$focusRing',
        outlineStyle: 'solid',
      }}
      testID={testID}
      {...(active
        ? {
            bg: activeBackgroundColor ?? '$bgPrimary',
          }
        : {
            hoverStyle: {
              bg: '$bgHover',
            },
            pressStyle: {
              bg: '$bgActive',
            },
          })}
      {...(disabled && {
        opacity: 0.5,
      })}
      {...rest}
    >
      {typeof label === 'string' ? (
        <SizableText
          size="$bodyMdMedium"
          textAlign="center"
          color={
            active
              ? (activeTextColor ?? '$textInverse')
              : (inactiveTextColor ?? '$text')
          }
        >
          {label}
        </SizableText>
      ) : (
        label
      )}
    </YStack>
  );
}

function SegmentControlFrame({
  value,
  options,
  onChange,
  fullWidth,
  segmentControlItemStyleProps,
  slotBackgroundColor,
  activeBackgroundColor,
  activeTextColor,
  inactiveTextColor,
  ...rest
}: ISegmentControlProps) {
  const handleChange = useCallback(
    (v: string | number) => {
      onChange(v);
    },
    [onChange],
  );
  return (
    <XStack
      width={fullWidth ? '100%' : 'auto'}
      alignSelf={fullWidth ? undefined : 'flex-start'}
      backgroundColor={slotBackgroundColor ?? '$bgStrong'}
      borderRadius="$full"
      borderCurve="continuous"
      h={32}
      {...rest}
    >
      {options.map(({ label, value: v, testID }, index) => (
        <SegmentControlItem
          testID={testID}
          key={index}
          label={label}
          value={v}
          active={value === v}
          onChange={handleChange}
          activeBackgroundColor={activeBackgroundColor}
          activeTextColor={activeTextColor}
          inactiveTextColor={inactiveTextColor}
          {...(fullWidth && {
            flexGrow: 1,
            flexBasis: 0,
          })}
          {...segmentControlItemStyleProps}
        />
      ))}
    </XStack>
  );
}

export const SegmentControl = styled(
  SegmentControlFrame,
  {} as ISegmentControlProps,
);
