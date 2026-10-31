/* cspell:ignore Infini */
import { EPrimeAuthSessionSource } from '@onekeyhq/shared/types/prime/primeTypes';
import type { IPrimeInfiniPendingPaymentLookup } from '@onekeyhq/shared/types/prime/primeTypes';

import {
  createPrimeInfiniRemotePendingPaymentResolver,
  getPrimeInfiniRemotePaymentRecovery,
} from './primeInfiniRemotePendingPayment';

const asset = {
  key: 'ETHEREUM-USDC',
  chain: 'ETHEREUM',
  token: 'USDC',
  networkId: 'evm--1',
  contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
};
const payment = {
  paymentId: 'remote-payment',
  address: '0x1234',
  chain: 'ETHEREUM',
  token: 'USDC',
  amountDue: '29.99',
  expiresAt: Date.now() + 3_600_000,
  status: 'pending',
};
const lookup: IPrimeInfiniPendingPaymentLookup = {
  authContext: {
    onekeyUserId: 'user-1',
    authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
    authStateGeneration: 3,
  },
  pendingPayment: {
    paymentId: payment.paymentId,
    payment,
    plan: 'monthly',
    hasTransactions: false,
  },
};

describe('remote Infini pending payment recovery', () => {
  it('uses the order plan and supported asset without requiring optional amounts', () => {
    expect(
      getPrimeInfiniRemotePaymentRecovery({
        pendingPayment: lookup.pendingPayment,
        assets: [asset],
      }),
    ).toEqual({ payment, plan: 'monthly', asset, sendStarted: false });
  });

  it.each([
    { ...lookup.pendingPayment!, plan: undefined },
    { ...lookup.pendingPayment!, payment: undefined },
    { ...lookup.pendingPayment!, payment: { ...payment, amountDue: '' } },
    { ...lookup.pendingPayment!, payment: { ...payment, expiresAt: 1 } },
  ])(
    'offers replacement when recovery fields are unavailable: %j',
    (pendingPayment) => {
      expect(
        getPrimeInfiniRemotePaymentRecovery({
          pendingPayment,
          assets: [asset],
        }),
      ).toBeUndefined();
    },
  );

  it('does not invent an asset when the remote token is unsupported', () => {
    expect(
      getPrimeInfiniRemotePaymentRecovery({
        pendingPayment: lookup.pendingPayment,
        assets: [],
      }),
    ).toBeUndefined();
  });

  it.each([
    { ...payment, status: 'confirming' },
    { ...payment, status: 'signed' },
    { ...payment, amountConfirmed: '1' },
    { ...payment, amountConfirming: '1' },
    { ...payment, hasTransactions: true },
    { ...payment, status: undefined },
  ])('keeps transfer activity tracking only: %j', (remotePayment) => {
    expect(
      getPrimeInfiniRemotePaymentRecovery({
        pendingPayment: { ...lookup.pendingPayment!, payment: remotePayment },
        assets: [asset],
      })?.sendStarted,
    ).toBe(true);
  });

  it('tracks a transaction after quote expiry instead of sending the due amount', () => {
    expect(
      getPrimeInfiniRemotePaymentRecovery({
        pendingPayment: {
          ...lookup.pendingPayment!,
          hasTransactions: true,
          payment: { ...payment, expiresAt: 1 },
        },
        assets: [asset],
      })?.sendStarted,
    ).toBe(true);
  });
});

describe('remote Infini pending payment consent', () => {
  const createParams = () => ({
    lookup,
    assets: [asset],
    choose: jest.fn(async (_canResume: boolean) => 'replace' as const),
    validateAuth: jest.fn(async () => true),
    shouldContinue: jest.fn(() => true),
  });

  it('keeps automatic preparation when there is no remote pending order', async () => {
    const params = createParams();
    params.lookup = { authContext: lookup.authContext };
    await expect(
      createPrimeInfiniRemotePendingPaymentResolver()(params),
    ).resolves.toEqual({ type: 'new' });
    expect(params.choose).not.toHaveBeenCalled();
  });

  it('allows confirmed new payment when the plan is missing', async () => {
    const params = createParams();
    params.lookup = {
      ...lookup,
      pendingPayment: { ...lookup.pendingPayment!, plan: undefined },
    };
    await expect(
      createPrimeInfiniRemotePendingPaymentResolver()(params),
    ).resolves.toEqual({ type: 'new' });
    expect(params.choose).toHaveBeenCalledWith(false);
  });

  it('restores only after continue was selected', async () => {
    const params = {
      ...createParams(),
      choose: jest.fn(async () => 'resume' as const),
    };
    await expect(
      createPrimeInfiniRemotePendingPaymentResolver()(params),
    ).resolves.toMatchObject({
      type: 'resume',
      recovery: { payment, plan: 'monthly' },
    });
    expect(params.choose).toHaveBeenCalledWith(true);
  });

  it('cancels on dismissal or when unavailable recovery is requested', async () => {
    const params = {
      ...createParams(),
      choose: jest.fn(async () => 'cancel' as const),
    };
    await expect(
      createPrimeInfiniRemotePendingPaymentResolver()(params),
    ).resolves.toEqual({ type: 'cancelled' });
  });

  it('shares one prompt for concurrent loader retries and repeated choices', async () => {
    const params = createParams();
    const resolve = createPrimeInfiniRemotePendingPaymentResolver();
    await expect(
      Promise.all([resolve(params), resolve(params), resolve(params)]),
    ).resolves.toEqual([{ type: 'new' }, { type: 'new' }, { type: 'new' }]);
    expect(params.choose).toHaveBeenCalledTimes(1);
  });

  it('discards a result after an account switch during the prompt', async () => {
    const params = createParams();
    params.choose.mockImplementation(async () => {
      params.validateAuth.mockResolvedValue(false);
      return 'replace';
    });
    await expect(
      createPrimeInfiniRemotePendingPaymentResolver()(params),
    ).resolves.toEqual({ type: 'cancelled' });
  });

  it('discards stale async results before showing a prompt', async () => {
    const params = createParams();
    params.shouldContinue.mockReturnValue(false);
    await expect(
      createPrimeInfiniRemotePendingPaymentResolver()(params),
    ).resolves.toEqual({ type: 'cancelled' });
    expect(params.choose).not.toHaveBeenCalled();
  });

  it('does not reuse consent after an A to B to A auth lifecycle change', async () => {
    const params = createParams();
    const resolve = createPrimeInfiniRemotePendingPaymentResolver();
    await resolve(params);
    await resolve({
      ...params,
      lookup: {
        ...lookup,
        authContext: { ...lookup.authContext, authStateGeneration: 4 },
      },
    });
    expect(params.choose).toHaveBeenCalledTimes(2);
  });

  it('honors a previously consented external-checkout recovery for the same order', async () => {
    const params = createParams();
    await expect(
      createPrimeInfiniRemotePendingPaymentResolver()({
        ...params,
        resumePaymentId: payment.paymentId,
      }),
    ).resolves.toMatchObject({ type: 'resume' });
    expect(params.choose).not.toHaveBeenCalled();
  });
});
