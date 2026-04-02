import {
  type ComponentProps,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { Group, Stack, TextArea } from '@onekeyhq/components';
import { getSharedInputStyles } from '@onekeyhq/components/src/forms/Input/sharedStyles';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { LayoutChangeEvent } from 'react-native';

const useAutoSize = (value?: string, numberOfLines = 2) => {
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const [minHeight, setMinHeight] = useState<number | undefined>(undefined);
  const initHeightRef = useRef(0);

  useEffect(() => {
    const element = textAreaRef.current;
    if (!platformEnv.isNative && element) {
      // We need to reset the height momentarily to get the correct scrollHeight for the textArea
      element.style.height = '0px';

      // We then set the height directly, outside of the render loop
      // Trying to set this with state or a ref will product an incorrect value.
      element.style.height = `${Math.max(
        element.scrollHeight,
        initHeightRef.current,
      )}px`;
    }
  }, [textAreaRef, value]);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    if (!initHeightRef.current) {
      initHeightRef.current = e.nativeEvent.layout.height;
      // Use initial layout height as minHeight on iOS & Web
      // (TextArea sizeVariant already accounts for numberOfLines)
      if (!platformEnv.isNativeAndroid) {
        setMinHeight(initHeightRef.current);
      }
    }
  }, []);

  return {
    minHeight,
    onLayout: platformEnv.isNativeAndroid ? undefined : handleLayout,
    textAreaRef,
    numberOfLines,
  };
};

export type IBaseInputProps = {
  extension?: React.ReactNode;
  numberOfLines?: number;
} & ComponentProps<typeof TextArea>;
function BaseInput(props: IBaseInputProps) {
  const {
    disabled,
    error,
    editable,
    size,
    extension,
    value,
    numberOfLines: numberOfLinesProp = 2,
    ...rest
  } = props;

  const sharedStyles = getSharedInputStyles({
    disabled,
    error,
    editable,
    size,
  });

  const { minHeight, textAreaRef, numberOfLines, onLayout } = useAutoSize(
    value,
    numberOfLinesProp,
  );

  return (
    <Group borderRadius={sharedStyles.borderRadius} disabled={disabled}>
      <Group.Item>
        <TextArea
          ref={textAreaRef as any}
          value={value}
          onLayout={onLayout}
          borderBottomWidth={extension ? 0 : undefined}
          error={error}
          numberOfLines={numberOfLines}
          multiline
          editable={editable}
          disabled={disabled}
          size={size}
          spellCheck={false}
          // focusVisibleStyle={undefined}
          minHeight={minHeight}
          {...rest}
        />
      </Group.Item>
      {extension ? (
        <Group.Item>
          <Stack
            px={sharedStyles.px}
            py={size === 'large' ? '$3.5' : '$1.5'}
            borderWidth={sharedStyles.borderWidth}
            bg={sharedStyles.backgroundColor}
            borderTopWidth={0}
            borderColor={sharedStyles.borderColor}
          >
            {extension}
          </Stack>
        </Group.Item>
      ) : null}
    </Group>
  );
}

export { BaseInput };
