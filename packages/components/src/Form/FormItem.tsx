import React, {
  ComponentProps,
  ReactElement,
  cloneElement,
  useMemo,
} from 'react';

import { Controller, ControllerProps, FieldValues } from 'react-hook-form';
import { useWindowDimensions } from 'react-native';

import Box from '../Box';
import FormControl from '../FormControl';
import Typography from '../Typography';

type FormItemProps = {
  label?: string;
  labelAddon?: ReactElement;
  helpText?: string;
  children?: ReactElement<any>;
  formControlProps?: ComponentProps<typeof FormControl>;
};

export function FormItem<TFieldValues extends FieldValues = FieldValues>({
  label,
  helpText,
  children,
  name,
  rules,
  defaultValue,
  formControlProps,
  labelAddon,
  ...props
}: Omit<ControllerProps<TFieldValues>, 'render'> & FormItemProps) {
  const { width } = useWindowDimensions();
  const formWidth = useMemo(() => (width < 768 ? 'full' : '320'), [width]);
  return (
    <Controller
      name={name}
      rules={rules}
      defaultValue={defaultValue}
      {...props}
      render={({
        field: { onChange, onBlur, value },
        fieldState: { error },
      }) => (
        <FormControl
          isInvalid={!!error}
          mb="2"
          width={formWidth}
          {...formControlProps}
        >
          <Box
            display="flex"
            flexDirection="row"
            justifyContent="space-between"
          >
            <FormControl.Label>
              <Typography.Body2Strong>{label}</Typography.Body2Strong>
            </FormControl.Label>
            {labelAddon}
          </Box>
          {children
            ? cloneElement(children, { onChange, onBlur, value })
            : null}
          {helpText ? (
            <FormControl.HelperText>{helpText}</FormControl.HelperText>
          ) : null}
          <FormControl.ErrorMessage>{error?.message}</FormControl.ErrorMessage>
        </FormControl>
      )}
    />
  );
}
