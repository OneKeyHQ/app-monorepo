import React, { ComponentProps, FC } from 'react';

import Select from '../Select';

type FormSelectProps = ComponentProps<typeof Select>;

export const FormSelect: FC<FormSelectProps> = (props) => <Select {...props} />;
