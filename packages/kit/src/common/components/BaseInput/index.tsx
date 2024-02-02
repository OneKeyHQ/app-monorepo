import { type ComponentProps, useCallback, useRef, useState } from 'react';

import { Group, Stack, TextArea } from '@onekeyhq/components';
import { getSharedInputStyles } from '@onekeyhq/components/src/forms/Input/sharedStyles';

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

  const [lines, setLines] = useState(2);

  const textareaRef = useRef();

  const handleChange = useCallback(
    (value: string) => {
      console.log('textareaRef', textareaRef);
      onChangeText?.(value);
    },
    [onChangeText],
  );
  return (
    <Group borderRadius={sharedStyles.borderRadius} disabled={disabled}>
      <Group.Item>
        <TextArea
          onChangeText={handleChange}
          borderBottomWidth={0}
          error={error}
          numberOfLines={lines}
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
            px={sharedStyles.px}
            py={size === 'large' ? '$3.5' : '$2.5'}
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
