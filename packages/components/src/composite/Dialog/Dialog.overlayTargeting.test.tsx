/**
 * @jest-environment jsdom
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */

import type { ReactElement, ReactNode } from 'react';

import { Dialog } from '.';

import { renderToContainer } from './renderToContainer';

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
  useOverlayZIndex: () => 1,
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

function getErrorSpy() {
  return jest.spyOn(console, 'error').mockImplementation(() => {});
}

function setPlatform(platform: Record<string, boolean>) {
  Object.assign(
    jest.requireMock('@onekeyhq/shared/src/platformEnv').__platformEnv,
    platform,
  );
}

describe('Dialog.show overlay targeting guard', () => {
  beforeEach(() => {
    setPlatform({ isDev: true, isNative: true, isNativeIOS: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports a dialog that asks for a container and the top of all views on iOS', () => {
    const errorSpy = getErrorSpy();

    Dialog.show({
      portalContainer: LOCK_CONTAINER,
      isOverTopAllViews: true,
    });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toContain('must not be combined');
  });

  it('stays quiet off iOS, where the same pair is a documented feature', () => {
    const errorSpy = getErrorSpy();

    // Web renders once and portals to `document.body` — the only shape in
    // which that documented behavior exists, and what `useInPageDialog`
    // relies on. Android drops the flag before it reaches Portal.Render.
    setPlatform({ isNative: false, isNativeIOS: false });
    Dialog.show({
      portalContainer: LOCK_CONTAINER,
      isOverTopAllViews: true,
    });

    setPlatform({ isNative: true, isNativeIOS: false });
    Dialog.show({
      portalContainer: LOCK_CONTAINER,
      isOverTopAllViews: true,
    });

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('stays quiet for a container-scoped dialog', () => {
    const errorSpy = getErrorSpy();

    // The shape `inAppStateLockDialogProps` uses: a container, and the flag
    // explicitly turned off. Warning here would cry wolf on every lock-screen
    // dialog this repo opens.
    Dialog.show({
      portalContainer: LOCK_CONTAINER,
      isOverTopAllViews: false,
    });
    Dialog.show({ portalContainer: LOCK_CONTAINER });

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('stays quiet for a dialog that only asks for the top of all views', () => {
    const errorSpy = getErrorSpy();

    Dialog.show({ isOverTopAllViews: true });

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('says nothing in production builds', () => {
    const errorSpy = getErrorSpy();
    setPlatform({ isDev: false });

    Dialog.show({
      portalContainer: LOCK_CONTAINER,
      isOverTopAllViews: true,
    });

    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe('Dialog.show closing lifecycle', () => {
  it('notifies close start synchronously and keeps cleanup after the animation', async () => {
    jest.useFakeTimers();
    try {
      const onCloseStart = jest.fn();
      const onClose = jest.fn();
      Dialog.show({ portalContainer: LOCK_CONTAINER, onCloseStart, onClose });
      const element = jest
        .mocked(renderToContainer)
        .mock.calls.at(-1)?.[1] as ReactElement<{
        onClose: () => Promise<void>;
      }>;
      const closing = element.props.onClose();
      expect(onCloseStart).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();
      jest.advanceTimersByTime(299);
      expect(onClose).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1);
      await closing;
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});
