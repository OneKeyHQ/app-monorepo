/**
 * @jest-environment jsdom
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */

import type { ReactElement, ReactNode } from 'react';

import { Dialog } from '.';

import { renderToContainer } from './renderToContainer';

jest.mock('./OverlayDialogPresentation', () => ({
  OverlayDialogPresentation: ({
    children,
    open,
  }: {
    children?: ReactNode;
    open: boolean;
  }) => (open ? <div data-testid="overlay-dialog">{children}</div> : null),
}));
jest.mock('@onekeyfe/react-native-native-overlay', () => ({
  useNestedOverlayLevel: () => 'modal',
  useOverlayPageScope: () => ({}),
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: ({ children }: { children?: ReactNode }) => children },
  useSharedValue: (value: number) => ({ value }),
  useAnimatedStyle: () => ({}),
}));
jest.mock('react-native-safe-area-context', () => ({}));
jest.mock('expo-clipboard', () => ({}));
jest.mock('@tamagui/focus-scope', () => ({ FocusScope: () => null }));
jest.mock('@onekeyhq/components', () => ({}));
jest.mock('@onekeyhq/components/src/hooks/useStyle', () => ({
  useMedia: () => ({}),
}));
jest.mock('@onekeyhq/components/src/shared/tamagui', () => ({
  AnimatePresence: () => null,
  Sheet: {},
  TMDialog: {},
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => {
  const platformEnv = { isDev: true, isNative: true, isNativeIOS: true };
  return { __esModule: true, __platformEnv: platformEnv, default: platformEnv };
});
jest.mock('@onekeyhq/shared/src/locale', () => ({ ETranslations: {} }));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { ui: { dialog: { dialogConfirm: jest.fn() } } },
}));
jest.mock('@onekeyhq/shared/src/errors/utils/errorUtils', () => ({}));
jest.mock('@onekeyhq/shared/src/utils/stringUtils', () => ({}));
jest.mock('@onekeyhq/shared/src/lazyLoad', () => ({
  createLazyModuleComponent: () => () => null,
  preloadLazyComponents: jest.fn(),
}));
jest.mock('../../primitives', () => ({
  SizableText: () => null,
  Spinner: () => null,
  Stack: () => null,
}));
jest.mock('../../actions/Toast', () => ({}));
jest.mock('../../content/Keyboard', () => ({
  Keyboard: { dismissWithDelay: jest.fn() },
}));
jest.mock('../../content/SheetGrabber', () => ({ SheetGrabber: () => null }));
jest.mock('../../hocs', () => {
  const manager = { destroy: jest.fn(), update: jest.fn() };
  return {
    EPageType: {},
    EPortalContainerConstantName: {
      FULL_WINDOW_OVERLAY_PORTAL: 'FULL_WINDOW_OVERLAY_PORTAL',
      APP_STATE_LOCK_CONTAINER_OVERLAY: 'APP_STATE_LOCK_CONTAINER_OVERLAY',
    },
    Portal: {
      Render: jest.fn(() => manager),
      Constant: {
        FULL_WINDOW_OVERLAY_PORTAL: 'FULL_WINDOW_OVERLAY_PORTAL',
        APP_STATE_LOCK_CONTAINER_OVERLAY: 'APP_STATE_LOCK_CONTAINER_OVERLAY',
      },
    },
    usePageType: () => undefined,
  };
});
jest.mock('../../hooks', () => ({
  useBackHandler: jest.fn(),
  useKeyboardEventWithoutNavigation: jest.fn(),
  useModalNavigatorContextPortalId: () => undefined,
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));
jest.mock('../../layouts/Page/PageContext', () => ({
  usePageContext: () => ({}),
}));
jest.mock('../../layouts/ScrollView', () => ({}));
jest.mock('./Content', () => ({ Content: () => null }));
jest.mock('./Footer', () => ({ Footer: () => null, FooterAction: () => null }));
jest.mock('./Header', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    DialogHeader: () => null,
    DialogHeaderCloseButton: () => null,
    DialogHeaderContext: React.createContext({}),
  };
});
jest.mock('./DialogScrollView', () => ({}));
jest.mock('./renderToContainer', () => ({
  renderToContainer: jest.fn(() => ({
    destroy: jest.fn(),
    update: jest.fn(),
  })),
}));

const LOCK_CONTAINER = 'APP_STATE_LOCK_CONTAINER_OVERLAY' as never;

describe('Dialog.show closing lifecycle', () => {
  const openLockDialog = () => {
    const onCloseStart = jest.fn();
    const onClose = jest.fn();
    Dialog.show({ portalContainer: LOCK_CONTAINER, onCloseStart, onClose });
    const element = jest
      .mocked(renderToContainer)
      .mock.calls.at(-1)?.[1] as ReactElement<{
      onClose: () => Promise<void>;
      onExited: () => void;
      overlayLevel: string;
    }>;
    return { element, onCloseStart, onClose };
  };

  it('opens a lock screen dialog at the lock level', () => {
    const { element } = openLockDialog();
    expect(element.props.overlayLevel).toBe('lock');
  });

  it('notifies close start synchronously and cleans up after the exit animation', async () => {
    jest.useFakeTimers();
    try {
      const { element, onCloseStart, onClose } = openLockDialog();
      const closing = element.props.onClose();
      expect(onCloseStart).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      expect(onClose).not.toHaveBeenCalled();
      element.props.onExited();
      await closing;
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('still cleans up when the overlay never reports its exit', async () => {
    jest.useFakeTimers();
    try {
      const { element, onClose } = openLockDialog();
      const closing = element.props.onClose();
      jest.advanceTimersByTime(1500);
      await closing;
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});
