/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react';

import type { ITradingViewChartSettingsValue } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls/chartSettings';
import type { ITradingViewChartSettingsProps } from '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls/chartSettings/TradingViewChartSettings';
import {
  type ITradingViewNativeChartSettings,
  createTradingViewNativeChartSettings,
} from '@onekeyhq/shared/types/tradingViewNative';

import MarketChartSettingsModal, {
  showMarketChartSettingsDialog,
} from './MarketChartSettingsModal';

type IChartSettingsUpdater = (
  currentSettings: ITradingViewNativeChartSettings,
) => ITradingViewNativeChartSettings;
type IGetNativeSettingsParams = {
  currentSettings: ITradingViewNativeChartSettings;
  value: ITradingViewChartSettingsValue;
};

const mockTradingViewChartSettings = jest.fn<
  null,
  [ITradingViewChartSettingsProps]
>(() => null);
const mockSetChartSettings = jest.fn<Promise<void>, [IChartSettingsUpdater]>();
const mockGetTradingViewNativeChartSettings = jest.fn<
  ITradingViewNativeChartSettings,
  [IGetNativeSettingsParams]
>();
const mockPanelValue = {} as ITradingViewChartSettingsValue;
const mockCloseDialog = jest.fn();
const mockShowTradingViewChartSettingsDialog = jest.fn<
  void,
  [{ renderContent: (closeDialog: () => void) => ReactNode }]
>();
let mockIsMobileLayout = false;
let mockIsNative = false;
let mockChartSettings = createTradingViewNativeChartSettings();

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const Page = ({ children }: { children?: ReactNode }) => <>{children}</>;
  Page.Header = () => null;
  Page.Body = ({ children }: { children?: ReactNode }) => <>{children}</>;

  return {
    Page,
    useMedia: () => ({ md: mockIsMobileLayout }),
  };
});

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNative() {
      return mockIsNative;
    },
  },
}));

jest.mock(
  '@onekeyhq/kit/src/components/TradingView/TradingViewChartControls/chartSettings',
  () => ({
    TradingViewChartSettings: (props: ITradingViewChartSettingsProps) =>
      mockTradingViewChartSettings(props),
    showTradingViewChartSettingsDialog: (options: {
      renderContent: (closeDialog: () => void) => ReactNode;
    }) => mockShowTradingViewChartSettingsDialog(options),
  }),
);

jest.mock(
  '@onekeyhq/kit/src/components/TradingView/TradingViewNative/chartSettingsAdapter',
  () => ({
    getTradingViewChartSettingsValue: () => mockPanelValue,
    getTradingViewNativeChartSettings: (params: IGetNativeSettingsParams) =>
      mockGetTradingViewNativeChartSettings(params),
  }),
);

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useMarketTradingViewChartSettingsPersistAtom: () => [
    mockChartSettings,
    mockSetChartSettings,
  ],
}));

describe('MarketChartSettingsModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsMobileLayout = false;
    mockIsNative = false;
    mockChartSettings = createTradingViewNativeChartSettings();
    mockSetChartSettings.mockImplementation((update) => {
      mockChartSettings = update(mockChartSettings);
      return Promise.resolve();
    });
    mockGetTradingViewNativeChartSettings.mockImplementation(
      ({ currentSettings }) => currentSettings,
    );
  });

  it('persists desktop changes only after confirmation', async () => {
    render(<MarketChartSettingsModal />);

    const props = mockTradingViewChartSettings.mock.calls[0][0];
    expect(props.mobileLayout).toBe(false);
    expect(props.showChartType).toBe(false);
    expect(props.onChange).toBeUndefined();
    expect(props.hiddenAppearanceSectionIds).toEqual(['events']);
    expect(props.hiddenOptionIds).toEqual([
      'countdown',
      'depth',
      'futureEvents',
      'pastEvents',
      'clickInteraction',
    ]);

    await act(async () => {
      await props.onConfirm?.(mockPanelValue);
    });

    expect(mockSetChartSettings).toHaveBeenCalledTimes(1);
    expect(mockGetTradingViewNativeChartSettings).toHaveBeenCalledWith({
      currentSettings: mockChartSettings,
      value: mockPanelValue,
    });
  });

  it('persists mobile changes immediately when no footer is rendered', () => {
    mockIsMobileLayout = true;
    render(<MarketChartSettingsModal />);

    const props = mockTradingViewChartSettings.mock.calls[0][0];
    expect(props.mobileLayout).toBe(true);
    expect(props.showChartType).toBe(true);

    act(() => {
      props.onChange?.(mockPanelValue);
    });

    expect(mockSetChartSettings).toHaveBeenCalledTimes(1);
  });

  it('keeps dialog edits in a draft and saves them only on confirmation', async () => {
    showMarketChartSettingsDialog();
    render(
      mockShowTradingViewChartSettingsDialog.mock.calls[0][0].renderContent(
        mockCloseDialog,
      ),
    );

    const props = mockTradingViewChartSettings.mock.calls[0][0];
    expect(props.usePageFooter).toBe(false);
    expect(props.mobileLayout).toBe(false);
    expect(props.onChange).toBeUndefined();
    expect(props.hiddenOptionIds).toContain('clickInteraction');

    act(() => {
      props.onCancel?.();
    });
    expect(mockCloseDialog).toHaveBeenCalledTimes(1);
    expect(mockSetChartSettings).not.toHaveBeenCalled();

    await act(async () => {
      await props.onConfirm?.(mockPanelValue);
      await props.onConfirmSuccess?.();
    });
    expect(mockSetChartSettings).toHaveBeenCalledTimes(1);
    expect(mockGetTradingViewNativeChartSettings).toHaveBeenCalledWith({
      currentSettings: mockChartSettings,
      value: mockPanelValue,
    });
    expect(mockCloseDialog).toHaveBeenCalledTimes(2);
  });

  it('exposes the implemented click interaction only on native platforms', () => {
    mockIsNative = true;
    render(<MarketChartSettingsModal />);

    expect(
      mockTradingViewChartSettings.mock.calls[0][0].hiddenOptionIds,
    ).toEqual(['countdown', 'depth', 'futureEvents', 'pastEvents']);
  });
});
