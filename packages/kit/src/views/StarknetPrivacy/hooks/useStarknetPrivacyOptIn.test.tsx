/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EStrk20ErrorCode,
  EStrk20SequencingStatus,
} from '@onekeyhq/shared/types/starknetPrivacy';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { useStarknetPrivacyOptIn } from './useStarknetPrivacyOptIn';

type IAccountKey = { networkId: string; accountId: string };
type IBuildResult =
  | { alreadyRegistered: true }
  | { alreadyRegistered: false; unsignedTx: { encodedTx: object } };

const mockRecordConsent = jest.fn(
  async (_params: IAccountKey & { consentAcceptedAt: number }) => undefined,
);
const mockPrepareActivation = jest.fn<
  Promise<{ encodedTx: object } | undefined>,
  [IAccountKey]
>();
const mockBuild = jest.fn<Promise<IBuildResult>, [IAccountKey]>();
const mockNavigate = jest.fn();
const mockWaitForDeployment = jest.fn<Promise<boolean>, [unknown]>();
const mockToast = jest.fn<void, [{ title: string }]>();

jest.mock('@onekeyhq/components', () => ({
  Toast: { error: (options: { title: string }) => mockToast(options) },
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: {
      error: {
        log: jest.fn(),
      },
    },
  },
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStarknetPrivacy: {
      recordConsent: (params: IAccountKey & { consentAcceptedAt: number }) =>
        mockRecordConsent(params),
      getSequencingState: async () => ({
        status: EStrk20SequencingStatus.Ready,
      }),
      prepareAccountActivation: (params: IAccountKey) =>
        mockPrepareActivation(params),
      buildRegisterTx: (params: IAccountKey) => mockBuild(params),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/transactionConfirmationUtils', () => ({
  ...jest.requireActual<
    typeof import('@onekeyhq/kit/src/hooks/transactionConfirmationUtils')
  >('@onekeyhq/kit/src/hooks/transactionConfirmationUtils'),
  waitForSendPrerequisite: (params: unknown) => mockWaitForDeployment(params),
  waitForTransactionReady: ({ check }: { check: () => Promise<boolean> }) =>
    check(),
}));
jest.mock('@onekeyhq/kit/src/hooks/useSignatureConfirm', () => ({
  __esModule: true,
  useSignatureConfirm: () => ({ navigationToTxConfirm: mockNavigate }),
}));
jest.mock('@onekeyhq/shared/src/errors/utils/errorUtils', () => ({
  __esModule: true,
  default: {
    isErrorByClassName: ({
      error,
      className,
    }: {
      error: { name?: string };
      className: string[];
    }) => className.includes(error.name ?? ''),
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const account = { networkId: 'starknet--mainnet', accountId: 'test-account' };
const unsignedTx = { encodedTx: {} };

beforeEach(() => {
  jest.clearAllMocks();
  mockPrepareActivation.mockResolvedValue(undefined);
  mockRecordConsent.mockResolvedValue(undefined);
  mockBuild.mockResolvedValue({ alreadyRegistered: false, unsignedTx });
});

it('shows loading while registering and prevents duplicate attempts', async () => {
  const build = deferred<IBuildResult>();
  mockBuild.mockImplementationOnce(() => build.promise);
  const ui = renderHook(() => useStarknetPrivacyOptIn(account));
  let first: Promise<void>;
  let second: Promise<void>;
  act(() => {
    first = ui.result.current.optIn();
    second = ui.result.current.optIn();
  });
  expect(ui.result.current.isOptingIn).toBe(true);
  await waitFor(() => expect(mockBuild).toHaveBeenCalledTimes(1));
  await act(async () => {
    build.resolve({ alreadyRegistered: false, unsignedTx });
    await first;
    await second;
  });
  expect(mockRecordConsent).toHaveBeenCalledTimes(1);
  expect(mockBuild).toHaveBeenCalledTimes(1);
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  expect(ui.result.current.isOptingIn).toBe(false);
});

it('moves from recording consent to proving, then to transaction review', async () => {
  const consent = deferred<undefined>();
  const build = deferred<IBuildResult>();
  mockRecordConsent.mockImplementationOnce(() => consent.promise);
  mockBuild.mockImplementationOnce(() => build.promise);
  const ui = renderHook(() => useStarknetPrivacyOptIn(account));
  let attempt: Promise<void>;
  act(() => {
    attempt = ui.result.current.optIn();
  });
  await waitFor(() => expect(mockRecordConsent).toHaveBeenCalledTimes(1));
  expect(mockBuild).not.toHaveBeenCalled();
  await act(async () => {
    consent.resolve(undefined);
  });
  await waitFor(() => expect(mockBuild).toHaveBeenCalledTimes(1));
  expect(mockNavigate).not.toHaveBeenCalled();
  await act(async () => {
    build.resolve({ alreadyRegistered: false, unsignedTx });
    await attempt;
  });
  expect(mockNavigate).toHaveBeenCalledTimes(1);
});

it('catches failures while recording consent instead of leaving a silent rejected promise', async () => {
  mockRecordConsent.mockRejectedValueOnce(
    new OneKeyLocalError('Storage unavailable'),
  );
  const ui = renderHook(() => useStarknetPrivacyOptIn(account));
  await act(async () => ui.result.current.optIn());
  expect(mockToast).toHaveBeenCalledWith({
    title: ETranslations.global_an_error_occurred,
  });
  expect(ui.result.current.optInErrorKey).toBe(
    ETranslations.global_an_error_occurred,
  );
  expect(ui.result.current.isOptingIn).toBe(false);
  expect(mockBuild).not.toHaveBeenCalled();
});

it('opens the transaction review after building without broadcasting it', async () => {
  const ui = renderHook(() => useStarknetPrivacyOptIn(account));
  await act(async () => ui.result.current.optIn());
  expect(mockRecordConsent).toHaveBeenCalledWith(
    expect.objectContaining(account),
  );
  expect(mockBuild).toHaveBeenCalledWith({ ...account, resumeOnly: false });
  expect(mockNavigate).toHaveBeenCalledWith(
    expect.objectContaining({
      unsignedTxs: [unsignedTx],
    }),
  );
});

it('refreshes an existing registration without asking for another signature', async () => {
  mockBuild.mockResolvedValueOnce({ alreadyRegistered: true });
  const onRegisterSubmitted = jest.fn();
  const ui = renderHook(() =>
    useStarknetPrivacyOptIn({ ...account, onRegisterSubmitted }),
  );
  await act(async () => ui.result.current.optIn());
  expect(onRegisterSubmitted).toHaveBeenCalledTimes(1);
  expect(mockNavigate).not.toHaveBeenCalled();
});

it('keeps submission errors visible after the transaction review closes', async () => {
  const onRegisterSubmitted = jest.fn();
  const ui = renderHook(() =>
    useStarknetPrivacyOptIn({ ...account, onRegisterSubmitted }),
  );
  await act(async () => ui.result.current.optIn());
  const route = mockNavigate.mock.calls[0][0] as {
    onConfirmationFail: (error: Error) => void;
  };
  act(() =>
    route.onConfirmationFail(new OneKeyLocalError('Submission unavailable')),
  );
  expect(ui.result.current.optInErrorKey).toBe(
    ETranslations.global_an_error_occurred,
  );
  expect(onRegisterSubmitted).toHaveBeenCalledTimes(1);
});

it('ignores a late proof error after leaving the privacy panel', async () => {
  const build = deferred<IBuildResult>();
  mockBuild.mockImplementationOnce(() => build.promise);
  const ui = renderHook(() => useStarknetPrivacyOptIn(account));
  let attempt: Promise<void>;
  act(() => {
    attempt = ui.result.current.optIn();
  });
  await waitFor(() => expect(mockBuild).toHaveBeenCalledTimes(1));
  ui.unmount();
  await act(async () => {
    build.reject(new OneKeyLocalError('sensitive-proof-payload'));
    await attempt;
  });
  expect(mockToast).not.toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();
});

it('leaves a cancelled password prompt silent and clears loading', async () => {
  const error = new OneKeyLocalError('Cancelled');
  error.name = EOneKeyErrorClassNames.PasswordPromptDialogCancel;
  mockBuild.mockRejectedValueOnce(error);
  const ui = renderHook(() => useStarknetPrivacyOptIn(account));
  await act(async () => ui.result.current.optIn());
  expect(mockToast).not.toHaveBeenCalled();
  expect(ui.result.current.optInErrorKey).toBeUndefined();
  expect(ui.result.current.isOptingIn).toBe(false);
});

it('surfaces the service unavailable reason instead of a generic unknown error', async () => {
  mockBuild.mockRejectedValueOnce(
    new OneKeyLocalError({
      key: ETranslations.global_not_available,
      data: { starknetPrivacyErrorCode: EStrk20ErrorCode.Unavailable },
    }),
  );
  const ui = renderHook(() => useStarknetPrivacyOptIn(account));
  await act(async () => ui.result.current.optIn());
  expect(mockToast).toHaveBeenCalledWith({
    title: ETranslations.global_not_available,
  });
});

it('restores an existing registration without opening transaction confirmation', async () => {
  mockBuild.mockResolvedValueOnce({ alreadyRegistered: true });
  const ui = renderHook(() =>
    useStarknetPrivacyOptIn({ ...account, isResuming: true }),
  );
  await act(async () => ui.result.current.optIn());
  expect(mockBuild).toHaveBeenCalledWith(
    expect.objectContaining({ resumeOnly: true }),
  );
  expect(mockNavigate).not.toHaveBeenCalled();
});

it('builds registration only after deployment and opens its own confirmation', async () => {
  const activation = { encodedTx: { type: 'DEPLOY_ACCOUNT' } };
  const deployment = deferred<boolean>();
  mockPrepareActivation.mockResolvedValueOnce(activation);
  mockWaitForDeployment.mockReturnValueOnce(deployment.promise);
  mockNavigate.mockResolvedValue(undefined);
  const ui = renderHook(() => useStarknetPrivacyOptIn(account));
  let attempt: Promise<void>;
  act(() => {
    attempt = ui.result.current.optIn();
  });
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
  const first = mockNavigate.mock.calls[0][0] as {
    onSuccess: (result: ISendTxOnSuccessData[]) => void;
  };
  expect(first).toMatchObject({
    unsignedTxs: [activation],
    transactionStep: { step: 1, total: 2 },
  });
  first.onSuccess([{ signedTx: { txid: '0x01' } }] as ISendTxOnSuccessData[]);
  await waitFor(() =>
    expect(mockWaitForDeployment).toHaveBeenCalledWith(
      expect.objectContaining({ txid: '0x01' }),
    ),
  );
  expect(mockBuild).not.toHaveBeenCalled();
  await act(async () => {
    deployment.resolve(true);
    await attempt;
  });
  expect(mockNavigate).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      unsignedTxs: [unsignedTx],
      transactionStep: { step: 2, total: 2 },
    }),
  );
});

it.each(['account change', 'unmount'])(
  'discards an in-flight opt-in after %s',
  async (reason) => {
    const consent = deferred<undefined>();
    mockRecordConsent.mockReturnValueOnce(consent.promise);
    const ui = renderHook((params) => useStarknetPrivacyOptIn(params), {
      initialProps: account,
    });
    let attempt: Promise<void>;
    act(() => {
      attempt = ui.result.current.optIn();
    });
    if (reason === 'unmount') ui.unmount();
    else {
      ui.rerender({ ...account, accountId: 'second-account' });
    }
    await act(async () => {
      consent.resolve(undefined);
      await attempt;
    });
    expect(mockBuild).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  },
);
