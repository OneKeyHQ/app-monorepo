type IUseFormModule = typeof import('./useFormBase');
type IUnknownFunction = (...args: unknown[]) => unknown;

let useFormModule: IUseFormModule | undefined;
let useFormModulePromise: Promise<void> | undefined;

function loadUseFormModule() {
  useFormModulePromise ??= import('./useFormBase').then((module) => {
    useFormModule = module;
  });
  return useFormModulePromise;
}

function scheduleUseFormModulePreload() {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => {
      void loadUseFormModule();
    });
    return;
  }
  setTimeout(() => {
    void loadUseFormModule();
  }, 0);
}

scheduleUseFormModulePreload();

function getUseFormModule() {
  if (!useFormModule) {
    throw loadUseFormModule();
  }
  return useFormModule;
}

export const useForm: IUseFormModule['useForm'] = ((props) =>
  getUseFormModule().useForm(props)) as IUseFormModule['useForm'];

export const useFormContext: IUseFormModule['useFormContext'] = (() =>
  getUseFormModule().useFormContext()) as IUseFormModule['useFormContext'];

export const useFormState: IUseFormModule['useFormState'] = ((props) =>
  getUseFormModule().useFormState(props)) as IUseFormModule['useFormState'];

export const useFormWatch: IUseFormModule['useFormWatch'] = ((
  ...args: unknown[]
) =>
  (getUseFormModule().useFormWatch as IUnknownFunction)(
    ...args,
  )) as IUseFormModule['useFormWatch'];

export type {
  FieldError,
  FieldErrors,
  FieldPath,
  FieldPathValue,
  FieldValues,
  IFormMode,
  IReValidateMode,
  UseFormProps,
  UseFormReturn,
} from './useFormBase';
