/**
 * @jest-environment jsdom
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */

import type { ReactNode } from 'react';

import { Dialog, DialogContainer } from '.';

import { render, screen } from '@testing-library/react';

jest.mock('@onekeyhq/components', () => {
  const Wrapper = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    useMedia: () => ({ md: true }),
    AnimatePresence: Wrapper,
    Sheet: Object.assign(Wrapper, {
      Frame: Wrapper,
      Overlay: () => null,
    }),
    TMDialog: Object.assign(Wrapper, {
      Content: Wrapper,
      Overlay: () => null,
      Title: () => null,
    }),
  };
});

jest.mock('../../shared/tamagui', () => ({
  Sheet: {
    ScrollView: ({ children }: { children?: ReactNode }) => (
      <div data-testid="sheet-scroll-view">{children}</div>
    ),
  },
}));

jest.mock('../../layouts/ScrollView', () => ({
  ScrollView: ({ children }: { children?: ReactNode }) => (
    <div data-testid="plain-scroll-view">{children}</div>
  ),
}));

jest.mock('../../hocs/NativeSheetPresentation', () => ({
  NATIVE_SHEET_PRESENTATION_SUPPORTED: true,
  NativeSheetPresentation: ({ children }: { children?: ReactNode }) => (
    <div data-testid="native-sheet-presentation">{children}</div>
  ),
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
jest.mock('react-native-safe-area-context', () => ({
  initialWindowMetrics: null,
}));
jest.mock('expo-clipboard', () => ({}));
jest.mock('@tamagui/focus-scope', () => ({
  FocusScope: ({ children }: { children?: ReactNode }) => children,
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDev: false,
    isNative: true,
    isNativeAndroid: false,
    isNativeIOS: true,
    isNativeIOSPad: false,
  },
}));
jest.mock('@onekeyhq/shared/src/locale', () => ({ ETranslations: {} }));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { ui: { dialog: {} } },
}));
jest.mock('@onekeyhq/shared/src/errors/utils/errorUtils', () => ({}));
jest.mock('@onekeyhq/shared/src/utils/stringUtils', () => ({}));
jest.mock('@onekeyhq/shared/src/lazyLoad', () => ({
  createLazyModuleComponent: () =>
    Object.assign(() => null, { preload: jest.fn() }),
  preloadLazyComponents: jest.fn(),
}));
jest.mock('../../actions/Toast', () => ({}));
jest.mock('../../content/Keyboard', () => ({
  Keyboard: { dismissWithDelay: jest.fn() },
}));
jest.mock('../../content/SheetGrabber', () => ({ SheetGrabber: () => null }));
jest.mock('../../hocs', () => ({
  EPageType: {},
  EPortalContainerConstantName: {},
  Portal: {},
  usePageType: () => undefined,
}));
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
jest.mock('../../primitives', () => ({
  SizableText: () => null,
  Spinner: () => null,
  Stack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));
jest.mock('./Content', () => ({
  Content: ({ children }: { children?: ReactNode }) => children,
}));
jest.mock('./Footer', () => ({ Footer: () => null, FooterAction: () => null }));
jest.mock('./Header', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    DialogHeader: () => null,
    DialogHeaderContext: React.createContext({}),
  };
});
jest.mock('./HeaderDragZone', () => ({ HeaderDragZone: () => null }));
jest.mock('./renderToContainer', () => ({}));

const dialogProps = {
  open: true,
  showHeader: false,
  showFooter: false,
  onClose: async () => undefined,
  renderContent: <Dialog.ScrollView>Content</Dialog.ScrollView>,
};

describe('Dialog sheet scroll view presentation', () => {
  it('uses the plain ScrollView inside a native sheet presentation', () => {
    render(<DialogContainer {...dialogProps} nativeSheet />);

    expect(screen.getByTestId('native-sheet-presentation')).toBeTruthy();
    expect(screen.getByTestId('plain-scroll-view')).toBeTruthy();
    expect(screen.queryByTestId('sheet-scroll-view')).toBeNull();
  });

  it('uses Sheet.ScrollView inside the Tamagui sheet fallback', () => {
    render(<DialogContainer {...dialogProps} nativeSheet={false} />);

    expect(screen.queryByTestId('native-sheet-presentation')).toBeNull();
    expect(screen.getByTestId('sheet-scroll-view')).toBeTruthy();
    expect(screen.queryByTestId('plain-scroll-view')).toBeNull();
  });
});
