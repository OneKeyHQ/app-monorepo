/**
 * @jest-environment jsdom
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */
// Tests drive host callbacks with fresh fixture props.
/* oxlint-disable react-perf/jsx-no-new-object-as-prop, react-perf/jsx-no-new-function-as-prop */

import type { ReactNode } from 'react';

import { Dialog, DialogContainer } from '.';

import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  AndroidSoftInputModes,
  KeyboardController,
} from 'react-native-keyboard-controller';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useKeyboardEventWithoutNavigation } from '../../hooks';

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
  };
});

jest.mock('../../layouts/ScrollView', () => ({
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
      data-testid={testID || 'plain-scroll-view'}
      data-scroll-kind="plain"
      data-max-height={maxHeight === undefined ? '' : String(maxHeight)}
      data-height={height === undefined ? '' : String(height)}
      data-keyboard-persist={keyboardShouldPersistTaps || ''}
    >
      {children}
    </div>
  ),
}));

jest.mock('./OverlayDialogPresentation', () => ({
  OverlayDialogPresentation: ({
    children,
    open,
    isSheet,
    cardProps,
    dismissOnOverlayPress,
    dismissOnBackPress,
    onRequestClose,
    disableDrag,
    onAnimationComplete,
  }: {
    children?: ReactNode;
    open: boolean;
    isSheet: boolean;
    cardProps?: { maxWidth?: string };
    dismissOnOverlayPress: boolean;
    dismissOnBackPress: boolean;
    onRequestClose: () => void;
    disableDrag: boolean;
    onAnimationComplete?: (info: { open: boolean }) => void;
  }) => (
    <div
      data-testid="overlay-dialog"
      data-sheet={isSheet ? 'true' : 'false'}
      data-max-width={cardProps?.maxWidth}
      data-disable-drag={String(disableDrag)}
    >
      <button
        type="button"
        data-testid="overlay-backdrop"
        disabled={!dismissOnOverlayPress}
        onClick={onRequestClose}
      >
        Backdrop
      </button>
      <button
        type="button"
        data-testid="overlay-back"
        disabled={!dismissOnBackPress}
        onClick={onRequestClose}
      >
        Back
      </button>
      <button
        type="button"
        data-testid="sheet-presented"
        onClick={() => onAnimationComplete?.({ open: true })}
      >
        Presented
      </button>
      {open ? children : null}
    </div>
  ),
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
});

describe('Dialog sheet scroll view presentation', () => {
  it('uses the plain ScrollView inside the native overlay sheet', () => {
    render(<DialogContainer {...dialogProps} />);

    expect(
      screen.getByTestId('overlay-dialog').getAttribute('data-sheet'),
    ).toBe('true');
    expect(screen.getByTestId('plain-scroll-view')).toBeTruthy();
    expect(screen.queryByTestId('sheet-scroll-view')).toBeNull();
  });
});

describe('Dialog native centered opt-in', () => {
  it.each([
    ['iOS', false, 450],
    ['Android', true, 416],
  ] as const)(
    'centers without sheet chrome and bounds scroll content for the keyboard on %s',
    (_name, isAndroid, expectedMaxHeight) => {
      platformEnv.isNativeAndroid = isAndroid;
      platformEnv.isNativeIOS = !isAndroid;
      render(
        <DialogContainer
          {...boundedDialogProps}
          boundedSheetLayout={false}
          nativeCentered
          sheetDragArea="header"
        />,
      );

      expect(
        screen.getByTestId('overlay-dialog').getAttribute('data-sheet'),
      ).toBe('false');
      expect(screen.queryByTestId('phone-sheet')).toBeNull();
      expect(screen.queryByTestId('native-sheet-presentation')).toBeNull();
      expect(screen.queryByTestId('header-drag-zone')).toBeNull();
      expect(screen.queryByTestId('sheet-grabber')).toBeNull();
      expect(screen.getByTestId('dialog-bounded-close')).toBeTruthy();
      const content = screen.getByTestId('overlay-dialog');
      const scroll = screen.getByTestId('dialog-bounded-scroll');
      expect(scroll.getAttribute('data-scroll-kind')).toBe('plain');
      expect(scroll.getAttribute('data-height')).toBe('');
      expect(content.getAttribute('data-max-width')).toBe('90%');

      expect(
        content
          .querySelector('[data-animated-style]')
          ?.getAttribute('data-animated-style'),
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

      expect(scroll.getAttribute('data-max-height')).toBe(
        String(expectedMaxHeight),
      );
      expect(
        content
          .querySelector('[data-animated-style]')
          ?.getAttribute('data-animated-style'),
      ).toBe('none');

      act(() => {
        keyboardHandlers?.keyboardWillHide?.({
          endCoordinates: { height: 0 },
        } as KeyboardEvent);
      });

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

    expect(
      screen.getByTestId('overlay-dialog').getAttribute('data-sheet'),
    ).toBe('false');
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

    expect(
      screen.getByTestId('overlay-dialog').getAttribute('data-sheet'),
    ).toBe('true');
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
      fireEvent.click(screen.getByTestId('overlay-backdrop'));
      fireEvent.click(screen.getByTestId('overlay-back'));
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
      fireEvent.click(screen.getByTestId('overlay-backdrop'));
    });
    expect(onBeforeClose).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    onBeforeClose.mockResolvedValue(true);
    await act(async () => {
      fireEvent.click(screen.getByTestId('overlay-back'));
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

    expect(scroll.getAttribute('data-scroll-kind')).toBe('plain');
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

it('honors sheet pan dismissal and forwards its presentation callback', () => {
  const onAnimationComplete = jest.fn();
  render(
    <DialogContainer
      {...dialogProps}
      sheetDragArea="header"
      sheetProps={{ dismissOnSnapToBottom: false, onAnimationComplete }}
    />,
  );
  expect(screen.getByTestId('overlay-dialog').dataset.disableDrag).toBe('true');
  expect(screen.queryByTestId('header-drag-zone')).toBeNull();
  fireEvent.click(screen.getByTestId('sheet-presented'));
  expect(onAnimationComplete).toHaveBeenCalledWith({ open: true });
});
