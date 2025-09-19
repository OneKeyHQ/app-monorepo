import { memo, useCallback } from 'react';

import {
  Input,
  SizableText,
  XStack,
  YStack,
  getFontSize,
} from '@onekeyhq/components';

interface IInputAction {
  labelColor: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

interface IInputHelper {
  text: string;
  align?: 'left' | 'right';
}

interface ITradingFormInputProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  suffix?: string;
  actions?: IInputAction[];
  helper?: IInputHelper;
  validator?: (value: string) => boolean;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  readonly?: boolean;
  ifOnDialog?: boolean;
}

export const TradingFormInput = memo(
  ({
    value,
    onChange,
    label,
    placeholder = '0.0',
    disabled = false,
    error,
    suffix,
    actions,
    helper,
    validator,
    keyboardType = 'decimal-pad',
    ifOnDialog = false,
  }: ITradingFormInputProps) => {
    const handleInputChange = useCallback(
      (text: string) => {
        if (validator && !validator(text)) return;
        onChange(text);
      },
      [validator, onChange],
    );

    const renderAddOns = () => {
      const addOns = [];

      if (suffix) {
        addOns.push({
          renderContent: (
            <XStack alignItems="center">
              <SizableText size="$bodyMdMedium" color="$textSubdued">
                {suffix}
              </SizableText>
            </XStack>
          ),
        });
      }

      if (actions && actions.length > 0) {
        actions.forEach((action) => {
          addOns.push({
            renderContent: (
              <XStack
                alignItems="center"
                cursor="pointer"
                onPress={action.onPress}
                opacity={action.disabled ? 0.5 : 1}
              >
                <SizableText size="$bodyMdMedium" color={action.labelColor}>
                  {action.label}
                </SizableText>
              </XStack>
            ),
          });
        });
      }

      return addOns.length > 0 ? addOns : undefined;
    };

    return (
      <YStack
        bg={ifOnDialog ? '$bgApp' : '$bgSubdued'}
        borderRadius="$3"
        borderWidth={ifOnDialog ? '$px' : 0}
        borderColor={ifOnDialog ? '$borderSubdued' : undefined}
        p="$3"
        pb="$2"
      >
        <SizableText size="$bodySm" color="$textSubdued" mb="$1">
          {label}
        </SizableText>
        <YStack>
          <Input
            flex={1}
            size="medium"
            value={value}
            onChangeText={handleInputChange}
            placeholder={placeholder}
            keyboardType={keyboardType}
            disabled={disabled}
            fontSize={getFontSize('$headingMd')}
            containerProps={{
              flex: 1,
              borderWidth: 0,
              bg: 'transparent',
              p: 0,
            }}
            InputComponentStyle={{
              p: 0,
              bg: 'transparent',
            }}
            addOns={renderAddOns()}
          />
          {error ? (
            <SizableText size="$bodySm" color="$red10" mt="$1">
              {error}
            </SizableText>
          ) : null}
          {helper ? (
            <XStack
              alignItems="center"
              alignSelf={helper.align === 'left' ? 'flex-start' : 'flex-end'}
              mt="$1"
              gap="$1"
            >
              <SizableText size="$bodySm" color="$textSubdued">
                {helper.text}
              </SizableText>
            </XStack>
          ) : null}
        </YStack>
      </YStack>
    );
  },
);

TradingFormInput.displayName = 'TradingFormInput';
