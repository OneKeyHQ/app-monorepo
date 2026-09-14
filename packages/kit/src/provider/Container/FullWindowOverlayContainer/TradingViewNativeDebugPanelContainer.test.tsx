/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';

import { TradingViewNativeDebugPanelContainer } from './TradingViewNativeDebugPanelContainer';

const mockDevSettings: {
  enabled: boolean;
  settings: { showTradingViewNativeDebugPanel?: boolean };
} = {
  enabled: true,
  settings: { showTradingViewNativeDebugPanel: true },
};
const mockSetDevSettings = jest.fn(
  (updater: (current: typeof mockDevSettings) => typeof mockDevSettings) => {
    Object.assign(mockDevSettings, updater(mockDevSettings));
  },
);
const mockPanelRender = jest.fn(({ onClose }: { onClose: () => void }) => (
  <button data-testid="trading-view-native-debug-panel" onClick={onClose}>
    Close
  </button>
));
const mockSetDebugEventCollectionEnabled = jest.fn();

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings', () => ({
  useDevSettingsPersistAtom: () => {
    const React = jest.requireActual<typeof import('react')>('react');
    const [value, setValue] = React.useState(mockDevSettings);
    const setPersistedValue = React.useCallback(
      (
        updater: (current: typeof mockDevSettings) => typeof mockDevSettings,
      ) => {
        mockSetDevSettings(updater);
        setValue({
          ...mockDevSettings,
          settings: { ...mockDevSettings.settings },
        });
      },
      [],
    );
    return [value, setPersistedValue];
  },
}));

jest.mock('@onekeyhq/shared/src/lazyLoad', () => ({
  __esModule: true,
  default: () => (props: { onClose: () => void }) => mockPanelRender(props),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDev: true,
    isWeb: true,
  },
}));

jest.mock(
  '../../../components/TradingView/TradingViewNative/data/tradingViewNativeDebugLogger',
  () => ({
    setTradingViewNativeDebugEventCollectionEnabled: (
      enabled: boolean,
    ): void => {
      mockSetDebugEventCollectionEnabled(enabled);
    },
  }),
);

const mockPlatformEnv = jest.requireMock('@onekeyhq/shared/src/platformEnv')
  .default as {
  isDev: boolean;
  isWeb: boolean;
};

describe('TradingViewNativeDebugPanelContainer', () => {
  beforeEach(() => {
    mockDevSettings.enabled = true;
    mockDevSettings.settings = { showTradingViewNativeDebugPanel: true };
    mockPlatformEnv.isDev = true;
    mockPlatformEnv.isWeb = true;
    mockPanelRender.mockClear();
    mockSetDevSettings.mockClear();
    mockSetDebugEventCollectionEnabled.mockClear();
  });

  it('mounts the panel from the global owner when debug mode is enabled', () => {
    render(<TradingViewNativeDebugPanelContainer />);

    expect(screen.getByTestId('trading-view-native-debug-panel')).toBeTruthy();
    expect(mockPanelRender).toHaveBeenCalledTimes(1);
    expect(mockSetDebugEventCollectionEnabled).toHaveBeenCalledWith(true);
  });

  it('keeps the panel unmounted when the developer setting is disabled', () => {
    mockDevSettings.settings.showTradingViewNativeDebugPanel = false;
    render(<TradingViewNativeDebugPanelContainer />);

    expect(screen.queryByTestId('trading-view-native-debug-panel')).toBeNull();
    expect(mockPanelRender).not.toHaveBeenCalled();
    expect(mockSetDebugEventCollectionEnabled).toHaveBeenCalledWith(false);
  });

  it('defaults a missing diagnostics setting to disabled', () => {
    mockDevSettings.settings = {};
    render(<TradingViewNativeDebugPanelContainer />);

    expect(screen.queryByTestId('trading-view-native-debug-panel')).toBeNull();
    expect(mockPanelRender).not.toHaveBeenCalled();
    expect(mockSetDebugEventCollectionEnabled).toHaveBeenCalledWith(false);
  });

  it('keeps the panel unmounted outside a local Web development build', () => {
    mockPlatformEnv.isDev = false;
    const { rerender } = render(<TradingViewNativeDebugPanelContainer />);
    expect(mockPanelRender).not.toHaveBeenCalled();

    mockPlatformEnv.isDev = true;
    mockPlatformEnv.isWeb = false;
    rerender(<TradingViewNativeDebugPanelContainer />);
    expect(mockPanelRender).not.toHaveBeenCalled();
  });

  it('persists close through the global developer setting gate', () => {
    const { rerender } = render(<TradingViewNativeDebugPanelContainer />);

    fireEvent.click(screen.getByTestId('trading-view-native-debug-panel'));
    expect(mockDevSettings.settings.showTradingViewNativeDebugPanel).toBe(
      false,
    );

    rerender(<TradingViewNativeDebugPanelContainer />);
    expect(screen.queryByTestId('trading-view-native-debug-panel')).toBeNull();
    expect(mockPanelRender).toHaveBeenCalledTimes(1);
  });
});
