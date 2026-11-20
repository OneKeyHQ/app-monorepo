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

const historicalReceipt: ICompleted = {
  ...receipt,
  status: 'completed',
  completedAt: serverTime,
  deletedScope: [DELETION_SCOPE],
  retainedScope: [...RETAINED_SCOPE],
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

it('requires sign-in again when the delete request rejects expired proof', async () => {
  const client = createClientFixture();
  client.deleteShare.mockRejectedValueOnce(
    new DeletionError({ code: 'AUTH_EXPIRED' }),
  );
  const { result, history } = renderFlow(client);
  await waitFor(() => expect(result.current.screen.step).toBe('identity'));
  await act(async () => result.current.signIn('google'));
  await act(async () => result.current.submit('01234567', [...WARNING_CODES]));

  expect(result.current.screen.step).toBe('identity');
  expect(result.current.error?.code).toBe('AUTH_EXPIRED');
  expect(history.has(token)).toBe(false);
  expect(client.getResult).not.toHaveBeenCalled();
});

it('preserves the server acknowledgement and respects the result cooldown', async () => {
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
  expect(history.get(token)?.accepted).toEqual(original?.accepted);
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

it('reports a delete error directly and respects the server cooldown', async () => {
  const client = createClientFixture();
  client.deleteShare
    .mockRejectedValueOnce(
      new DeletionError({ code: 'SERVICE_UNAVAILABLE', retryAfterSeconds: 60 }),
    )
    .mockResolvedValueOnce(historicalReceipt);
  client.getResult.mockResolvedValueOnce({
    ...historicalReceipt,
    currentShareStatus: 'absent',
  });
  const { result, history } = renderFlow(client);
  await waitFor(() => expect(result.current.screen.step).toBe('identity'));
  await act(async () => result.current.signIn('google'));
  await act(async () => result.current.submit('01234567', [...WARNING_CODES]));

  expect(result.current.error?.code).toBe('SERVICE_UNAVAILABLE');
  expect(result.current.screen.step).toBe('confirm');
  expect(history.has(token)).toBe(false);
  expect(client.getResult).not.toHaveBeenCalled();
  const original = client.deleteShare.mock.calls[0];

  await act(async () => result.current.submit('01234567', [...WARNING_CODES]));
  expect(client.deleteShare).toHaveBeenCalledTimes(1);

  const now = jest
    .spyOn(globalThis.performance, 'now')
    .mockReturnValue(result.current.error?.retryAt ?? 0);
  try {
    await act(async () =>
      result.current.submit('01234567', [...WARNING_CODES]),
    );
    expect(client.deleteShare).toHaveBeenCalledTimes(2);
    expect(client.deleteShare.mock.calls[1]).toEqual(original);
    expect(result.current.screen.step).toBe('result');
  } finally {
    now.mockRestore();
  }
});

it.each([
  new TypeError('Network unavailable'),
  new DOMException('Request timed out', 'TimeoutError'),
  new SyntaxError('Unexpected delete response'),
])(
  'stays on confirmation and uses the shared error path for %s',
  async (error) => {
    const client = createClientFixture();
    client.deleteShare.mockRejectedValueOnce(error);
    const { result, history } = renderFlow(client);
    await waitFor(() => expect(result.current.screen.step).toBe('identity'));
    await act(async () => result.current.signIn('google'));
    await act(async () =>
      result.current.submit('01234567', [...WARNING_CODES]),
    );

    expect(result.current.screen.step).toBe('confirm');
    expect(result.current.error).toMatchObject({ usesSharedToast: true });
    expect(history.has(token)).toBe(false);
    expect(client.getResult).not.toHaveBeenCalled();
  },
);

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
  await act(async () => result.current.submit('01234567', [...WARNING_CODES]));
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
  });
  await act(async () => result.current.checkStatus());
  expect(client.getResult).toHaveBeenCalledTimes(2);
  expect(client.deleteShare).not.toHaveBeenCalled();
});

it('distinguishes a failed result request from a successful unknown result', async () => {
  const client = createClientFixture('used');
  client.getResult
    .mockRejectedValueOnce(new TypeError('Network unavailable'))
    .mockResolvedValueOnce({
      ...historicalReceipt,
      currentShareStatus: 'unknown',
    })
    .mockResolvedValueOnce({
      ...historicalReceipt,
      currentShareStatus: 'absent',
    });
  const { result, history } = renderFlow(client);
  await waitFor(() => expect(result.current.screen.step).toBe('identity'));
  await act(async () => result.current.signIn('google'));
  expect(history.get(token)).toMatchObject({ resultCheckFailed: true });
  expect(result.current.error).toMatchObject({ usesSharedToast: true });

  await act(async () => result.current.checkStatus());
  expect(history.get(token)).toMatchObject({
    resultCheckFailed: false,
    result: { ...historicalReceipt, currentShareStatus: 'unknown' },
  });
  expect(result.current.error).toBeUndefined();

  await act(async () => result.current.checkStatus());
  expect(history.get(token)).toMatchObject({
    resultCheckFailed: false,
    result: { ...historicalReceipt, currentShareStatus: 'absent' },
  });
  expect(client.deleteShare).not.toHaveBeenCalled();
});

it('only checks an uncertain delete when requested and never submits it again', async () => {
  const client = createClientFixture();
  client.deleteShare.mockRejectedValueOnce(
    new DOMException('Request timed out', 'TimeoutError'),
  );
  client.getResult
    .mockResolvedValueOnce({ status: 'not_submitted' })
    .mockResolvedValueOnce({
      ...historicalReceipt,
      currentShareStatus: 'absent',
    });
  const { result, history } = renderFlow(client);
  await waitFor(() => expect(result.current.screen.step).toBe('identity'));
  await act(async () => result.current.signIn('google'));
  await act(async () => result.current.submit('01234567', [...WARNING_CODES]));
  const key = client.deleteShare.mock.calls[0]?.[1];

  expect(client.getResult).not.toHaveBeenCalled();
  expect(history.has(token)).toBe(false);
  expect(result.current.screen).toMatchObject({
    step: 'confirm',
    key,
    uncertainDeletion: 'unconfirmed',
  });

  await act(async () => result.current.checkDeleteOutcome());
  expect(result.current.screen).toMatchObject({
    step: 'confirm',
    key,
    uncertainDeletion: 'not_found',
  });

  await act(async () => result.current.sendDeletionOtp());
  expect(client.sendDeletionOtp).toHaveBeenCalledTimes(1);

  await act(async () => result.current.checkDeleteOutcome());
  expect(result.current.screen.step).toBe('result');
  expect(history.get(token)?.result).toMatchObject({
    currentShareStatus: 'absent',
  });
  expect(client.getResult).toHaveBeenCalledTimes(2);
  expect(client.deleteShare).toHaveBeenCalledTimes(1);
});

it('ends an uncertain deletion when a manual result check rejects the link', async () => {
  const client = createClientFixture();
  client.deleteShare.mockRejectedValueOnce(
    new TypeError('Network unavailable'),
  );
  client.getResult.mockRejectedValueOnce(
    new DeletionError({ code: 'INVITATION_UNAVAILABLE' }),
  );
  const { result, history } = renderFlow(client);
  await waitFor(() => expect(result.current.screen.step).toBe('identity'));
  await act(async () => result.current.signIn('google'));
  await act(async () => result.current.submit('01234567', [...WARNING_CODES]));

  await act(async () => result.current.checkDeleteOutcome());

  expect(result.current.screen.step).toBe('unavailable');
  expect(history.has(token)).toBe(false);
  expect(client.deleteShare).toHaveBeenCalledTimes(1);
});

it('renews expired proof for an outcome check without requesting another code', async () => {
  const client = createClientFixture();
  client.deleteShare.mockRejectedValueOnce(
    new TypeError('Network unavailable'),
  );
  client.getResult
    .mockRejectedValueOnce(new DeletionError({ code: 'AUTH_EXPIRED' }))
    .mockResolvedValueOnce({
      ...historicalReceipt,
      currentShareStatus: 'unknown',
    });
  const { result, authenticate, history } = renderFlow(client);
  await waitFor(() => expect(result.current.screen.step).toBe('identity'));
  await act(async () => result.current.signIn('google'));
  await act(async () => result.current.submit('01234567', [...WARNING_CODES]));
  await act(async () => result.current.checkDeleteOutcome());
  expect(result.current.screen).toMatchObject({
    step: 'confirm',
    outcomeNeedsSignIn: true,
  });
  await act(async () => result.current.submit('01234567', [...WARNING_CODES]));
  expect(client.deleteShare).toHaveBeenCalledTimes(1);

  authenticate.mockResolvedValueOnce('fixture-renewed-proof');
  await act(async () => result.current.checkDeleteOutcome());
  expect(client.getResult).toHaveBeenLastCalledWith({
    invitationToken: token,
    provider: 'google',
    supabaseAccessToken: 'fixture-renewed-proof',
  });
  expect(client.sendDeletionOtp).toHaveBeenCalledTimes(1);
  expect(history.get(token)?.result).toMatchObject({
    currentShareStatus: 'unknown',
  });
});
