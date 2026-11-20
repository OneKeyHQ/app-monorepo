import type { IStakeTxResponse } from '@onekeyhq/shared/types/staking';

import ServiceStaking from './ServiceStaking';

// Server-executed claim step (OK-61790, Unitas): after the claim transaction
// is broadcast the client asks the server to convert the claimed amount. Until
// that transaction is mined the server answers "no claimable amount", so the
// request is retried on that answer only.

const NO_CLAIMABLE_AMOUNT = 70_813;

function serverError(code: number | string) {
  return Object.assign(new Error(`server error ${code}`), { code });
}

function createHarness(responses: Array<IStakeTxResponse | Error>) {
  const service = new ServiceStaking({ backgroundApi: {} });
  const buildClaimTransaction = jest.spyOn(service, 'buildClaimTransaction');
  responses.forEach((response) => {
    if (response instanceof Error) {
      buildClaimTransaction.mockRejectedValueOnce(response);
    } else {
      buildClaimTransaction.mockResolvedValueOnce(response);
    }
  });
  return { service, buildClaimTransaction };
}

// @backgroundMethod guards against UI-thread calls; the service is exercised
// directly here.
beforeAll(() => {
  (globalThis as { $onekeyIsInBackground?: boolean }).$onekeyIsInBackground =
    true;
});

afterAll(() => {
  delete (globalThis as { $onekeyIsInBackground?: boolean })
    .$onekeyIsInBackground;
});

const claim = {
  networkId: 'evm--56',
  accountId: 'hd-1--evm--56',
  symbol: 'USDT',
  provider: 'unitas',
  vault: '0xe9e8573bb351da16c6ee7ddac0cbc70b7f9784ae',
  amount: '10',
  identity: 'convert',
};
const params = { ...claim, intervalMs: 1, timeoutMs: 200 };
const accepted: IStakeTxResponse = { tx: null, orderId: 'order-1' };

describe('ServiceStaking.requestServerExecutedClaim', () => {
  it('returns the order as soon as the server accepts the step', async () => {
    const { service, buildClaimTransaction } = createHarness([accepted]);

    await expect(service.requestServerExecutedClaim(params)).resolves.toEqual({
      status: 'accepted',
      orderId: 'order-1',
    });
    expect(buildClaimTransaction).toHaveBeenCalledTimes(1);
    // The polling options stay local; only the claim itself goes to the server.
    expect(buildClaimTransaction).toHaveBeenCalledWith(claim);
  });

  it('retries while the claim transaction is not mined yet', async () => {
    const { service, buildClaimTransaction } = createHarness([
      serverError(NO_CLAIMABLE_AMOUNT),
      serverError(String(NO_CLAIMABLE_AMOUNT)),
      accepted,
    ]);

    await expect(service.requestServerExecutedClaim(params)).resolves.toEqual({
      status: 'accepted',
      orderId: 'order-1',
    });
    expect(buildClaimTransaction).toHaveBeenCalledTimes(3);
  });

  it('reports a timeout, not a failure, when the claim never shows up', async () => {
    const service = new ServiceStaking({ backgroundApi: {} });
    const buildClaimTransaction = jest
      .spyOn(service, 'buildClaimTransaction')
      .mockRejectedValue(serverError(NO_CLAIMABLE_AMOUNT));

    await expect(
      service.requestServerExecutedClaim({ ...params, timeoutMs: 20 }),
    ).resolves.toEqual({ status: 'timeout' });
    expect(buildClaimTransaction.mock.calls.length).toBeGreaterThan(1);
  });

  it('asks once even when the deadline is already over', async () => {
    const { service, buildClaimTransaction } = createHarness([accepted]);

    await expect(
      service.requestServerExecutedClaim({ ...params, timeoutMs: 0 }),
    ).resolves.toEqual({ status: 'accepted', orderId: 'order-1' });
    expect(buildClaimTransaction).toHaveBeenCalledTimes(1);
  });

  it('reports a server rejection with the server’s wording and does not retry', async () => {
    const rejection = Object.assign(serverError(70_903), {
      className: 'OneKeyServerApiError',
      message: 'Amount exceeds your redeemable limit of 10 USDu.',
    });
    const { service, buildClaimTransaction } = createHarness([
      rejection,
      accepted,
    ]);

    // Returned, not thrown: an error crossing the background bridge would
    // raise the global error toast on top of the caller's own dialog.
    await expect(service.requestServerExecutedClaim(params)).resolves.toEqual({
      status: 'rejected',
      message: 'Amount exceeds your redeemable limit of 10 USDu.',
    });
    expect(buildClaimTransaction).toHaveBeenCalledTimes(1);
  });

  it('reports a rejection without wording when the server sent none', async () => {
    const rejection = Object.assign(serverError(70_905), {
      className: 'OneKeyServerApiError',
      message: '',
    });
    const { service } = createHarness([rejection]);

    await expect(service.requestServerExecutedClaim(params)).resolves.toEqual({
      status: 'rejected',
    });
  });

  it('keeps a non-server error message to itself, such as a network failure', async () => {
    const { service, buildClaimTransaction } = createHarness([
      new Error('Network Error'),
      accepted,
    ]);

    await expect(service.requestServerExecutedClaim(params)).resolves.toEqual({
      status: 'rejected',
    });
    expect(buildClaimTransaction).toHaveBeenCalledTimes(1);
  });

  it('rejects a response that carries a transaction to sign', async () => {
    const { service } = createHarness([
      { tx: { to: '0x1', data: '0x', value: '0' } as IStakeTxResponse['tx'] },
    ]);

    await expect(service.requestServerExecutedClaim(params)).resolves.toEqual({
      status: 'rejected',
    });
  });

  it('rejects a response that has neither a transaction nor an order', async () => {
    const { service } = createHarness([{ tx: null }]);

    await expect(service.requestServerExecutedClaim(params)).resolves.toEqual({
      status: 'rejected',
    });
  });
});
