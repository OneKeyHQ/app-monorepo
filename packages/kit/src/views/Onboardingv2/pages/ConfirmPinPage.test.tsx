/** @jest-environment jsdom */

import { useRoute } from '@react-navigation/core';
import { act, fireEvent, render, waitFor } from '@testing-library/react';

import { EKeylessFinalizeAction } from '@onekeyhq/shared/src/keylessWallet/keylessWalletConsts';

import { useKeylessWallet } from '../../../components/KeylessWallet/useKeylessWallet';
import { PinInputLayout } from '../components/PinInputLayout';

import ConfirmPinPage from './ConfirmPinPage';

jest.mock('@react-navigation/core', () => ({
  useRoute: jest.fn(),
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('../../../components/AccountSelector/AccountSelectorProvider', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    AccountSelectorProviderMirror: ({
      children,
    }: {
      children?: import('react').ReactNode;
    }) => React.createElement(React.Fragment, null, children),
  };
});

jest.mock('../../../components/KeylessWallet/useKeylessWallet', () => ({
  useKeylessWallet: jest.fn(),
}));

jest.mock('../components/PinInputLayout', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    PinInputLayout: jest.fn(
      ({
        value,
        onChange,
        onSubmit,
        isInputDisabled,
        isSubmitDisabled,
        isLoading,
        errorMessage,
      }: import('react').ComponentProps<typeof PinInputLayout>) =>
        React.createElement(
          'div',
          null,
          React.createElement('input', {
            'aria-label': 'PIN',
            value,
            disabled: isInputDisabled,
            onChange: (event: import('react').ChangeEvent<HTMLInputElement>) =>
              onChange(event.target.value),
          }),
          React.createElement(
            'button',
            {
              disabled: isSubmitDisabled || isLoading,
              onClick: () => {
                void Promise.resolve(onSubmit()).catch(() => undefined);
              },
            },
            'Confirm',
          ),
          errorMessage ? React.createElement('span', null, errorMessage) : null,
        ),
    ),
  };
});

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('ConfirmPinPage', () => {
  const pin = '1234';
  const getKeylessOnboardingPin = jest.fn(async () => pin);
  const confirmKeylessOnboardingPin = jest.fn(async () => undefined);
  const handleKeylessOnboardingTimeout = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    getKeylessOnboardingPin.mockReset().mockResolvedValue(pin);
    confirmKeylessOnboardingPin.mockReset().mockResolvedValue(undefined);
    jest.mocked(useRoute).mockReturnValue({
      params: { action: EKeylessFinalizeAction.ResetPin },
    } as ReturnType<typeof useRoute>);
    jest.mocked(useKeylessWallet).mockReturnValue({
      getKeylessOnboardingPin,
      confirmKeylessOnboardingPin,
      handleKeylessOnboardingTimeout,
    } as unknown as ReturnType<typeof useKeylessWallet>);
  });

  test('locks input before reading the PIN and requires fresh validation after reset fails', async () => {
    const { getByRole } = render(<ConfirmPinPage />);
    const input = getByRole('textbox', { name: 'PIN' }) as HTMLInputElement;
    const button = getByRole('button', {
      name: 'Confirm',
    }) as HTMLButtonElement;
    fireEvent.change(input, { target: { value: pin } });
    await waitFor(() => expect(button.disabled).toBe(false));

    const previousCallbacks = jest.mocked(PinInputLayout).mock.lastCall?.[0];
    const pinRead = createDeferred<string>();
    const reset = createDeferred<undefined>();
    getKeylessOnboardingPin.mockReturnValueOnce(pinRead.promise);
    confirmKeylessOnboardingPin.mockReturnValueOnce(reset.promise);

    fireEvent.click(button);
    expect(input.disabled).toBe(true);
    expect(input.value).toBe('');
    expect(button.disabled).toBe(true);
    expect(confirmKeylessOnboardingPin).not.toHaveBeenCalled();

    // Replay events queued before the disabled native input reaches its view.
    await act(async () => {
      previousCallbacks?.onChange('9876');
      previousCallbacks?.onSubmit();
    });
    expect(input.value).toBe('');
    expect(getKeylessOnboardingPin).toHaveBeenCalledTimes(2);

    await act(async () => pinRead.resolve(pin));
    expect(confirmKeylessOnboardingPin).toHaveBeenCalledWith({
      pin,
      action: EKeylessFinalizeAction.ResetPin,
    });
    expect(input.disabled).toBe(true);
    fireEvent.click(button);
    expect(confirmKeylessOnboardingPin).toHaveBeenCalledTimes(1);

    await act(async () => reset.reject(new Error('Reset failed')));
    expect(input.disabled).toBe(false);
    expect(input.value).toBe('');
    expect(button.disabled).toBe(true);

    const retryPinRead = createDeferred<string>();
    getKeylessOnboardingPin.mockReturnValueOnce(retryPinRead.promise);
    fireEvent.change(input, { target: { value: pin } });
    expect(button.disabled).toBe(true);
    await act(async () => retryPinRead.resolve(pin));
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    await waitFor(() =>
      expect(confirmKeylessOnboardingPin).toHaveBeenCalledTimes(2),
    );
  });

  test('ignores a successful validation after the user deletes a digit', async () => {
    const pinRead = createDeferred<string>();
    getKeylessOnboardingPin.mockReturnValueOnce(pinRead.promise);
    const { getByRole } = render(<ConfirmPinPage />);
    const input = getByRole('textbox', { name: 'PIN' }) as HTMLInputElement;
    const button = getByRole('button', {
      name: 'Confirm',
    }) as HTMLButtonElement;

    fireEvent.change(input, { target: { value: pin } });
    fireEvent.change(input, { target: { value: '123' } });
    await act(async () => pinRead.resolve(pin));

    expect(input.value).toBe('123');
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(confirmKeylessOnboardingPin).not.toHaveBeenCalled();
  });

  test('rejects a queued submit after input changes before React commits', async () => {
    const { getByRole } = render(<ConfirmPinPage />);
    const input = getByRole('textbox', { name: 'PIN' }) as HTMLInputElement;
    const button = getByRole('button', {
      name: 'Confirm',
    }) as HTMLButtonElement;
    fireEvent.change(input, { target: { value: pin } });
    await waitFor(() => expect(button.disabled).toBe(false));
    const previousCallbacks = jest.mocked(PinInputLayout).mock.lastCall?.[0];

    await act(async () => {
      previousCallbacks?.onChange('123');
      previousCallbacks?.onSubmit();
    });

    expect(input.value).toBe('123');
    expect(input.disabled).toBe(false);
    expect(button.disabled).toBe(true);
    expect(getKeylessOnboardingPin).toHaveBeenCalledTimes(1);
    expect(confirmKeylessOnboardingPin).not.toHaveBeenCalled();
  });

  test('ignores an incorrect older PIN result after the current PIN validates', async () => {
    const oldPinRead = createDeferred<string>();
    getKeylessOnboardingPin.mockReturnValueOnce(oldPinRead.promise);
    const { getByRole, queryByText } = render(<ConfirmPinPage />);
    const input = getByRole('textbox', { name: 'PIN' });
    const button = getByRole('button', {
      name: 'Confirm',
    }) as HTMLButtonElement;

    fireEvent.change(input, { target: { value: '9876' } });
    fireEvent.change(input, { target: { value: pin } });
    await waitFor(() => expect(button.disabled).toBe(false));
    await act(async () => oldPinRead.resolve(pin));

    expect(button.disabled).toBe(false);
    expect(queryByText('incorrect_pin')).toBeNull();
  });
});
