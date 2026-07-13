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

let loadFormBaseModulePromise: Promise<IFormBaseModule> | undefined;
function loadFormBaseModule() {
  if (!loadFormBaseModulePromise) {
    loadFormBaseModulePromise = import('./FormBase').catch((error: unknown) => {
      loadFormBaseModulePromise = undefined;
      throw error;
    });
  }
  return loadFormBaseModulePromise;
}

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

async function loadFormComponentModule() {
  const formBaseModule = await loadFormBaseModule();
  await preloadLazyComponents([
    LazyFormFieldComponent,
    LazyFormFieldDescriptionComponent,
  ]);
  return formBaseModule;
}

const LazyFormComponent = createLazyModuleComponent<
  IFormProps,
  IFormBaseModule
>(loadFormComponentModule, ({ Form }) => Form as ComponentType<IFormProps>);

export const Form = Object.assign(LazyFormComponent, {
  Field: LazyFormFieldComponent,
  FieldDescription: LazyFormFieldDescriptionComponent,
}) as IFormComponent & { preload: typeof LazyFormComponent.preload };

export type { IFieldErrorProps, IFieldProps, IFormProps } from './FormBase';
