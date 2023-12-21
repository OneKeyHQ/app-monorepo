import type { PropsWithChildren, ReactChildren, ReactElement } from 'react';
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useMemo,
} from 'react';

import { noop } from 'lodash';
import { Controller, FormProvider, useFormContext } from 'react-hook-form';
import { Fieldset, Form as TMForm, withStaticProperties } from 'tamagui';

import { HeightTransition } from '../../content';
import { Label, SizableText, YStack } from '../../primitives';
import { Input } from '../Input';
import { TextArea } from '../TextArea';

import type { ControllerRenderProps, UseFormReturn } from 'react-hook-form';
import type { GetProps } from 'tamagui';

interface IFormContextProps {
  /** Default value is true. Determines if validation will be triggered when element loses focus.  */
  validateOnBlur?: boolean;
}
export type IFormProps = PropsWithChildren<
  IFormContextProps & {
    form: UseFormReturn<any>;
  }
>;

const FormContext = createContext({} as IFormContextProps);

export function FormWrapper({
  form,
  children,
  validateOnBlur = true,
}: IFormProps) {
  const value = useMemo(
    () => ({
      validateOnBlur,
    }),
    [validateOnBlur],
  );
  return (
    <FormContext.Provider value={value}>
      <FormProvider {...form}>
        <TMForm onSubmit={noop}>
          <YStack space="$5">{children}</YStack>
        </TMForm>
      </FormProvider>
    </FormContext.Provider>
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
  validateOnBlur?: boolean,
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
  field.onBlur = validateOnBlur ? handleBlur : onBlur || noop;
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
  const { validateOnBlur } = useContext(FormContext);
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
                  getChildProps(
                    child,
                    field,
                    validateField,
                    error,
                    validateOnBlur,
                  ),
                )
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
