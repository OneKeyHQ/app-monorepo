import { resolveAllNetworkPublishedResult } from './allNetworkRunResultUtils';

describe('resolveAllNetworkPublishedResult', () => {
  const signature = 'account-1|all--networks|wallet-1|0|0';

  test('publishes and records a stable result', () => {
    const result = [{ networkId: 'evm--1' }];

    expect(
      resolveAllNetworkPublishedResult({
        completedResult: result,
        hasQueuedRerun: false,
        lastPublished: undefined,
        runSignature: signature,
      }),
    ).toEqual({
      publishedResult: result,
      nextLastPublished: { result, runSignature: signature },
    });
  });

  test('keeps the previous stable result when the run is superseded', () => {
    const previous = [{ networkId: 'btc--0' }];

    expect(
      resolveAllNetworkPublishedResult({
        completedResult: [{ networkId: 'evm--1' }],
        hasQueuedRerun: true,
        lastPublished: { result: previous, runSignature: signature },
        runSignature: signature,
      }),
    ).toEqual({
      publishedResult: previous,
      nextLastPublished: { result: previous, runSignature: signature },
    });
  });

  test('does not reuse a stable result from another owner', () => {
    const previous = [{ networkId: 'btc--0' }];

    expect(
      resolveAllNetworkPublishedResult({
        completedResult: [{ networkId: 'evm--1' }],
        hasQueuedRerun: true,
        lastPublished: {
          result: previous,
          runSignature: 'another-account|all--networks|wallet-2|0|0',
        },
        runSignature: signature,
      }),
    ).toEqual({
      publishedResult: undefined,
      nextLastPublished: {
        result: previous,
        runSignature: 'another-account|all--networks|wallet-2|0|0',
      },
    });
  });

  test('publishes a stable empty result', () => {
    expect(
      resolveAllNetworkPublishedResult({
        completedResult: null,
        hasQueuedRerun: false,
        lastPublished: undefined,
        runSignature: signature,
      }),
    ).toEqual({
      publishedResult: null,
      nextLastPublished: { result: null, runSignature: signature },
    });
  });
});
