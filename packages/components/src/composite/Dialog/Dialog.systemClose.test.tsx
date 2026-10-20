/**
 * @jest-environment jsdom
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */

import type { ReactNode } from 'react';

import { DialogContainer } from '.';

import { act, render } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IDialogContainerProps } from './type';

// Exercise Dialog's close guard through the overlay host's dismissal contract.
const mockOverlayPresentation = jest.fn();
const mockBody = <span>body</span>;

jest.mock('@onekeyhq/components', () => {
  const Wrapper = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    useMedia: () => ({ md: false }),
    AnimatePresence: Wrapper,
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
  useKeyboardEventWithoutNavigation: jest.fn(),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
jest.mock('@onekeyfe/react-native-native-overlay', () => ({
  useNestedOverlayLevel: () => 'modal',
  useOverlayPageScope: () => ({}),
}));
jest.mock('./OverlayDialogPresentation', () => ({
  OverlayDialogPresentation: (props: { children?: ReactNode }) => {
    mockOverlayPresentation(props);
    return props.children;
  },
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
  const presentation = mockOverlayPresentation.mock.calls.at(-1)?.[0] as {
    open: boolean;
    dismissOnBackPress: boolean;
    onRequestClose: () => void;
  };
  let consumed = false;
  await act(async () => {
    consumed = presentation.open;
    if (consumed && platformEnv.isNative && presentation.dismissOnBackPress)
      presentation.onRequestClose();
  });
  return consumed;
}

describe('Dialog system close through the overlay host', () => {
  beforeEach(() => {
    mockOverlayPresentation.mockClear();
    platformEnv.isNative = true;
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
  it('keeps desktop Escape from closing an open dialog', async () => {
    platformEnv.isNative = false;
    const onClose = jest.fn(() => Promise.resolve());
    expect(await pressSystemClose({ onClose })).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });
});
