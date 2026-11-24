/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { fireEvent, render, waitFor } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { showAdjustPositionMarginDialog } from './AdjustPositionMarginModal';

import type { IntlShape } from 'react-intl';

const mockRefreshTradingMeta = jest.fn<Promise<void>, []>();
const mockGetSymbolMeta = jest.fn<
  Promise<{ assetId: number } | undefined>,
  [{ coin: string }]
>();
const mockUpdateIsolatedMargin = jest.fn<Promise<void>, [unknown]>();
const mockDialogShow = jest.fn<
  {
    close: jest.Mock;
    getForm: jest.Mock;
    isExist: jest.Mock;
  },
  [{ renderContent: ReactNode; sheetDragArea?: string }]
>(() => ({
  close: jest.fn(),
  getForm: jest.fn(),
  isExist: jest.fn(() => true),
}));

jest.mock('@onekeyhq/components', () => {
  const Container = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Button: ({
      children,
      disabled,
      onPress,
      testID,
    }: {
      children?: ReactNode;
      disabled?: boolean;
      onPress?: () => void;
      testID?: string;
    }) => (
      <button
        type="button"
        data-testid={testID}
        disabled={disabled}
        onClick={onPress}
      >
        {children}
      </button>
    ),
    Dialog: {
      show: (params: { renderContent: ReactNode; sheetDragArea?: string }) =>
        mockDialogShow(params),
    },
    Icon: () => null,
    Select: () => null,
    SizableText: ({
      children,
      onPress,
    }: {
      children?: ReactNode;
      onPress?: () => void;
    }) =>
      onPress ? (
        <button type="button" onClick={onPress}>
          {children}
        </button>
      ) : (
        <span>{children}</span>
      ),
    XStack: Container,
    YStack: Container,
  };
});

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHyperliquid: {
      getSymbolMeta: (params: { coin: string }) => mockGetSymbolMeta(params),
      refreshTradingMeta: () => mockRefreshTradingMeta(),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useHyperliquidActions: () => ({
    current: {
      updateIsolatedMargin: (params: unknown) =>
        mockUpdateIsolatedMargin(params),
    },
  }),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsComputedAccountValueAtom: () => [{ withdrawable: '100' }],
}));

jest.mock('../../hooks/usePerpsAccountScopedActivePositions', () => ({
  usePerpsAccountScopedActivePositions: () => [
    {
      position: {
        coin: 'BTC',
        szi: '0.1',
        entryPx: '60000',
        liquidationPx: '55000',
        marginUsed: '150',
        positionValue: '6000',
        leverage: { type: 'isolated', value: 40 },
      },
    },
  ],
}));

jest.mock('../../PerpsAccountSelectorProviderMirror', () => ({
  PerpsAccountSelectorProviderMirror: ({
    children,
  }: {
    children?: ReactNode;
  }) => <>{children}</>,
}));

jest.mock('../../PerpsProviderMirror', () => ({
  PerpsProviderMirror: ({ children }: { children?: ReactNode }) => (
    <>{children}</>
  ),
}));

jest.mock('../PerpKeyboardAwareDialogContent', () => ({
  PerpKeyboardAwareDialogContent: ({ children }: { children?: ReactNode }) => (
    <div data-testid="perp-keyboard-aware-content">{children}</div>
  ),
}));

jest.mock('../TradingGuardWrapper', () => ({
  TradingGuardWrapper: ({ children }: { children?: ReactNode }) => (
    <>{children}</>
  ),
}));

jest.mock('../TradingPanel/inputs/TradingFormInput', () => ({
  TradingFormInput: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <input
      data-testid="adjust-margin-amount-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: false,
    isNativeIOS: false,
    isNativeAndroid: false,
  },
}));

const env = platformEnv as {
  isNative: boolean;
  isNativeIOS: boolean;
  isNativeAndroid: boolean;
};

const intl = {
  formatMessage: ({ id }: { id: string }) => id,
} as unknown as IntlShape;

describe('AdjustPositionMarginModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    env.isNative = false;
    env.isNativeIOS = false;
    env.isNativeAndroid = false;
  });

  it('uses page dialog only on iOS and keeps desktop, web, and Android global', () => {
    const pageDialogShow = jest.fn(() => ({
      close: jest.fn(),
      getForm: jest.fn(),
      isExist: jest.fn(() => true),
    }));
    const pageDialog = { show: pageDialogShow } as never;

    // Desktop / Web -> global Dialog
    showAdjustPositionMarginDialog({ coin: 'BTC', dialog: pageDialog, intl });
    expect(mockDialogShow).toHaveBeenCalledTimes(1);
    expect(pageDialogShow).not.toHaveBeenCalled();

    // Android -> global Dialog with header-only drag so scroll gestures stay inside body
    env.isNative = true;
    env.isNativeAndroid = true;
    showAdjustPositionMarginDialog({ coin: 'BTC', dialog: pageDialog, intl });
    expect(mockDialogShow).toHaveBeenCalledTimes(2);
    expect(mockDialogShow.mock.calls[1]?.[0]?.sheetDragArea).toBe('header');
    expect(pageDialogShow).not.toHaveBeenCalled();

    // iOS -> in-page dialog
    env.isNativeAndroid = false;
    env.isNativeIOS = true;
    showAdjustPositionMarginDialog({ coin: 'BTC', dialog: pageDialog, intl });
    expect(pageDialogShow).toHaveBeenCalledTimes(1);
    expect(mockDialogShow).toHaveBeenCalledTimes(2);
  });

  it('recovers from asset metadata lookup failure via retry while preserving amount', async () => {
    mockRefreshTradingMeta.mockResolvedValueOnce(undefined);
    mockGetSymbolMeta
      .mockRejectedValueOnce(new Error('missing universe'))
      .mockResolvedValueOnce({ assetId: 42 });
    mockUpdateIsolatedMargin.mockResolvedValueOnce(undefined);

    showAdjustPositionMarginDialog({ coin: 'BTC', intl });
    const renderContent = mockDialogShow.mock.calls[0]?.[0]?.renderContent;

    const { getByTestId } = render(<>{renderContent}</>);
    expect(getByTestId('perp-keyboard-aware-content')).toBeTruthy();

    fireEvent.change(getByTestId('adjust-margin-amount-input'), {
      target: { value: '10' },
    });

    const retryBtn = await waitFor(() =>
      getByTestId('perp-adjust-margin-retry-btn'),
    );
    expect(mockRefreshTradingMeta).not.toHaveBeenCalled();
    fireEvent.click(retryBtn);

    const confirmBtn = await waitFor(() => {
      const btn = getByTestId('perp-btn') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
      return btn;
    });
    expect(mockRefreshTradingMeta).toHaveBeenCalledTimes(1);
    expect(
      (getByTestId('adjust-margin-amount-input') as HTMLInputElement).value,
    ).toBe('10');

    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(mockUpdateIsolatedMargin).toHaveBeenCalledWith({
        asset: 42,
        isBuy: true,
        ntli: 10_000_000,
      });
    });
  });
});
