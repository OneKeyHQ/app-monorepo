import {
  FirmwareUpdateExitPrevent,
  cancelFirmwareUpdateAttempt,
  cancelFirmwareUpdateWorkflow,
} from './FirmwareUpdateExitPrevent';

jest.mock('react', () => ({
  ...jest.requireActual<typeof import('react')>('react'),
  useCallback: (callback: unknown) => callback,
}));

jest.mock('expo-keep-awake', () => ({
  useKeepAwake: jest.fn(),
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('../../../background/instance/backgroundApiProxy', () => {
  const exitUpdateWorkflow = jest.fn();
  const cancel = jest.fn();
  return {
    __esModule: true,
    exitUpdateWorkflow,
    cancel,
    default: {
      serviceFirmwareUpdate: {
        exitUpdateWorkflow,
      },
      serviceHardware: {
        cancel,
      },
    },
  };
});

jest.mock('../hooks/useFirmwareUpdateHooks', () => ({
  useAppExitPrevent: jest.fn(),
  useExtensionUpdatingFromExpandTab: jest.fn(),
  useModalExitPrevent: jest.fn(),
}));

const {
  exitUpdateWorkflow: mockExitUpdateWorkflow,
  cancel: mockCancel,
} = jest.requireMock('../../../background/instance/backgroundApiProxy');
const { useModalExitPrevent: mockUseModalExitPrevent } = jest.requireMock(
  '../hooks/useFirmwareUpdateHooks',
);

describe('cancelFirmwareUpdateWorkflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExitUpdateWorkflow.mockResolvedValue(undefined);
    mockCancel.mockResolvedValue(undefined);
  });

  it('immediately clears the app workflow and cancels the hardware task', async () => {
    await cancelFirmwareUpdateWorkflow();

    expect(mockExitUpdateWorkflow).toHaveBeenCalledTimes(1);
    expect(mockCancel).toHaveBeenCalledWith({ immediate: true });
  });

  it('still clears the app workflow when hardware cancellation fails', async () => {
    mockCancel.mockRejectedValueOnce(new Error('cancel failed'));

    await expect(cancelFirmwareUpdateWorkflow()).resolves.toBeUndefined();

    expect(mockExitUpdateWorkflow).toHaveBeenCalledTimes(1);
  });
});

describe('cancelFirmwareUpdateAttempt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCancel.mockResolvedValue(undefined);
  });

  it('cancels the hardware task without clearing the app workflow', async () => {
    await cancelFirmwareUpdateAttempt();

    expect(mockCancel).toHaveBeenCalledWith({ immediate: true });
    expect(mockExitUpdateWorkflow).not.toHaveBeenCalled();
  });

  it('preserves the workflow while cancelling the active attempt', async () => {
    const onCancelAttempt = jest.fn();
    FirmwareUpdateExitPrevent({
      preserveWorkflowOnCancel: true,
      onCancelAttempt,
    });

    expect(mockUseModalExitPrevent).toHaveBeenCalledWith(
      expect.objectContaining({
        shouldRemoveOnConfirm: false,
      }),
    );

    const [{ onConfirm }] = mockUseModalExitPrevent.mock.calls[0];
    onConfirm();
    await Promise.resolve();

    expect(mockCancel).toHaveBeenCalledWith({ immediate: true });
    expect(mockExitUpdateWorkflow).not.toHaveBeenCalled();
    expect(onCancelAttempt).toHaveBeenCalledTimes(1);
  });
});
