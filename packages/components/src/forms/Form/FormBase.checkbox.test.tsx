/**
 * @jest-environment jsdom
 */
/* eslint-disable react-perf/jsx-no-new-object-as-prop, react-perf/jsx-no-new-function-as-prop */

import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Checkbox } from '../Checkbox';

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
  default: { isNative: true, isNativeAndroid: true },
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

jest.mock('../../content', () => ({ Divider: () => null }));
jest.mock('../../layouts', () => ({ ListView: () => null }));
jest.mock('../../utils/getFontSize', () => ({ NATIVE_HIT_SLOP: 8 }));

jest.mock('../../primitives', () => {
  const Wrapper = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  const XStack = ({
    children,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    onPress?: (event: unknown) => void;
    testID?: string;
  }) =>
    onPress ? (
      <button type="button" data-testid={testID} onClick={onPress}>
        {children}
      </button>
    ) : (
      <div data-testid={testID}>{children}</div>
    );
  const YStack = ({
    children,
    bg,
    onBlur,
    onFocus,
  }: {
    children?: ReactNode;
    bg?: string;
    onBlur?: () => void;
    onFocus?: () => void;
  }) => (
    <div
      data-testid={bg ? 'checkbox-square' : undefined}
      data-blur-handler={bg ? String(!!onBlur) : undefined}
      data-focus-handler={bg ? String(!!onFocus) : undefined}
      onBlur={onBlur}
      onFocus={onFocus}
    >
      {children}
    </div>
  );
  return {
    Button: Wrapper,
    Icon: () => null,
    Label: Wrapper,
    SizableText: Wrapper,
    Stack: Wrapper,
    XStack,
    YStack,
  };
});

jest.mock('../../utils/animationConstants', () => ({
  ANIMATE_ONLY_OPACITY_TRANSFORM: [],
}));

jest.mock('../Input', () => ({ Input: () => null }));

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

type ICheckboxForm = UseFormReturn<{ confirmed: boolean }>;

function Harness({
  formRef,
  disabled,
  mode = 'onBlur',
  onChange,
}: {
  formRef: { current?: ICheckboxForm };
  disabled?: boolean;
  mode?: 'onBlur' | 'onTouched';
  onChange?: (value: unknown) => unknown;
}) {
  const form = useForm<{ confirmed: boolean }>({
    defaultValues: { confirmed: true },
    mode,
  });
  formRef.current = form;
  return (
    <Form form={form}>
      <Form.Field
        name="confirmed"
        rules={{
          validate: (value: unknown) =>
            value === true || 'Confirmation required',
        }}
      >
        <Checkbox
          label="Confirm"
          testID="checkbox"
          disabled={disabled}
          onChange={onChange}
        />
      </Form.Field>
      <span data-testid="touched">
        {String(!!form.formState.touchedFields.confirmed)}
      </span>
    </Form>
  );
}

describe('native Form.Field Checkbox interaction', () => {
  beforeEach(() => {
    platformEnv.isNative = true;
  });

  it.each(['onBlur', 'onTouched'] as const)(
    'marks touched and validates the updated value in %s mode',
    async (mode) => {
      const formRef: { current?: ICheckboxForm } = {};
      render(<Harness formRef={formRef} mode={mode} />);
      const square = screen.getByTestId('checkbox-square');
      expect(square.getAttribute('data-blur-handler')).toBe('false');
      expect(square.getAttribute('data-focus-handler')).toBe('false');
      expect(screen.getByTestId('touched').textContent).toBe('false');

      await act(async () => {
        fireEvent.click(square);
      });
      expect(formRef.current?.getValues('confirmed')).toBe(false);
      expect(screen.getByTestId('touched').textContent).toBe('true');
      expect(screen.getByText('Confirmation required')).toBeTruthy();

      await act(async () => {
        fireEvent.click(screen.getByText('Confirm'));
      });
      expect(formRef.current?.getValues('confirmed')).toBe(true);
      expect(screen.queryByText('Confirmation required')).toBeNull();
    },
  );

  it('leaves disabled Checkbox value and touched state unchanged', async () => {
    const formRef: { current?: ICheckboxForm } = {};
    render(<Harness formRef={formRef} disabled />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('checkbox-square'));
    });
    expect(formRef.current?.getValues('confirmed')).toBe(true);
    expect(screen.getByTestId('touched').textContent).toBe('false');
    expect(screen.queryByText('Confirmation required')).toBeNull();
  });

  it('preserves caller change composition before validating', async () => {
    const formRef: { current?: ICheckboxForm } = {};
    const onChange = jest.fn((value: unknown) => value);
    render(<Harness formRef={formRef} onChange={onChange} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('checkbox-square'));
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(false);
    expect(formRef.current?.getValues('confirmed')).toBe(false);
    expect(screen.getByText('Confirmation required')).toBeTruthy();
  });

  it('does not mark touched when the caller prevents the field change', async () => {
    const formRef: { current?: ICheckboxForm } = {};
    const onChange = jest.fn(() => ({ defaultPrevented: true }));
    render(<Harness formRef={formRef} onChange={onChange} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('checkbox-square'));
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(formRef.current?.getValues('confirmed')).toBe(true);
    expect(screen.getByTestId('touched').textContent).toBe('false');
  });

  it('keeps Web validation tied to actual blur', async () => {
    platformEnv.isNative = false;
    const formRef: { current?: ICheckboxForm } = {};
    render(<Harness formRef={formRef} />);
    const square = screen.getByTestId('checkbox-square');
    expect(square.getAttribute('data-blur-handler')).toBe('true');
    await act(async () => {
      fireEvent.click(square);
    });
    expect(formRef.current?.getValues('confirmed')).toBe(false);
    expect(screen.getByTestId('touched').textContent).toBe('false');
    expect(screen.queryByText('Confirmation required')).toBeNull();
    await act(async () => {
      fireEvent.blur(square);
    });
    expect(screen.getByTestId('touched').textContent).toBe('true');
    expect(screen.getByText('Confirmation required')).toBeTruthy();
  });
});
