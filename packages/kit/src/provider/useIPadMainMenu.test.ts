/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import type {
  IMainMenuCommand,
  IMainMenuConfig,
} from '@onekeyhq/shared/src/modules/MainMenu';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';

import { useIPadMainMenu } from './useIPadMainMenu';

let mockTravelMode = false;
let mockRootState: unknown;
let mockCommandListener: ((command: IMainMenuCommand) => void) | undefined;
const mockSetConfig = jest.fn<void, [IMainMenuConfig]>();
const mockPushModal = jest.fn();
const mockShowAboutDialog = jest.fn<void, unknown[]>();

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('react-native', () => ({ Platform: { Version: '27.0' } }));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeIOSPad: true },
}));
jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: {
    getRuntimeEnvironmentSync: () => ({
      profile: { kind: mockTravelMode ? 'travel-mode' : 'normal' },
    }),
  },
}));
jest.mock('@onekeyhq/shared/src/modules/MainMenu', () => ({
  __esModule: true,
  default: {
    setConfig: (config: IMainMenuConfig) => mockSetConfig(config),
    addCommandListener: (callback: (command: IMainMenuCommand) => void) => {
      mockCommandListener = callback;
      return () => {
        mockCommandListener = undefined;
      };
    },
  },
}));
jest.mock('@onekeyhq/components', () => ({
  rootNavigationRef: { current: { getRootState: () => mockRootState } },
}));
jest.mock('../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: mockPushModal }),
}));
jest.mock('../hooks/useOnLock', () => ({ useOnLock: () => jest.fn() }));
jest.mock('./showAboutDialog', () => ({
  showAboutDialog: (...args: unknown[]) => mockShowAboutDialog(...args),
}));

describe('useIPadMainMenu', () => {
  beforeEach(() => {
    mockTravelMode = false;
    mockRootState = { routes: [] };
    mockCommandListener = undefined;
    jest.clearAllMocks();
  });

  it('offers About and the help links outside Travel Mode', () => {
    renderHook(() => useIPadMainMenu());
    const config = mockSetConfig.mock.calls.at(-1)?.[0];
    expect(config?.aboutTitle).not.toBe('');
    expect(config?.helpLinks.length).toBeGreaterThan(0);

    mockCommandListener?.('about');
    expect(mockShowAboutDialog).toHaveBeenCalledTimes(1);
  });

  it('removes About and the help links in Travel Mode', () => {
    mockTravelMode = true;
    renderHook(() => useIPadMainMenu());
    const config = mockSetConfig.mock.calls.at(-1)?.[0];
    expect(config?.aboutTitle).toBe('');
    expect(config?.helpLinks).toEqual([]);
    expect(config?.preferencesTitle).not.toBe('');

    mockCommandListener?.('about');
    expect(mockShowAboutDialog).not.toHaveBeenCalled();
  });

  it('does not open Settings again once its modal has navigated', () => {
    mockRootState = {
      routes: [
        { name: 'Main' },
        {
          name: 'Modal',
          params: { screen: EModalRoutes.SettingModal },
          state: {
            index: 0,
            routes: [{ name: EModalRoutes.SettingModal }],
          },
        },
      ],
    };
    renderHook(() => useIPadMainMenu());
    mockCommandListener?.('preferences');
    expect(mockPushModal).not.toHaveBeenCalled();
  });

  it('opens Settings when another modal is on top', () => {
    mockRootState = {
      routes: [
        { name: 'Main' },
        {
          name: 'Modal',
          params: { screen: EModalRoutes.SettingModal },
          state: {
            index: 1,
            routes: [
              { name: EModalRoutes.SettingModal },
              { name: EModalRoutes.SendModal },
            ],
          },
        },
      ],
    };
    renderHook(() => useIPadMainMenu());
    mockCommandListener?.('preferences');
    expect(mockPushModal).toHaveBeenCalledWith(
      EModalRoutes.SettingModal,
      expect.anything(),
    );
  });
});
