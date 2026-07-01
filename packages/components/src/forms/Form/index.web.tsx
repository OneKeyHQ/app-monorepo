import type { ComponentProps, ComponentType } from 'react';
import { Suspense, lazy } from 'react';

type IFormComponent = typeof import('./FormBase').Form;
type IFormProps = ComponentProps<IFormComponent>;
type IFormFieldProps = ComponentProps<IFormComponent['Field']>;
type IFormFieldDescriptionProps = ComponentProps<
  IFormComponent['FieldDescription']
>;

const LazyFormComponent = lazy(async () => {
  const { Form } = await import('./FormBase');
  return { default: Form as ComponentType<IFormProps> };
});

function LazyForm(props: IFormProps) {
  return (
    <Suspense fallback={null}>
      <LazyFormComponent {...props} />
    </Suspense>
  );
}

const LazyFormFieldComponent = lazy(async () => {
  const { Form } = await import('./FormBase');
  return { default: Form.Field as ComponentType<IFormFieldProps> };
});

function LazyFormField(props: IFormFieldProps) {
  return (
    <Suspense fallback={null}>
      <LazyFormFieldComponent {...props} />
    </Suspense>
  );
}

const LazyFormFieldDescriptionComponent = lazy(async () => {
  const { Form } = await import('./FormBase');
  return {
    default: Form.FieldDescription as ComponentType<IFormFieldDescriptionProps>,
  };
});

function LazyFormFieldDescription(props: IFormFieldDescriptionProps) {
  return (
    <Suspense fallback={null}>
      <LazyFormFieldDescriptionComponent {...props} />
    </Suspense>
  );
}

export const Form = Object.assign(LazyForm, {
  Field: LazyFormField,
  FieldDescription: LazyFormFieldDescription,
}) as IFormComponent;

export type { IFieldErrorProps, IFieldProps, IFormProps } from './FormBase';
