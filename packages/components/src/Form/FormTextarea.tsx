import type { ComponentProps, FC } from 'react';

import Textarea from '../Textarea';

type FormTextareaProps = {
  onChange?: (text: string) => void;
};

export const FormTextarea: FC<
  FormTextareaProps & ComponentProps<typeof Textarea>
> = ({ onChange, ...props }) => (
  <Textarea w="full" {...props} onChangeText={onChange} />
);
