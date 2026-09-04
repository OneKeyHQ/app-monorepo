/** @jest-environment jsdom */

import TravelMode from './';

import { act, fireEvent, render, waitFor } from '@testing-library/react';

type ITravelModeStatus = {
  enabled: boolean;
  restartRequired: boolean;
};

const mockDialogShow = jest.fn<void, [unknown]>();
const mockDialogLoading = jest.fn<void, [unknown]>();
const mockLoadingClose = jest.fn<Promise<void>, []>();
const mockNavigationPop = jest.fn();
const mockNavigationAddListener = jest.fn(() => jest.fn());
const mockEnterPage = jest.fn<Promise<ITravelModeStatus>, [unknown]>();
const mockLeavePage = jest.fn<Promise<void>, [unknown]>();
const mockSetEnabled = jest.fn<Promise<void>, [unknown]>();
const mockRetryRestart = jest.fn<Promise<void>, [unknown]>();

let mockCurrentEnabled = false;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    pop: mockNavigationPop,
    addListener: mockNavigationAddListener,
  }),
  useRoute: () => ({ params: { admissionId: 'admission-id' } }),
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  type IButtonProps = {
    children?: React.ReactNode;
    onPress?: () => void;
    testID?: string;
  };
  type ISwitchProps = {
    disabled?: boolean;
    onChange: (value: boolean) => void;
    testID?: string;
    value: boolean;
  };
  const Stack = ({ children }: { children?: import('react').ReactNode }) =>
    React.createElement('div', null, children);
  const Page = Stack as typeof Stack & {
    Header: typeof Stack;
    Body: typeof Stack;
  };
  Page.Header = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('header', null, children);
  Page.Body = Stack;

  return {
    Button: ({ children, onPress, testID }: IButtonProps) =>
      React.createElement(
        'button',
        { type: 'button', onClick: onPress, 'data-testid': testID },
        children,
      ),
    Dialog: {
      show: (options: unknown) => mockDialogShow(options),
      loading: (options: unknown) => {
        mockDialogLoading(options);
        return { close: mockLoadingClose };
      },
    },
    ESwitchSize: { small: 'small' },
    Icon: () => null,
    Page,
    SizableText: Stack,
    Spinner: () => React.createElement('div', { 'data-testid': 'spinner' }),
    Switch: ({ disabled, onChange, testID, value }: ISwitchProps) =>
      React.createElement(
        'button',
        {
          disabled,
          type: 'button',
          onClick: () => onChange(!value),
          'data-testid': testID,
        },
        String(value),
      ),
    Toast: { error: jest.fn() },
    XStack: Stack,
    YStack: Stack,
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceTravelMode: {
      enterPage: (params: unknown) => mockEnterPage(params),
      leavePage: (params: unknown) => mockLeavePage(params),
      retryRestart: (params: unknown) => mockRetryRestart(params),
      setEnabled: (params: unknown) => mockSetEnabled(params),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/components/ListItem', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  type IListItemProps = {
    children?: React.ReactNode;
    subtitle?: React.ReactNode;
    title?: React.ReactNode;
  };
  return {
    ListItem: ({ children, subtitle, title }: IListItemProps) =>
      React.createElement('div', null, title, subtitle, children),
  };
});

jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: {
    global_retry: 'global_retry',
    global_unknown_error_retry_message: 'global_unknown_error_retry_message',
  },
}));

jest.mock('../Tab/settingsSurface', () => ({
  SETTINGS_PAGE_BODY_INSET_X: 0,
}));

describe('TravelMode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentEnabled = false;
    mockEnterPage.mockImplementation(async () => ({
      enabled: mockCurrentEnabled,
      restartRequired: false,
    }));
    mockLeavePage.mockResolvedValue(undefined);
    mockSetEnabled.mockResolvedValue(undefined);
    mockRetryRestart.mockResolvedValue(undefined);
    mockLoadingClose.mockResolvedValue(undefined);
  });

  it('requires confirmation before enabling Travel Mode', async () => {
    const { container, findByTestId } = render(<TravelMode />);

    fireEvent.click(await findByTestId('setting-travel-mode-switch'));

    expect(container.textContent).toContain('Your wallet is ready to use');
    expect(container.textContent).toContain(
      'Hide your wallet information while you travel. Everything returns when you turn Travel Mode off.',
    );
    expect(container.textContent).toContain(
      'Your Passcode protection stays on.',
    );
    expect(mockSetEnabled).not.toHaveBeenCalled();
    expect(mockDialogShow).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Turn on Travel Mode?',
        description:
          'Your wallet will appear empty while Travel Mode is on. Don’t worry—nothing will be deleted. Everything will return after you turn it off.',
        onCancelText: 'Not now',
        onConfirmText: 'Turn on Travel Mode',
      }),
    );

    const dialogOptions = mockDialogShow.mock.calls[0]?.[0] as {
      onConfirm: (params: { close: () => Promise<void> }) => Promise<void>;
    };
    const closeConfirmation = jest.fn<Promise<void>, []>();
    closeConfirmation.mockResolvedValue(undefined);

    await act(async () => {
      await dialogOptions.onConfirm({ close: closeConfirmation });
    });

    expect(closeConfirmation).toHaveBeenCalledTimes(1);
    expect(mockSetEnabled).toHaveBeenCalledWith({
      admissionId: 'admission-id',
      enabled: true,
    });
    expect(mockDialogLoading).toHaveBeenCalledWith({
      title: 'Restarting OneKey…',
      description: 'Applying the new protection mode.',
    });
  });

  it('keeps Travel Mode off when enable confirmation is cancelled', async () => {
    const { findByTestId } = render(<TravelMode />);

    fireEvent.click(await findByTestId('setting-travel-mode-switch'));

    const dialogOptions = mockDialogShow.mock.calls[0]?.[0] as {
      onCancel: (close: () => Promise<void>) => void;
    };
    const closeConfirmation = jest.fn<Promise<void>, []>();
    closeConfirmation.mockResolvedValue(undefined);

    act(() => {
      dialogOptions.onCancel(closeConfirmation);
    });

    await waitFor(() => expect(closeConfirmation).toHaveBeenCalledTimes(1));
    expect(mockSetEnabled).not.toHaveBeenCalled();
    expect(mockDialogLoading).not.toHaveBeenCalled();
  });

  it('disables Travel Mode without a confirmation dialog', async () => {
    mockCurrentEnabled = true;
    const { findByTestId } = render(<TravelMode />);

    fireEvent.click(await findByTestId('setting-travel-mode-switch'));

    await waitFor(() =>
      expect(mockSetEnabled).toHaveBeenCalledWith({
        admissionId: 'admission-id',
        enabled: false,
      }),
    );
    expect(mockDialogShow).not.toHaveBeenCalled();
  });
});
