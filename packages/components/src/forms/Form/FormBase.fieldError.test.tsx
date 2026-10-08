/**
 * @jest-environment jsdom
 */
/* eslint-disable react-perf/jsx-no-new-object-as-prop, react-perf/jsx-no-new-function-as-prop */

import type { ReactNode } from 'react';
import { memo } from 'react';

import { act, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';

import { Input } from '../Input';

import { Form } from './FormBase';

import type { UseFormReturn } from 'react-hook-form';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: { form_optional_indicator: 'form_optional_indicator' },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));

jest.mock('@onekeyhq/components/src/shared/tamagui', () => {
  const Wrapper = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    TMForm: Object.assign(Wrapper, { Trigger: Wrapper }),
    withStaticProperties: (
      component: object,
      statics: Record<string, unknown>,
    ) => Object.assign(component, statics),
  };
});

jest.mock('../../content/HeightTransition', () => ({
  HeightTransition: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock('../../primitives', () => {
  const Wrapper = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Button: Wrapper,
    Label: Wrapper,
    SizableText: Wrapper,
    Stack: Wrapper,
    XStack: Wrapper,
    YStack: Wrapper,
  };
});

jest.mock('../../utils/animationConstants', () => ({
  ANIMATE_ONLY_OPACITY_TRANSFORM: [],
}));

jest.mock('../Input', () => ({
  Input: jest.requireActual<typeof import('react')>('react').forwardRef<
    HTMLInputElement,
    {
      value?: string;
      onChangeText?: (value: string) => void;
      testID?: string;
    }
  >(({ value, onChangeText, testID }, ref) => <input ref={ref} data-testid={testID} value={value ?? ''} onChange={(event) => onChangeText?.(event.target.value)} />),
}));

jest.mock('../TextArea', () => ({
  TextArea: () => null,
  TextAreaInput: () => null,
}));

jest.mock('./Fieldset', () => ({
  Fieldset: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

jest.mock('./formInstances', () => ({
  addFormInstance: jest.fn(),
  removeFormInstance: jest.fn(),
}));

type INameForm = UseFormReturn<{ name: string }>;

// Production serves `Form` through LazyLoad, which returns
// `memo(LazyLoadContainer)`. `Dialog.Form` then renders it with a stable
// `form` object and the static `renderContent` children, so a parent
// re-render never reaches FormProvider and its context snapshot goes stale.
const MemoForm = memo(Form);

const stableChildren = (
  <Form.Field
    name="name"
    testID="name-field"
    rules={{ required: { value: true, message: 'Name is required' } }}
  >
    <Input testID="name-input" />
  </Form.Field>
);

function Harness({ formRef }: { formRef: { current?: INameForm } }) {
  const form = useForm<{ name: string }>({ values: { name: 'Wallet 1' } });
  formRef.current = form;
  return <MemoForm form={form}>{stableChildren}</MemoForm>;
}

describe('Form.Field error rendering', () => {
  it('shows and clears the field error under a memoized provider', async () => {
    const formRef: { current?: INameForm } = {};
    render(<Harness formRef={formRef} />);
    const input = screen.getByTestId('name-input') as HTMLInputElement;
    expect(input.value).toBe('Wallet 1');

    await act(async () => {
      formRef.current?.setValue('name', '');
    });
    let valid: boolean | undefined;
    await act(async () => {
      valid = await formRef.current?.trigger();
    });
    expect(valid).toBe(false);
    expect(screen.getByText('Name is required')).toBeTruthy();

    await act(async () => {
      formRef.current?.setValue('name', 'Wallet 2');
    });
    await act(async () => {
      valid = await formRef.current?.trigger();
    });
    expect(valid).toBe(true);
    expect(screen.queryByText('Name is required')).toBeNull();
  });
});
