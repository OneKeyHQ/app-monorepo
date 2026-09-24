/** @jest-environment jsdom */

import { cloneElement, isValidElement } from 'react';
import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react';
import { createIntl } from 'react-intl';

import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';
import type { IPrimeTransferAtomData } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';

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

test('one dialog switches from preparation to acknowledged bytes, and never invents a legacy percentage', () => {
  showPrimeTransferProcessingDialog(intl, 'fixture-task');
  const content = () => {
    const element = mockDialogs[0].renderContent;
    expect(isValidElement(element)).toBe(true);
    if (!isValidElement(element)) return null;
    return cloneElement(element);
  };
  const view = render(content());
  expect(view.getByText('global.preparing 35%')).toBeTruthy();
  expect(view.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
    '35',
  );
  mockState.networkProgress = {
    transferId: 'fixture-task',
    direction: 'sending',
    transferredBytes: 150,
    totalBytes: 200,
  };
  view.rerender(content());
  expect(view.getByText('hardware.transferring_data 75%')).toBeTruthy();
  expect(view.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
    '75',
  );
  mockState.networkProgress.indeterminate = true;
  view.rerender(content());
  expect(view.queryByRole('progressbar')).toBeNull();
  expect(view.getByRole('status')).toBeTruthy();
  expect(view.getByText('hardware.transferring_data')).toBeTruthy();
  expect(mockDialogs).toHaveLength(1);
  expect(mockDialogs[0]).toMatchObject({
    disableDrag: true,
    dismissOnOverlayPress: false,
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
