import type { ComponentProps, FC } from 'react';

import Select from '../Select';

type FormSelectProps = ComponentProps<typeof Select>;

export const FormSelect: FC<FormSelectProps> = ({
  triggerProps = {},
  ...rest
}) => <Select {...rest} withReactModal triggerProps={{ ...triggerProps }} />;
