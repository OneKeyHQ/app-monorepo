// cspell:ignore rews
import type {
  IApiErrorResponse,
  IApiRequestError,
  IApiRequestResult,
  ICancelResponse,
  IModifyResponse,
  IOrderParams,
  IOrderRequest,
  IOrderResponse,
  ISuccessResponse,
  ITwapCancelResponse,
  ITwapOrderResponse,
} from '@onekeyhq/shared/types/hyperliquid/sdk';
import type {
  IAgentApprovalRequest,
  IBuilderFeeRequest,
  ICancelTwapOrderParams,
  ILeverageUpdateRequest,
  IPlaceTwapOrderParams,
  ISetReferrerRequest,
  IUpdateIsolatedMarginRequest,
  IWithdrawParams,
} from '@onekeyhq/shared/types/hyperliquid/types';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export interface IHyperLiquidAccountContext {
  accountAddress: string | null;
  exchangeAccountAddress: string | null;
}

export interface IHyperLiquidLogParams<
  TRequest,
  TResponse,
> extends IHyperLiquidAccountContext {
  request: TRequest;
  response?: TResponse;
  error?: Record<string, unknown>;
  extra?: Record<string, unknown>;
  isFirstTime?: boolean;
}

export type IHyperLiquidApiFailureEndpoint = 'info' | 'exchange';

export interface IHyperLiquidApiFailureLogParams extends Partial<IHyperLiquidAccountContext> {
  endpoint: IHyperLiquidApiFailureEndpoint;
  action: string;
  request?: unknown;
  response?: unknown;
  error?: Record<string, unknown>;
  message?: string;
  extra?: Record<string, unknown>;
}

function stripSensitiveFields<TRequest, TResponse>(
  params: IHyperLiquidLogParams<TRequest, TResponse>,
) {
  const { accountAddress, exchangeAccountAddress, ...rest } = params;
  void accountAddress;
  void exchangeAccountAddress;
  return rest;
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
  @LogToLocal({ level: 'error' })
  public apiRequestFailure(params: IHyperLiquidApiFailureLogParams) {
    return params;
  }

  @LogToServer()
  public setReferrer(
    params: IHyperLiquidLogParams<
      ISetReferrerRequest,
      IApiRequestResult | IApiErrorResponse
    >,
  ) {
    return stripSensitiveFields(params);
  }

  @LogToServer()
  public updateLeverage(
    params: IHyperLiquidLogParams<
      ILeverageUpdateRequest,
      { success: true } | IApiErrorResponse
    >,
  ) {
    return stripSensitiveFields(params);
  }

  @LogToServer()
  public updateIsolatedMargin(
    params: IHyperLiquidLogParams<
      IUpdateIsolatedMarginRequest,
      ISuccessResponse | IApiErrorResponse
    >,
  ) {
    return stripSensitiveFields(params);
  }

  @LogToServer()
  public approveBuilderFee(
    params: IHyperLiquidLogParams<
      IBuilderFeeRequest,
      IApiRequestResult | IApiErrorResponse
    >,
  ) {
    return stripSensitiveFields(params);
  }

  @LogToServer()
  public approveAgent(
    params: IHyperLiquidLogParams<
      IAgentApprovalRequest,
      IApiRequestResult | IApiErrorResponse
    >,
  ) {
    return stripSensitiveFields(params);
  }

  @LogToServer()
  public removeAgent(
    params: IHyperLiquidLogParams<
      IAgentApprovalRequest,
      IApiRequestResult | IApiErrorResponse
    >,
  ) {
    return stripSensitiveFields(params);
  }

  @LogToServer()
  public placeOrder(
    params: IHyperLiquidLogParams<
      IHyperLiquidOrderRequestPayload,
      IOrderResponse | IApiErrorResponse
    >,
  ) {
    return stripSensitiveFields(params);
  }

  @LogToServer()
  public orderOpen(
    params: IHyperLiquidLogParams<
      IHyperLiquidOrderRequestPayload,
      IOrderResponse | IApiErrorResponse
    >,
  ) {
    return stripSensitiveFields(params);
  }

  @LogToServer()
  public perpTermsAgree() {
    return {};
  }

  @LogToServer()
  public perpTermsReject() {
    return {};
  }

  @LogToServer()
  public ordersClose(
    params: IHyperLiquidLogParams<
      IHyperLiquidOrderRequestPayload,
      IOrderResponse | IApiErrorResponse
    >,
  ) {
    return stripSensitiveFields(params);
  }

  @LogToServer()
  public multiOrder(
    params: IHyperLiquidLogParams<
      IHyperLiquidOrderRequestPayload,
      IOrderResponse | IApiErrorResponse
    >,
  ) {
    return stripSensitiveFields(params);
  }

  @LogToServer()
  public setPositionTpsl(
    params: IHyperLiquidLogParams<
      IHyperLiquidOrderRequestPayload,
      IOrderResponse | IApiErrorResponse
    >,
  ) {
    return stripSensitiveFields(params);
  }

  @LogToServer()
  public orderTrigger(
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
    return stripSensitiveFields(params);
  }

  @LogToServer()
  public modifyOrder(
    params: IHyperLiquidLogParams<
      { oid: number; order: IOrderParams },
      IModifyResponse | IApiErrorResponse
    >,
  ) {
    return stripSensitiveFields(params);
  }

  @LogToServer()
  public twapOrder(
    params: IHyperLiquidLogParams<
      { twap: Omit<IPlaceTwapOrderParams, 'szDecimals'> },
      ITwapOrderResponse | IApiErrorResponse
    >,
  ) {
    return stripSensitiveFields(params);
  }

  @LogToServer()
  public twapCancel(
    params: IHyperLiquidLogParams<
      ICancelTwapOrderParams,
      ITwapCancelResponse | IApiErrorResponse
    >,
  ) {
    return stripSensitiveFields(params);
  }

  @LogToServer()
  public withdraw(
    params: IHyperLiquidLogParams<
      IWithdrawParams,
      { success: true } | IApiErrorResponse
    >,
  ) {
    return stripSensitiveFields(params);
  }

  // ============ Referral Binding Flow Logs ============

  /**
   * Log referral promotion checkbox user interaction
   */
  @LogToServer()
  @LogToLocal()
  public referralCheckboxInteraction(params: {
    userAddress: string;
    isChecked: boolean;
    action: 'shown' | 'checked' | 'unchecked';
  }) {
    const { userAddress, ...rest } = params;
    void userAddress;
    return rest;
  }

  /**
   * Log referral binding flow step
   */
  @LogToLocal()
  public referralBindingStep(params: {
    step:
      | 'start'
      | 'build_typed_data'
      | 'sign_message'
      | 'submit_request'
      | 'complete'
      | 'error';
    userAddress: string;
    message?: string;
    error?: string;
  }) {
    return params;
  }

  /**
   * Log referral binding result to server
   */
  @LogToServer()
  public referralBindingResult(params: {
    userAddress: string;
    success: boolean;
    referralCode: string;
    errorMessage?: string;
  }) {
    const { userAddress, ...rest } = params;
    void userAddress;
    return rest;
  }

  /**
   * Log referral promotion condition check
   */
  @LogToLocal({ level: 'info' })
  public referralConditionCheck(params: {
    userAddress: string;
    condition: string;
    passed: boolean;
    reason?: string;
  }) {
    return params;
  }

  // ============ WebSocket Subscription Lifecycle Logs ============

  /**
   * Defensive log for the socket "open" handler async body.
   * Emitted when the open handler's body throws/rejects — caught to prevent
   * unhandled rejection from escalating into a fatal RuntimeScheduler error.
   */
  @LogToLocal({ level: 'error' })
  public subscriptionSocketOpenError(params: { error: unknown }) {
    return params;
  }

  /**
   * Defensive log for the WS subscription message hot path.
   * Emitted when _handleSubscriptionData throws synchronously inside the
   * SDK's HyperliquidEventTarget dispatch. Hyperliquid streams up to ~10
   * L2 book updates per second; any uncaught throw here would propagate
   * via dispatchEvent → fatal RuntimeScheduler task → SIGABRT.
   */
  @LogToLocal({ level: 'error' })
  public subscriptionHandlerError(params: { type: string; error: unknown }) {
    return params;
  }

  /**
   * Trace log for socket transport dispose — fires when ServiceHyperliquid
   * tears down the rews ReconnectingWebSocket. Useful to correlate orphan
   * timer cleanup with rapid Perp/Discovery tab switching scenarios.
   */
  @LogToLocal({ level: 'info' })
  public subscriptionTransportDispose(params: { clientId: string }) {
    return params;
  }

  /**
   * Defensive log for inner SDK SubscriptionClient dispose errors.
   */
  @LogToLocal({ level: 'error' })
  public subscriptionInnerClientDisposeError(params: { error: unknown }) {
    return params;
  }

  /**
   * Local-only diagnostics for non-blocking cold-start market snapshot writes.
   */
  @LogToLocal({ level: 'error' })
  public cacheSnapshotError(params: {
    type:
      | 'active_asset_ctx_simple_db'
      | 'all_dexs_asset_ctxs_simple_db'
      | 'l2_book_simple_db'
      | 'l2_book_swr'
      | 'l2_book_ui_cache';
    error: unknown;
  }) {
    return params;
  }

  /**
   * Local-only diagnostics for non-blocking cold-start initialization steps.
   */
  @LogToLocal({ level: 'error' })
  public coldStartInitializationError(params: {
    type:
      | 'refresh_trading_meta'
      | 'refresh_spot_meta'
      | 'active_asset_ctx_snapshot'
      | 'active_asset_ctx_cache';
    coin?: string;
    error: unknown;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public coldStartBenchmark(params: {
    tag: 'PerpsColdStartBenchmark';
    label: string;
    elapsed: number;
    sessionId: number;
    detail?: Record<string, unknown>;
  }) {
    return params;
  }
}

export type IHyperLiquidOrderAction =
  | 'placeOrder'
  | 'placeSpotOrder'
  | 'orderOpen'
  | 'orderTrigger'
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
    case 'orderTrigger':
      scene.orderTrigger(payload);
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
