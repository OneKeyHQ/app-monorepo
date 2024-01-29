import type { ComponentProps } from 'react';
import { useState } from 'react';

import { Stack, TextArea, YStack } from '@onekeyhq/components';
import { getSharedInputStyles } from '@onekeyhq/components/src/forms/Input/sharedStyles';

export type IBaseInputProps = {
  extension?: React.ReactNode;
} & ComponentProps<typeof TextArea>;
function BaseInput(props: IBaseInputProps) {
  const { onBlur, disabled, error, editable, size, extension, ...rest } = props;
  const [isFocus, setFocus] = useState<boolean>(false);

  const sharedStyles = getSharedInputStyles({
    disabled,
    error,
    editable,
    size,
  });

  return (
    <YStack space="$2">
      <YStack
        space="$2"
        borderWidth={sharedStyles.borderWidth}
        borderColor={sharedStyles.borderColor}
        borderRadius={sharedStyles.borderRadius}
        outlineColor={
          isFocus ? sharedStyles.focusStyle.outlineColor : undefined
        }
        outlineStyle={
          isFocus ? sharedStyles.focusStyle.outlineStyle : undefined
        }
        outlineWidth={
          isFocus ? sharedStyles.focusStyle.outlineWidth : undefined
        }
      >
        <TextArea
          w="full"
          onFocus={() => setFocus(true)}
          onBlur={(e) => {
            setFocus(false);
            onBlur?.(e);
          }}
          borderColor="$transparent"
          hoverStyle={{ borderColor: '$transparent' }}
          focusStyle={{ borderColor: '$transparent' }}
          {...rest}
        />
        {extension && (
          <Stack py={sharedStyles.py} px={sharedStyles.px}>
            {extension}
          </Stack>
        )}
      </YStack>
    </YStack>
  );
}

export { BaseInput };
