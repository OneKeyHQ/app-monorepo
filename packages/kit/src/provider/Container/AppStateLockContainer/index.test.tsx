/**
 * @jest-environment jsdom
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */
import type { ReactNode, Ref } from 'react';

import { AppStateLockContainer } from '.';

import { act, render } from '@testing-library/react';
let mockLocked = true;
let mockMountLock: () => void;
let mockLayer: HTMLDivElement;
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
  useAppIsLockedAtom: () => [mockLocked],
}));
jest.mock('@onekeyhq/shared/src/lazyLoad', () => ({
  __esModule: true,
  default: () => () => null,
}));
jest.mock('@onekeyhq/shared/src/performance/deviceMemory', () => ({
  IS_LOW_END_DEVICE: false,
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
jest.mock('./components/AppStateUpdater', () => ({
  AppStateUpdater: () => null,
}));
jest.mock('./components/AppStateLock', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { createPortal } =
    jest.requireActual<typeof import('react-dom')>('react-dom');
  return {
    __esModule: true,
    default: function MockLock({
      lockContainerRef,
    }: {
      lockContainerRef: Ref<HTMLDivElement>;
    }) {
      const [ready, setReady] = React.useState(false);
      mockMountLock = () => setReady(true);
      return ready
        ? createPortal(<div ref={lockContainerRef}>Lock</div>, mockLayer)
        : null;
    },
  };
});
it('protects body portals when the lock node mounts a commit late and restores inert state', async () => {
  jest.useFakeTimers();
  mockLocked = true;
  mockLayer = document.createElement('div');
  document.body.appendChild(mockLayer);
  const portal = document.createElement('div');
  portal.inert = false;
  document.body.appendChild(portal);
  const alreadyInert = document.createElement('div');
  alreadyInert.inert = true;
  document.body.appendChild(alreadyInert);
  const view = render(
    <AppStateLockContainer>
      <button type="button">Background</button>
    </AppStateLockContainer>,
  );
  expect(portal.inert).toBe(false);
  await act(async () => mockMountLock());
  expect(view.container.inert).toBe(true);
  expect(portal.inert).toBe(true);
  expect(mockLayer.inert).not.toBe(true);
  const latePortal = document.createElement('div');
  latePortal.inert = false;
  await act(async () => {
    document.body.appendChild(latePortal);
  });
  expect(latePortal.inert).toBe(true);
  mockLocked = false;
  view.rerender(
    <AppStateLockContainer>
      <button type="button">Background</button>
    </AppStateLockContainer>,
  );
  expect(portal.inert).toBe(false);
  expect(latePortal.inert).toBe(false);
  expect(alreadyInert.inert).toBe(true);
  view.unmount();
  mockLayer.remove();
  portal.remove();
  latePortal.remove();
  alreadyInert.remove();
  jest.useRealTimers();
});
