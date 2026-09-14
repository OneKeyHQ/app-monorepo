/**
 * @jest-environment jsdom
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */

import type { HTMLAttributes, ReactNode } from 'react';

import { DialogContainer } from '.';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

let mockIsSheet = false;
const mockClose = jest.fn(() => Promise.resolve());
const mockPeriodInput = <input aria-label="Period" />;

jest.mock('@onekeyhq/components', () => {
  const { FocusScope } = jest.requireActual(
    '@tamagui/focus-scope',
  ) as typeof import('@tamagui/focus-scope');
  const Wrapper = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  const DialogContent = ({
    children,
    onOpenAutoFocus,
    trapFocus,
  }: {
    children?: ReactNode;
    onOpenAutoFocus?: (event: Event) => void;
    trapFocus?: boolean;
  }) => (
    <FocusScope trapped={trapFocus} loop onMountAutoFocus={onOpenAutoFocus}>
      <div>{children}</div>
    </FocusScope>
  );
  return {
    useMedia: () => ({ md: mockIsSheet }),
    AnimatePresence: Wrapper,
    Sheet: Object.assign(Wrapper, { Frame: Wrapper, Overlay: () => null }),
    TMDialog: Object.assign(Wrapper, {
      Content: DialogContent,
      Overlay: () => null,
      Title: () => null,
    }),
  };
});

jest.mock('../../primitives', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    Stack: React.forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
      ({ children, tabIndex }, ref) => (
        <div ref={ref} tabIndex={tabIndex}>
          {children}
        </div>
      ),
    ),
  };
});

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
  useBackHandler: jest.fn(),
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
  return { DialogHeaderContext: React.createContext({}) };
});
jest.mock('./DialogScrollView', () => ({}));
jest.mock('./renderToContainer', () => ({}));

describe.each([false, true])('Dialog opening focus (sheet: %s)', (isSheet) => {
  beforeEach(() => {
    mockIsSheet = isSheet;
  });

  it('keeps default input autofocus when no override is provided', async () => {
    render(
      <DialogContainer
        open
        showHeader={false}
        showFooter={false}
        onClose={mockClose}
        renderContent={mockPeriodInput}
      />,
    );

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('textbox')),
    );
  });

  it('focuses the container without selecting an input and preserves keyboard navigation', async () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();
    const onOpenAutoFocus = jest.fn((event: Event) => {
      const container = event.currentTarget;
      if (container instanceof HTMLElement) {
        event.preventDefault();
        container.tabIndex = -1;
        container.focus();
      }
    });
    const view = render(
      <DialogContainer
        open
        showHeader={false}
        showFooter={false}
        onClose={mockClose}
        onOpenAutoFocus={onOpenAutoFocus}
        renderContent={
          <>
            <input aria-label="Period" defaultValue="14" />
            <button type="button">Confirm</button>
          </>
        }
      />,
    );

    await waitFor(() => expect(onOpenAutoFocus).toHaveBeenCalledTimes(1));
    const input = screen.getByRole('textbox');
    const confirm = screen.getByRole('button', { name: 'Confirm' });
    const focusTarget = document.activeElement;
    expect(focusTarget).not.toBe(input);
    expect(focusTarget).not.toBe(trigger);
    expect(focusTarget?.contains(input)).toBe(true);

    input.focus();
    expect(document.activeElement).toBe(input);
    fireEvent.keyDown(input, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirm);
    fireEvent.keyDown(confirm, { key: 'Tab' });
    expect(document.activeElement).toBe(input);

    view.unmount();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    trigger.remove();
  });
});

it('defers sheet opening focus until the sheet is open', async () => {
  mockIsSheet = true;
  const onOpenAutoFocus = jest.fn((event: Event) => event.preventDefault());
  const dialogProps = {
    showHeader: false,
    showFooter: false,
    onClose: async () => undefined,
    onOpenAutoFocus,
    renderContent: <input aria-label="Period" />,
  };
  const view = render(<DialogContainer {...dialogProps} open={false} />);
  expect(onOpenAutoFocus).not.toHaveBeenCalled();

  view.rerender(<DialogContainer {...dialogProps} open />);
  await waitFor(() => expect(onOpenAutoFocus).toHaveBeenCalledTimes(1));
});
