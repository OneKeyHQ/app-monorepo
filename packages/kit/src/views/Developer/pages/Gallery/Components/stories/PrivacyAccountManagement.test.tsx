/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { fireEvent, render, screen, within } from '@testing-library/react';
import { IntlProvider } from 'react-intl';

import enMessages from '@onekeyhq/shared/src/locale/json/en_US.json';
import zhMessages from '@onekeyhq/shared/src/locale/json/zh_CN.json';

import { PrivacyAccountManagementPreview } from './PrivacyAccountManagement';

jest.mock('react-native', () => ({ StyleSheet: { hairlineWidth: 1 } }));

jest.mock('@onekeyhq/shared/src/config/presetNetworks', () => ({
  presetNetworksMap: {
    zec: { id: 'zec--0', name: 'Zcash', logoURI: 'zec.png' },
    xmr: { id: 'xmr--0', name: 'Monero', logoURI: 'xmr.png' },
  },
}));

jest.mock('@onekeyhq/kit/src/components/NetworkAvatar', () => ({
  NetworkAvatarBase: ({ networkName }: { networkName: string }) => (
    <span role="img" aria-label={networkName} />
  ),
}));

jest.mock('@onekeyhq/kit/src/components/ListItem', () => ({
  ListItem: ({
    children,
    renderAvatar,
    renderItemText,
    testID,
    title,
    onPress,
    disabled,
  }: {
    children?: ReactNode;
    renderAvatar?: ReactNode;
    renderItemText?: ReactNode;
    testID?: string;
    title?: string;
    onPress?: () => void;
    disabled?: boolean;
  }) =>
    onPress ? (
      <button
        type="button"
        data-testid={testID}
        onClick={onPress}
        disabled={disabled}
      >
        {title}
        {children}
      </button>
    ) : (
      <div data-testid={testID}>
        {renderAvatar}
        {renderItemText}
        {children}
      </div>
    ),
}));

jest.mock('@onekeyhq/components', () => {
  const Wrapper = ({
    children,
    testID,
  }: {
    children?: ReactNode;
    testID?: string;
  }) => <div data-testid={testID}>{children}</div>;
  const Action = ({
    children,
    testID,
    onPress,
    disabled,
    title,
  }: {
    children?: ReactNode;
    testID?: string;
    onPress?: () => void;
    disabled?: boolean;
    title?: string;
  }) => (
    <button
      type="button"
      data-testid={testID}
      onClick={onPress}
      disabled={disabled}
      aria-label={title}
    >
      {children}
    </button>
  );
  return {
    Button: Action,
    IconButton: Action,
    Dialog: { confirm: jest.fn() },
    Divider: () => null,
    SizableText: Wrapper,
    Toast: { success: jest.fn() },
    XStack: Wrapper,
    YStack: Wrapper,
  };
});

const mockIntlError = jest.fn();

function preview(locale: 'en-US' | 'zh-CN') {
  const messages: Record<string, string> =
    locale === 'en-US' ? enMessages : zhMessages;
  return (
    <IntlProvider locale={locale} messages={messages} onError={mockIntlError}>
      <PrivacyAccountManagementPreview />
    </IntlProvider>
  );
}

function accountRow(id: 'enabled' | 'disabled' | 'paused') {
  return screen.getByTestId(
    `account-manager-privacy-network-account-preview-${id}`,
  );
}

describe('Privacy account management preview localization', () => {
  beforeEach(() => {
    mockIntlError.mockClear();
  });

  it('updates copy and long names on locale changes without resetting account state', () => {
    const { rerender } = render(preview('en-US'));
    expect(screen.getByRole('button', { name: 'Default' })).toBeTruthy();
    expect(
      screen.getByText(
        "This preview uses sample data. Actions won't change your accounts.",
      ),
    ).toBeTruthy();
    expect(within(accountRow('enabled')).getByText('Account #1')).toBeTruthy();

    fireEvent.click(
      within(accountRow('enabled')).getByRole('button', { name: 'Pause' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Long names' }));
    expect(
      within(accountRow('enabled')).getByText(
        'Account #1 · Personal savings and long-term private funds',
      ),
    ).toBeTruthy();

    rerender(preview('zh-CN'));
    expect(screen.getByRole('button', { name: '默认' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '长名称' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '不可用' })).toBeTruthy();
    expect(
      screen.getByText('此预览使用示例数据，操作不会更改你的账户。'),
    ).toBeTruthy();
    expect(
      within(accountRow('enabled')).getByText(
        '账户 #1 · 个人储蓄和长期隐私资金',
      ),
    ).toBeTruthy();
    expect(within(accountRow('enabled')).getByText('Zcash')).toBeTruthy();
    expect(within(accountRow('disabled')).getByText('Monero')).toBeTruthy();
    expect(within(accountRow('enabled')).getByText(/钱包 · /)).toBeTruthy();
    expect(
      within(accountRow('enabled')).getByRole('button', {
        name: zhMessages['global.resume'],
      }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Long names' })).toBeNull();
    expect(mockIntlError).not.toHaveBeenCalled();
  });

  it('resets scenarios and sample actions while preserving the selected language', () => {
    render(preview('zh-CN'));
    fireEvent.click(
      within(accountRow('enabled')).getByRole('button', {
        name: zhMessages['global.pause'],
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: '长名称' }));
    fireEvent.click(screen.getByRole('button', { name: '不可用' }));
    expect(
      screen
        .getByTestId('privacy-management-preview-action-preview-enabled')
        .hasAttribute('disabled'),
    ).toBe(true);

    fireEvent.click(
      screen.getByRole('button', { name: zhMessages['global.reset'] }),
    );
    expect(within(accountRow('enabled')).getByText('账户 #1')).toBeTruthy();
    expect(within(accountRow('paused')).getByText('账户 #2')).toBeTruthy();
    expect(
      within(accountRow('enabled'))
        .getByRole('button', {
          name: zhMessages['global.pause'],
        })
        .hasAttribute('disabled'),
    ).toBe(false);
    expect(
      within(accountRow('disabled')).getByRole('button', {
        name: zhMessages['global.enable'],
      }),
    ).toBeTruthy();
    expect(
      within(accountRow('paused')).getByRole('button', {
        name: zhMessages['global.resume'],
      }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: '长名称' })).toBeTruthy();
    expect(mockIntlError).not.toHaveBeenCalled();
  });
});
