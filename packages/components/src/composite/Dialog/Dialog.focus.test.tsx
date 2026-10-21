/**
 * @jest-environment jsdom
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */

import type { HTMLAttributes, ReactElement, ReactNode } from 'react';
import { createRef, useEffect } from 'react';

import { Dialog, DialogContainer } from '.';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useForm } from 'react-hook-form';

import { renderToContainer } from './renderToContainer';

import type { IDialogInstance } from './type';

let mockIsSheet = false;
const mockClose = jest.fn(() => Promise.resolve());
const mockPeriodInput = <input aria-label="Period" />;
const mockNoopDialogClose = async () => undefined;
const mockNestedDialog = (
  <DialogContainer
    testID="nested-dialog"
    showHeader={false}
    showFooter={false}
    onClose={mockNoopDialogClose}
  />
);
let mockPresentation:
  | {
      page?: { hostKey: string; ownerKey: string };
      onExited?: () => void;
      level: string;
    }
  | undefined;
const mockPresentations: Array<{
  page?: { hostKey: string; ownerKey: string };
  testID?: string;
}> = [];

jest.mock('./OverlayDialogPresentation', () => ({
  OverlayDialogPresentation: ({
    children,
    open,
    page,
    onExited,
    level,
    testID,
  }: {
    children?: ReactNode;
    open: boolean;
    page?: { hostKey: string; ownerKey: string };
    onExited?: () => void;
    level: string;
    testID?: string;
  }) => {
    mockPresentation = { page, onExited, level };
    mockPresentations.push({ page, testID });
    return open ? <div data-testid="overlay-dialog">{children}</div> : null;
  },
}));
jest.mock('@react-navigation/native', () => ({
  NavigationRouteContext: jest
    .requireActual<typeof import('react')>('react')
    .createContext(undefined),
}));

jest.mock('@onekeyfe/react-native-native-overlay', () => ({
  useNestedOverlayLevel: () => 'modal',
  useOverlayPageScope: () => ({}),
}));

jest.mock('@onekeyhq/components', () => {
  const Wrapper = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    useMedia: () => ({ md: mockIsSheet }),
    AnimatePresence: Wrapper,
  };
});

it('does not pass a custom dialog mount into nested dialog content', () => {
  mockPresentations.length = 0;
  Dialog.show({
    overlayPage: { hostKey: 'main', ownerKey: 'perp' },
    dialogContainer: ({ ref }) => (
      <div>
        <DialogContainer
          ref={ref}
          testID="outer-dialog"
          showHeader={false}
          showFooter={false}
          onClose={mockNoopDialogClose}
          renderContent={mockNestedDialog}
        />
      </div>
    ),
  });
  const element = jest
    .mocked(renderToContainer)
    .mock.calls.at(-1)?.[1] as ReactElement;
  const mounted = render(element);
  expect(mockPresentations).toContainEqual({
    page: { hostKey: 'main', ownerKey: 'perp' },
    testID: 'outer-dialog',
  });
  expect(mockPresentations).toContainEqual({
    page: undefined,
    testID: 'nested-dialog',
  });
  mounted.unmount();
});

jest.mock('../../primitives', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    Stack: React.forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
      // eslint-disable-next-line prefer-arrow-callback
      function StackMock({ children, tabIndex }, ref) {
        return (
          <div ref={ref} tabIndex={tabIndex}>
            {children}
          </div>
        );
      },
    ),
  };
});

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('react-native-reanimated', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: {
      View: React.forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
        // eslint-disable-next-line prefer-arrow-callback
        function AnimatedViewMock({ children, tabIndex }, ref) {
          return (
            <div ref={ref} tabIndex={tabIndex}>
              {children}
            </div>
          );
        },
      ),
    },
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: () => ({}),
  };
});
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
jest.mock('../../hocs', () => ({
  EPortalContainerConstantName: {
    FULL_WINDOW_OVERLAY_PORTAL: 'window',
    APP_STATE_LOCK_CONTAINER_OVERLAY: 'lock',
    PASSWORD_VERIFY_CONTAINER_PORTAL: 'secure',
  },
}));
jest.mock('../../hooks', () => ({
  useBackHandler: jest.fn(),
  useKeyboardEventWithoutNavigation: jest.fn(),
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));
jest.mock('../../layouts/Page/PageContext', () => ({}));
jest.mock('../../layouts/ScrollView', () => ({}));
jest.mock('./Content', () => ({
  Content: ({ children }: { children?: ReactNode }) => children,
}));
jest.mock('./Footer', () => ({ Footer: () => null }));
jest.mock('./Header', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    DialogHeader: () => null,
    DialogHeaderCloseButton: () => null,
    DialogHeaderContext: React.createContext({}),
  };
});
jest.mock('./DialogScrollView', () => ({}));
jest.mock('./renderToContainer', () => ({
  renderToContainer: jest.fn(() => ({ destroy: jest.fn(), update: jest.fn() })),
}));

it('keeps a wrapped custom dialog page-scoped and forwards both close callbacks', async () => {
  const ownClose = jest.fn(async () => undefined);
  const onClose = jest.fn();
  const dialog = Dialog.show({
    overlayPage: { hostKey: 'main', ownerKey: 'perp' },
    dialogContainer: ({ ref }) => (
      <div data-testid="theme-wrapper">
        <DialogContainer
          ref={ref}
          showHeader={false}
          showFooter={false}
          onClose={ownClose}
        />
      </div>
    ),
    onClose,
  });
  const element = jest
    .mocked(renderToContainer)
    .mock.calls.at(-1)?.[1] as ReactElement;
  const mounted = render(element);
  expect(mockPresentation?.page).toEqual({ hostKey: 'main', ownerKey: 'perp' });
  expect(mockPresentation?.level).toBe('modal');
  let closing!: Promise<void>;
  act(() => {
    closing = Promise.resolve(dialog.close());
  });
  await waitFor(() => expect(ownClose).toHaveBeenCalledTimes(1));
  expect(onClose).not.toHaveBeenCalled();
  act(() => mockPresentation?.onExited?.());
  await act(async () => {
    await closing;
  });
  expect(onClose).toHaveBeenCalledTimes(1);
  mounted.unmount();
});

it('starts a wrapped custom close before its own asynchronous callback settles', async () => {
  let finishOwnClose: () => void = () => undefined;
  const ownClose = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        finishOwnClose = resolve;
      }),
  );
  const onCloseStart = jest.fn();
  const onClose = jest.fn();
  const dialog = Dialog.show({
    dialogContainer: ({ ref }) => (
      <div>
        <DialogContainer
          ref={ref}
          showHeader={false}
          showFooter={false}
          onClose={ownClose}
        />
      </div>
    ),
    onCloseStart,
    onClose,
  });
  const element = jest
    .mocked(renderToContainer)
    .mock.calls.at(-1)?.[1] as ReactElement;
  const mounted = render(element);
  let closing!: Promise<void>;
  act(() => {
    closing = Promise.resolve(dialog.close({ flag: 'confirm' }));
  });
  await waitFor(() => expect(ownClose).toHaveBeenCalledTimes(1));
  expect(onCloseStart).toHaveBeenCalledTimes(1);
  act(() => mockPresentation?.onExited?.());
  await waitFor(() =>
    expect(onClose).toHaveBeenCalledWith({ flag: 'confirm' }),
  );
  let settled = false;
  void closing.then(() => {
    settled = true;
  });
  await Promise.resolve();
  expect(settled).toBe(false);
  await act(async () => {
    finishOwnClose();
    await closing;
  });
  expect(onCloseStart).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalledTimes(1);
  mounted.unmount();
});

it('keeps the exit animation when a dialog mounts during a pending close guard', async () => {
  let allowClose: (allowed: boolean) => void = () => undefined;
  const onBeforeClose = jest.fn(
    () =>
      new Promise<boolean>((resolve) => {
        allowClose = resolve;
      }),
  );
  const onCloseStart = jest.fn();
  const onClose = jest.fn();
  const dialog = Dialog.show({ onBeforeClose, onCloseStart, onClose });
  const element = jest
    .mocked(renderToContainer)
    .mock.calls.at(-1)?.[1] as ReactElement;
  const manager = jest.mocked(renderToContainer).mock.results.at(-1)?.value as {
    destroy: jest.Mock;
  };
  const closing = Promise.resolve(dialog.close({ flag: 'confirm' }));
  const mounted = render(element);

  await act(async () => {
    allowClose(true);
    await Promise.resolve();
  });
  expect(onBeforeClose).toHaveBeenCalledTimes(1);
  expect(onCloseStart).toHaveBeenCalledTimes(1);
  expect(manager.destroy).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();

  act(() => mockPresentation?.onExited?.());
  await act(async () => {
    await closing;
  });
  expect(manager.destroy).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalledWith({ flag: 'confirm' });
  mounted.unmount();
});

it.each(['direct', 'wrapped'] as const)(
  'reuses the pending close guard for a %s custom dialog',
  async (container) => {
    let allowClose: (allowed: boolean) => void = () => undefined;
    const onBeforeClose = jest.fn(
      () =>
        new Promise<boolean>((resolve) => {
          allowClose = resolve;
        }),
    );
    const onCloseStart = jest.fn();
    const onClose = jest.fn();
    const dialog = Dialog.show({
      onBeforeClose,
      onCloseStart,
      onClose,
      dialogContainer: ({ ref }) => {
        const customDialog = (
          <DialogContainer
            ref={ref}
            showHeader={false}
            showFooter={false}
            onBeforeClose={onBeforeClose}
            onClose={mockNoopDialogClose}
          />
        );
        return container === 'direct' ? (
          customDialog
        ) : (
          <div>{customDialog}</div>
        );
      },
    });
    const element = jest
      .mocked(renderToContainer)
      .mock.calls.at(-1)?.[1] as ReactElement;
    const manager = jest.mocked(renderToContainer).mock.results.at(-1)
      ?.value as { destroy: jest.Mock };
    const closing = Promise.resolve(dialog.close({ flag: 'confirm' }));
    const mounted = render(element);

    await act(async () => {
      allowClose(true);
      await Promise.resolve();
    });
    expect(onBeforeClose).toHaveBeenCalledTimes(1);
    expect(onCloseStart).toHaveBeenCalledTimes(1);
    expect(manager.destroy).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    act(() => mockPresentation?.onExited?.());
    await act(async () => {
      await closing;
    });
    expect(manager.destroy).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith({ flag: 'confirm' });
    mounted.unmount();
  },
);

it('notifies dismissal before waiting for the close animation', async () => {
  const dialogRef = createRef<IDialogInstance>();
  const closeOrder: string[] = [];
  let finishAnimation = () => {};
  const animation = new Promise<void>((resolve) => {
    finishAnimation = resolve;
  });
  const onCloseRequested = jest.fn(() => {
    closeOrder.push('requested');
  });
  const onClose = jest.fn(() => {
    closeOrder.push('animation');
    return animation;
  });
  render(
    <DialogContainer
      ref={dialogRef}
      showHeader={false}
      showFooter={false}
      onCloseRequested={onCloseRequested}
      onClose={onClose}
    />,
  );
  act(() => {
    void dialogRef.current?.close();
  });
  expect(closeOrder).toEqual(['requested', 'animation']);
  await act(async () => {
    finishAnimation();
    await animation;
  });
});

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

describe('Dialog close confirmation', () => {
  beforeEach(() => {
    mockIsSheet = false;
  });

  it('keeps content mounted and skips cleanup when closing is declined', async () => {
    const ref = createRef<IDialogInstance>();
    const onClose = jest.fn().mockResolvedValue(undefined);
    const onCloseRequested = jest.fn();
    const onBeforeClose = jest.fn().mockResolvedValue(false);
    render(
      <DialogContainer
        ref={ref}
        showHeader={false}
        showFooter={false}
        onClose={onClose}
        onBeforeClose={onBeforeClose}
        onCloseRequested={onCloseRequested}
        renderContent={mockPeriodInput}
      />,
    );
    await act(async () => {
      await ref.current?.close();
    });
    expect(onBeforeClose).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(onCloseRequested).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toBeTruthy();

    onBeforeClose.mockResolvedValue(true);
    await act(async () => {
      await ref.current?.close();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCloseRequested).toHaveBeenCalledTimes(1);
    expect(onCloseRequested.mock.invocationCallOrder[0]).toBeLessThan(
      onClose.mock.invocationCallOrder[0],
    );
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('coalesces repeated close requests while confirmation is pending', async () => {
    const ref = createRef<IDialogInstance>();
    let confirm: (value: boolean) => void = () => undefined;
    const onBeforeClose = jest.fn(
      () =>
        new Promise<boolean>((resolve) => {
          confirm = resolve;
        }),
    );
    const onClose = jest.fn().mockResolvedValue(undefined);
    const onCloseRequested = jest.fn();
    render(
      <DialogContainer
        ref={ref}
        showHeader={false}
        showFooter={false}
        onClose={onClose}
        onBeforeClose={onBeforeClose}
        onCloseRequested={onCloseRequested}
        renderContent={mockPeriodInput}
      />,
    );
    await act(async () => {
      const first = ref.current?.close();
      const second = ref.current?.close();
      expect(first).toBe(second);
      expect(onBeforeClose).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();
      expect(onCloseRequested).not.toHaveBeenCalled();
      confirm(true);
      await first;
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCloseRequested).toHaveBeenCalledTimes(1);
    expect(onCloseRequested.mock.invocationCallOrder[0]).toBeLessThan(
      onClose.mock.invocationCallOrder[0],
    );
  });
});

function DraftForm({
  field,
  initial,
  onForm,
  onMount,
  onUnmount,
  onSubmit,
}: {
  field: string;
  initial: string;
  onForm: (form: ReturnType<typeof useForm<Record<string, string>>>) => void;
  onMount: () => void;
  onUnmount: () => void;
  onSubmit: () => void;
}) {
  // Match the consumers' real react-hook-form initialization contracts.
  const form = useForm<Record<string, string>>(
    field === 'passphrase'
      ? { defaultValues: { [field]: initial } }
      : { values: { [field]: initial } },
  );
  useEffect(() => {
    onForm(form);
    onMount();
    return onUnmount;
  }, [form, onForm, onMount, onUnmount]);
  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <input aria-label={field} {...form.register(field)} />
    </form>
  );
}

const draftCases = [
  { field: 'name', initial: 'Original QA Name', edited: 'Edited QA Name' },
  { field: 'count', initial: '3', edited: '7' },
  { field: 'passphrase', initial: '', edited: 'QA-NOT-A-WALLET-50653' },
];
const resizeCases = [
  [400, 500, 400],
  [800, 900, 800],
  [767, 768, 767],
  [768, 767, 768],
];

describe.each(['sheet', 'header'] as const)(
  'Dialog unsubmitted drafts (drag area: %s)',
  (sheetDragArea) => {
    it.each(
      draftCases.flatMap((draft) =>
        resizeCases.map((widths) => ({ ...draft, widths })),
      ),
    )(
      'preserves $field through $widths without remounting or refocusing',
      async ({ field, initial, edited, widths }) => {
        let currentForm:
          | ReturnType<typeof useForm<Record<string, string>>>
          | undefined;
        const onForm = jest.fn((form: typeof currentForm) => {
          currentForm = form;
        });
        const onMount = jest.fn();
        const onUnmount = jest.fn();
        const onSubmit = jest.fn();
        const onOpenAutoFocus = jest.fn();
        const props = {
          open: true,
          showHeader: false,
          showFooter: false,
          sheetDragArea,
          onClose: mockClose,
          onOpenAutoFocus,
          renderContent: (
            <DraftForm
              field={field}
              initial={initial}
              onForm={onForm}
              onMount={onMount}
              onUnmount={onUnmount}
              onSubmit={onSubmit}
            />
          ),
        };
        mockIsSheet = widths[0] <= 767;
        const view = render(<DialogContainer {...props} />);
        const input = screen.getByRole<HTMLInputElement>('textbox', {
          name: field,
        });
        await waitFor(() => expect(document.activeElement).toBe(input));
        fireEvent.change(input, { target: { value: edited } });
        const originalForm = currentForm;
        for (const width of widths.slice(1)) {
          mockIsSheet = width <= 767;
          view.rerender(<DialogContainer {...props} />);
          expect(currentForm?.getValues(field)).toBe(edited);
          expect(currentForm).toBe(originalForm);
          expect(screen.getByRole('textbox', { name: field })).toBe(input);
          expect(input.value).toBe(edited);
          expect(document.activeElement).toBe(input);
        }
        expect(onMount).toHaveBeenCalledTimes(1);
        expect(onUnmount).not.toHaveBeenCalled();
        expect(onOpenAutoFocus).toHaveBeenCalledTimes(1);
        expect(onSubmit).not.toHaveBeenCalled();
      },
    );

    it.each(draftCases)(
      'discards the unsubmitted $field only on close and reopens with its default',
      async ({ field, initial, edited }) => {
        let currentForm:
          | ReturnType<typeof useForm<Record<string, string>>>
          | undefined;
        const onForm = jest.fn((form: typeof currentForm) => {
          currentForm = form;
        });
        const onMount = jest.fn();
        const onUnmount = jest.fn();
        const onSubmit = jest.fn();
        const trigger = document.createElement('button');
        trigger.dataset.dialogDraftTrigger = 'true';
        document.body.append(trigger);
        trigger.focus();
        const props = {
          showHeader: false,
          showFooter: false,
          sheetDragArea,
          onClose: mockClose,
          renderContent: (
            <DraftForm
              field={field}
              initial={initial}
              onForm={onForm}
              onMount={onMount}
              onUnmount={onUnmount}
              onSubmit={onSubmit}
            />
          ),
        };
        mockIsSheet = true;
        const view = render(<DialogContainer {...props} open />);
        const input = screen.getByRole<HTMLInputElement>('textbox', {
          name: field,
        });
        await waitFor(() => expect(document.activeElement).toBe(input));
        fireEvent.change(input, { target: { value: edited } });
        const originalForm = currentForm;
        mockIsSheet = false;
        view.rerender(<DialogContainer {...props} open />);
        view.rerender(<DialogContainer {...props} open={false} />);
        await waitFor(() => expect(document.activeElement).toBe(trigger));
        expect(screen.queryByRole('textbox')).toBeNull();
        expect(onUnmount).toHaveBeenCalledTimes(1);
        view.rerender(<DialogContainer {...props} open />);
        const reopened = screen.getByRole<HTMLInputElement>('textbox', {
          name: field,
        });
        await waitFor(() => expect(document.activeElement).toBe(reopened));
        expect(currentForm).not.toBe(originalForm);
        expect(currentForm?.getValues(field)).toBe(initial);
        expect(reopened.value).toBe(initial);
        expect(onMount).toHaveBeenCalledTimes(2);
        expect(onSubmit).not.toHaveBeenCalled();
        view.unmount();
        trigger.remove();
      },
    );
  },
);

afterEach(() => {
  document
    .querySelectorAll('[data-dialog-draft-trigger]')
    .forEach((node) => node.remove());
});
