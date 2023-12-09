import type { PropsWithChildren, ReactChildren, ReactElement } from 'react';
import { Children, cloneElement, isValidElement, useCallback } from 'react';

import { noop } from 'lodash';
import { Controller, FormProvider, useFormContext } from 'react-hook-form';
import { Fieldset, Form as TMForm, withStaticProperties } from 'tamagui';

import { HeightTransition } from '../../layouts';
import { Label, Text, YStack } from '../../primitives';
import { Input } from '../Input';
import { TextArea } from '../TextArea';

import type { ControllerRenderProps, UseFormReturn } from 'react-hook-form';
import type { GetProps } from 'tamagui';

export type IFormProps = PropsWithChildren<{
  form: UseFormReturn<any>;
  header?: React.ReactNode;
}>;

export function FormWrapper({ form: formContext, children }: IFormProps) {
  return (
    <FormProvider {...formContext}>
      <TMForm onSubmit={noop}>
        <YStack space="$6">{children}</YStack>
      </TMForm>
    </FormProvider>
  );
}

const composeEventHandlers =
  (prev: (value: unknown) => unknown, next: (value: unknown) => unknown) =>
  (value: unknown) => {
    const result = prev(value);
    return (result as { defaultPrevented?: boolean })?.defaultPrevented
      ? result
      : next(result);
  };

const getChildProps = (
  child: ReactElement,
  field: ControllerRenderProps<any, string>,
  validateField: () => void,
  error: Error,
) => {
  const { onBlur, onChange, onChangeText } = child.props as {
    onBlur?: () => void;
    onChange?: (value: unknown) => void;
    onChangeText?: (value: unknown) => void;
  };
  const handleBlur = () => {
    if (onBlur) {
      onBlur();
    }
    validateField();
  };
  field.onBlur = handleBlur;
  switch (child.type) {
    case Input:
    case TextArea: {
      const handleChange = onChangeText
        ? composeEventHandlers(onChangeText, field.onChange)
        : field.onChange;
      return {
        ...field,
        error,
        onChangeText: handleChange,
      };
    }
    default: {
      const handleChange = onChange
        ? composeEventHandlers(onChange, field.onChange)
        : field.onChange;
      return {
        ...field,
        onChange: handleChange,
      };
    }
  }
};

type IFieldProps = Omit<GetProps<typeof Controller>, 'render'> &
  PropsWithChildren<{
    label?: string;
    description?: string;
  }>;

function Field({ name, label, description, rules, children }: IFieldProps) {
  const {
    control,
    trigger,
    formState: { errors },
  } = useFormContext();
  const validateField = useCallback(() => {
    void trigger(name);
  }, [name, trigger]);
  const error = errors[name] as unknown as Error;
  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field }) => (
        <Fieldset p="$0" m="$0" borderWidth={0}>
          {label && (
            <Label htmlFor={name} mb="$1.5">
              {label}
            </Label>
          )}
          {Children.map(children as ReactChildren, (child) =>
            isValidElement(child)
              ? cloneElement(
                  child,
                  getChildProps(child, field, validateField, error),
                )
              : child,
          )}
          <HeightTransition>
            {error?.message && (
              <Text
                key={error?.message}
                color="$textCritical"
                variant="$bodyMd"
                pt="$1.5"
                animation="quick"
                enterStyle={{
                  opacity: 0,
                  y: -6,
                }}
                exitStyle={{
                  opacity: 0,
                  y: -6,
                }}
              >
                {error.message}
              </Text>
            )}
          </HeightTransition>
          {description ? (
            <Text variant="$bodyMd" pt="$1.5" color="$textSubdued">
              {description}
            </Text>
          ) : null}
        </Fieldset>
      )}
    />
  );
}

export const Form = withStaticProperties(FormWrapper, {
  Field,
});
