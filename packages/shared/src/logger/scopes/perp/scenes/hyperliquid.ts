import type {
  IApiErrorResponse,
  IApiRequestError,
  IApiRequestResult,
  ICancelResponse,
  IOrderParams,
  IOrderRequest,
  IOrderResponse,
  ISuccessResponse,
} from '@onekeyhq/shared/types/hyperliquid/sdk';
import type {
  IAgentApprovalRequest,
  IBuilderFeeRequest,
  ILeverageUpdateRequest,
  ISetReferrerRequest,
  IUpdateIsolatedMarginRequest,
  IWithdrawParams,
} from '@onekeyhq/shared/types/hyperliquid/types';

import { BaseScene } from '../../../base/baseScene';
import { LogToServer } from '../../../base/decorators';

export interface IHyperLiquidAccountContext {
  accountAddress: string | null;
  exchangeAccountAddress: string | null;
}

export interface IHyperLiquidLogParams<TRequest, TResponse>
  extends IHyperLiquidAccountContext {
  request: TRequest;
  response?: TResponse;
  error?: Record<string, unknown>;
  extra?: Record<string, unknown>;
}

export interface IHyperLiquidOrderRequestPayload {
  orders: IOrderParams[];
  grouping: IOrderRequest['grouping'];
  builder?: {
    b: `0x${string}`;
    f: number;
  } | null;
}

export class HyperLiquidScene extends BaseScene {
  @LogToServer()
  public setReferrer(
    params: IHyperLiquidLogParams<
      ISetReferrerRequest,
      IApiRequestResult | IApiErrorResponse
    >,
  ) {
    return params;
  }

  @LogToServer()
  public updateLeverage(
    params: IHyperLiquidLogParams<
      ILeverageUpdateRequest,
      { success: true } | IApiErrorResponse
    >,
  ) {
    return params;
  }

  @LogToServer()
  public updateIsolatedMargin(
    params: IHyperLiquidLogParams<
      IUpdateIsolatedMarginRequest,
      ISuccessResponse | IApiErrorResponse
    >,
  ) {
    return params;
  }

  @LogToServer()
  public approveBuilderFee(
    params: IHyperLiquidLogParams<
      IBuilderFeeRequest,
      IApiRequestResult | IApiErrorResponse
    >,
  ) {
    return params;
  }

  @LogToServer()
  public approveAgent(
    params: IHyperLiquidLogParams<
      IAgentApprovalRequest,
      IApiRequestResult | IApiErrorResponse
    >,
  ) {
    return params;
  }

  @LogToServer()
  public removeAgent(
    params: IHyperLiquidLogParams<
      IAgentApprovalRequest,
      IApiRequestResult | IApiErrorResponse
    >,
  ) {
    return params;
  }

  @LogToServer()
  public placeOrder(
    params: IHyperLiquidLogParams<
      IHyperLiquidOrderRequestPayload,
      IOrderResponse | IApiErrorResponse
    >,
  ) {
    return params;
  }

  @LogToServer()
  public orderOpen(
    params: IHyperLiquidLogParams<
      IHyperLiquidOrderRequestPayload,
      IOrderResponse | IApiErrorResponse
    >,
  ) {
    return params;
  }

  @LogToServer()
  public ordersClose(
    params: IHyperLiquidLogParams<
      IHyperLiquidOrderRequestPayload,
      IOrderResponse | IApiErrorResponse
    >,
  ) {
    return params;
  }

  @LogToServer()
  public multiOrder(
    params: IHyperLiquidLogParams<
      IHyperLiquidOrderRequestPayload,
      IOrderResponse | IApiErrorResponse
    >,
  ) {
    return params;
  }

  @LogToServer()
  public setPositionTpsl(
    params: IHyperLiquidLogParams<
      IHyperLiquidOrderRequestPayload,
      IOrderResponse | IApiErrorResponse
    >,
  ) {
    return params;
  }

  @LogToServer()
  public cancelOrder(
    params: IHyperLiquidLogParams<
      { cancels: Array<{ a: number; o: number }> },
      ICancelResponse | IApiErrorResponse
    >,
  ) {
    return params;
  }

  @LogToServer()
  public withdraw(
    params: IHyperLiquidLogParams<
      IWithdrawParams,
      { success: true } | IApiErrorResponse
    >,
  ) {
    return params;
  }
}

export type IHyperLiquidOrderAction =
  | 'placeOrder'
  | 'orderOpen'
  | 'ordersClose'
  | 'multiOrder'
  | 'setPositionTpsl';

export function dispatchHyperLiquidOrderLog({
  scene,
  action,
  payload,
}: {
  scene: HyperLiquidScene;
  action?: IHyperLiquidOrderAction;
  payload: IHyperLiquidLogParams<
    IHyperLiquidOrderRequestPayload,
    IOrderResponse | IApiErrorResponse
  >;
}) {
  const resolvedAction = action ?? 'placeOrder';
  switch (resolvedAction) {
    case 'orderOpen':
      scene.orderOpen(payload);
      break;
    case 'ordersClose':
      scene.ordersClose(payload);
      break;
    case 'multiOrder':
      scene.multiOrder(payload);
      break;
    case 'setPositionTpsl':
      scene.setPositionTpsl(payload);
      break;
    case 'placeOrder':
    default:
      scene.placeOrder(payload);
      break;
  }
}

export function extractHyperLiquidErrorResponse<T>(
  error: unknown,
): T | undefined {
  const requestError = error as IApiRequestError | undefined;
  if (requestError?.response) {
    return requestError.response as unknown as T;
  }
  return undefined;
}

export function serializeHyperLiquidError(
  error: unknown,
): Record<string, unknown> | undefined {
  if (!error) {
    return undefined;
  }

  const result: Record<string, unknown> = {};

  if (error instanceof Error) {
    result.name = error.name;
    result.message = error.message;
  } else if (typeof error === 'string') {
    result.message = error;
  } else {
    result.message = String(error);
  }

  const requestError = error as IApiRequestError | undefined;
  if (requestError?.response) {
    result.response = requestError.response;
  }
  // @ts-expect-error
  if (typeof requestError?.status !== 'undefined') {
    // @ts-expect-error
    result.status = requestError.status;
  }
  // @ts-expect-error
  if ('code' in (requestError ?? {}) && requestError?.code) {
    // @ts-expect-error
    result.code = requestError.code;
  }

  return result;
}
