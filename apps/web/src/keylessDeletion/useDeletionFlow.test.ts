/** @jest-environment jsdom */
import { randomUUID } from 'node:crypto';

import { act, renderHook, waitFor } from '@testing-library/react';

import {
  CONFIRMATION_VERSION,
  DELETION_SCOPE,
  DeletionError,
  RETAINED_SCOPE,
  WARNING_CODES,
  createDeletionClient,
} from './protocol';
import { useDeletionFlow } from './useDeletionFlow';

import type { ICompleted, IDeletionClient } from './protocol';
import type { IBusinessAuth, IResultHistory } from './useDeletionFlow';

jest.mock('./protocol', () => ({
  ...jest.requireActual<typeof import('./protocol')>('./protocol'),
  createDeletionClient: jest.fn(),
}));

const token = 'fixture-invitation';
const serverTime = '2030-01-01T00:00:00Z';
const expiresAt = '2030-01-01T00:05:00Z';
const receipt = {
  resultId: 'fixture-operation',
  supportReference: 'CASE-FIXTURE',
};

function createClientFixture(
  status: 'ready' | 'used' = 'ready',
): jest.Mocked<IDeletionClient> {
  return {
    getLinkInfo: jest.fn().mockResolvedValue({
      status,
      allowedProvider: 'google',
      expiresAt,
      serverTime,
      confirmationVersion: CONFIRMATION_VERSION,
      deletionScope: [DELETION_SCOPE],
      retainedScope: RETAINED_SCOPE,
      warningCodes: WARNING_CODES,
      recreationPolicy: 'allowed_new_wallet',
    }),
    sendDeletionOtp: jest.fn().mockResolvedValue({
      challengeId: 'fixture-challenge',
      maskedEmail: 'd***@example.invalid',
      expiresAt,
      serverTime,
      resendAfterSeconds: 0,
    }),
    deleteShare: jest.fn(),
    getResult: jest.fn(),
  };
}

const uuidDescriptor = Object.getOwnPropertyDescriptor(
  globalThis.crypto,
  'randomUUID',
);
beforeAll(() => {
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    value: randomUUID,
    configurable: true,
  });
});
afterAll(() => {
  if (uuidDescriptor) {
    Object.defineProperty(globalThis.crypto, 'randomUUID', uuidDescriptor);
  } else {
    Reflect.deleteProperty(globalThis.crypto, 'randomUUID');
  }
});

it.each([false, true])(
  'rejects a different recovery account and preserves the original operation (already accepted: %s)',
  async (accepted) => {
    const client = createClientFixture();
    const error = (code: 'AUTH_EXPIRED' | 'IDENTITY_MISMATCH') =>
      new DeletionError({ code });
    const completed: ICompleted = {
      ...receipt,
      status: 'completed',
      completedAt: serverTime,
      deletedScope: [DELETION_SCOPE],
      retainedScope: [...RETAINED_SCOPE],
    };
    client.deleteShare.mockRejectedValueOnce(
      accepted
        ? new DeletionError({
            code: 'OPERATION_IN_PROGRESS',
            supportReference: receipt.supportReference,
          })
        : error('AUTH_EXPIRED'),
    );
    client.deleteShare.mockResolvedValueOnce(completed);
    if (accepted) client.getResult.mockRejectedValueOnce(error('AUTH_EXPIRED'));
    client.getResult
      .mockRejectedValueOnce(error('IDENTITY_MISMATCH'))
      .mockResolvedValueOnce(accepted ? completed : { status: 'not_submitted' })
      .mockResolvedValueOnce({ ...completed, currentShareStatus: 'absent' });
    jest.mocked(createDeletionClient).mockReturnValue(client);

    const authenticate = jest
      .fn<
        ReturnType<IBusinessAuth['authenticate']>,
        Parameters<IBusinessAuth['authenticate']>
      >()
      .mockResolvedValueOnce('fixture-expired-proof')
      .mockResolvedValueOnce('fixture-wrong-account-proof')
      .mockResolvedValueOnce('fixture-correct-account-proof');
    const business: IBusinessAuth = {
      origin: 'https://prime.example.invalid',
      authenticate,
      transport: jest.fn(),
    };
    const history: IResultHistory = new Map();
    const { result } = renderHook(() =>
      useDeletionFlow(token, business, history),
    );

    await waitFor(() => expect(result.current.screen.step).toBe('identity'));
    act(() => result.current.signIn('google'));
    await waitFor(() => expect(result.current.screen.step).toBe('confirm'));
    act(() => result.current.submit('01234567', [...WARNING_CODES]));
    await waitFor(() =>
      expect(result.current.error?.code).toBe('AUTH_EXPIRED'),
    );
    const original = history.get(token);
    expect(original?.proof).toBeUndefined();
    expect(original?.attempt?.key).toBeTruthy();
    expect(original?.accepted?.supportReference).toBe(
      accepted ? receipt.supportReference : undefined,
    );

    act(() => result.current.reauthenticate());
    await waitFor(() =>
      expect(result.current.error?.code).toBe('IDENTITY_MISMATCH'),
    );
    expect(history.get(token)?.proof).toBeUndefined();
    expect(history.get(token)?.attempt).toBe(original?.attempt);
    expect(history.get(token)?.accepted).toBe(original?.accepted);
    expect(history.get(token)?.canRetry).toBe(false);
    act(() => result.current.checkStatus());
    expect(client.getResult).toHaveBeenCalledTimes(accepted ? 2 : 1);
    expect(client.deleteShare).toHaveBeenCalledTimes(1);

    act(() => result.current.reauthenticate());
    await waitFor(() =>
      expect(history.get(token)?.proof?.supabaseAccessToken).toBe(
        'fixture-correct-account-proof',
      ),
    );
    expect(authenticate.mock.calls.map(([provider]) => provider)).toEqual([
      'google',
      'google',
      'google',
    ]);
    expect(client.getResult).toHaveBeenLastCalledWith({
      invitationToken: token,
      provider: 'google',
      supabaseAccessToken: 'fixture-correct-account-proof',
    });
    if (!accepted) {
      expect(history.get(token)?.canRetry).toBe(true);
      act(() => result.current.retrySubmit());
      await waitFor(() =>
        expect(history.get(token)?.result).toMatchObject({
          currentShareStatus: 'absent',
        }),
      );
      expect(client.deleteShare.mock.calls[1]?.[1]).toBe(
        original?.attempt?.key,
      );
      expect(client.deleteShare.mock.calls[1]?.[0]).toMatchObject({
        ...original?.attempt?.body,
        supabaseAccessToken: 'fixture-correct-account-proof',
      });
    } else {
      expect(history.get(token)?.result).toEqual(completed);
      expect(client.deleteShare).toHaveBeenCalledTimes(1);
    }
  },
);

it('preserves the original request and blocks result sign-in until the server cooldown ends', async () => {
  const client = createClientFixture();
  const authenticate = jest.fn().mockResolvedValue('fixture-proof');
  const business: IBusinessAuth = {
    origin: 'https://prime.example.invalid',
    authenticate,
    transport: jest.fn(),
  };
  const history: IResultHistory = new Map();
  client.deleteShare.mockRejectedValueOnce(
    new DeletionError({
      code: 'OPERATION_IN_PROGRESS',
      supportReference: receipt.supportReference,
    }),
  );
  client.getResult
    .mockRejectedValueOnce(new DeletionError({ code: 'AUTH_EXPIRED' }))
    .mockRejectedValueOnce(
      new DeletionError({ code: 'RATE_LIMITED', retryAfterSeconds: 60 }),
    )
    .mockResolvedValueOnce({
      ...receipt,
      status: 'processing',
      retryAfterSeconds: 0,
    });
  jest.mocked(createDeletionClient).mockReturnValue(client);
  const { result } = renderHook(() =>
    useDeletionFlow(token, business, history),
  );
  await waitFor(() => expect(result.current.screen.step).toBe('identity'));
  act(() => result.current.signIn('google'));
  await waitFor(() => expect(result.current.screen.step).toBe('confirm'));
  act(() => result.current.submit('01234567', [...WARNING_CODES]));
  await waitFor(() => expect(result.current.error?.code).toBe('AUTH_EXPIRED'));
  const original = history.get(token);
  act(() => result.current.reauthenticate());
  await waitFor(() => expect(result.current.error?.code).toBe('RATE_LIMITED'));

  await act(async () => result.current.reauthenticate());
  expect(authenticate).toHaveBeenCalledTimes(2);
  expect(client.getResult).toHaveBeenCalledTimes(2);
  expect(history.get(token)).toMatchObject({
    attempt: original?.attempt,
    accepted: original?.accepted,
  });
  expect(history.get(token)?.proof).toBeUndefined();
  const deadline = history.get(token)?.checkAfter;
  expect(deadline).toBeGreaterThan(globalThis.performance.now());
  const now = jest
    .spyOn(globalThis.performance, 'now')
    .mockReturnValue(result.current.resultCheckAfter);
  try {
    await act(async () => result.current.reauthenticate());
    expect(authenticate).toHaveBeenCalledTimes(3);
    expect(client.getResult).toHaveBeenCalledTimes(3);
    expect(client.deleteShare).toHaveBeenCalledTimes(1);
    expect(history.get(token)?.result).toMatchObject(receipt);
  } finally {
    now.mockRestore();
  }
});

it('blocks the old challenge after the server reports expiry and the resend is limited', async () => {
  const client = createClientFixture();
  const business: IBusinessAuth = {
    origin: 'https://prime.example.invalid',
    authenticate: jest.fn().mockResolvedValue('fixture-proof'),
    transport: jest.fn(),
  };
  const history: IResultHistory = new Map();
  client.deleteShare.mockRejectedValueOnce(
    new DeletionError({ code: 'OTP_EXPIRED' }),
  );
  jest.mocked(createDeletionClient).mockReturnValue(client);
  const { result } = renderHook(() =>
    useDeletionFlow(token, business, history),
  );
  await waitFor(() => expect(result.current.screen.step).toBe('identity'));
  act(() => result.current.signIn('google'));
  await waitFor(() => expect(result.current.screen.step).toBe('confirm'));
  act(() => result.current.submit('01234567', [...WARNING_CODES]));
  await waitFor(() => expect(result.current.error?.code).toBe('OTP_EXPIRED'));

  client.sendDeletionOtp.mockRejectedValueOnce(
    new DeletionError({ code: 'RATE_LIMITED', retryAfterSeconds: 60 }),
  );
  act(() => result.current.sendDeletionOtp());
  await waitFor(() =>
    expect(result.current.error?.code).toBe('OTP_SEND_RATE_LIMITED'),
  );
  await act(async () => result.current.submit('01234567', [...WARNING_CODES]));
  expect(client.deleteShare).toHaveBeenCalledTimes(1);
  expect(result.current.screen.step).toBe('email');
});

it('allows status checks during the deletion cooldown and retries with the original key after it ends', async () => {
  const client = createClientFixture();
  const business: IBusinessAuth = {
    origin: 'https://prime.example.invalid',
    authenticate: jest.fn().mockResolvedValue('fixture-proof'),
    transport: jest.fn(),
  };
  const history: IResultHistory = new Map();
  client.deleteShare.mockRejectedValueOnce(
    new DeletionError({ code: 'SERVICE_UNAVAILABLE', retryAfterSeconds: 60 }),
  );
  client.getResult.mockResolvedValue({ status: 'not_submitted' });
  jest.mocked(createDeletionClient).mockReturnValue(client);
  const { result } = renderHook(() =>
    useDeletionFlow(token, business, history),
  );

  await waitFor(() => expect(result.current.screen.step).toBe('identity'));
  act(() => result.current.signIn('google'));
  await waitFor(() => expect(result.current.screen.step).toBe('confirm'));
  act(() => result.current.submit('01234567', [...WARNING_CODES]));
  await waitFor(() => expect(history.get(token)?.canRetry).toBe(true));

  const original = client.deleteShare.mock.calls[0];
  await act(async () => result.current.retrySubmit());
  expect(client.deleteShare).toHaveBeenCalledTimes(1);
  expect(client.getResult).toHaveBeenCalledTimes(1);
  await act(async () => result.current.checkStatus());
  expect(client.getResult).toHaveBeenCalledTimes(2);
  const deadline = history.get(token)?.deleteRetryAt;
  expect(deadline).toBeGreaterThan(globalThis.performance.now());
  const now = jest
    .spyOn(globalThis.performance, 'now')
    .mockReturnValue(deadline ?? 0);
  try {
    await act(async () => result.current.retrySubmit());
    expect(client.deleteShare).toHaveBeenCalledTimes(2);
    expect(client.deleteShare.mock.calls[1]).toEqual(original);
  } finally {
    now.mockRestore();
  }
});

const historicalReceipt: ICompleted = {
  ...receipt,
  status: 'completed',
  completedAt: serverTime,
  deletedScope: [DELETION_SCOPE],
  retainedScope: [...RETAINED_SCOPE],
};

function renderFlow(client: jest.Mocked<IDeletionClient>) {
  const authenticate = jest
    .fn<
      ReturnType<IBusinessAuth['authenticate']>,
      Parameters<IBusinessAuth['authenticate']>
    >()
    .mockResolvedValue('fixture-proof');
  const business: IBusinessAuth = {
    origin: 'https://prime.example.invalid',
    authenticate,
    transport: jest.fn(),
  };
  const history: IResultHistory = new Map();
  jest.mocked(createDeletionClient).mockReturnValue(client);
  return {
    ...renderHook(() => useDeletionFlow(token, business, history)),
    authenticate,
    history,
  };
}

it.each(['ready', 'used'] as const)(
  'stops an expired %s invitation before OAuth or any downstream endpoint',
  async (status) => {
    const client = createClientFixture(status);
    const info = await client.getLinkInfo(token);
    client.getLinkInfo.mockResolvedValue({ ...info, expiresAt: serverTime });
    const { result, authenticate } = renderFlow(client);
    await waitFor(() => expect(result.current.screen.step).toBe('unavailable'));
    await act(async () => {
      result.current.signIn('google');
      result.current.reauthenticate();
      result.current.checkStatus();
    });
    expect(authenticate).not.toHaveBeenCalled();
    expect(client.getResult).not.toHaveBeenCalled();
    expect(client.sendDeletionOtp).not.toHaveBeenCalled();
    expect(client.deleteShare).not.toHaveBeenCalled();
  },
);

it('does not allow OAuth after a displayed used invitation expires', async () => {
  const client = createClientFixture('used');
  const { result, authenticate } = renderFlow(client);
  await waitFor(() => expect(result.current.screen.step).toBe('identity'));
  const now = jest
    .spyOn(globalThis.performance, 'now')
    .mockReturnValue(globalThis.performance.now() + 300_001);
  try {
    await act(async () => result.current.signIn('google'));
    expect(result.current.screen.step).toBe('unavailable');
    expect(authenticate).not.toHaveBeenCalled();
    expect(client.getResult).not.toHaveBeenCalled();
  } finally {
    now.mockRestore();
  }
});

it('stops permanently if a previously valid invitation is rejected by /result', async () => {
  const client = createClientFixture('used');
  client.getResult.mockRejectedValueOnce(
    new DeletionError({ code: 'INVITATION_UNAVAILABLE' }),
  );
  const { result, authenticate, history } = renderFlow(client);
  await waitFor(() => expect(result.current.screen.step).toBe('identity'));
  await act(async () => result.current.signIn('google'));
  expect(result.current.screen.step).toBe('unavailable');
  expect(history.has(token)).toBe(false);
  await act(async () => {
    result.current.reauthenticate();
    result.current.checkStatus();
  });
  expect(authenticate).toHaveBeenCalledTimes(1);
  expect(client.getResult).toHaveBeenCalledTimes(1);
  expect(client.sendDeletionOtp).not.toHaveBeenCalled();
  expect(client.deleteShare).not.toHaveBeenCalled();
});

it('keeps a valid used invitation read-only when the share goes from present to absent', async () => {
  const client = createClientFixture('used');
  client.getResult
    .mockResolvedValueOnce({
      ...historicalReceipt,
      currentShareStatus: 'present',
    })
    .mockResolvedValueOnce({
      ...historicalReceipt,
      currentShareStatus: 'absent',
    });
  const { result, history } = renderFlow(client);
  await waitFor(() => expect(result.current.screen.step).toBe('identity'));
  await act(async () => result.current.signIn('google'));
  expect(history.get(token)?.result).toMatchObject({
    currentShareStatus: 'present',
  });
  await act(async () => result.current.checkStatus());
  expect(history.get(token)?.result).toEqual({
    ...historicalReceipt,
    currentShareStatus: 'absent',
  });
  await act(async () => result.current.retrySubmit());
  expect(client.getResult).toHaveBeenCalledTimes(2);
  expect(client.sendDeletionOtp).not.toHaveBeenCalled();
  expect(client.deleteShare).not.toHaveBeenCalled();
});

it('checks current share state immediately after a delete receipt with the same proof', async () => {
  const client = createClientFixture();
  client.deleteShare.mockResolvedValueOnce(historicalReceipt);
  let resolveResult:
    | ((value: Awaited<ReturnType<IDeletionClient['getResult']>>) => void)
    | undefined;
  client.getResult.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveResult = resolve;
    }),
  );
  const { result, history } = renderFlow(client);
  await waitFor(() => expect(result.current.screen.step).toBe('identity'));
  await act(async () => result.current.signIn('google'));
  await act(async () => result.current.submit('01234567', [...WARNING_CODES]));
  expect(history.get(token)?.result).toEqual(historicalReceipt);
  expect(result.current.busy).toBe(true);
  expect(client.getResult).toHaveBeenCalledWith({
    invitationToken: token,
    provider: 'google',
    supabaseAccessToken: 'fixture-proof',
  });
  await act(async () =>
    resolveResult?.({ ...historicalReceipt, currentShareStatus: 'absent' }),
  );
  expect(history.get(token)?.result).toMatchObject({
    currentShareStatus: 'absent',
  });
  expect(client.deleteShare).toHaveBeenCalledTimes(1);
});

it('clears stale current share certainty on a failed read and keeps the original result', async () => {
  const client = createClientFixture('used');
  client.getResult
    .mockResolvedValueOnce({
      ...historicalReceipt,
      currentShareStatus: 'present',
    })
    .mockRejectedValueOnce(
      new DeletionError({ code: 'RATE_LIMITED', retryAfterSeconds: 60 }),
    );
  const { result, history } = renderFlow(client);
  await waitFor(() => expect(result.current.screen.step).toBe('identity'));
  await act(async () => result.current.signIn('google'));
  await act(async () => result.current.checkStatus());
  expect(history.get(token)).toMatchObject({
    result: { ...historicalReceipt, currentShareStatus: 'unknown' },
    resultCheckFailed: true,
    canRetry: false,
  });
  await act(async () => result.current.checkStatus());
  expect(client.getResult).toHaveBeenCalledTimes(2);
  expect(client.deleteShare).not.toHaveBeenCalled();
});
