import { type ComponentProps, useCallback, useRef } from 'react';

import { Group, Stack, TextArea } from '@onekeyhq/components';
import { getSharedInputStyles } from '@onekeyhq/components/src/forms/Input/sharedStyles';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { LayoutChangeEvent } from 'react-native';

const useAutoSize = (onChangeText?: (text: string) => void) => {
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const initHeightRef = useRef(0);

  const numberOfLines = 2;

  const resizeTextArea = useCallback(() => {
    const element = textAreaRef.current;
    if (element) {
      const height = element.scrollHeight;
      element.style.height = 'auto';
      element.style.height = `${
        height < initHeightRef.current ? initHeightRef.current : height
      }px`;
    }
  }, []);

  const handleTextChange = useCallback(
    (value: string) => {
      resizeTextArea();
      onChangeText?.(value);
    },
    [onChangeText, resizeTextArea],
  );

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    if (!initHeightRef.current) {
      initHeightRef.current = e.nativeEvent.layout.height;
    }
  }, []);

  return {
    onLayout: platformEnv.isNative ? undefined : handleLayout,
    textAreaRef,
    onChangeText: platformEnv.isNative ? onChangeText : handleTextChange,
    numberOfLines,
  };
};

export type IBaseInputProps = {
  extension?: React.ReactNode;
} & ComponentProps<typeof TextArea>;
function BaseInput(props: IBaseInputProps) {
  const { disabled, error, editable, size, extension, onChangeText, ...rest } =
    props;

  const sharedStyles = getSharedInputStyles({
    disabled,
    error,
    editable,
    size,
  });

  const {
    textAreaRef,
    numberOfLines,
    onLayout,
    onChangeText: handleChangeText,
  } = useAutoSize(onChangeText);

  return (
    <Group borderRadius={sharedStyles.borderRadius} disabled={disabled}>
      <Group.Item>
        <TextArea
          ref={textAreaRef}
          onLayout={onLayout}
          onChangeText={handleChangeText}
          borderBottomWidth={0}
          error={error}
          numberOfLines={numberOfLines}
          multiline
          editable={editable}
          disabled={disabled}
          size={size}
          spellCheck={false}
          focusStyle={undefined}
          {...rest}
        />
      </Group.Item>
      {extension && (
        <Group.Item>
          <Stack
            p="$3"
            pt="$2"
            borderWidth={sharedStyles.borderWidth}
            bg={sharedStyles.backgroundColor}
            borderTopWidth={0}
            borderColor={sharedStyles.borderColor}
          >
            {extension}
          </Stack>
        </Group.Item>
      )}
    </Group>
  );
}

export { BaseInput };
