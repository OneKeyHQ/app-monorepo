import {
  convertHyperLiquidResponse,
  extractHyperLiquidErrorMessage,
  hyperLiquidErrorResolver,
} from './hyperLiquidErrorResolver';

describe('hyperLiquidErrorResolver', () => {
  afterEach(() => {
    hyperLiquidErrorResolver.updateLocales(undefined);
  });

  it('extracts SDK response errors', () => {
    expect(
      extractHyperLiquidErrorMessage({
        response: {
          status: 'err',
          response: 'Price too far from oracle',
        },
      }),
    ).toBe('Price too far from oracle');
  });

  it('extracts axios response data errors', () => {
    expect(
      extractHyperLiquidErrorMessage({
        response: {
          data: {
            status: 'err',
            response: 'Must deposit before performing actions. User: 0x00',
          },
        },
      }),
    ).toBe('Must deposit before performing actions. User: 0x00');
  });

  it('extracts embedded response JSON from wrapped messages', () => {
    expect(
      extractHyperLiquidErrorMessage(
        'Hyperliquid API error 8712: AxiosError, ERR_BAD_REQUEST, Request failed with status code 422, 422, Unprocessable Entity, {"status":"err","response":"Price too far from oracle"}',
      ),
    ).toBe('Price too far from oracle');
  });

  it('extracts trailing business messages from wrapped messages', () => {
    expect(
      extractHyperLiquidErrorMessage(
        'Hyperliquid API error 8712: AxiosError, ERR_BAD_REQUEST, Request failed with status code 422, 422, Unprocessable Entity, Price too far from oracle',
      ),
    ).toBe('Price too far from oracle');
  });

  it('keeps commas inside trailing business messages from wrapped messages', () => {
    expect(
      extractHyperLiquidErrorMessage(
        'Hyperliquid API error 8712: AxiosError, ERR_BAD_REQUEST, Request failed with status code 422, 422, Unprocessable Entity, Invalid order: reduce only, no position',
      ),
    ).toBe('Invalid order: reduce only, no position');
  });

  it('extracts order business messages from ApiRequestError wrappers', () => {
    expect(
      extractHyperLiquidErrorMessage(
        'Failed to place market order open: ApiRequestError: Order 0: Price too far from oracle asset=110029',
      ),
    ).toBe('Price too far from oracle');
  });

  it('does not reclassify regular errors without HyperLiquid payloads', () => {
    const error = new Error('Top level message');
    Object.assign(error, {
      cause: new Error('Nested cause message'),
    });

    expect(extractHyperLiquidErrorMessage(error)).toBeUndefined();
  });

  it('does not overflow on circular error causes', () => {
    const error = new Error('Top level message') as Error & {
      cause?: unknown;
    };
    error.cause = error;

    expect(extractHyperLiquidErrorMessage(error)).toBeUndefined();
  });

  it('resolves extracted messages through locale matchers', async () => {
    hyperLiquidErrorResolver.updateLocales([
      {
        i18nKey: 'perp_price_too_far',
        rawMessage: 'Price too far from oracle',
        localizedMessage: '价格偏离预言机',
        variables: [],
        matcher: {
          type: 'exact',
          value: 'Price too far from oracle',
        },
      },
    ]);

    const error = new Error('Hyperliquid API error 8712');
    Object.assign(error, {
      response: {
        status: 'err',
        response: 'Price too far from oracle',
      },
    });

    await expect(
      convertHyperLiquidResponse(() => Promise.reject(error)),
    ).rejects.toMatchObject({
      message: '价格偏离预言机',
    });
  });
});
