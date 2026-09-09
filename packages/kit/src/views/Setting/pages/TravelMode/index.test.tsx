/** @jest-environment jsdom */

import TravelMode from './';

import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { IntlProvider } from 'react-intl';

import { loadLocaleMessages } from '@onekeyhq/shared/src/locale/localeLoaders';

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
let enMessages: Awaited<ReturnType<typeof loadLocaleMessages>>;
let zhMessages: Awaited<ReturnType<typeof loadLocaleMessages>>;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    pop: mockNavigationPop,
    addListener: mockNavigationAddListener,
  }),
  useRoute: () => ({ params: { admissionId: 'admission-id' } }),
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
    Header: (props: { title?: string }) => React.ReactElement;
    Body: typeof Stack;
  };
  Page.Header = ({ title }) => React.createElement('header', null, title);
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

jest.mock('@onekeyhq/shared/src/locale', () =>
  jest.requireActual<
    typeof import('@onekeyhq/shared/src/locale/enum/translations')
  >('@onekeyhq/shared/src/locale/enum/translations'),
);

jest.mock('../Tab/settingsSurface', () => ({
  SETTINGS_PAGE_BODY_INSET_X: 0,
}));

function TravelModeWithLocale({ locale = 'en' }: { locale?: 'en' | 'zh-CN' }) {
  return (
    <IntlProvider
      locale={locale}
      messages={locale === 'en' ? enMessages : zhMessages}
    >
      <TravelMode />
    </IntlProvider>
  );
}

describe('TravelMode', () => {
  beforeAll(async () => {
    [enMessages, zhMessages] = await Promise.all([
      loadLocaleMessages('en-US'),
      loadLocaleMessages('zh-CN'),
    ]);
  });

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
    const { container, findByTestId } = render(<TravelModeWithLocale />);

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
    const { findByTestId } = render(<TravelModeWithLocale />);

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
    const { findByTestId } = render(<TravelModeWithLocale />);

    fireEvent.click(await findByTestId('setting-travel-mode-switch'));

    await waitFor(() =>
      expect(mockSetEnabled).toHaveBeenCalledWith({
        admissionId: 'admission-id',
        enabled: false,
      }),
    );
    expect(mockDialogShow).not.toHaveBeenCalled();
  });

  it('refreshes page, confirmation and restart copy when the locale changes', async () => {
    const { container, findByTestId, rerender } = render(
      <TravelModeWithLocale />,
    );
    await findByTestId('setting-travel-mode-switch');
    expect(container.querySelector('header')?.textContent).toBe('Travel Mode');

    rerender(<TravelModeWithLocale locale="zh-CN" />);

    expect(container.querySelector('header')?.textContent).toBe('旅行模式');
    expect(container.textContent).toContain('你的钱包已准备就绪');
    expect(container.textContent).toContain('密码保护仍然有效。');
    expect(container.textContent).not.toContain('Your wallet is ready to use');
    fireEvent.click(await findByTestId('setting-travel-mode-switch'));
    expect(mockDialogShow).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: '开启旅行模式？',
        onCancelText: '以后再说',
        onConfirmText: '开启旅行模式',
      }),
    );
    const dialogOptions = mockDialogShow.mock.calls.at(-1)?.[0] as {
      onConfirm: (params: { close: () => Promise<void> }) => Promise<void>;
    };
    const close = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
    await act(async () => {
      await dialogOptions.onConfirm({ close });
    });
    expect(mockDialogLoading).toHaveBeenLastCalledWith({
      title: '正在重启 OneKey…',
      description: '正在应用新的保护模式。',
    });
  });
});
