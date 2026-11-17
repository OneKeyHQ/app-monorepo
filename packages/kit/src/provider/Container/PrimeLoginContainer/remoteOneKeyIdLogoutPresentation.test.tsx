/* eslint-disable import/first */

const mockDialogClose = jest.fn();
const mockDialogShow = jest.fn((_props?: { onOpen?: () => void }) => ({
  close: mockDialogClose,
  getForm: jest.fn(),
  isExist: jest.fn(() => true),
}));
const mockTryClaimPresentation = jest.fn();
const mockCompletePresentation = jest.fn();
const mockAutoPrintErrorIgnore = jest.fn();
const mockOneKeyIdRemoteLogoutFlowLog = jest.fn();

jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    show: (props: { onOpen?: () => void }) => mockDialogShow(props),
  },
}));

jest.mock('@onekeyhq/shared/src/errors/utils/errorUtils', () => ({
  __esModule: true,
  default: {
    autoPrintErrorIgnore: (error: unknown): void => {
      mockAutoPrintErrorIgnore(error);
    },
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: {
      subscription: {
        onekeyIdRemoteLogoutFlow: (...args: unknown[]) => {
          mockOneKeyIdRemoteLogoutFlowLog(...args);
        },
      },
    },
  },
}));

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceIdentityExit: {
      tryClaimRemoteOneKeyIdLogoutPresentation: async (
        params: unknown,
      ): Promise<unknown> => await mockTryClaimPresentation(params),
      completeRemoteOneKeyIdLogoutPresentation: async (
        params: unknown,
      ): Promise<unknown> => await mockCompletePresentation(params),
    },
  },
}));

jest.mock(
  '../../../views/Prime/components/PrimeDeviceLogoutAlertDialog',
  () => ({
    PrimeDeviceLogoutAlertDialog: () => null,
  }),
);

import {
  presentRemoteOneKeyIdLogout,
  resetRemoteOneKeyIdLogoutPresentationForTest,
} from './remoteOneKeyIdLogoutPresentation';

const presentation = {
  operationId: 'remoteDeviceLogout:message-1',
  messageId: 'message-1',
};

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('remote OneKey ID logout presentation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDialogShow.mockImplementation(() => ({
      close: mockDialogClose,
      getForm: jest.fn(),
      isExist: jest.fn(() => true),
    }));
    mockCompletePresentation.mockResolvedValue({ updated: true });
  });

  afterEach(() => {
    resetRemoteOneKeyIdLogoutPresentationForTest();
    jest.useRealTimers();
  });

  test('commits presentation only after the claimed dialog opens', async () => {
    mockTryClaimPresentation.mockResolvedValue({
      status: 'claimed',
      claimId: 'claim-1',
      expiresAt: 30_000,
    });

    await presentRemoteOneKeyIdLogout(presentation);

    expect(mockDialogShow).toHaveBeenCalledTimes(1);
    expect(mockCompletePresentation).not.toHaveBeenCalled();
    const dialogProps = mockDialogShow.mock.calls[0]?.[0];
    expect(dialogProps).toBeDefined();
    dialogProps?.onOpen?.();
    await flushPromises();
    expect(mockCompletePresentation).toHaveBeenCalledWith({
      ...presentation,
      claimId: 'claim-1',
    });
    expect(mockDialogClose).not.toHaveBeenCalled();
    expect(mockOneKeyIdRemoteLogoutFlowLog).toHaveBeenCalledWith({
      stage: 'targetPresentation',
      status: 'started',
      flowId: presentation.messageId,
      operationId: presentation.operationId,
    });
    expect(mockOneKeyIdRemoteLogoutFlowLog).toHaveBeenCalledWith({
      stage: 'targetPresentation',
      status: 'succeeded',
      flowId: presentation.messageId,
      operationId: presentation.operationId,
      reason: 'Remote logout dialog opened and presentation was committed',
    });
  });

  test('retries after the active foreground lease expires', async () => {
    jest.useFakeTimers();
    mockTryClaimPresentation
      .mockResolvedValueOnce({
        status: 'claimedByOther',
        retryAfterMs: 1000,
      })
      .mockResolvedValueOnce({
        status: 'claimed',
        claimId: 'claim-2',
        expiresAt: 31_000,
      });

    await presentRemoteOneKeyIdLogout(presentation);

    expect(mockDialogShow).not.toHaveBeenCalled();
    expect(mockOneKeyIdRemoteLogoutFlowLog).toHaveBeenCalledWith({
      stage: 'targetPresentation',
      status: 'deduplicated',
      flowId: presentation.messageId,
      operationId: presentation.operationId,
      reason: 'Presentation is owned by another UI surface',
    });
    await jest.advanceTimersByTimeAsync(1050);
    expect(mockTryClaimPresentation).toHaveBeenCalledTimes(2);
    expect(mockDialogShow).toHaveBeenCalledTimes(1);
  });

  test('retries after the lease expires when the dialog cannot be created', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    const renderError = new Error('Dialog portal unavailable');
    mockTryClaimPresentation
      .mockResolvedValueOnce({
        status: 'claimed',
        claimId: 'claim-3',
        expiresAt: 1000,
      })
      .mockResolvedValueOnce({ status: 'handled' });
    mockDialogShow.mockImplementationOnce(() => {
      throw renderError;
    });

    await expect(presentRemoteOneKeyIdLogout(presentation)).rejects.toBe(
      renderError,
    );
    expect(mockOneKeyIdRemoteLogoutFlowLog).toHaveBeenCalledWith({
      stage: 'targetPresentation',
      status: 'failed',
      flowId: presentation.messageId,
      operationId: presentation.operationId,
      reason: renderError.message,
    });
    await jest.advanceTimersByTimeAsync(1050);
    expect(mockTryClaimPresentation).toHaveBeenCalledTimes(2);
  });

  test('closes and retries when BG cannot commit its claim', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    const commitError = new Error('Presentation journal write failed');
    mockTryClaimPresentation
      .mockResolvedValueOnce({
        status: 'claimed',
        claimId: 'claim-4',
        expiresAt: 1000,
      })
      .mockResolvedValueOnce({ status: 'handled' });
    mockCompletePresentation.mockRejectedValue(commitError);

    await presentRemoteOneKeyIdLogout(presentation);
    const dialogProps = mockDialogShow.mock.calls[0]?.[0];
    expect(dialogProps).toBeDefined();
    dialogProps?.onOpen?.();
    await flushPromises();

    expect(mockDialogClose).toHaveBeenCalledTimes(1);
    expect(mockAutoPrintErrorIgnore).toHaveBeenCalledWith(commitError);
    expect(mockOneKeyIdRemoteLogoutFlowLog).toHaveBeenCalledWith({
      stage: 'targetPresentation',
      status: 'failed',
      flowId: presentation.messageId,
      operationId: presentation.operationId,
      reason: commitError.message,
    });
    await jest.advanceTimersByTimeAsync(1050);
    expect(mockTryClaimPresentation).toHaveBeenCalledTimes(2);
  });
});
