import React, { ComponentProps, FC } from 'react';

import Select from '../Select';

type FormSelectProps = ComponentProps<typeof Select>;

export const FormSelect: FC<FormSelectProps> = ({
  triggerProps = {},
  ...rest
}) => <Select {...rest} triggerProps={{ ...triggerProps, borderWidth: 1 }} />;
