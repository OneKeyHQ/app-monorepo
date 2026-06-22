import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IHyperLiquidApiFailureEndpoint } from '@onekeyhq/shared/src/logger/scopes/perp/scenes/hyperliquid';

import {
  createLoggedHyperLiquidClient,
  requestLoggedHyperLiquidTransport,
} from './logHyperLiquidApiFailure';

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    perp: {
      hyperliquid: {
        apiRequestFailure: jest.fn(),
      },
    },
  },
}));

function getApiRequestFailureMock() {
  return (
    defaultLogger.perp.hyperliquid as unknown as {
      apiRequestFailure: jest.Mock;
    }
  ).apiRequestFailure;
}

describe('logHyperLiquidApiFailure', () => {
  beforeEach(() => {
    getApiRequestFailureMock().mockClear();
  });

  it('allows soft fallback client actions to opt out of failure logs', async () => {
    const client = {
      soft: jest.fn(async () => {
        throw new OneKeyLocalError('soft read failed');
      }),
      hard: jest.fn(async () => {
        throw new OneKeyLocalError('hard read failed');
      }),
    };
    const loggedClient = createLoggedHyperLiquidClient(client, {
      endpoint: 'info',
      shouldLogFailure: ({ action }) => action !== 'soft',
    });

    await expect(loggedClient.soft()).rejects.toThrow('soft read failed');
    expect(getApiRequestFailureMock()).not.toHaveBeenCalled();

    await expect(loggedClient.hard()).rejects.toThrow('hard read failed');
    expect(getApiRequestFailureMock()).toHaveBeenCalledTimes(1);
    expect(getApiRequestFailureMock()).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'info',
        action: 'hard',
        message: 'hard read failed',
      }),
    );
  });

  it('logs direct transport error results without changing the result', async () => {
    const result = {
      status: 'err',
      response: 'Price too far from oracle',
    };
    const transport = {
      async request<TResult>(
        _endpoint: IHyperLiquidApiFailureEndpoint,
        _payload: unknown,
      ) {
        return result as TResult;
      },
    };

    await expect(
      requestLoggedHyperLiquidTransport(
        transport,
        'exchange',
        { action: { type: 'setReferrer' } },
        {
          action: 'setReferrer',
          extra: { source: 'test' },
        },
      ),
    ).resolves.toBe(result);

    expect(getApiRequestFailureMock()).toHaveBeenCalledTimes(1);
    expect(getApiRequestFailureMock()).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'exchange',
        action: 'setReferrer',
        response: result,
        message: 'Price too far from oracle',
        extra: { source: 'test' },
      }),
    );
  });

  it('does not log direct transport success results', async () => {
    const result = { status: 'ok', response: { type: 'default' } };
    const transport = {
      async request<TResult>(
        _endpoint: IHyperLiquidApiFailureEndpoint,
        _payload: unknown,
      ) {
        return result as TResult;
      },
    };

    await expect(
      requestLoggedHyperLiquidTransport(
        transport,
        'exchange',
        { action: { type: 'setReferrer' } },
        { action: 'setReferrer' },
      ),
    ).resolves.toBe(result);

    expect(getApiRequestFailureMock()).not.toHaveBeenCalled();
  });
});
