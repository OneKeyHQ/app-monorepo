import type { ComponentProps } from 'react';
import { useCallback, useRef, useState } from 'react';

import { Input } from '.';

import { XStack } from '../../primitives';

import type { IInputRef } from '.';
import type { Stack } from '../../primitives';
import type {
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from 'react-native';

type IVerificationCodeInputProps = {
  length?: number;
  onChange?: (code: string) => void;
  onComplete?: (code: string) => void;
} & ComponentProps<typeof Stack>;

export function VerificationCodeInput({
  length = 6,
  onChange,
  onComplete,
  ...props
}: IVerificationCodeInputProps) {
  const [code, setCode] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<(IInputRef | null)[]>([]);

  const focusNextInput = useCallback((index: number) => {
    inputRefs.current[index + 1]?.focus();
  }, []);

  const focusPrevInput = useCallback((index: number) => {
    inputRefs.current[index - 1]?.focus();
  }, []);

  const handleChange = useCallback(
    (index: number, value: string) => {
      const newCode = [...code];
      newCode[index] = value.slice(-1);
      setCode(newCode);

      if (value && index < length - 1) {
        focusNextInput(index);
      }
      //   if (!value && index > 0) {
      //     focusPrevInput(index);
      //   }

      onChange?.(newCode.join(''));
      if (newCode.filter(Boolean).length >= length) {
        inputRefs?.current?.forEach((input) => {
          // TODO blur not working if rendered in Dialog
          input?.blur();
        });
        const completeCode = newCode.join('');
        onComplete?.(completeCode);
      }
    },
    [code, focusNextInput, length, onChange, onComplete],
  );

  const handleKeyDown = useCallback(
    (index: number, e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      const keyboardKey = e.nativeEvent.key;
      if (keyboardKey === 'Backspace') {
        if (code[index]) {
          handleChange(index, '');
        } else if (index > 0) {
          focusPrevInput(index);
          handleChange(index - 1, '');
        }
      }

      if (!Number.isNaN(Number(keyboardKey))) {
        handleChange(index, keyboardKey);
      }
    },
    [code, focusPrevInput, handleChange],
  );

  const inputSize = '$11';
  return (
    <XStack gap="$2" {...props}>
      {Array(length)
        .fill(null)
        .map((_, index) => (
          <Input
            key={index}
            keyboardType="number-pad"
            containerProps={{
              w: inputSize,
              borderColor: code[index] ? '$borderActive' : '$borderSubdued',
            }}
            autoFocus={index === 0}
            ref={(el) => (inputRefs.current[index] = el)}
            value={code[index]}
            onKeyPress={(e) => handleKeyDown(index, e)}
            maxLength={1}
            textAlign="center"
            w={inputSize}
            h={inputSize}
            minWidth={inputSize} // iOS
          />
        ))}
    </XStack>
  );
}
