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
    const client: jest.Mocked<IDeletionClient> = {
      getLinkInfo: jest.fn().mockResolvedValue({
        status: 'ready',
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
      .mockResolvedValueOnce(
        accepted ? completed : { status: 'not_submitted' },
      );
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
        expect(history.get(token)?.result?.status).toBe('completed'),
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
