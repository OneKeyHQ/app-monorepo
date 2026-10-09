/** @jest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';

import { AccountSelectorMirrorInspectorContainer } from './AccountSelectorMirrorInspectorContainer';

const mockDevSettings: {
  enabled: boolean;
  settings: { showAccountSelectorMirrorInspector?: boolean };
} = {
  enabled: true,
  settings: { showAccountSelectorMirrorInspector: true },
};
const mockSetDevSettings = jest.fn(
  (updater: (current: typeof mockDevSettings) => typeof mockDevSettings) => {
    Object.assign(mockDevSettings, updater(mockDevSettings));
  },
);
const mockInspectorRender = jest.fn(({ onClose }: { onClose: () => void }) => (
  <button data-testid="mock-account-selector-inspector" onClick={onClose}>
    Close
  </button>
));

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
  default: () => (props: { onClose: () => void }) => mockInspectorRender(props),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDev: true,
    isE2E: false,
    isWeb: true,
  },
}));

const mockPlatformEnv = jest.requireMock('@onekeyhq/shared/src/platformEnv')
  .default as {
  isDev: boolean;
  isE2E: boolean;
  isWeb: boolean;
};

describe('AccountSelectorMirrorInspectorContainer', () => {
  beforeEach(() => {
    mockDevSettings.enabled = true;
    mockDevSettings.settings = { showAccountSelectorMirrorInspector: true };
    mockPlatformEnv.isDev = true;
    mockPlatformEnv.isE2E = false;
    mockPlatformEnv.isWeb = true;
    mockInspectorRender.mockClear();
    mockSetDevSettings.mockClear();
  });

  it('mounts the lazy Inspector when the developer setting is enabled', () => {
    render(<AccountSelectorMirrorInspectorContainer />);
    expect(screen.getByTestId('mock-account-selector-inspector')).toBeTruthy();
    expect(mockInspectorRender).toHaveBeenCalledTimes(1);
  });

  it('keeps the Inspector unmounted when the setting is disabled', () => {
    mockDevSettings.settings.showAccountSelectorMirrorInspector = false;
    render(<AccountSelectorMirrorInspectorContainer />);
    expect(screen.queryByTestId('mock-account-selector-inspector')).toBeNull();
    expect(mockInspectorRender).not.toHaveBeenCalled();
  });

  it('keeps the Inspector unmounted outside local Web dev or E2E', () => {
    mockPlatformEnv.isDev = false;
    const { rerender } = render(<AccountSelectorMirrorInspectorContainer />);
    expect(mockInspectorRender).not.toHaveBeenCalled();

    mockPlatformEnv.isE2E = true;
    mockPlatformEnv.isWeb = false;
    rerender(<AccountSelectorMirrorInspectorContainer />);
    expect(mockInspectorRender).not.toHaveBeenCalled();
  });

  it('turns off the persisted setting when the Inspector closes', () => {
    const { rerender } = render(<AccountSelectorMirrorInspectorContainer />);
    fireEvent.click(screen.getByTestId('mock-account-selector-inspector'));
    expect(mockDevSettings.settings.showAccountSelectorMirrorInspector).toBe(
      false,
    );

    rerender(<AccountSelectorMirrorInspectorContainer />);
    expect(screen.queryByTestId('mock-account-selector-inspector')).toBeNull();
  });
});
