import type { ComponentProps, ComponentType } from 'react';

import {
  createLazyModuleComponent,
  preloadLazyComponents,
} from '@onekeyhq/shared/src/lazyLoad';

type IFormComponent = typeof import('./FormBase').Form;
type IFormProps = ComponentProps<IFormComponent>;
type IFormFieldProps = ComponentProps<IFormComponent['Field']>;
type IFormFieldDescriptionProps = ComponentProps<
  IFormComponent['FieldDescription']
>;
type IFormBaseModule = typeof import('./FormBase');

const loadFormBaseModule = () => import('./FormBase');

const LazyFormComponent = createLazyModuleComponent<
  IFormProps,
  IFormBaseModule
>(loadFormBaseModule, ({ Form }) => Form as ComponentType<IFormProps>);

const LazyFormFieldComponent = createLazyModuleComponent<
  IFormFieldProps,
  IFormBaseModule
>(
  loadFormBaseModule,
  ({ Form }) => Form.Field as ComponentType<IFormFieldProps>,
);

const LazyFormFieldDescriptionComponent = createLazyModuleComponent<
  IFormFieldDescriptionProps,
  IFormBaseModule
>(
  loadFormBaseModule,
  ({ Form }) =>
    Form.FieldDescription as ComponentType<IFormFieldDescriptionProps>,
);

function preloadForm() {
  return preloadLazyComponents([
    LazyFormComponent,
    LazyFormFieldComponent,
    LazyFormFieldDescriptionComponent,
  ]);
}

export const Form = Object.assign(LazyFormComponent, {
  Field: LazyFormFieldComponent,
  FieldDescription: LazyFormFieldDescriptionComponent,
  preload: preloadForm,
}) as IFormComponent & { preload: typeof preloadForm };

export type { IFieldErrorProps, IFieldProps, IFormProps } from './FormBase';
