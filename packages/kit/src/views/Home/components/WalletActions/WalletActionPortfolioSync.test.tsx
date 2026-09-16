/** @jest-environment jsdom */

import { fireEvent, render } from '@testing-library/react';

import { WalletActionPortfolioSync } from './WalletActionPortfolioSync';

const requestPortfolioSync = jest.fn();
let portfolioSyncUiState: {
  disabled: boolean;
  request: () => void;
  visible: boolean;
} = {
  disabled: false,
  request: requestPortfolioSync,
  visible: true,
};

jest.mock('react-intl', () => {
  const actual = jest.requireActual<typeof import('react-intl')>('react-intl');
  const messages = jest.requireActual<
    typeof import('@onekeyhq/shared/src/locale/json/en_US.json')
  >('@onekeyhq/shared/src/locale/json/en_US.json');
  const intl = actual.createIntl({
    locale: 'en-US',
    messages: messages as Record<string, string>,
  });

  return {
    ...actual,
    useIntl: () => intl,
  };
});

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/tokenList', () => ({
  usePortfolioSyncUiStateAtom: () => [portfolioSyncUiState],
}));

jest.mock('@onekeyhq/components', () => {
  const ActionListItem = ({
    disabled,
    icon,
    label,
    onClose,
    onPress,
    testID,
  }: {
    disabled?: boolean;
    icon?: string;
    label: string;
    onClose: () => void;
    onPress?: (close: () => void) => void;
    testID?: string;
  }) => (
    <button
      type="button"
      data-icon={icon}
      data-testid={testID}
      disabled={disabled}
      onClick={() => onPress?.(onClose)}
    >
      {label}
    </button>
  );

  return {
    ActionList: { Item: ActionListItem },
  };
});

describe('WalletActionPortfolioSync', () => {
  beforeEach(() => {
    requestPortfolioSync.mockClear();
    portfolioSyncUiState = {
      disabled: false,
      request: requestPortfolioSync,
      visible: true,
    };
  });

  it('closes the menu before requesting an update', () => {
    const onClose = jest.fn();
    const view = render(<WalletActionPortfolioSync onClose={onClose} />);
    const action = view.getByTestId('home-update-portfolio-action');

    expect(action.textContent).toContain('Update device portfolio');
    expect(action.getAttribute('data-icon')).toBe('OnekeyDeviceCustom');

    fireEvent.click(action);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(requestPortfolioSync).toHaveBeenCalledTimes(1);
    expect(onClose.mock.invocationCallOrder[0]).toBeLessThan(
      requestPortfolioSync.mock.invocationCallOrder[0],
    );
  });

  it('honors the existing hardware-busy state', () => {
    portfolioSyncUiState = {
      disabled: true,
      request: requestPortfolioSync,
      visible: true,
    };
    const view = render(<WalletActionPortfolioSync onClose={jest.fn()} />);

    expect(
      (view.getByTestId('home-update-portfolio-action') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('stays hidden when the existing eligibility rule is false', () => {
    portfolioSyncUiState = {
      disabled: false,
      request: requestPortfolioSync,
      visible: false,
    };

    const view = render(<WalletActionPortfolioSync onClose={jest.fn()} />);
    expect(view.queryByTestId('home-update-portfolio-action')).toBeNull();
  });
});
