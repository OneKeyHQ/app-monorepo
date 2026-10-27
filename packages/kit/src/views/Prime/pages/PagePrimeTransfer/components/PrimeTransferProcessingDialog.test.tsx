/** @jest-environment jsdom */

import { cloneElement, isValidElement } from 'react';
import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react';
import { createIntl } from 'react-intl';

import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';
import type { IPrimeTransferAtomData } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';

import { PRIME_TRANSFER_PROGRESS_STEP_MS } from './hooks/usePrimeTransferStepProgress';
import { showPrimeTransferProcessingDialog } from './PrimeTransferProcessingDialog';

let mockState: Pick<
  IPrimeTransferAtomData,
  'preparationProgress' | 'networkProgress'
>;
const mockDialogs: IDialogShowProps[] = [];
const mockCancel = jest.fn(async (_args: unknown) => undefined);
const intl = createIntl({
  locale: 'en',
  onError: () => undefined,
});

jest.mock('react-intl', () => ({
  ...jest.requireActual<typeof import('react-intl')>('react-intl'),
  useIntl: () => intl,
}));
jest.mock('@onekeyhq/components', () => {
  const Container = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Stack: Container,
    YStack: Container,
    SizableText: Container,
    Icon: () => null,
    Spinner: () => <div role="status">Waiting</div>,
    Progress: ({ value }: { value: number }) => (
      <div role="progressbar" aria-valuenow={value} />
    ),
    Dialog: {
      Footer: () => null,
      show: (props: IDialogShowProps) => {
        mockDialogs.push(props);
        return {
          close: async () => {
            if ((await props.onBeforeClose?.()) !== false)
              await props.onClose?.();
          },
        };
      },
    },
  };
});
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrimeTransfer: {
      cancelTransfer: (args: unknown) => mockCancel(args),
    },
  },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/prime', () => ({
  primeTransferAtom: { get: async () => mockState },
  usePrimeTransferAtom: () => [mockState],
}));

beforeEach(() => {
  mockState = {
    preparationProgress: { taskId: 'fixture-task', percentage: 35 },
  };
  mockDialogs.length = 0;
  mockCancel.mockClear();
});

function renderProcessingDialog() {
  showPrimeTransferProcessingDialog(intl, 'fixture-task');
  const content = () => {
    const element = mockDialogs[0].renderContent;
    expect(isValidElement(element)).toBe(true);
    if (!isValidElement(element)) return null;
    return cloneElement(element);
  };
  const view = render(content());
  return {
    view,
    rerender: () => view.rerender(content()),
    progressValue: () =>
      view.getByRole('progressbar').getAttribute('aria-valuenow'),
  };
}

function step(times = 1) {
  for (let i = 0; i < times; i += 1) {
    act(() => {
      jest.advanceTimersByTime(PRIME_TRANSFER_PROGRESS_STEP_MS);
    });
  }
}

describe('stepped progress', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test('one dialog steps through preparation, then restarts for acknowledged bytes, and never invents a legacy percentage', () => {
    const { view, rerender, progressValue } = renderProcessingDialog();
    expect(view.getByText('global.preparing 0%')).toBeTruthy();
    step();
    expect(view.getByText('global.preparing 1%')).toBeTruthy();
    expect(progressValue()).toBe('1');
    step(34);
    expect(view.getByText('global.preparing 35%')).toBeTruthy();
    step(5);
    expect(view.getByText('global.preparing 35%')).toBeTruthy();
    expect(progressValue()).toBe('35');

    mockState.networkProgress = {
      transferId: 'fixture-task',
      direction: 'sending',
      transferredBytes: 150,
      totalBytes: 200,
    };
    rerender();
    expect(view.getByText('hardware.transferring_data 0%')).toBeTruthy();
    step(75);
    expect(view.getByText('hardware.transferring_data 75%')).toBeTruthy();
    expect(progressValue()).toBe('75');

    mockState.networkProgress.indeterminate = true;
    rerender();
    expect(view.queryByRole('progressbar')).toBeNull();
    expect(view.getByRole('status')).toBeTruthy();
    expect(view.getByText('hardware.transferring_data')).toBeTruthy();
    expect(mockDialogs).toHaveLength(1);
    expect(mockDialogs[0]).toMatchObject({
      disableDrag: true,
      dismissOnOverlayPress: false,
    });
  });

  test('preparation completion jumps to 100% without waiting for the remaining steps', () => {
    const { view, rerender, progressValue } = renderProcessingDialog();
    step(3);
    expect(progressValue()).toBe('3');
    mockState.preparationProgress = {
      taskId: 'fixture-task',
      percentage: 100,
    };
    rerender();
    expect(view.getByText('global.preparing 100%')).toBeTruthy();
    expect(progressValue()).toBe('100');
    expect(jest.getTimerCount()).toBe(0);
  });

  test('acknowledged bytes stay below 100% until the final transfer confirmation', () => {
    mockState.networkProgress = {
      transferId: 'fixture-task',
      direction: 'sending',
      transferredBytes: 200,
      totalBytes: 200,
    };
    const { view, rerender, progressValue } = renderProcessingDialog();
    step(120);
    expect(view.getByText('hardware.transferring_data 99%')).toBeTruthy();
    expect(progressValue()).toBe('99');
    mockState.networkProgress = {
      ...mockState.networkProgress,
      completed: true,
    };
    rerender();
    expect(view.getByText('hardware.transferring_data 100%')).toBeTruthy();
    expect(progressValue()).toBe('100');
  });
});

test('declining exit keeps the task; completion closes a pending confirmation without cancelling', async () => {
  const dialog = showPrimeTransferProcessingDialog(intl, 'fixture-task');
  const close = mockDialogs[0].onBeforeClose;
  const pending = close?.();
  await act(async () => {
    await Promise.resolve();
  });
  await mockDialogs[1].onClose?.();
  expect(await pending).toBe(false);
  expect(mockCancel).not.toHaveBeenCalled();
  const secondAttempt = close?.();
  await act(async () => {
    await Promise.resolve();
  });
  await dialog.close();
  expect(await secondAttempt).toBe(true);
  expect(mockCancel).not.toHaveBeenCalled();
});

test('confirming exit cancels only the owning task', async () => {
  showPrimeTransferProcessingDialog(intl, 'fixture-task');
  const pending = mockDialogs[0].onBeforeClose?.();
  await act(async () => {
    await Promise.resolve();
  });
  // The dialog framework supplies these arguments; this callback only resolves the choice.
  await mockDialogs[1].onConfirm?.({
    preventClose: () => undefined,
    close: async () => undefined,
    getForm: () => undefined,
    isExist: () => true,
  });
  expect(await pending).toBe(true);
  expect(mockCancel).toHaveBeenCalledWith({ taskId: 'fixture-task' });
});
