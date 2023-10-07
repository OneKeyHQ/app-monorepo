import type { PropsWithChildren } from 'react';
import { useState } from 'react';

import { useHeaderHeight as useHeaderHeightOG } from '@react-navigation/elements';
import { FormProvider } from 'react-hook-form';
import { KeyboardAvoidingView, Platform } from 'react-native';
import {
  Fieldset,
  ScrollView,
  Form as TMForm,
  YStack,
  useWindowDimensions,
  withStaticProperties,
} from 'tamagui';

import type { UseFormReturn } from 'react-hook-form';
import type { JsxElement } from 'typescript';

const useHeaderHeight = () => {
  try {
    return useHeaderHeightOG();
  } catch (error) {
    return 0;
  }
};

export interface FormProps {
  onSubmit: () => void;
  form: UseFormReturn;
  header: JsxElement;
  footer: JsxElement;
}

export function FormWrapper({
  onSubmit,
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
      <TMForm onSubmit={onSubmit}>
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

export const Form = withStaticProperties(FormWrapper, {
  Field: Fieldset,
});

export { useForm } from 'react-hook-form';
