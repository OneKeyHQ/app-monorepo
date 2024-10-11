import type { PropsWithChildren, ReactElement, ReactNode } from 'react';
import { Children, cloneElement, isValidElement, useCallback } from 'react';

import { noop } from 'lodash';
import { Controller, FormProvider, useFormContext } from 'react-hook-form';
import { useIntl } from 'react-intl';
import { Fieldset, Form as TMForm, withStaticProperties } from 'tamagui';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { HeightTransition } from '../../content';
import {
  Label,
  SizableText,
  Stack,
  View,
  XStack,
  YStack,
} from '../../primitives';
import { Input } from '../Input';
import { TextArea, TextAreaInput } from '../TextArea';

import type { ISizableTextProps } from '../../primitives';
import type { IPropsWithTestId } from '../../types';
import type { ControllerRenderProps, UseFormReturn } from 'react-hook-form';
import type { GetProps } from 'tamagui';

export type IFormProps = IPropsWithTestId<{
  form: UseFormReturn<any>;
  header?: React.ReactNode;
}>;

export function FormWrapper({ form: formContext, children }: IFormProps) {
  return (
    <FormProvider {...formContext}>
      <TMForm onSubmit={noop}>
        <YStack gap="$5">{children}</YStack>
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
  const hasError = !!error;
  const { onChange, onChangeText } = child.props as {
    onChange?: (value: unknown) => void;
    onChangeText?: (value: unknown) => void;
  };
  switch (child.type) {
    case Input:
    case TextAreaInput:
    case TextArea: {
      const handleChange = onChangeText
        ? composeEventHandlers(onChangeText, field.onChange)
        : field.onChange;
      return {
        ...field,
        error,
        hasError,
        onChangeText: handleChange,
      };
    }
    default: {
      const handleChange = onChange
        ? composeEventHandlers(onChange, field.onChange)
        : field.onChange;
      return {
        ...field,
        error,
        hasError,
        onChange: handleChange,
      };
    }
  }
};

export function FieldDescription(props: ISizableTextProps) {
  return (
    <SizableText size="$bodyMd" pt="$1.5" color="$textSubdued" {...props} />
  );
}

type IFieldProps = Omit<GetProps<typeof Controller>, 'render'> &
  PropsWithChildren<{
    testID?: string;
    label?: string;
    description?: string | ReactNode;
    horizontal?: boolean;
    optional?: boolean;
    labelAddon?: string | ReactElement;
  }>;

function Field({
  name,
  label,
  optional,
  description,
  rules,
  children,
  horizontal = false,
  testID = '',
  labelAddon,
}: IFieldProps) {
  const intl = useIntl();
  const {
    control,
    formState: { errors },
  } = useFormContext();
  const renderLabelAddon = useCallback(() => {
    if (labelAddon) {
      return typeof labelAddon === 'string' ? (
        <SizableText size="$bodyMdMedium">{labelAddon}</SizableText>
      ) : (
        labelAddon
      );
    }
    return null;
  }, [labelAddon]);
  const error = errors[name] as unknown as Error;
  // if (error) {
  //   debugger;
  // }
  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field }) => (
        <Fieldset p="$0" m="$0" borderWidth={0}>
          <Stack
            flexDirection={horizontal ? 'row' : 'column'}
            jc={horizontal ? 'space-between' : undefined}
            alignItems={horizontal ? 'center' : undefined}
            mb={horizontal ? '$1.5' : undefined}
          >
            {label ? (
              <XStack
                mb={horizontal ? undefined : '$1.5'}
                justifyContent="space-between"
              >
                <XStack>
                  <Label htmlFor={name}>{label}</Label>
                  {optional ? (
                    <SizableText size="$bodyMd" color="$textSubdued" pl="$1">
                      {`(${intl.formatMessage({
                        id: ETranslations.form_optional_indicator,
                      })})`}
                    </SizableText>
                  ) : null}
                </XStack>
                {renderLabelAddon()}
              </XStack>
            ) : null}
            {Children.map(children as ReactNode[], (child) =>
              isValidElement(child)
                ? cloneElement(child, getChildProps(child, field, error))
                : child,
            )}
          </Stack>
          <HeightTransition>
            {error?.message ? (
              <SizableText
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
                <SizableText
                  color="$textCritical"
                  size="$bodyMd"
                  key={error?.message}
                  testID={`${testID}-message`}
                >
                  {error.message}
                </SizableText>
              </SizableText>
            ) : null}
          </HeightTransition>
          {typeof description === 'string' ? (
            <FieldDescription>{description}</FieldDescription>
          ) : (
            description
          )}
        </Fieldset>
      )}
    />
  );
}

export const Form = withStaticProperties(FormWrapper, {
  Field,
  FieldDescription,
});
