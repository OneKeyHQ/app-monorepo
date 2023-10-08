import type { PropsWithChildren, ReactChildren, ReactElement } from 'react';
import { Children, cloneElement, isValidElement, useState } from 'react';

import { ErrorMessage } from '@hookform/error-message';
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
  Control,
  ControllerRenderProps,
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
) => {
  switch (child.type) {
    case Input:
      return {
        ...field,
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
    formState: { errors },
  } = useFormContext();
  console.log(errors);
  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field }) => (
        <Fieldset>
          <Label width={90} htmlFor={name}>
            {label}
          </Label>
          {Children.map(children as ReactChildren, (child) =>
            isValidElement(child)
              ? cloneElement(child, getChildProps(child, field))
              : child,
          )}
          <ErrorMessage
            errors={errors}
            name={name}
            render={({ message }) => <Text>{message}</Text>}
          />
        </Fieldset>
      )}
    />
  );
}

export const Form = withStaticProperties(FormWrapper, {
  Field,
});

export { useForm } from 'react-hook-form';
