/** @jest-environment jsdom */

import { act, render } from '@testing-library/react';

import type { IPrimeTransferAtomData } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';

import { PrimeTransferExitPrevent } from './PrimeTransferExitPrevent';

type IExitOptions = { onConfirm: () => Promise<void> };
let mockProgress: IPrimeTransferAtomData['importProgress'];
let mockModalExit: IExitOptions;
let mockAppExit: IExitOptions;
const mockReset = jest.fn(async (_options: { taskUUID: string }) => undefined);
const mockClear = jest.fn(async () => undefined);
const mockLeave = jest.fn(async () => undefined);
const mockRefresh = jest.fn(async () => undefined);

jest.mock('expo-keep-awake', () => ({ useKeepAwake: () => undefined }));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/prime', () => ({
  usePrimeTransferAtom: () => [{ importProgress: mockProgress }],
}));
jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: { wait: async () => undefined },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrimeTransfer: {
      resetImportProgress: (options: { taskUUID: string }) =>
        mockReset(options),
      clearSensitiveData: () => mockClear(),
      handleLeaveRoom: () => mockLeave(),
      refreshQrcodeHook: () => mockRefresh(),
    },
  },
}));
jest.mock('./hooks/usePrimeTransferHooks', () => ({
  useModalExitPrevent: (options: IExitOptions) => {
    mockModalExit = options;
  },
  useAppExitPrevent: (options: IExitOptions) => {
    mockAppExit = options;
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockProgress = {
    taskUUID: 'old-task',
    isImporting: true,
    current: 1,
    total: 2,
  };
});

test.each(['modal', 'app'] as const)(
  'pending %s exit keeps its original import owner after replacement',
  async (surface) => {
    const view = render(<PrimeTransferExitPrevent />);
    const oldExit =
      surface === 'modal' ? mockModalExit.onConfirm : mockAppExit.onConfirm;
    mockProgress = {
      ...mockProgress,
      taskUUID: 'replacement',
      isImporting: true,
      current: 0,
      total: 2,
    };
    view.rerender(<PrimeTransferExitPrevent />);
    const newExit =
      surface === 'modal' ? mockModalExit.onConfirm : mockAppExit.onConfirm;
    await act(async () => oldExit());
    expect(mockReset).toHaveBeenLastCalledWith({ taskUUID: 'old-task' });
    await act(async () => newExit());
    expect(mockReset).toHaveBeenLastCalledWith({ taskUUID: 'replacement' });
    expect(mockClear).toHaveBeenCalledTimes(2);
    expect(mockLeave).toHaveBeenCalledTimes(2);
    expect(mockRefresh).toHaveBeenCalledTimes(2);
  },
);

test('an exit opened without an active import cannot cancel a later import', async () => {
  mockProgress = undefined;
  const view = render(<PrimeTransferExitPrevent />);
  const oldExit = mockModalExit.onConfirm;
  mockProgress = {
    taskUUID: 'replacement',
    isImporting: true,
    current: 0,
    total: 2,
  };
  view.rerender(<PrimeTransferExitPrevent />);
  await act(async () => oldExit());
  expect(mockReset).not.toHaveBeenCalled();
});
