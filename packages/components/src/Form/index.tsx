import type { PropsWithChildren, ReactChildren, ReactElement } from 'react';
import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useState,
} from 'react';

import { useHeaderHeight as useHeaderHeightOG } from '@react-navigation/elements';
import { noop } from 'lodash';
import { Controller, FormProvider, useFormContext } from 'react-hook-form';
import { KeyboardAvoidingView, Platform } from 'react-native';
import {
  Fieldset,
  Input,
  Label,
  ScrollView,
  Form as TMForm,
  YStack,
  useWindowDimensions,
  withStaticProperties,
} from 'tamagui';

import { Text } from '../Text';

import type {
  ControllerRenderProps,
  FieldErrors,
  UseFormReturn,
} from 'react-hook-form';
import type { GetProps } from 'tamagui';

const useHeaderHeight = () => {
  try {
    return useHeaderHeightOG();
  } catch (error) {
    return 0;
  }
};

export interface FormProps {
  form: UseFormReturn<any>;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export function FormWrapper({
  form: formContext,
  header,
  children,
  footer,
}: PropsWithChildren<FormProps>) {
  const [height, setHeight] = useState(0);
  const dimensions = useWindowDimensions();
  const headerHeight = useHeaderHeight();
  const modalOffsetFromTop = height ? dimensions.height - height : headerHeight;
  return (
    <FormProvider {...formContext}>
      <TMForm onSubmit={noop}>
        <YStack
          onLayout={(event) => {
            setHeight(event.nativeEvent.layout.height);
          }}
          gap="$4"
          flex={1}
          jc="center"
          $gtSm={{
            width: '100%',
            maxWidth: 600,
            als: 'center',
          }}
          // $gtSm={{ width: 500, mx: 'auto' }}
          $sm={{ jc: 'space-between' }}
        >
          {header}
          <ScrollView>
            <YStack p="$4" gap="$2" pb="$8">
              {children}
            </YStack>
          </ScrollView>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={modalOffsetFromTop}
          >
            <YStack pb="$4" px="$4" gap="$4" flexDirection="column-reverse">
              {footer}
            </YStack>
          </KeyboardAvoidingView>
        </YStack>
      </TMForm>
    </FormProvider>
  );
}

const getChildProps = (
  child: ReactElement,
  field: ControllerRenderProps<any, string>,
  validateField: () => void,
  error: Error,
) => {
  const { onBlur } = child.props as { onBlur?: () => void };
  const handleBlur = () => {
    if (onBlur) {
      onBlur();
    }
    validateField();
  };
  field.onBlur = handleBlur;
  switch (child.type) {
    case Input:
      return {
        ...field,
        borderColor: error ? '$textCritical' : undefined,
        onChangeText: field.onChange,
      };
    default:
      return field;
  }
};

type FieldProps = Omit<GetProps<typeof Controller>, 'render'> &
  PropsWithChildren<{
    label: string;
  }>;

function Field({ name, label, rules, children }: FieldProps) {
  const {
    control,
    trigger,
    formState: { errors },
  } = useFormContext();
  const validateField = useCallback(() => {
    trigger(name);
  }, [name, trigger]);
  const error = errors[name] as Error;
  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field }) => (
        <Fieldset borderWidth={0}>
          <Label htmlFor={name}>{label}</Label>
          {Children.map(children as ReactChildren, (child) =>
            isValidElement(child)
              ? cloneElement(
                  child,
                  getChildProps(child, field, validateField, error),
                )
              : child,
          )}
          {error?.message ? (
            <Text ml="$2" color="$textCritical" fontSize="$bodyMd">
              {error.message}
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

export { useForm } from 'react-hook-form';
