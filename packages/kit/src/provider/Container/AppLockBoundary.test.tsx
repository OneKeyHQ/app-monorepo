/**
 * @jest-environment jsdom
 */
import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import { AppLockBoundary } from './AppLockBoundary';

const mockSetLocked = jest.fn<void, []>();

jest.mock('@onekeyhq/components', () => ({
  AnimatePresence: ({ children }: { children?: ReactNode }) => children,
  Spinner: () => null,
  YStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { servicePassword: { unLockApp: jest.fn() } },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock', () => ({
  useAppIsLockedAtom: () => [true],
  usePasswordPersistAtom: () => [{ isPasswordSet: true, appLockDuration: 5 }],
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/settings', () => ({
  useSettingsLastActivityAtom: () => [{ time: 1234 }],
}));
jest.mock('@onekeyhq/shared/src/lazyLoad', () => ({
  __esModule: true,
  default: () => () => null,
}));
jest.mock('@onekeyhq/shared/src/performance/deviceMemory', () => ({
  IS_LOW_END_DEVICE: true,
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true },
}));
jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: {
    getRuntimeEnvironmentSync: () => ({ profile: { kind: 'standard' } }),
  },
}));
jest.mock('@onekeyhq/kit/src/views/Intercom/client', () => ({
  syncIntercomLockState: async () => mockSetLocked(),
}));
jest.mock('./AppStateLockContainer/components/AppStateUpdater', () => ({
  AppStateUpdater: () => null,
}));
jest.mock('./AppStateLockContainer/components/AppStateLock', () => ({
  __esModule: true,
  default: () => null,
}));

it('guards Intercom while a low-memory cold-start lock defers the app tree', () => {
  const view = render(
    <AppLockBoundary>
      <div>App tree</div>
    </AppLockBoundary>,
  );
  // The deferred subtree, including the route-gated message container, is
  // not rendered, yet the lock guard still cancels support requests.
  expect(view.queryByText('App tree')).toBeNull();
  expect(mockSetLocked).toHaveBeenCalledTimes(1);
});
