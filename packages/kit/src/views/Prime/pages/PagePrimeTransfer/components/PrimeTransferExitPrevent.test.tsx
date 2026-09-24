/** @jest-environment jsdom */

import { act, render } from '@testing-library/react';

import type { IPrimeTransferAtomData } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';

import { PrimeTransferExitPrevent } from './PrimeTransferExitPrevent';

type IExitOptions = {
  onConfirm: () => Promise<boolean>;
  isExitCurrent: () => Promise<boolean>;
};
let mockGeneration = 1;
let mockProgress: IPrimeTransferAtomData['importProgress'];
let mockModalExit: IExitOptions;
let mockAppExit: IExitOptions;
const mockExit = jest.fn(
  async ({ generation }: { generation: number }) =>
    generation === mockGeneration,
);
const mockIsCurrent = jest.fn(
  async (generation: number) => generation === mockGeneration,
);

jest.mock('expo-keep-awake', () => ({ useKeepAwake: () => undefined }));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/prime', () => ({
  usePrimeTransferAtom: () => [
    { importProgress: mockProgress, exitGeneration: mockGeneration },
  ],
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrimeTransfer: {
      exitTransfer: (options: { generation: number }) => mockExit(options),
      isTransferExitCurrent: (generation: number) => mockIsCurrent(generation),
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
  mockGeneration = 1;
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
    mockGeneration = 2;
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
    await act(async () => expect(await oldExit()).toBe(false));
    expect(mockExit).toHaveBeenLastCalledWith({ generation: 1 });
    await act(async () => expect(await newExit()).toBe(true));
    expect(mockExit).toHaveBeenLastCalledWith({ generation: 2 });
  },
);

test('an exit opened without an active import cannot cancel a later import', async () => {
  mockProgress = undefined;
  const view = render(<PrimeTransferExitPrevent />);
  const oldExit = mockModalExit.onConfirm;
  mockGeneration = 2;
  mockProgress = {
    taskUUID: 'replacement',
    isImporting: true,
    current: 0,
    total: 2,
  };
  view.rerender(<PrimeTransferExitPrevent />);
  await act(async () => expect(await oldExit()).toBe(false));
  expect(mockExit).toHaveBeenCalledWith({ generation: 1 });
});
