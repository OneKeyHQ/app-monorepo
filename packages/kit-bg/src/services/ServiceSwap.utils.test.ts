import {
  buildPerpDepositOrderStatusRequestParams,
  buildSwapRequestErrorToastPayload,
} from './ServiceSwap.utils';

describe('buildPerpDepositOrderStatusRequestParams', () => {
  it('maps the quote order ID to the status request', () => {
    expect(
      buildPerpDepositOrderStatusRequestParams({
        networkId: 'evm--1',
        txId: '0xtx',
        isArbUSDCToken: false,
        toPerpDepositTokenAddress: '0xdeposit',
        receivingAddress: '0xreceiver',
        orderId: 'order-123',
      }),
    ).toEqual({
      networkId: 'evm--1',
      txId: '0xtx',
      isArbUSDCToken: false,
      toPerpDepositTokenAddress: '0xdeposit',
      receivedAddress: '0xreceiver',
      orderId: 'order-123',
    });
  });

  it('omits the order ID for direct deposits and legacy pending orders', () => {
    expect(
      buildPerpDepositOrderStatusRequestParams({
        networkId: 'evm--42161',
        txId: '0xtx',
        isArbUSDCToken: true,
        toPerpDepositTokenAddress: '0xdeposit',
        receivingAddress: '0xreceiver',
      }),
    ).not.toHaveProperty('orderId');
  });
});

describe('buildSwapRequestErrorToastPayload', () => {
  it('keeps the request ID out of visible text while preserving diagnostics', () => {
    const payload = buildSwapRequestErrorToastPayload({
      message: 'Minimum value is 10 USDT',
      requestId: 'req-123',
    });

    expect(payload).toEqual({
      diagnosticText: 'RequestId: req-123',
      method: 'error',
      requestId: 'req-123',
      title: 'Minimum value is 10 USDT',
    });
    expect(payload).not.toHaveProperty('message');
  });

  it('omits request diagnostics when the error has no request ID', () => {
    expect(buildSwapRequestErrorToastPayload()).toEqual({
      diagnosticText: undefined,
      method: 'error',
      requestId: undefined,
      title: 'Request failed',
    });
  });
});
