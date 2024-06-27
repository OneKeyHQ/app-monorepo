import type { ReactElement } from 'react';
import { useCallback } from 'react';

import { SizableText, styled } from 'tamagui';

import { XStack, YStack } from '../../primitives';

import type { IXStackProps } from '../../primitives';
import type { GetProps } from 'tamagui';

export interface ISegmentControlProps extends IXStackProps {
  fullWidth?: boolean;
  value: string | number;
  options: {
    label: string | ReactElement;
    value: string | number;
  }[];
  onChange: (value: string | number) => void;
}

function SegmentControlItem({
  label,
  value,
  onChange,
  active,
  disabled,
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
      focusStyle={{
        outlineWidth: 2,
        outlineColor: '$focusRing',
        outlineStyle: 'solid',
      }}
      {...(active
        ? {
            bg: '$bg',
            elevation: 2,
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
      {options.map(({ label, value: v }, index) => (
        <SegmentControlItem
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
        />
      ))}
    </XStack>
  );
}

export const SegmentControl = styled(
  SegmentControlFrame,
  {} as ISegmentControlProps,
);
