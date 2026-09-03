/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render } from '@testing-library/react';

import { PortfolioSyncButton } from './PortfolioSyncButton';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: {
    global_synced: 'global.synced',
    global_syncing: 'global.syncing',
    portfolio_sync_to_device__action: 'portfolio_sync_to_device__action',
  },
}));

jest.mock('@onekeyhq/components', () => ({
  Button: ({
    accessibilityLiveRegion,
    children,
    color,
    disabled,
    icon,
    iconColor,
    loading,
    onPress,
    opacity,
    testID,
    variant,
  }: {
    accessibilityLiveRegion?: 'none' | 'polite' | 'assertive';
    children?: ReactNode;
    color?: string;
    disabled?: boolean;
    icon?: string;
    iconColor?: string;
    loading?: boolean;
    onPress?: () => void;
    opacity?: number;
    testID?: string;
    variant?: string;
  }) => (
    <button
      type="button"
      aria-live={
        accessibilityLiveRegion === 'none' ? 'off' : accessibilityLiveRegion
      }
      data-color={color}
      data-icon={icon}
      data-icon-color={iconColor}
      data-loading={String(Boolean(loading))}
      data-opacity={opacity}
      data-variant={variant}
      data-testid={testID}
      disabled={disabled}
      onClick={onPress}
    >
      {children}
    </button>
  ),
}));

describe('PortfolioSyncButton', () => {
  it('starts enabled and triggers an interactive sync', () => {
    const onPress = jest.fn();
    const view = render(<PortfolioSyncButton state="idle" onPress={onPress} />);
    const button = view.getByTestId('home-sync-portfolio');

    expect(button.textContent).toBe('portfolio_sync_to_device__action');
    expect(button.getAttribute('data-icon')).toBe('OnekeyDeviceCustom');
    expect(button.getAttribute('data-variant')).toBe('secondary');
    expect(button.getAttribute('aria-live')).toBe('polite');
    expect((button as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('disables itself and shows progress while syncing', () => {
    const view = render(
      <PortfolioSyncButton state="loading" onPress={jest.fn()} />,
    );
    const button = view.getByTestId('home-sync-portfolio');

    expect(button.textContent).toBe('global.syncing');
    expect(button.getAttribute('data-loading')).toBe('true');
    expect(button.getAttribute('data-opacity')).toBe('1');
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows a disabled success acknowledgement', () => {
    const view = render(
      <PortfolioSyncButton state="success" onPress={jest.fn()} />,
    );
    const button = view.getByTestId('home-sync-portfolio');

    expect(button.textContent).toBe('global.synced');
    expect(button.getAttribute('data-icon')).toBe('CheckRadioSolid');
    expect(button.getAttribute('data-icon-color')).toBe('$iconSuccess');
    expect(button.getAttribute('data-color')).toBe('$textSuccess');
    expect(button.getAttribute('data-opacity')).toBe('1');
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('honors an external hardware-busy disabled state', () => {
    const view = render(
      <PortfolioSyncButton disabled state="idle" onPress={jest.fn()} />,
    );

    expect(
      (view.getByTestId('home-sync-portfolio') as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
