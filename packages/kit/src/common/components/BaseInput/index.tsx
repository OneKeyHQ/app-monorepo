import type { ComponentProps } from 'react';

import { Group, Stack, TextArea } from '@onekeyhq/components';
import { getSharedInputStyles } from '@onekeyhq/components/src/forms/Input/sharedStyles';

export type IBaseInputProps = {
  extension?: React.ReactNode;
} & ComponentProps<typeof TextArea>;
function BaseInput(props: IBaseInputProps) {
  const { disabled, error, editable, size, extension, ...rest } = props;

  const sharedStyles = getSharedInputStyles({
    disabled,
    error,
    editable,
    size,
  });

  return (
    <Group borderRadius={sharedStyles.borderRadius} disabled={disabled}>
      <Group.Item>
        <TextArea
          borderBottomWidth={0}
          error={error}
          numberOfLines={2}
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
