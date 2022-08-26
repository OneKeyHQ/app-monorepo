import React, { ComponentProps, FC } from 'react';

import Textarea from '../Textarea';

type FormTextareaProps = {
  enableInputWhiteSpace?: boolean;
  onChange?: (text: string) => void;
};

export const FormTextarea: FC<
  FormTextareaProps & ComponentProps<typeof Textarea>
> = ({ onChange, ...props }) => (
  <Textarea
    w="full"
    {...props}
    onChangeText={(text) => {
      if (props.enableInputWhiteSpace) {
        return onChange?.(text);
      }
      return onChange?.(text?.trim?.());
    }}
  />
);
