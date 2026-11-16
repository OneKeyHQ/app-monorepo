/**
 * @jest-environment jsdom
 */
/* eslint-disable react-perf/jsx-no-new-object-as-prop, react-perf/jsx-no-new-function-as-prop */

import type { ReactNode } from 'react';
import { cloneElement, isValidElement } from 'react';

import { act, render, screen } from '@testing-library/react';

import { useForm } from '../../hooks/useForm';
import { Button } from '../../primitives';
import { Input } from '../Input';

import { Form } from './FormBase';

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

// Mirrors @tamagui/form on web: `TMForm` renders a real <form>, publishes its
// onSubmit through context, and `Form.Trigger` merges `context.onSubmit` into
// the child's press handler (asChild). A submit button wrapped in the trigger
// therefore reached the same submit twice — once through the trigger press,
// once through the form's `submit` event — which duplicated address book
// entries on a single Enter press.
jest.mock('@onekeyhq/components/src/shared/tamagui', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const FormContext = React.createContext<{ onSubmit?: () => void }>({});
  const MockForm = ({
    children,
    onSubmit,
  }: {
    children?: ReactNode;
    onSubmit?: () => void;
  }) =>
    React.createElement(
      FormContext.Provider,
      { value: { onSubmit } },
      React.createElement(
        'form',
        {
          onSubmit: (event: { preventDefault: () => void }) => {
            event.preventDefault();
            onSubmit?.();
          },
        },
        children,
      ),
    );
  const MockTrigger = ({ children }: { children?: ReactNode }) => {
    const { onSubmit } = React.useContext(FormContext);
    return isValidElement(children)
      ? cloneElement(children as never, { onPress: onSubmit } as never)
      : children;
  };
  return {
    TMForm: Object.assign(MockForm, { Trigger: MockTrigger }),
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
  const React = jest.requireActual<typeof import('react')>('react');
  const Wrapper = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  const MockButton = ({
    testID,
    type,
    onPress,
    children,
  }: {
    testID?: string;
    type?: 'submit' | 'button';
    onPress?: () => void;
    children?: ReactNode;
  }) =>
    React.createElement(
      'button',
      { type: type ?? 'button', 'data-testid': testID, onClick: onPress },
      children,
    );
  return {
    Button: MockButton,
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

jest.mock('../Input', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const MockInput = React.forwardRef<
    HTMLInputElement,
    { value?: string; onChangeText?: (value: string) => void; testID?: string }
  >(({ value, onChangeText, testID }, ref) => (
    <input
      ref={ref}
      data-testid={testID}
      value={value ?? ''}
      onChange={(event) => onChangeText?.(event.target.value)}
    />
  ));
  MockInput.displayName = 'MockInput';
  return { Input: MockInput };
});

jest.mock('../Checkbox', () => ({ Checkbox: () => null }));

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

function Harness({ onSubmit }: { onSubmit: () => void }) {
  const form = useForm<{ name: string }>({
    defaultValues: { name: 'Wallet 1' },
    onSubmit,
  });
  return (
    <Form form={form}>
      <Form.Field name="name">
        <Input testID="name-input" />
      </Form.Field>
      {/* Any in-form action, e.g. AddressInput's paste button. It must not be a
          submit button, or Enter would activate it (the old paste bug). */}
      <Button testID="inline-action">paste</Button>
    </Form>
  );
}

describe('Form submit gesture', () => {
  it('submits once when the form submit button is activated', async () => {
    const onSubmit = jest.fn();
    render(<Harness onSubmit={onSubmit} />);

    await act(async () => {
      // `.click()` runs the button's activation behavior (the same path the
      // browser takes for an implicit Enter submission), not just the handler.
      (screen.getByTestId('form-submit-button') as HTMLButtonElement).click();
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('keeps the hidden submit button as the only submit button', () => {
    const onSubmit = jest.fn();
    const { container } = render(<Harness onSubmit={onSubmit} />);

    const submitButtons = container.querySelectorAll('button[type="submit"]');
    expect(submitButtons).toHaveLength(1);
    expect(submitButtons[0].getAttribute('data-testid')).toBe(
      'form-submit-button',
    );
    // A regular in-form button stays a plain button, so activating it can never
    // submit the form (and Enter never routes to it as the default button).
    const inlineAction = screen.getByTestId(
      'inline-action',
    ) as HTMLButtonElement;
    expect(inlineAction.getAttribute('type')).toBe('button');
    inlineAction.click();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
