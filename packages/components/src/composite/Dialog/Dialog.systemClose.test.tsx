/**
 * @jest-environment jsdom
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */

import type { ReactNode } from 'react';

import { DialogContainer } from '.';

import { act, render } from '@testing-library/react';

import type { IDialogContainerProps } from './type';

// System close — the Android hardware back press, and Escape on web and
// desktop, which the web useBackHandler maps onto the same callback — reaches
// a dialog through the handler DialogFrame registers with useBackHandler.
// The mock captures that handler; the Tamagui primitives around it are
// stubbed as in Dialog.focus.test.tsx.
const mockUseBackHandler = jest.fn();
const mockBody = <span>body</span>;

jest.mock('@onekeyhq/components', () => {
  const Wrapper = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    useMedia: () => ({ md: false }),
    AnimatePresence: Wrapper,
    Sheet: Object.assign(Wrapper, { Frame: Wrapper, Overlay: () => null }),
    TMDialog: Object.assign(Wrapper, {
      Content: Wrapper,
      Overlay: () => null,
      Title: () => null,
    }),
  };
});

jest.mock('../../primitives', () => ({
  Stack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
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
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
jest.mock('@onekeyhq/shared/src/locale', () => ({ ETranslations: {} }));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({}));
jest.mock('@onekeyhq/shared/src/errors/utils/errorUtils', () => ({}));
jest.mock('@onekeyhq/shared/src/utils/stringUtils', () => ({}));
jest.mock('@onekeyhq/shared/src/lazyLoad', () => ({
  createLazyModuleComponent: () => () => null,
}));
jest.mock('../../actions/Toast', () => ({}));
jest.mock('../../content/Keyboard', () => ({
  Keyboard: { dismissWithDelay: jest.fn() },
}));
jest.mock('../../content/SheetGrabber', () => ({ SheetGrabber: () => null }));
jest.mock('../../hocs', () => ({}));
jest.mock('../../hooks', () => ({
  useBackHandler: (callback: () => boolean) => {
    mockUseBackHandler(callback);
  },
  useKeyboardEventWithoutNavigation: jest.fn(),
  useOverlayZIndex: () => 1,
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));
jest.mock('../../layouts/Page/PageContext', () => ({}));
jest.mock('../../layouts/ScrollView', () => ({}));
jest.mock('./Content', () => ({
  Content: ({ children }: { children?: ReactNode }) => children,
}));
jest.mock('./Footer', () => ({ Footer: () => null }));
jest.mock('./Header', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    DialogHeader: () => null,
    DialogHeaderCloseButton: () => null,
    DialogHeaderContext: React.createContext({}),
  };
});
jest.mock('./DialogScrollView', () => ({}));
jest.mock('./renderToContainer', () => ({}));

async function pressSystemClose(
  props: Partial<IDialogContainerProps> & {
    onClose: IDialogContainerProps['onClose'];
  },
) {
  render(
    <DialogContainer
      open
      showHeader={false}
      showFooter={false}
      renderContent={mockBody}
      {...props}
    />,
  );
  const handleBackPress = mockUseBackHandler.mock.calls.at(-1)?.[0] as
    | (() => boolean)
    | undefined;
  expect(handleBackPress).toBeDefined();
  let consumed: boolean | undefined;
  await act(async () => {
    consumed = handleBackPress?.();
  });
  return consumed;
}

describe('Dialog system close (Android back, Escape on web and desktop)', () => {
  beforeEach(() => {
    mockUseBackHandler.mockClear();
  });

  it('closes an open dialog through onClose', async () => {
    const onClose = jest.fn(() => Promise.resolve());

    expect(await pressSystemClose({ onClose })).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('consumes the press without closing while system close is disabled', async () => {
    const onClose = jest.fn(() => Promise.resolve());

    expect(await pressSystemClose({ onClose, disableSystemClose: true })).toBe(
      true,
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('lets onBeforeClose refuse the close', async () => {
    const onClose = jest.fn(() => Promise.resolve());
    const onBeforeClose = jest.fn(() => false);

    expect(await pressSystemClose({ onClose, onBeforeClose })).toBe(true);
    expect(onBeforeClose).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('leaves the press to others while the dialog is closed', async () => {
    const onClose = jest.fn(() => Promise.resolve());

    expect(await pressSystemClose({ onClose, open: false })).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });
});
