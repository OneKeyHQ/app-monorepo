/**
 * @jest-environment jsdom
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */

import type { ReactNode } from 'react';

import assert from 'node:assert/strict';

import { Dialog, DialogContainer } from '.';

import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  AndroidSoftInputModes,
  KeyboardController,
} from 'react-native-keyboard-controller';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useBackHandler, useKeyboardEventWithoutNavigation } from '../../hooks';

import type { KeyboardEvent } from 'react-native';

const mockMediaMd = { current: true };
const mockSafeAreaInsets = {
  current: { top: 47, bottom: 34, left: 0, right: 0 },
};
const mockWindowDimensions = {
  current: { height: 844, width: 390, scale: 1, fontScale: 1 },
};

jest.mock('@onekeyhq/components', () => {
  const Wrapper = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    useMedia: () => ({ md: mockMediaMd.current }),
    AnimatePresence: Wrapper,
    Sheet: Object.assign(
      ({ children }: { children?: ReactNode }) => (
        <div data-testid="phone-sheet">{children}</div>
      ),
      {
        Frame: Wrapper,
        Overlay: () => null,
      },
    ),
    TMDialog: Object.assign(
      ({ children }: { children?: ReactNode }) => (
        <div data-testid="floating-dialog">{children}</div>
      ),
      {
        Content: ({
          children,
          width,
          maxWidth,
        }: {
          children?: ReactNode;
          width?: number;
          maxWidth?: string;
        }) => (
          <div
            data-testid="floating-content"
            data-width={width}
            data-max-width={maxWidth}
          >
            {children}
          </div>
        ),
        Overlay: ({ onPress }: { onPress?: () => void }) => (
          <button
            type="button"
            data-testid="floating-overlay"
            onClick={onPress}
          >
            Overlay
          </button>
        ),
        Title: () => null,
      },
    ),
  };
});

jest.mock('../../shared/tamagui', () => ({
  Sheet: {
    ScrollView: ({
      children,
      maxHeight,
      height,
      keyboardShouldPersistTaps,
      testID,
    }: {
      children?: ReactNode;
      maxHeight?: number;
      height?: number;
      keyboardShouldPersistTaps?: string;
      testID?: string;
    }) => (
      <div
        data-testid={testID || 'sheet-scroll-view'}
        data-scroll-kind="sheet"
        data-max-height={maxHeight === undefined ? '' : String(maxHeight)}
        data-height={height === undefined ? '' : String(height)}
        data-keyboard-persist={keyboardShouldPersistTaps || ''}
      >
        {children}
      </div>
    ),
  },
}));

jest.mock('../../layouts/ScrollView', () => ({
  ScrollView: ({
    children,
    maxHeight,
    height,
    testID,
  }: {
    children?: ReactNode;
    maxHeight?: number;
    height?: number;
    testID?: string;
  }) => (
    <div
      data-testid={testID || 'plain-scroll-view'}
      data-scroll-kind="plain"
      data-max-height={maxHeight === undefined ? '' : String(maxHeight)}
      data-height={height === undefined ? '' : String(height)}
    >
      {children}
    </div>
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
  default: {
    View: ({ children, style }: { children?: ReactNode; style?: unknown }) => (
      <div data-animated-style={style ? 'applied' : 'none'}>{children}</div>
    ),
  },
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
jest.mock('../../content/SheetGrabber', () => ({
  SheetGrabber: () => <div data-testid="sheet-grabber" />,
}));
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
  useSafeAreaInsets: () => mockSafeAreaInsets.current,
}));
jest.mock('react-native-keyboard-controller', () => ({
  KeyboardController: {
    setInputMode: jest.fn(),
    setDefaultMode: jest.fn(),
  },
  AndroidSoftInputModes: {
    SOFT_INPUT_ADJUST_NOTHING: 48,
  },
}));
jest.mock('../../hooks/useKeyboardController', () => {
  const actual = jest.requireActual(
    '../../hooks/useKeyboardController.native.ts',
  ) as typeof import('../../hooks/useKeyboardController.native');
  return actual;
});
jest.mock('../../layouts/Page/PageContext', () => ({
  usePageContext: () => ({}),
}));
jest.mock('../../primitives', () => ({
  SizableText: () => null,
  Spinner: () => null,
  Stack: ({
    children,
    testID,
    paddingTop,
    paddingBottom,
  }: {
    children?: ReactNode;
    testID?: string;
    paddingTop?: number;
    paddingBottom?: number;
  }) => (
    <div
      data-testid={testID}
      data-padding-top={paddingTop}
      data-padding-bottom={paddingBottom}
    >
      {children}
    </div>
  ),
}));
jest.mock('./Content', () => ({
  Content: ({ children }: { children?: ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
}));
jest.mock('./Footer', () => ({
  Footer: () => <div data-testid="dialog-footer" />,
  FooterAction: () => null,
}));
jest.mock('./Header', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    DialogHeader: ({ hideCloseButton }: { hideCloseButton?: boolean }) => (
      <div
        data-testid="dialog-header"
        data-hide-close={hideCloseButton ? 'true' : 'false'}
      />
    ),
    DialogHeaderCloseButton: ({
      testID,
      onClose,
    }: {
      testID?: string;
      onClose?: () => void;
    }) => (
      <button
        type="button"
        aria-label="Close"
        data-testid={testID || 'dialog-header-close'}
        onClick={onClose}
      >
        Close
      </button>
    ),
    DialogHeaderContext: React.createContext({}),
  };
});
jest.mock('./HeaderDragZone', () => ({
  HeaderDragZone: ({ children }: { children?: ReactNode }) => (
    <div data-testid="header-drag-zone">{children}</div>
  ),
}));
jest.mock('./renderToContainer', () => ({}));
jest.mock('react-native', () => ({
  ...jest.requireActual<typeof import('react-native')>('react-native'),
  useWindowDimensions: () => mockWindowDimensions.current,
}));

const noopOnClose = async () => undefined;
const loginContent = <div>Login</div>;
const dialogProps = {
  open: true,
  showHeader: false,
  showFooter: false,
  onClose: noopOnClose,
  renderContent: <Dialog.ScrollView>Content</Dialog.ScrollView>,
};
const boundedDialogProps = {
  open: true,
  boundedSheetLayout: true,
  onClose: noopOnClose,
  renderContent: loginContent,
};

beforeEach(() => {
  platformEnv.isNative = true;
  platformEnv.isNativeAndroid = false;
  platformEnv.isNativeIOS = true;
  mockMediaMd.current = true;
  mockSafeAreaInsets.current = {
    top: 47,
    bottom: 34,
    left: 0,
    right: 0,
  };
  mockWindowDimensions.current = {
    height: 844,
    width: 390,
    scale: 1,
    fontScale: 1,
  };
  jest.mocked(KeyboardController.setInputMode).mockClear();
  jest.mocked(KeyboardController.setDefaultMode).mockClear();
  jest.mocked(useBackHandler).mockClear();
});

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
    expect(screen.queryByTestId('dialog-bounded-scroll')).toBeNull();
  });
});

describe('Dialog native centered opt-in', () => {
  it.each([false, true])(
    'centers a bounded native dialog without sheet chrome (Android: %s)',
    (isAndroid) => {
      platformEnv.isNativeAndroid = isAndroid;
      platformEnv.isNativeIOS = !isAndroid;
      render(
        <DialogContainer
          {...boundedDialogProps}
          boundedSheetLayout={false}
          nativeSheet
          nativeCentered
          sheetDragArea="header"
        />,
      );

      expect(screen.getByTestId('floating-dialog')).toBeTruthy();
      expect(screen.queryByTestId('phone-sheet')).toBeNull();
      expect(screen.queryByTestId('native-sheet-presentation')).toBeNull();
      expect(screen.queryByTestId('header-drag-zone')).toBeNull();
      expect(screen.queryByTestId('sheet-grabber')).toBeNull();
      expect(screen.getByTestId('dialog-bounded-close')).toBeTruthy();
      const scroll = screen.getByTestId('dialog-bounded-scroll');
      expect(scroll.getAttribute('data-scroll-kind')).toBe('plain');
      expect(scroll.getAttribute('data-max-height')).toBe('750');
      expect(scroll.getAttribute('data-height')).toBe('');
      expect(
        screen.getByTestId('floating-content').getAttribute('data-max-width'),
      ).toBe('90%');
    },
  );

  it.each([
    ['iOS', false, 450, 347],
    ['Android', true, 416, 381],
  ] as const)(
    'keeps safe-area and keyboard padding outside the centered card on %s',
    (_name, isAndroid, expectedMaxHeight, expectedPaddingBottom) => {
      platformEnv.isNativeAndroid = isAndroid;
      platformEnv.isNativeIOS = !isAndroid;
      render(<DialogContainer {...boundedDialogProps} nativeCentered />);

      const content = screen.getByTestId('floating-content');
      const frame = content.parentElement;
      const scroll = screen.getByTestId('dialog-bounded-scroll');
      expect(frame?.getAttribute('data-padding-top')).toBe('47');
      expect(frame?.getAttribute('data-padding-bottom')).toBe('47');
      expect(
        content.firstElementChild?.getAttribute('data-animated-style'),
      ).toBe('none');
      expect(scroll.getAttribute('data-max-height')).toBe('750');
      const keyboardHandlers = jest
        .mocked(useKeyboardEventWithoutNavigation)
        .mock.calls.at(-1)?.[0];

      act(() => {
        keyboardHandlers?.keyboardWillShow?.({
          endCoordinates: { height: 300 },
        } as KeyboardEvent);
      });
      expect(frame?.getAttribute('data-padding-top')).toBe('47');
      expect(frame?.getAttribute('data-padding-bottom')).toBe(
        String(expectedPaddingBottom),
      );
      expect(scroll.getAttribute('data-max-height')).toBe(
        String(expectedMaxHeight),
      );
      expect(
        content.firstElementChild?.getAttribute('data-animated-style'),
      ).toBe('none');

      act(() => {
        keyboardHandlers?.keyboardWillHide?.({
          endCoordinates: { height: 0 },
        } as KeyboardEvent);
      });
      expect(frame?.getAttribute('data-padding-bottom')).toBe('47');
      expect(scroll.getAttribute('data-max-height')).toBe('750');
    },
  );

  it('keeps equal safe-area clearance when the bottom inset is larger in landscape', () => {
    mockSafeAreaInsets.current = { top: 0, bottom: 34, left: 47, right: 47 };
    mockWindowDimensions.current = {
      height: 390,
      width: 844,
      scale: 1,
      fontScale: 1,
    };
    render(<DialogContainer {...boundedDialogProps} nativeCentered />);

    const frame = screen.getByTestId('floating-content').parentElement;
    expect(frame?.getAttribute('data-padding-top')).toBe('34');
    expect(frame?.getAttribute('data-padding-bottom')).toBe('34');
    expect(
      screen
        .getByTestId('dialog-bounded-scroll')
        .getAttribute('data-max-height'),
    ).toBe('322');
  });

  it('keeps a web phone sheet when only nativeCentered is enabled', () => {
    platformEnv.isNative = false;
    platformEnv.isNativeIOS = false;
    render(<DialogContainer {...dialogProps} nativeCentered />);

    expect(screen.getByTestId('phone-sheet')).toBeTruthy();
    expect(screen.queryByTestId('floating-dialog')).toBeNull();
    expect(screen.queryByTestId('dialog-bounded-scroll')).toBeNull();
  });

  it('keeps the header close available when backdrop and system dismissal are disabled', async () => {
    platformEnv.isNativeAndroid = true;
    platformEnv.isNativeIOS = false;
    const onClose = jest.fn().mockResolvedValue(undefined);
    render(
      <DialogContainer
        {...boundedDialogProps}
        nativeCentered
        onClose={onClose}
        dismissOnOverlayPress={false}
        disableSystemClose
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('floating-overlay'));
      const onBack = jest.mocked(useBackHandler).mock.calls.at(-1)?.[0];
      assert(onBack, 'Expected a registered back handler');
      expect(onBack()).toBe(true);
    });
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByTestId('dialog-bounded-close'));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('honors the close guard for backdrop and Android back dismissal', async () => {
    platformEnv.isNativeAndroid = true;
    platformEnv.isNativeIOS = false;
    const onClose = jest.fn().mockResolvedValue(undefined);
    const onBeforeClose = jest.fn().mockResolvedValue(false);
    render(
      <DialogContainer
        {...boundedDialogProps}
        nativeCentered
        onClose={onClose}
        onBeforeClose={onBeforeClose}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('floating-overlay'));
    });
    expect(onBeforeClose).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    onBeforeClose.mockResolvedValue(true);
    await act(async () => {
      const onBack = jest.mocked(useBackHandler).mock.calls.at(-1)?.[0];
      assert(onBack, 'Expected a registered back handler');
      expect(onBack()).toBe(true);
    });
    expect(onBeforeClose).toHaveBeenCalledTimes(2);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Dialog bounded sheet layout opt-in', () => {
  it('uses a capped scroll view with a fixed close and header drag on native', () => {
    render(<DialogContainer {...boundedDialogProps} sheetDragArea="header" />);

    const scroll = screen.getByTestId('dialog-bounded-scroll');
    const close = screen.getByTestId('dialog-bounded-close');

    expect(scroll.getAttribute('data-scroll-kind')).toBe('sheet');
    expect(screen.getByTestId('header-drag-zone')).toBeTruthy();
    expect(screen.getByTestId('sheet-grabber')).toBeTruthy();
    expect(
      screen.getByTestId('dialog-header').getAttribute('data-hide-close'),
    ).toBe('true');
    expect(scroll.contains(screen.getByTestId('dialog-header'))).toBe(true);
    expect(scroll.contains(screen.getByTestId('dialog-content'))).toBe(true);
    expect(scroll.contains(screen.getByTestId('dialog-footer'))).toBe(true);
    expect(scroll.contains(close)).toBe(false);
    expect(screen.getByTestId('dialog-bounded-chrome').contains(close)).toBe(
      true,
    );
    expect(scroll.getAttribute('data-max-height')).not.toBe('');
    expect(scroll.getAttribute('data-height')).toBe('');
    expect(scroll.getAttribute('data-keyboard-persist')).toBe('handled');
    expect(screen.queryByTestId('native-sheet-presentation')).toBeNull();
    expect(screen.queryByTestId('plain-scroll-view')).toBeNull();
  });

  it('does not change the web or desktop dialog layout', () => {
    platformEnv.isNative = false;
    platformEnv.isNativeIOS = false;
    mockMediaMd.current = false;
    render(<DialogContainer {...boundedDialogProps} />);

    expect(screen.queryByTestId('dialog-bounded-scroll')).toBeNull();
    expect(
      screen.getByTestId('dialog-header').getAttribute('data-hide-close'),
    ).toBe('false');
  });

  it.each([
    ['iOS negative-height fallback', false, -24, 467],
    ['Android keyboard and navigation bar', true, 300, 463],
  ] as const)(
    'updates and restores the scroll cap: %s',
    (_name, isAndroid, height, expectedMaxHeight) => {
      platformEnv.isNativeAndroid = isAndroid;
      platformEnv.isNativeIOS = !isAndroid;
      render(<DialogContainer {...boundedDialogProps} />);

      const hiddenMaxHeight = Number(
        screen
          .getByTestId('dialog-bounded-scroll')
          .getAttribute('data-max-height'),
      );
      const keyboardHandlers = jest
        .mocked(useKeyboardEventWithoutNavigation)
        .mock.calls.at(-1)?.[0];

      act(() => {
        keyboardHandlers?.keyboardWillShow?.({
          endCoordinates: { height },
        } as KeyboardEvent);
      });

      const shownMaxHeight = Number(
        screen
          .getByTestId('dialog-bounded-scroll')
          .getAttribute('data-max-height'),
      );
      expect(shownMaxHeight).toBe(expectedMaxHeight);

      act(() => {
        keyboardHandlers?.keyboardWillHide?.({
          endCoordinates: { height: 0 },
        } as KeyboardEvent);
      });
      expect(
        Number(
          screen
            .getByTestId('dialog-bounded-scroll')
            .getAttribute('data-max-height'),
        ),
      ).toBe(hiddenMaxHeight);
    },
  );

  it('recomputes the scroll cap when the window height shrinks', () => {
    const { rerender } = render(<DialogContainer {...boundedDialogProps} />);
    expect(
      screen
        .getByTestId('dialog-bounded-scroll')
        .getAttribute('data-max-height'),
    ).toBe('763');

    mockWindowDimensions.current = {
      height: 390,
      width: 844,
      scale: 1,
      fontScale: 1,
    };
    rerender(<DialogContainer {...boundedDialogProps} />);
    expect(
      screen
        .getByTestId('dialog-bounded-scroll')
        .getAttribute('data-max-height'),
    ).toBe('309');
  });

  it('suspends Android window pan for bounded dialogs and restores it on unmount', () => {
    platformEnv.isNativeAndroid = true;
    platformEnv.isNativeIOS = false;

    const { unmount } = render(<DialogContainer {...boundedDialogProps} />);
    expect(KeyboardController.setInputMode).toHaveBeenCalledTimes(1);
    expect(KeyboardController.setInputMode).toHaveBeenCalledWith(
      AndroidSoftInputModes.SOFT_INPUT_ADJUST_NOTHING,
    );
    expect(KeyboardController.setDefaultMode).not.toHaveBeenCalled();

    unmount();
    expect(KeyboardController.setDefaultMode).toHaveBeenCalledTimes(1);

    const reopened = render(<DialogContainer {...boundedDialogProps} />);
    expect(KeyboardController.setInputMode).toHaveBeenCalledTimes(2);
    reopened.unmount();
    expect(KeyboardController.setDefaultMode).toHaveBeenCalledTimes(2);
  });

  it('does not change native input mode for ordinary Android dialogs or iOS', () => {
    platformEnv.isNativeAndroid = true;
    platformEnv.isNativeIOS = false;
    const { unmount } = render(<DialogContainer {...dialogProps} />);
    expect(KeyboardController.setInputMode).not.toHaveBeenCalled();
    expect(KeyboardController.setDefaultMode).not.toHaveBeenCalled();
    unmount();

    platformEnv.isNativeAndroid = false;
    platformEnv.isNativeIOS = true;
    const ios = render(<DialogContainer {...boundedDialogProps} />);
    expect(KeyboardController.setInputMode).not.toHaveBeenCalled();
    expect(KeyboardController.setDefaultMode).not.toHaveBeenCalled();
    ios.unmount();

    platformEnv.isNative = false;
    platformEnv.isNativeIOS = false;
    const web = render(<DialogContainer {...boundedDialogProps} />);
    expect(KeyboardController.setInputMode).not.toHaveBeenCalled();
    expect(KeyboardController.setDefaultMode).not.toHaveBeenCalled();
    web.unmount();
  });

  it('keeps a tablet floating dialog on a single bounded scroll view', () => {
    mockMediaMd.current = false;
    render(<DialogContainer {...boundedDialogProps} />);

    expect(screen.getByTestId('dialog-bounded-scroll')).toBeTruthy();
    expect(
      screen
        .getByTestId('dialog-bounded-scroll')
        .getAttribute('data-scroll-kind'),
    ).toBe('plain');
    expect(
      screen
        .getByTestId('dialog-bounded-scroll')
        .getAttribute('data-max-height'),
    ).toBe('716');
    expect(screen.queryByTestId('header-drag-zone')).toBeNull();
    expect(screen.queryByTestId('plain-scroll-view')).toBeNull();
    expect(screen.getByTestId('dialog-bounded-close')).toBeTruthy();
  });
});
