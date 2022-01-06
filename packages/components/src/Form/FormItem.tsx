import React, { ComponentProps, ReactElement, cloneElement } from 'react';

import { Controller, ControllerProps, FieldValues } from 'react-hook-form';

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
          width="full"
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
