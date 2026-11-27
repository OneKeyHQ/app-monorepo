/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { showAdjustPositionMarginDialog } from './AdjustPositionMarginModal';

import type { IntlShape } from 'react-intl';

const mockGetSymbolMeta = jest.fn<
  Promise<{ assetId: number } | undefined>,
  [{ coin: string }]
>();
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
    Button: Container,
    Dialog: {
      show: (params: { renderContent: ReactNode; sheetDragArea?: string }) =>
        mockDialogShow(params),
    },
    Icon: () => null,
    Select: () => null,
    SizableText: Container,
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
    },
  },
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useHyperliquidActions: () => ({
    current: {
      updateIsolatedMargin: jest.fn(),
    },
  }),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsComputedAccountValueAtom: () => [{ withdrawable: '100' }],
}));

jest.mock('../../hooks/usePerpsAccountScopedActivePositions', () => ({
  usePerpsAccountScopedActivePositions: () => [],
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
  TradingFormInput: () => null,
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
    mockGetSymbolMeta.mockResolvedValue({ assetId: 1 });
  });

  it('uses page dialog only on iOS and keeps desktop, web, and Android global', () => {
    const pageDialogShow = jest.fn<
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
    const pageDialog = { show: pageDialogShow } as never;

    // Desktop / Web -> global Dialog
    showAdjustPositionMarginDialog({ coin: 'BTC', dialog: pageDialog, intl });
    expect(mockDialogShow).toHaveBeenCalledTimes(1);
    expect(mockDialogShow.mock.calls[0]?.[0]?.sheetDragArea).toBeUndefined();
    expect(pageDialogShow).not.toHaveBeenCalled();

    // Android -> global Dialog with header-only drag so scroll gestures stay inside body
    env.isNative = true;
    env.isNativeAndroid = true;
    showAdjustPositionMarginDialog({ coin: 'BTC', dialog: pageDialog, intl });
    expect(mockDialogShow).toHaveBeenCalledTimes(2);
    expect(mockDialogShow.mock.calls[1]?.[0]?.sheetDragArea).toBe('header');
    expect(pageDialogShow).not.toHaveBeenCalled();

    // iOS -> in-page dialog wrapped in keyboard-aware content
    env.isNativeAndroid = false;
    env.isNativeIOS = true;
    showAdjustPositionMarginDialog({ coin: 'BTC', dialog: pageDialog, intl });
    expect(pageDialogShow).toHaveBeenCalledTimes(1);
    expect(pageDialogShow.mock.calls[0]?.[0]?.sheetDragArea).toBeUndefined();
    expect(mockDialogShow).toHaveBeenCalledTimes(2);

    const { getByTestId } = render(
      <>{pageDialogShow.mock.calls[0]?.[0]?.renderContent}</>,
    );
    expect(getByTestId('perp-keyboard-aware-content')).toBeTruthy();
  });
});
