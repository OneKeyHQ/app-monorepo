import { useCallback } from 'react';

import { RadioGroup } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Label, SizableText, XStack, YStack } from '../../primitives';
import { NATIVE_HIT_SLOP } from '../../utils';

import type { IFormFieldProps } from '../types';

export type IRadioProps = IFormFieldProps<
  string,
  {
    disabled?: boolean;
    options: {
      label: string;
      description?: string;
      value: string;
      children?: React.ReactNode;
      disabled?: boolean;
    }[];
    defaultValue?: string;
    orientation?: 'vertical' | 'horizontal';
    gap?: string;
  }
>;

export function Radio({
  value,
  defaultValue,
  onChange,
  disabled,
  options,
  orientation = 'vertical',
  gap = '$2',
}: IRadioProps) {
  const Container = orientation === 'horizontal' ? XStack : YStack;

  const handleValueChange = useCallback(
    (v: string) => {
      const option = options.find((o) => o.value === v);
      if (option?.disabled) {
        return;
      }
      onChange?.(v);
    },
    [onChange, options],
  );

  return (
    <RadioGroup
      value={value}
      defaultValue={defaultValue}
      onValueChange={handleValueChange}
      disabled={disabled}
    >
      <Container gap={gap} alignItems="flex-start" flexWrap="wrap">
        {options.map(
          (
            {
              label,
              description,
              value: v,
              children: optionChildren,
              disabled: optionDisabled,
            },
            index,
          ) => {
            const ItemContainer =
              orientation === 'horizontal' ? XStack : XStack;
            return (
              <ItemContainer
                key={index}
                py="$2"
                alignItems="center"
                gap="$2"
                flex={orientation === 'horizontal' ? undefined : 1}
                opacity={optionDisabled ? 0.5 : 1}
              >
                <RadioGroup.Item
                  value={v}
                  id={v}
                  unstyled
                  alignItems="center"
                  justifyContent="center"
                  my="$0.5"
                  w="$5"
                  h="$5"
                  borderWidth="$0.5"
                  borderColor={value === v ? '$transparent' : '$borderStrong'}
                  backgroundColor={value === v ? '$bgPrimary' : '$transparent'}
                  borderRadius="$full"
                  focusVisibleStyle={{
                    outlineOffset: 2,
                    outlineColor: '$focusRing',
                  }}
                  hitSlop={NATIVE_HIT_SLOP}
                  disabled={optionDisabled}
                >
                  <RadioGroup.Indicator
                    unstyled
                    w="$2.5"
                    h="$2.5"
                    bg="$iconInverse"
                    borderRadius="$full"
                  />
                </RadioGroup.Item>
                <YStack
                  py={orientation === 'horizontal' ? '$0' : '$2'}
                  my={orientation === 'horizontal' ? '$0' : '$-2'}
                  flex={orientation === 'horizontal' ? undefined : 1}
                >
                  <Label
                    htmlFor={v}
                    variant="$bodyLgMedium"
                    color={optionDisabled ? '$textDisabled' : '$text'}
                  >
                    {label}
                  </Label>
                  {description ? (
                    <SizableText
                      size="$bodyMd"
                      color={optionDisabled ? '$textDisabled' : '$textSubdued'}
                      pt="$0.5"
                    >
                      {description}
                    </SizableText>
                  ) : null}
                  {optionChildren}
                </YStack>
              </ItemContainer>
            );
          },
        )}
      </Container>
    </RadioGroup>
  );
}
