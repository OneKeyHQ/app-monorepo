import type {
  IApiErrorResponse,
  IOrderResponse,
} from '@onekeyhq/shared/types/hyperliquid/sdk';

import {
  buildHyperLiquidLogResult,
  dispatchHyperLiquidOrderLog,
} from './hyperliquid';

import type {
  HyperLiquidScene,
  IHyperLiquidLogParams,
  IHyperLiquidOrderRequestPayload,
} from './hyperliquid';

type IOrderLogPayload = IHyperLiquidLogParams<
  IHyperLiquidOrderRequestPayload,
  IOrderResponse | IApiErrorResponse
>;

describe('HyperLiquid analytics', () => {
  it('dispatches spot orders to the dedicated event', () => {
    const placeOrder = jest.fn();
    const placeSpotOrder = jest.fn();
    const scene = {
      placeOrder,
      placeSpotOrder,
    } as unknown as HyperLiquidScene;
    const payload = {} as IOrderLogPayload;

    dispatchHyperLiquidOrderLog({
      scene,
      action: 'placeSpotOrder',
      payload,
    });

    expect(placeSpotOrder).toHaveBeenCalledWith(payload);
    expect(placeOrder).not.toHaveBeenCalled();
  });

  it('builds consistent success and failure result fields', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1250);

    expect(buildHyperLiquidLogResult({ startedAt: 1000 })).toEqual({
      status: 'success',
      duration: 250,
    });

    const error = Object.assign(new Error('rejected'), { code: 'E_ORDER' });
    expect(buildHyperLiquidLogResult({ startedAt: 1000, error })).toEqual({
      status: 'fail',
      duration: 250,
      errorCode: 'E_ORDER',
    });
  });
});
