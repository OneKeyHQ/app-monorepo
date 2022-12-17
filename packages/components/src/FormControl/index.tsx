import type { ComponentProps, FC } from 'react';

import { FormControl } from 'native-base';

const { Label } = FormControl;
const { HelperText } = FormControl;

type LabelProps = ComponentProps<typeof Label>;
type HelperTextProps = ComponentProps<typeof HelperText>;

const LabelComponent: FC<LabelProps> = (props) => (
  <Label _text={{ color: 'text-default' }} {...props} />
);

const HelperTextComponent: FC<HelperTextProps> = (props) => (
  <HelperText _text={{ color: 'text-subdued' }} {...props} />
);

/* eslint @typescript-eslint/no-unsafe-member-access: "off" */
(FormControl as any).Label = LabelComponent;
(FormControl as any).HelperText = HelperTextComponent;

export default FormControl;
