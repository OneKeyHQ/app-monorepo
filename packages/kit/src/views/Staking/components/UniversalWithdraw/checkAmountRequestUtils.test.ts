import {
  getCheckAmountRequestKey,
  isLatestCheckAmountRequest,
} from './checkAmountRequestUtils';

const baseParams = {
  accountId: 'hd-1--m/44/60/0/0/0',
  amount: '1',
  identity: 'position-1',
  inputTokenAddress: '0xinput',
  networkId: 'evm--1',
  outputTokenAddress: '0xoutput',
  provider: 'Spark',
  protocolVault: '0xvault-a',
  slippage: 0.5,
  symbol: 'USDC',
  withdrawAll: false,
  withdrawType: 'instant' as const,
};

describe('check amount request guards', () => {
  it.each([
    ['accountId', 'hd-2--m/44/60/0/0/0'],
    ['networkId', 'evm--137'],
    ['provider', 'Bitway'],
    ['protocolVault', '0xvault-b'],
    ['withdrawType', 'queued'],
  ] as const)('includes %s in the request identity', (key, value) => {
    expect(getCheckAmountRequestKey(baseParams)).not.toBe(
      getCheckAmountRequestKey({ ...baseParams, [key]: value }),
    );
  });

  it('accepts only the latest request generation with the current identity', () => {
    expect(
      isLatestCheckAmountRequest({
        latestRequestId: 2,
        latestRequestKey: 'vault-b',
        requestId: 1,
        requestKey: 'vault-a',
      }),
    ).toBe(false);
    expect(
      isLatestCheckAmountRequest({
        latestRequestId: 2,
        latestRequestKey: 'vault-b',
        requestId: 2,
        requestKey: 'vault-a',
      }),
    ).toBe(false);
    expect(
      isLatestCheckAmountRequest({
        latestRequestId: 2,
        latestRequestKey: 'vault-b',
        requestId: 2,
        requestKey: 'vault-b',
      }),
    ).toBe(true);
  });
});
