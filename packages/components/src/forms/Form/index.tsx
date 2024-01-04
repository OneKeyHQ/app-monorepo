import type { PropsWithChildren, ReactChildren, ReactElement } from 'react';
import { Children, cloneElement, isValidElement } from 'react';

import { noop } from 'lodash';
import { Controller, FormProvider, useFormContext } from 'react-hook-form';
import { Fieldset, Form as TMForm, withStaticProperties } from 'tamagui';

import { HeightTransition } from '../../content';
import { Label, SizableText, YStack } from '../../primitives';
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
        <YStack space="$5">{children}</YStack>
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
  error: Error,
) => {
  const { onChange, onChangeText } = child.props as {
    onChange?: (value: unknown) => void;
    onChangeText?: (value: unknown) => void;
  };
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
    formState: { errors },
  } = useFormContext();
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
              ? cloneElement(child, getChildProps(child, field, error))
              : child,
          )}
          <HeightTransition>
            {error?.message && (
              <SizableText
                key={error?.message}
                color="$textCritical"
                size="$bodyMd"
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
              </SizableText>
            )}
          </HeightTransition>
          {description ? (
            <SizableText size="$bodyMd" pt="$1.5" color="$textSubdued">
              {description}
            </SizableText>
          ) : null}
        </Fieldset>
      )}
    />
  );
}

export const Form = withStaticProperties(FormWrapper, {
  Field,
});
