import type { ComponentProps, ComponentType } from 'react';

import LazyLoad from '@onekeyhq/shared/src/lazyLoad';

type IFormComponent = typeof import('./FormBase').Form;
type IFormProps = ComponentProps<IFormComponent>;
type IFormFieldProps = ComponentProps<IFormComponent['Field']>;
type IFormFieldDescriptionProps = ComponentProps<
  IFormComponent['FieldDescription']
>;

const LazyFormComponent = LazyLoad<IFormProps>(async () => {
  const { Form } = await import('./FormBase');
  return { default: Form as ComponentType<IFormProps> };
});

function LazyForm(props: IFormProps) {
  return <LazyFormComponent {...props} />;
}

const LazyFormFieldComponent = LazyLoad<IFormFieldProps>(async () => {
  const { Form } = await import('./FormBase');
  return { default: Form.Field as ComponentType<IFormFieldProps> };
});

function LazyFormField(props: IFormFieldProps) {
  return <LazyFormFieldComponent {...props} />;
}

const LazyFormFieldDescriptionComponent = LazyLoad<IFormFieldDescriptionProps>(
  async () => {
    const { Form } = await import('./FormBase');
    return {
      default:
        Form.FieldDescription as ComponentType<IFormFieldDescriptionProps>,
    };
  },
);

function LazyFormFieldDescription(props: IFormFieldDescriptionProps) {
  return <LazyFormFieldDescriptionComponent {...props} />;
}

function preloadForm() {
  return Promise.all([
    LazyFormComponent.preload(),
    LazyFormFieldComponent.preload(),
    LazyFormFieldDescriptionComponent.preload(),
  ]);
}

export const Form = Object.assign(LazyForm, {
  Field: LazyFormField,
  FieldDescription: LazyFormFieldDescription,
  preload: preloadForm,
}) as IFormComponent & { preload: typeof preloadForm };

export type { IFieldErrorProps, IFieldProps, IFormProps } from './FormBase';
