import React, { ComponentProps, ReactElement, cloneElement } from 'react';

import { Controller, ControllerProps, FieldValues } from 'react-hook-form';

import FormControl from '../FormControl';

type FormItemProps = {
  label?: string;
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
        <FormControl isInvalid={!!error} mb="2" {...formControlProps}>
          <FormControl.Label>{label}</FormControl.Label>
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
