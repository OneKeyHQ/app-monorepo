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
}

function SegmentControlItem({
  label,
  value,
  onChange,
  active,
  disabled,
  testID,
  ...rest
}: {
  label: string | ReactElement;
  value: string | number;
  active: boolean;
  disabled?: boolean;
  onChange: (value: string | number) => void;
} & GetProps<typeof YStack>) {
  const handleChange = useCallback(() => {
    onChange(value);
  }, [onChange, value]);
  return (
    <YStack
      py="$1"
      px="$2"
      $gtMd={{ zIndex: 4 }}
      onPress={handleChange}
      borderRadius="$2"
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
            bg: '$bg',
            elevation: 2,
            '$platform-native': {
              elevation: 2,
            },
            '$platform-web': {
              boxShadow:
                '0 1px 1px 0 rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(0, 0, 0, 0.05), 0 4px 6px 0 rgba(0, 0, 0, 0.04), 0 24px 68px 0 rgba(0, 0, 0, 0.05), 0 2px 3px 0 rgba(0, 0, 0, 0.04)',
            },
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
          color={active ? '$text' : '$textSubdued'}
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
      backgroundColor="$neutral5"
      borderRadius="$2.5"
      borderCurve="continuous"
      p="$0.5"
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
          {...(index !== 0 && {
            ml: '$0.5',
          })}
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
