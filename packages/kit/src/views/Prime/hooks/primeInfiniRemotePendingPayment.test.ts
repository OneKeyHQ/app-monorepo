/* cspell:ignore Infini */
import { EPrimeAuthSessionSource } from '@onekeyhq/shared/types/prime/primeTypes';
import type { IPrimeInfiniPendingPaymentLookup } from '@onekeyhq/shared/types/prime/primeTypes';

import {
  createPrimeInfiniRemotePendingPaymentResolver,
  getPrimeInfiniRemotePaymentRecovery,
  preparePrimeInfiniRemotePayment,
} from './primeInfiniRemotePendingPayment';

const asset = {
  key: 'ETHEREUM-USDC',
  chain: 'ETHEREUM',
  token: 'USDC',
  networkId: 'evm--1',
  contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
};
const payment = {
  paymentId: 'remote-order',
  address: '0xrecipient',
  chain: 'ETHEREUM',
  token: 'USDC',
  amountDue: '29.99',
  expiresAt: Date.now() + 3_600_000,
  status: 'created',
  amountConfirmed: '0',
  amountConfirming: '0',
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
const params = () => ({
  lookup,
  assets: [asset],
  choose: jest.fn(
    async (_canResume: boolean, _unavailable?: boolean) =>
      'replace' as 'replace' | 'resume' | 'cancel',
  ),
  validateAuth: jest.fn(async () => true),
  shouldContinue: jest.fn(() => true),
});

describe('advisory remote pending payment', () => {
  it('resumes only a complete supported unpaid quote on its actual plan', () => {
    expect(
      getPrimeInfiniRemotePaymentRecovery({
        pendingPayment: lookup.pendingPayment,
        assets: [asset],
      }),
    ).toEqual({ payment, asset, plan: 'monthly' });
  });
  it.each([
    { plan: undefined },
    { hasTransactions: undefined },
    { hasTransactions: true },
    { hasLocalSendEvidence: true },
    { payment: undefined },
    ...[
      'signed',
      'broadcast',
      'processing',
      'confirming',
      'paid',
      'expired',
      'failed',
      undefined,
    ].map((status) => ({ payment: { ...payment, status } })),
    { payment: { ...payment, amountConfirmed: undefined } },
    { payment: { ...payment, amountConfirming: undefined } },
    { payment: { ...payment, amountConfirmed: '1' } },
    { payment: { ...payment, amountConfirming: '1' } },
    { payment: { ...payment, expiresAt: 1 } },
    { payment: { ...payment, token: 'UNSUPPORTED' } },
  ])('does not guess incomplete or transferred recovery data: %j', (change) => {
    const p = params();
    p.lookup = {
      ...lookup,
      pendingPayment: { ...lookup.pendingPayment!, ...change },
    };
    expect(
      getPrimeInfiniRemotePaymentRecovery({
        pendingPayment: p.lookup.pendingPayment,
        assets: [asset],
      }),
    ).toBeUndefined();
  });
  it('continues automatically after a confirmed empty query', async () => {
    const p = params();
    p.lookup = { authContext: lookup.authContext };
    await expect(
      createPrimeInfiniRemotePendingPaymentResolver()(p),
    ).resolves.toEqual({ type: 'new' });
    expect(p.choose).not.toHaveBeenCalled();
  });
  it.each(['replace', 'cancel', 'resume'] as const)(
    'requires a choice after query failure: %s',
    async (choice) => {
      const p = params();
      p.lookup = { authContext: lookup.authContext, status: 'unavailable' };
      p.choose.mockResolvedValue(choice);
      await expect(
        createPrimeInfiniRemotePendingPaymentResolver()(p),
      ).resolves.toEqual({ type: choice === 'replace' ? 'new' : 'cancelled' });
      expect(p.choose).toHaveBeenCalledWith(false, true);
    },
  );
  it('lets an explicit new-payment choice replace an unsuccessful resume', async () => {
    const p = params();
    p.lookup = { authContext: lookup.authContext, status: 'unavailable' };
    await expect(
      createPrimeInfiniRemotePendingPaymentResolver()({
        ...p,
        resumePaymentId: 'missing-order',
        allowNewPayment: false,
      }),
    ).resolves.toEqual({ type: 'new' });
    expect(p.choose).toHaveBeenCalledWith(false, true);
  });
  it.each(['localSend', 'unavailable'] as const)(
    'warns without auto-resuming an old intent with %s evidence, while allowing a new payment',
    async (kind) => {
      const p = params();
      p.lookup =
        kind === 'unavailable'
          ? { ...lookup, status: 'unavailable' }
          : {
              ...lookup,
              pendingPayment: {
                ...lookup.pendingPayment!,
                hasLocalSendEvidence: true,
              },
            };
      await expect(
        createPrimeInfiniRemotePendingPaymentResolver()({
          ...p,
          resumePaymentId: payment.paymentId,
        }),
      ).resolves.toEqual({ type: 'new' });
      expect(p.choose).toHaveBeenCalledWith(
        false,
        ...(kind === 'unavailable' ? [true] : []),
      );
    },
  );
  it('does not automatically create on a missing resume-only entry', async () => {
    const p = params();
    p.lookup = { authContext: lookup.authContext };
    await expect(
      createPrimeInfiniRemotePendingPaymentResolver()({
        ...p,
        allowNewPayment: false,
      }),
    ).resolves.toEqual({ type: 'cancelled' });
    expect(p.choose).not.toHaveBeenCalled();
  });
  it('offers resume for a validated unpaid invoice', async () => {
    const p = params();
    p.choose.mockResolvedValue('resume');
    await expect(
      createPrimeInfiniRemotePendingPaymentResolver()(p),
    ).resolves.toMatchObject({
      type: 'resume',
      recovery: { payment, plan: 'monthly' },
    });
    expect(p.choose).toHaveBeenCalledWith(true);
  });
  it('uses the requested recovery without asking the same resume question twice', async () => {
    const p = params();
    await expect(
      createPrimeInfiniRemotePendingPaymentResolver()({
        ...p,
        resumePaymentId: payment.paymentId,
      }),
    ).resolves.toMatchObject({ type: 'resume' });
    expect(p.choose).not.toHaveBeenCalled();
  });
  it('shares a dialog only within one loader and unchanged lookup', async () => {
    const p = params();
    const resolve = createPrimeInfiniRemotePendingPaymentResolver();
    await Promise.all([resolve(p), resolve(p), resolve(p)]);
    expect(p.choose).toHaveBeenCalledTimes(1);
    await resolve({
      ...p,
      lookup: {
        ...lookup,
        pendingPayment: {
          ...lookup.pendingPayment!,
          payment: { ...payment, amountDue: '39.99' },
        },
      },
    });
    expect(p.choose).toHaveBeenCalledTimes(2);
    await createPrimeInfiniRemotePendingPaymentResolver()(p);
    expect(p.choose).toHaveBeenCalledTimes(3);
  });
  it('does not let an older cancellation clear a newer shared dialog', async () => {
    const p = params();
    const resolve = createPrimeInfiniRemotePendingPaymentResolver();
    let cancelOld!: (choice: 'cancel') => void;
    let confirmNew!: (choice: 'replace') => void;
    p.choose
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            cancelOld = done;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            confirmNew = done;
          }),
      );
    const old = resolve(p);
    await Promise.resolve();
    const newer = {
      ...p,
      lookup: { ...lookup, status: 'unavailable' as const },
    };
    const next = resolve(newer);
    await Promise.resolve();
    cancelOld('cancel');
    await expect(old).resolves.toEqual({ type: 'cancelled' });
    const concurrent = resolve(newer);
    await Promise.resolve();
    expect(p.choose).toHaveBeenCalledTimes(2);
    confirmNew('replace');
    await expect(Promise.all([next, concurrent])).resolves.toEqual([
      { type: 'new' },
      { type: 'new' },
    ]);
  });
  it('rejects an identity change before opening the warning', async () => {
    const p = params();
    p.validateAuth.mockResolvedValue(false);
    await expect(
      createPrimeInfiniRemotePendingPaymentResolver()(p),
    ).resolves.toEqual({ type: 'cancelled' });
    expect(p.choose).not.toHaveBeenCalled();
  });
  it('rejects identity changes and stale attempts during a warning', async () => {
    const p = params();
    p.choose.mockImplementation(async () => {
      p.validateAuth.mockResolvedValue(false);
      return 'replace';
    });
    await expect(
      createPrimeInfiniRemotePendingPaymentResolver()(p),
    ).resolves.toEqual({ type: 'cancelled' });
    p.validateAuth.mockResolvedValue(true);
    p.choose.mockImplementation(async () => {
      p.shouldContinue.mockReturnValue(false);
      return 'replace';
    });
    await expect(
      createPrimeInfiniRemotePendingPaymentResolver()(p),
    ).resolves.toEqual({ type: 'cancelled' });
  });
});

describe('wallet recovery preparation to the original create API', () => {
  const recovery = { payment, asset, plan: 'monthly' as const };
  const create = () => ({
    recovery,
    asset,
    fetchLookup: jest.fn(async () => lookup),
    createPayment: jest.fn(async () => ({
      ...payment,
      paymentId: 'new-order',
    })),
    chooseNew: jest.fn(
      async (_unavailable: boolean) => 'replace' as 'replace' | 'cancel',
    ),
    validateAuth: jest.fn(async () => true),
    shouldContinue: () => true,
  });
  it('reuses a freshly verified unchanged unpaid invoice without creating or warning again', async () => {
    const p = create();
    await expect(preparePrimeInfiniRemotePayment(p)).resolves.toEqual({
      payment,
      resumed: true,
    });
    expect(p.createPayment).not.toHaveBeenCalled();
    expect(p.chooseNew).not.toHaveBeenCalled();
  });
  it.each([
    'unavailable',
    'transferred',
    'localSend',
    'different',
    'missing',
  ] as const)(
    'calls the original new-payment API only after confirmation when recovery is %s',
    async (kind) => {
      const p = create();
      if (kind === 'unavailable')
        p.fetchLookup.mockResolvedValue({
          authContext: lookup.authContext,
          status: 'unavailable',
        });
      if (kind === 'localSend')
        p.fetchLookup.mockResolvedValue({
          ...lookup,
          pendingPayment: {
            ...lookup.pendingPayment!,
            hasLocalSendEvidence: true,
          },
        });
      if (kind === 'missing')
        p.fetchLookup.mockResolvedValue({ authContext: lookup.authContext });
      if (kind === 'transferred')
        p.fetchLookup.mockResolvedValue({
          ...lookup,
          pendingPayment: { ...lookup.pendingPayment!, hasTransactions: true },
        });
      if (kind === 'different')
        p.fetchLookup.mockResolvedValue({
          ...lookup,
          pendingPayment: {
            ...lookup.pendingPayment!,
            payment: { ...payment, amountDue: '99' },
          },
        });
      p.chooseNew.mockImplementation(async () => {
        expect(p.createPayment).not.toHaveBeenCalled();
        return 'replace';
      });
      await expect(preparePrimeInfiniRemotePayment(p)).resolves.toMatchObject({
        payment: { paymentId: 'new-order' },
        resumed: false,
      });
      expect(p.createPayment).toHaveBeenCalledTimes(1);
      expect(p.chooseNew).toHaveBeenCalledTimes(1);
    },
  );
  it('does not create after cancellation or an auth change during confirmation', async () => {
    const p = create();
    p.fetchLookup.mockResolvedValue({
      authContext: lookup.authContext,
      status: 'unavailable',
    });
    p.chooseNew.mockResolvedValue('cancel');
    await expect(preparePrimeInfiniRemotePayment(p)).resolves.toBeUndefined();
    expect(p.createPayment).not.toHaveBeenCalled();
    p.chooseNew.mockImplementation(async () => {
      p.validateAuth.mockResolvedValue(false);
      return 'replace';
    });
    await expect(preparePrimeInfiniRemotePayment(p)).resolves.toBeUndefined();
    expect(p.createPayment).not.toHaveBeenCalled();
  });
});
