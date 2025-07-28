import type {
  ComponentProps,
  PropsWithChildren,
  ReactElement,
  ReactNode,
} from 'react';
import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
} from 'react';

import { Controller, FormProvider, useFormContext } from 'react-hook-form';
import { useIntl } from 'react-intl';
import { Fieldset, Form as TMForm, withStaticProperties } from 'tamagui';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { HeightTransition } from '../../content';
import {
  Button,
  Label,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '../../primitives';
import { Input } from '../Input';
import { TextArea, TextAreaInput } from '../TextArea';

import { addFormInstance, removeFormInstance } from './formInstances';

import type { ISizableTextProps } from '../../primitives';
import type { IPropsWithTestId } from '../../types';
import type { ControllerRenderProps, UseFormReturn } from 'react-hook-form';
import type { GetProps } from 'tamagui';

export type IFormProps = IPropsWithTestId<{
  form: UseFormReturn<any> & {
    submit?: () => void;
  };
  header?: ReactNode;
  childrenGap?: ComponentProps<typeof YStack>['gap'];
}>;

function HiddenSubmit() {
  return platformEnv.isNative ? null : (
    <TMForm.Trigger asChild>
      <Button
        testID="form-submit-button"
        type="submit"
        opacity={0}
        position="absolute"
        pointerEvents="none"
      />
    </TMForm.Trigger>
  );
}

export function FormWrapper({
  form: formContext,
  children,
  childrenGap,
}: IFormProps) {
  useEffect(() => {
    addFormInstance(formContext);

    return () => {
      removeFormInstance(formContext);
    };
  }, [formContext]);

  return (
    <FormProvider {...formContext}>
      <TMForm onSubmit={formContext.submit} position="relative">
        <YStack gap={childrenGap ?? '$5'}>{children}</YStack>
        {formContext.submit ? <HiddenSubmit /> : null}
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

export interface IFieldErrorProps {
  error?: { message: string };
  errorMessageAlign?: IFieldProps['errorMessageAlign'];
  testID?: IFieldProps['testID'];
}

export type IFieldProps = Omit<GetProps<typeof Controller>, 'render'> &
  PropsWithChildren<{
    testID?: string;
    label?: string;
    display?:
      | 'inherit'
      | 'none'
      | 'inline'
      | 'block'
      | 'contents'
      | 'flex'
      | 'inline-flex';
    description?: string | ReactNode;
    horizontal?: boolean;
    optional?: boolean;
    labelAddon?: string | ReactElement | ReactNode;
    errorMessageAlign?: 'left' | 'center' | 'right';
    renderErrorMessage?: (props: IFieldErrorProps) => ReactElement;
  }>;

function Field({
  name,
  label,
  optional,
  display,
  errorMessageAlign,
  description,
  rules,
  children,
  horizontal = false,
  testID = '',
  labelAddon,
  renderErrorMessage,
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
  const error = errors[name] as unknown as Error & {
    translationId: ETranslations;
  };

  const descriptionElement = useMemo(() => {
    return typeof description === 'string' ? (
      <FieldDescription>{description}</FieldDescription>
    ) : (
      description
    );
  }, [description]);
  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field }) => (
        <Fieldset
          p="$0"
          m="$0"
          borderWidth={0}
          {...(display ? { display } : {})}
        >
          <Stack
            gap={horizontal ? '$1' : undefined}
            flexDirection={horizontal ? 'row' : 'column'}
            jc={horizontal ? 'space-between' : undefined}
            alignItems={horizontal ? 'center' : undefined}
            mb={horizontal ? '$1.5' : undefined}
          >
            <YStack flexShrink={horizontal ? 1 : undefined}>
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
              {horizontal ? descriptionElement : null}
            </YStack>
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
                textAlign={errorMessageAlign}
              >
                {renderErrorMessage ? (
                  renderErrorMessage({ error })
                ) : (
                  <SizableText
                    color="$textCritical"
                    size="$bodyMd"
                    textAlign={errorMessageAlign}
                    key={error?.message}
                    testID={`${testID}-message`}
                  >
                    {error?.message}
                  </SizableText>
                )}
              </SizableText>
            ) : null}
          </HeightTransition>
          {horizontal ? null : descriptionElement}
        </Fieldset>
      )}
    />
  );
}

export const Form = withStaticProperties(FormWrapper, {
  Field,
  FieldDescription,
});
