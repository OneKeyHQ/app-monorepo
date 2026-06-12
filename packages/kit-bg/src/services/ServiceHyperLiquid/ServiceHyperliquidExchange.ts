import { ExchangeClient, HttpTransport } from '@nktkas/hyperliquid';
import { BigNumber } from 'bignumber.js';
import { isNumber } from 'lodash';

import type { ICoreHyperLiquidAgentCredential } from '@onekeyhq/core/src/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  DISABLE_PERPS_WALLET_BIND,
  type EHyperLiquidAgentName,
  PERPS_EMPTY_ADDRESS,
  PERPS_EVM_CHAIN_ID_HEX,
} from '@onekeyhq/shared/src/consts/perp';
import {
  OneKeyLocalError,
  WatchedAccountTradeError,
} from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  dispatchHyperLiquidOrderLog,
  extractHyperLiquidErrorResponse,
  serializeHyperLiquidError,
} from '@onekeyhq/shared/src/logger/scopes/perp/scenes/hyperliquid';
import type {
  IHyperLiquidOrderAction,
  IHyperLiquidOrderRequestPayload,
} from '@onekeyhq/shared/src/logger/scopes/perp/scenes/hyperliquid';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { convertHyperLiquidResponse } from '@onekeyhq/shared/src/utils/hyperLiquidErrorResolver';
import {
  assertValidScaleOrderLegs,
  buildScaleOrderLegs,
} from '@onekeyhq/shared/src/utils/hyperliquidScaleOrderUtils';
import {
  MAX_DECIMALS_PERP,
  formatHlPrice,
  formatHlSize,
  formatPriceToSignificantDigits,
  formatSpotPriceToValid,
  getValidPriceDecimals,
  mapTriggerOrderType,
  parseSignatureToRSV,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import { SPOT_ASSET_ID_OFFSET } from '@onekeyhq/shared/types/hyperliquid/perp.constants';
import type {
  IApiErrorResponse,
  IApiRequestResult,
  ICancelResponse,
  IHex,
  IModifyResponse,
  IOrderParams,
  IOrderRequest,
  IOrderResponse,
  ISuccessResponse,
  ITIF,
  ITwapCancelResponse,
  ITwapOrderResponse,
} from '@onekeyhq/shared/types/hyperliquid/sdk';
import type {
  IAgentApprovalRequest,
  IBuilderFeeRequest,
  ICancelOrderParams,
  ICancelTwapOrderParams,
  ILeverageUpdateRequest,
  IModifyOrderParams,
  IOrderCloseParams,
  IOrderOpenParams,
  IPlaceOrderParams,
  IPlaceScaleOrderParams,
  IPlaceTwapOrderParams,
  IPositionTpslOrderParams,
  ISetReferrerRequest,
  ISpotDustingOptOutRequest,
  ISpotOrderParams,
  ITriggerOrderParams,
  IUpdateIsolatedMarginRequest,
  IWithdrawParams,
} from '@onekeyhq/shared/types/hyperliquid/types';
import type { IHyperLiquidSignatureRSV } from '@onekeyhq/shared/types/hyperliquid/webview';
import { ERookieTaskType } from '@onekeyhq/shared/types/rookieGuide';

import {
  perpsActiveAccountAtom,
  perpsActiveAccountStatusAtom,
} from '../../states/jotai/atoms';
import ServiceBase from '../ServiceBase';

import { createLoggedHyperLiquidClient } from './utils/logHyperLiquidApiFailure';

import type {
  WalletHyperliquidOnekey,
  WalletHyperliquidProxy,
} from './ServiceHyperliquidWallet';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';

interface IOrderLogOptions {
  action?: IHyperLiquidOrderAction;
  originalParams?: unknown;
  extra?: Record<string, unknown>;
}

interface IOrderAssetPrecision {
  szDecimals: number;
  type: 'perp' | 'spot';
}

function isUserLimitTif(value: unknown): value is ITIF {
  return value === 'Gtc' || value === 'Ioc' || value === 'Alo';
}

function normalizeUserLimitTif(value: unknown): ITIF {
  return isUserLimitTif(value) ? value : 'Gtc';
}

type IOrderAssetId = IOrderParams['a'];

interface IOrderLogContext {
  accountAddress: string | null;
  exchangeAccountAddress: string | null;
}

// TV lowercases everything; HL universe keys perps as `BTC`, spot as `@N`,
// and sub-DEX as `xyz:<TICKER>` (lowercase prefix, uppercase ticker).
function normalizePerpsCoin(coin: string): string {
  if (!coin) return coin;
  if (coin.startsWith('@')) return coin;
  const xyzMatch = coin.match(/^xyz:(.*)$/i);
  if (xyzMatch) return `xyz:${xyzMatch[1].toUpperCase()}`;
  return coin.toUpperCase();
}

@backgroundClass()
export default class ServiceHyperliquidExchange extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: IBackgroundApi }) {
    super({ backgroundApi });
  }

  private _account: string | null = null;

  private _exchangeClient: ExchangeClient | null = null;

  private _wallet: WalletHyperliquidProxy | WalletHyperliquidOnekey | null =
    null;

  private _builderFeeInfo:
    | {
        b: `0x${string}`;
        f: number;
      }
    | undefined = undefined;

  // TODO: Apply to all trades and allow user configuration
  public slippage = 0.08;

  private get exchangeClient(): ExchangeClient {
    if (!this._account || !this._exchangeClient) {
      throw new OneKeyLocalError(
        'Exchange client not setup. Call setup() first.',
      );
    }
    return this._exchangeClient;
  }

  private _createLoggedExchangeClient(client: ExchangeClient): ExchangeClient {
    return createLoggedHyperLiquidClient(client, {
      endpoint: 'exchange',
      context: () => this._buildLogContext(),
      extra: { source: 'ServiceHyperliquidExchange' },
    });
  }

  private _calculateSlippagePrice(params: {
    markPrice: string;
    isBuy: boolean;
    slippage: number;
    szDecimals?: number;
  }): string {
    const price = new BigNumber(params.markPrice);
    const slippageMultiplier = params.isBuy
      ? new BigNumber(1).plus(params.slippage)
      : new BigNumber(1).minus(params.slippage);
    const adjustedPrice = price.multipliedBy(slippageMultiplier);
    return formatHlPrice(adjustedPrice, params.szDecimals ?? 0) || '0';
  }

  private async _getOrderAssetPrecisionMap(
    assetIds: IOrderAssetId[],
  ): Promise<Map<IOrderAssetId, IOrderAssetPrecision>> {
    const idSet = new Set(assetIds);
    const precisionMap = new Map<IOrderAssetId, IOrderAssetPrecision>();
    if (idSet.size === 0) {
      return precisionMap;
    }

    const [{ universesByDex }, { universes: spotUniverses }] =
      await Promise.all([
        this.backgroundApi.simpleDb.perp.getTradingUniverse(),
        this.backgroundApi.simpleDb.perp.getSpotMeta(),
      ]);

    for (const universes of universesByDex) {
      for (const universe of universes ?? []) {
        if (idSet.has(universe.assetId)) {
          precisionMap.set(universe.assetId, {
            szDecimals: universe.szDecimals,
            type: 'perp',
          });
        }
      }
    }

    for (const universe of spotUniverses) {
      if (idSet.has(universe.assetId)) {
        precisionMap.set(universe.assetId, {
          szDecimals: universe.baseSzDecimals,
          type: 'spot',
        });
      }
    }

    return precisionMap;
  }

  private async _formatOrdersForHyperLiquid(
    orders: IOrderParams[],
    options?: {
      allowZeroSize?: boolean;
    },
  ): Promise<IOrderParams[]> {
    const precisionMap = await this._getOrderAssetPrecisionMap(
      orders.map((order) => order.a),
    );

    return orders.map((order) => {
      const precision = precisionMap.get(order.a);
      if (!precision) {
        return order;
      }

      const price = formatHlPrice(
        order.p,
        precision.szDecimals,
        precision.type,
      );
      const size =
        options?.allowZeroSize && new BigNumber(order.s).isZero()
          ? '0'
          : formatHlSize(order.s, precision.szDecimals);
      if (!price) {
        throw new OneKeyLocalError('Order price is too small for HL tick size');
      }
      if (!size) {
        throw new OneKeyLocalError('Order size is too small for HL lot size');
      }
      const t =
        'trigger' in order.t
          ? {
              trigger: {
                ...order.t.trigger,
                triggerPx: formatHlPrice(
                  order.t.trigger.triggerPx,
                  precision.szDecimals,
                  precision.type,
                ),
              },
            }
          : order.t;

      if ('trigger' in t && !t.trigger.triggerPx) {
        throw new OneKeyLocalError(
          'Trigger price is too small for HL tick size',
        );
      }

      return {
        ...order,
        p: price,
        s: size,
        t,
      };
    });
  }

  private async _buildLogContext() {
    const activeAccount = await perpsActiveAccountAtom.get();
    return {
      accountAddress: activeAccount?.accountAddress ?? null,
      exchangeAccountAddress: this._account,
    };
  }

  private _getOrderOpenFirstTimeKey(context: IOrderLogContext) {
    return (
      context.accountAddress ??
      context.exchangeAccountAddress ??
      ''
    ).toLowerCase();
  }

  private async _resolveOrderOpenIsFirstTime(
    options: IOrderLogOptions,
    context: IOrderLogContext,
  ) {
    if (options.action !== 'orderOpen') {
      return undefined;
    }
    try {
      const key = this._getOrderOpenFirstTimeKey(context);
      if (!key) {
        return true;
      }
      return await this.backgroundApi.simpleDb.perp.isFirstPerpOrderOpen(key);
    } catch (error) {
      console.error(error);
      return undefined;
    }
  }

  private async _markOrderOpenSucceeded(
    options: IOrderLogOptions,
    context: IOrderLogContext,
    isFirstTime: boolean | undefined,
  ) {
    if (options.action !== 'orderOpen' || !isFirstTime) {
      return;
    }
    const key = this._getOrderOpenFirstTimeKey(context);
    if (!key) {
      return;
    }
    try {
      await this.backgroundApi.simpleDb.perp.markPerpOrderOpen(key);
    } catch (error) {
      console.error(error);
    }
  }

  private _composeOrderLogExtra(options: IOrderLogOptions) {
    const extra: Record<string, unknown> = {
      ...options.extra,
    };
    if (typeof options.originalParams !== 'undefined') {
      extra.originalParams = options.originalParams;
    }
    return Object.keys(extra).length > 0 ? extra : undefined;
  }

  @backgroundMethod()
  async setup(params: {
    userAddress: IHex | undefined;
    userAccountId?: string;
    agentCredential?: ICoreHyperLiquidAgentCredential;
  }): Promise<void> {
    try {
      const { hyperliquidBuilderAddress, hyperliquidMaxBuilderFee } =
        await this.backgroundApi.simpleDb.perp.getPerpData();
      if (
        hyperliquidBuilderAddress &&
        !Number.isNaN(hyperliquidMaxBuilderFee) &&
        isNumber(hyperliquidMaxBuilderFee)
      ) {
        this._builderFeeInfo = {
          b: hyperliquidBuilderAddress.toLowerCase() as `0x${string}`,
          f: hyperliquidMaxBuilderFee,
        };
      }
      if (!params.userAddress) {
        throw new OneKeyLocalError(
          'ServiceHyperliquidExchange.setup Error: User address is required',
        );
      }

      const transport = new HttpTransport();

      let wallet: WalletHyperliquidProxy | WalletHyperliquidOnekey;
      let account: string;

      if (params.userAccountId) {
        wallet =
          await this.backgroundApi.serviceHyperliquidWallet.getOnekeyWallet({
            userAccountId: params.userAccountId,
          });
        account = params.userAddress;
      } else {
        const proxyWallet =
          await this.backgroundApi.serviceHyperliquidWallet.getProxyWallet({
            agentCredential: params.agentCredential,
          });
        wallet = proxyWallet.wallet;
        account = proxyWallet.address;
      }

      this._exchangeClient = this._createLoggedExchangeClient(
        new ExchangeClient({
          transport,
          wallet,
          signatureChainId: PERPS_EVM_CHAIN_ID_HEX,
        }),
      );

      this._account = account;
      this._wallet = wallet;
    } catch (error) {
      throw new OneKeyLocalError(
        `Failed to setup exchange client: ${String(error)}`,
      );
    }
  }

  /**
   * Check if agent is ready based on local status only
   */
  private async _ensureAgentReady(): Promise<boolean> {
    const accountStatus = await perpsActiveAccountStatusAtom.get();
    const isAtomReady = Boolean(
      accountStatus?.details?.agentOk && accountStatus?.canTrade,
    );
    if (isAtomReady) {
      return true;
    }

    return false;
  }

  /**
   * Get exchange client for trading operations with automatic agent authorization
   */
  private async getExchangeClientForTrading(): Promise<ExchangeClient> {
    const isReady = await this._ensureAgentReady();

    if (!isReady) {
      throw new OneKeyLocalError(
        'Agent authorization required. Please enable trading first.',
      );
    }

    return this.exchangeClient;
  }

  @backgroundMethod()
  async setReferrerCode(params: ISetReferrerRequest) {
    await this.checkAccountCanTrade();
    const context = await this._buildLogContext();
    try {
      const response = await convertHyperLiquidResponse(() =>
        this.exchangeClient.setReferrer(params),
      );
      defaultLogger.perp.hyperliquid.setReferrer({
        ...context,
        request: params,
        response,
      });
      return response;
    } catch (error) {
      defaultLogger.perp.hyperliquid.setReferrer({
        ...context,
        request: params,
        response: extractHyperLiquidErrorResponse<
          IApiRequestResult | IApiErrorResponse
        >(error),
        error: serializeHyperLiquidError(error),
      });
      throw error;
    }
  }

  @backgroundMethod()
  async updateLeverage(params: ILeverageUpdateRequest): Promise<void> {
    await this.checkAccountCanTrade();

    const client = await this.getExchangeClientForTrading();
    const context = await this._buildLogContext();
    try {
      await convertHyperLiquidResponse(() => client.updateLeverage(params));
      defaultLogger.perp.hyperliquid.updateLeverage({
        ...context,
        request: params,
        response: { success: true },
      });
    } catch (error) {
      defaultLogger.perp.hyperliquid.updateLeverage({
        ...context,
        request: params,
        response: extractHyperLiquidErrorResponse<IApiErrorResponse>(error),
        error: serializeHyperLiquidError(error),
      });
      throw error;
    }
  }

  @backgroundMethod()
  async updateIsolatedMargin(
    params: IUpdateIsolatedMarginRequest,
  ): Promise<void> {
    await this.checkAccountCanTrade();

    const client = await this.getExchangeClientForTrading();
    const context = await this._buildLogContext();
    try {
      const response = await convertHyperLiquidResponse(() =>
        client.updateIsolatedMargin(params),
      );
      defaultLogger.perp.hyperliquid.updateIsolatedMargin({
        ...context,
        request: params,
        response,
      });
    } catch (error) {
      defaultLogger.perp.hyperliquid.updateIsolatedMargin({
        ...context,
        request: params,
        response: extractHyperLiquidErrorResponse<IApiErrorResponse>(error),
        error: serializeHyperLiquidError(error),
      });
      throw error;
    }
  }

  @backgroundMethod()
  async approveBuilderFee(params: IBuilderFeeRequest) {
    await this.checkAccountCanTrade();
    const context = await this._buildLogContext();
    try {
      const response = await this.exchangeClient.approveBuilderFee(params);
      defaultLogger.perp.hyperliquid.approveBuilderFee({
        ...context,
        request: params,
        response,
      });
      return response;
    } catch (error) {
      defaultLogger.perp.hyperliquid.approveBuilderFee({
        ...context,
        request: params,
        response: extractHyperLiquidErrorResponse<
          IApiRequestResult | IApiErrorResponse
        >(error),
        error: serializeHyperLiquidError(error),
      });
      const errStr = String(error);
      // Abstract Wallet Error
      if (errStr.includes('Failed to sign typed data')) {
        throw new OneKeyLocalError({
          message: appLocale.intl.formatMessage({
            id: ETranslations.perps_connection_error,
          }),
        });
      }
      // Hyperliquid Error
      else if (errStr.includes('Too many builders approved')) {
        throw new OneKeyLocalError({
          message: appLocale.intl.formatMessage({
            id: ETranslations.perps_builder_max_error,
          }),
        });
      }
      throw new OneKeyLocalError({
        message: appLocale.intl.formatMessage({
          id: ETranslations.global_unknown_error,
        }),
      });
    }
  }

  @backgroundMethod()
  async setSpotDustingOptOut(
    params: ISpotDustingOptOutRequest,
  ): Promise<ISuccessResponse> {
    await this.checkAccountCanTrade();

    const client = await this.getExchangeClientForTrading();
    const context = await this._buildLogContext();
    try {
      const response = await convertHyperLiquidResponse(() =>
        client.spotUser({ toggleSpotDusting: params }),
      );
      defaultLogger.perp.hyperliquid.setSpotDustingOptOut({
        ...context,
        request: params,
        response,
      });
      await this.backgroundApi.serviceHyperliquid.updateSpotDustingOptOutStatus(
        {
          accountAddress: context.accountAddress,
          optOut: params.optOut,
          source: 'local',
        },
      );
      return response;
    } catch (error) {
      defaultLogger.perp.hyperliquid.setSpotDustingOptOut({
        ...context,
        request: params,
        response: extractHyperLiquidErrorResponse<
          ISuccessResponse | IApiErrorResponse
        >(error),
        error: serializeHyperLiquidError(error),
      });
      throw error;
    }
  }

  @backgroundMethod()
  async extractAgentSignature(): Promise<{
    action: {
      type: string;
      signatureChainId: string;
      hyperliquidChain: string;
      agentAddress: string;
      agentName: string;
      nonce: number;
    };
    signature: IHyperLiquidSignatureRSV;
    nonce: number;
    signerAddress: string;
  } | null> {
    const wallet = this._wallet;

    const signedData = (
      wallet as WalletHyperliquidOnekey
    )?.getTempSignatureAndClear();
    if (
      !signedData?.value ||
      typeof signedData.signatureHex !== 'string' ||
      !signedData.signerAddress
    ) {
      return null;
    }

    const { value, signatureHex, signerAddress } = signedData;

    // These fields are NOT part of the signed EIP-712 message in SDK > 0.24.x,
    // so reading them from `value` is unreliable. Use stable constants instead.
    const actionType = 'approveAgent';
    const signatureChainId = PERPS_EVM_CHAIN_ID_HEX;
    // Only extract approveAgent signatures
    return {
      action: {
        type: actionType,
        signatureChainId,
        hyperliquidChain: value.hyperliquidChain as string,
        agentAddress: value.agentAddress as string,
        agentName: value.agentName as string,
        nonce: value.nonce as number,
      },
      signature: parseSignatureToRSV(signatureHex),
      nonce: value.nonce as number,
      signerAddress,
    };
  }

  @backgroundMethod()
  async approveAgent(params: IAgentApprovalRequest) {
    await this.checkAccountCanTrade();
    const requestPayload = {
      agentAddress: params.agent,
      agentName: params.agentName || null,
    };
    const context = await this._buildLogContext();
    try {
      const response = await convertHyperLiquidResponse(() =>
        this.exchangeClient.approveAgent(requestPayload),
      );
      defaultLogger.perp.hyperliquid.approveAgent({
        ...context,
        request: params,
        response,
        extra: {
          requestPayload,
          operation: params.authorize ? 'authorize' : 'revoke',
        },
      });

      // Extract signature and report to backend after successful approval
      if (
        !DISABLE_PERPS_WALLET_BIND &&
        params.authorize &&
        response.status === 'ok' &&
        response.response.type === 'default'
      ) {
        try {
          const signatureInfo = await this.extractAgentSignature();
          if (signatureInfo) {
            void this.backgroundApi.serviceHyperliquid.reportAgentApprovalToBackend(
              signatureInfo,
            );
            void this.backgroundApi.serviceHyperliquid.notifyHyperliquidAccountBind(
              {
                signerAddress: signatureInfo.signerAddress,
                action: signatureInfo.action,
                nonce: signatureInfo.nonce,
                signature: signatureInfo.signature,
              },
            );
          }
        } catch (error) {
          console.error('Failed to extract agent signature:', error);
        }
      }

      return response;
    } catch (error) {
      defaultLogger.perp.hyperliquid.approveAgent({
        ...context,
        request: params,
        response: extractHyperLiquidErrorResponse<
          IApiRequestResult | IApiErrorResponse
        >(error),
        error: serializeHyperLiquidError(error),
        extra: {
          requestPayload,
          operation: params.authorize ? 'authorize' : 'revoke',
        },
      });
      throw error;
    }
  }

  @backgroundMethod()
  async removeAgent(params: { agentName: EHyperLiquidAgentName | undefined }) {
    await this.checkAccountCanTrade();
    const request: IAgentApprovalRequest = {
      agent: PERPS_EMPTY_ADDRESS,
      agentName: params.agentName,
      authorize: true,
    };
    const requestPayload = {
      agentAddress: PERPS_EMPTY_ADDRESS,
      agentName: params.agentName || null,
    };
    const context = await this._buildLogContext();
    try {
      const response = await convertHyperLiquidResponse(() =>
        this.exchangeClient.approveAgent(requestPayload),
      );
      defaultLogger.perp.hyperliquid.removeAgent({
        ...context,
        request,
        response,
        extra: {
          requestPayload,
          operation: 'remove',
        },
      });
      return response;
    } catch (error) {
      defaultLogger.perp.hyperliquid.removeAgent({
        ...context,
        request,
        response: extractHyperLiquidErrorResponse<
          IApiRequestResult | IApiErrorResponse
        >(error),
        error: serializeHyperLiquidError(error),
        extra: {
          requestPayload,
          operation: 'remove',
        },
      });
      throw error;
    }
  }

  @backgroundMethod()
  async getAccount(): Promise<string | null> {
    return this._account;
  }

  @backgroundMethod()
  async placeOrderRaw(
    {
      orders,
      grouping,
    }: {
      orders: IOrderParams[];
      grouping: IOrderRequest['grouping'];
    },
    options: IOrderLogOptions = {},
  ): Promise<IOrderResponse> {
    await this.checkAccountCanTrade();

    const formattedOrders = await this._formatOrdersForHyperLiquid(orders, {
      allowZeroSize: grouping === 'positionTpsl',
    });
    const client = await this.getExchangeClientForTrading();
    const requestPayload: IHyperLiquidOrderRequestPayload = {
      orders: formattedOrders,
      grouping,
      builder: this._builderFeeInfo ?? null,
    };
    const context = await this._buildLogContext();
    const extra = this._composeOrderLogExtra(options);
    const isFirstTime = await this._resolveOrderOpenIsFirstTime(
      options,
      context,
    );
    const firstTimePayload =
      typeof isFirstTime === 'boolean' ? { isFirstTime } : {};
    try {
      const response = await convertHyperLiquidResponse(() =>
        client.order({
          orders: formattedOrders,
          grouping,
          builder: this._builderFeeInfo,
        }),
      );
      dispatchHyperLiquidOrderLog({
        scene: defaultLogger.perp.hyperliquid,
        action: options.action,
        payload: {
          ...context,
          ...firstTimePayload,
          request: requestPayload,
          response,
          extra,
        },
      });
      // Record PERPS task completion for rookie guide
      void this.backgroundApi.serviceRookieGuide.recordTaskCompleted(
        ERookieTaskType.PERPS,
      );
      await this._markOrderOpenSucceeded(options, context, isFirstTime);
      return response;
    } catch (error) {
      dispatchHyperLiquidOrderLog({
        scene: defaultLogger.perp.hyperliquid,
        action: options.action,
        payload: {
          ...context,
          ...firstTimePayload,
          request: requestPayload,
          response: extractHyperLiquidErrorResponse<
            IOrderResponse | IApiErrorResponse
          >(error),
          error: serializeHyperLiquidError(error),
          extra,
        },
      });
      this.backgroundApi.serviceHyperliquid.fetchExtraAgentsWithCache.clear();
      this.backgroundApi.serviceHyperliquid.getUserApprovedMaxBuilderFeeWithCache.clear();
      throw error;
    }
  }

  @backgroundMethod()
  async isSetup(): Promise<boolean> {
    return this._account !== null && this._exchangeClient !== null;
  }

  async dispose(): Promise<void> {
    this._account = null;
    this._exchangeClient = null;
    this._builderFeeInfo = undefined;
    this._wallet = null;
  }

  async checkAccountCanTrade() {
    const selectedAccount = await perpsActiveAccountAtom.get();
    if (selectedAccount.accountAddress && selectedAccount.accountId) {
      if (
        accountUtils.isWatchingAccount({ accountId: selectedAccount.accountId })
      ) {
        throw new WatchedAccountTradeError();
      }
    }
  }

  @backgroundMethod()
  async placeOrder(params: IPlaceOrderParams): Promise<IOrderResponse> {
    await this.checkAccountCanTrade();
    try {
      const price = params.limitPx || '0';

      if (
        'market' in params.orderType &&
        (!params.limitPx || params.limitPx === '0')
      ) {
        throw new OneKeyLocalError(
          'Market orders require current market price - not implemented yet',
        );
      }

      const orderParams: IOrderParams = {
        a: params.assetId,
        b: params.isBuy,
        p: price,
        s: params.sz,
        r: params.reduceOnly || false,
        t:
          'limit' in params.orderType
            ? {
                limit: {
                  tif: normalizeUserLimitTif(params.orderType.limit.tif),
                },
              }
            : {
                limit: { tif: 'Ioc' },
              },
      };

      const response = await this.placeOrderRaw(
        {
          orders: [orderParams],
          grouping: 'na',
        },
        {
          action: 'placeOrder',
          originalParams: params,
          extra: {
            reduceOnly: Boolean(params.reduceOnly),
          },
        },
      );
      return response;
    } catch (error) {
      throw new OneKeyLocalError(`Failed to place order: ${String(error)}`);
    }
  }

  @backgroundMethod()
  async placeScaleOrder(
    params: IPlaceScaleOrderParams,
  ): Promise<IOrderResponse> {
    await this.checkAccountCanTrade();
    if (!this._account) {
      throw new OneKeyLocalError(
        'Exchange client not setup. Call setup() first.',
      );
    }

    const szDecimals = params.szDecimals ?? 2;
    const side = params.isBuy ? 'long' : 'short';
    const assetType =
      params.assetType ??
      (params.assetId >= SPOT_ASSET_ID_OFFSET ? 'spot' : 'perp');
    const tif =
      assetType === 'spot' ? 'Gtc' : normalizeUserLimitTif(params.tif);
    if (assetType === 'spot' && params.assetId < SPOT_ASSET_ID_OFFSET) {
      throw new OneKeyLocalError(
        `placeScaleOrder: invalid spot assetId ${params.assetId}, must be >= ${SPOT_ASSET_ID_OFFSET}`,
      );
    }
    const reduceOnly =
      assetType === 'spot' ? false : Boolean(params.reduceOnly);
    const legs = buildScaleOrderLegs({
      totalSize: params.size,
      lowerPrice: params.lowerPrice,
      upperPrice: params.upperPrice,
      orderCount: params.orderCount,
      szDecimals,
      side,
      sizeSkew: params.sizeSkew,
      assetType,
    });
    assertValidScaleOrderLegs({ legs });

    const orders: IOrderParams[] = legs.map((leg) => ({
      a: params.assetId,
      b: params.isBuy,
      p: leg.price,
      s: leg.size,
      r: reduceOnly,
      t: { limit: { tif } },
    }));

    try {
      return await this.placeOrderRaw(
        {
          orders,
          grouping: 'na',
        },
        {
          action: 'multiOrder',
          originalParams: params,
          extra: {
            orderCount: orders.length,
            reduceOnly,
            tif,
            sizeSkew: params.sizeSkew,
            assetType,
          },
        },
      );
    } catch (error) {
      throw new OneKeyLocalError(
        `Failed to place scale order: ${String(error)}`,
      );
    }
  }

  private _calculateSpotSlippagePrice(params: {
    markPrice: string;
    isBuy: boolean;
    slippage: number;
    szDecimals: number;
  }): string {
    const price = new BigNumber(params.markPrice);
    const slippageMultiplier = params.isBuy
      ? new BigNumber(1).plus(params.slippage)
      : new BigNumber(1).minus(params.slippage);
    const adjustedPrice = price.multipliedBy(slippageMultiplier);
    return formatSpotPriceToValid(adjustedPrice.toFixed(), params.szDecimals);
  }

  @backgroundMethod()
  async placeSpotOrder(params: ISpotOrderParams): Promise<IOrderResponse> {
    await this.checkAccountCanTrade();
    if (
      typeof params.assetId !== 'number' ||
      params.assetId < SPOT_ASSET_ID_OFFSET
    ) {
      throw new OneKeyLocalError(
        `placeSpotOrder: invalid spot assetId ${params.assetId}, must be >= ${SPOT_ASSET_ID_OFFSET}`,
      );
    }
    try {
      const isMarket = params.orderType === 'market';

      const price = isMarket
        ? this._calculateSpotSlippagePrice({
            markPrice: params.limitPx,
            isBuy: params.isBuy,
            slippage: params.slippage || this.slippage,
            szDecimals: params.szDecimals || 0,
          })
        : params.limitPx;

      const orderParams: IOrderParams = {
        a: params.assetId,
        b: params.isBuy,
        p: price,
        s: params.sz,
        r: false,
        t: isMarket
          ? { limit: { tif: params.tif || 'Ioc' } }
          : { limit: { tif: params.tif || 'Gtc' } },
      };

      const response = await this.placeOrderRaw(
        {
          orders: [orderParams],
          grouping: 'na',
        },
        {
          action: 'placeSpotOrder',
          originalParams: params,
          extra: {
            isMarket,
            isSpot: true,
          },
        },
      );
      return response;
    } catch (error) {
      throw new OneKeyLocalError(
        `Failed to place spot order: ${String(error)}`,
      );
    }
  }

  @backgroundMethod()
  async orderOpen(params: IOrderOpenParams): Promise<IOrderResponse> {
    await this.checkAccountCanTrade();
    try {
      const isMarket = params.type === 'market';

      const price = isMarket
        ? this._calculateSlippagePrice({
            markPrice: params.price,
            isBuy: params.isBuy,
            slippage: params.slippage || this.slippage,
          })
        : params.price;

      const orders: IOrderParams[] = [];

      const mainOrder: IOrderParams = {
        a: params.assetId,
        b: params.isBuy,
        p: price,
        s: params.size,
        r: false,
        t: isMarket
          ? {
              limit: {
                tif: 'Ioc',
              },
            }
          : { limit: { tif: normalizeUserLimitTif(params.tif) } },
      };
      orders.push(mainOrder);

      if (params.tpTriggerPx) {
        const originalTpPrice = params.tpTriggerPx;

        const executionPrice = this._calculateSlippagePrice({
          markPrice: originalTpPrice,
          isBuy: !params.isBuy,
          slippage: params.slippage || this.slippage,
        });

        const tpOrder: IOrderParams = {
          a: params.assetId,
          b: !params.isBuy,
          p: executionPrice,
          s: params.size,
          r: true,
          t: {
            trigger: {
              isMarket: true,
              triggerPx: originalTpPrice,
              tpsl: 'tp',
            },
          },
        };
        orders.push(tpOrder);
      }

      if (params.slTriggerPx) {
        const originalSlPrice = params.slTriggerPx;

        const executionPrice = this._calculateSlippagePrice({
          markPrice: originalSlPrice,
          isBuy: !params.isBuy,
          slippage: params.slippage || this.slippage,
        });

        const slOrder: IOrderParams = {
          a: params.assetId,
          b: !params.isBuy,
          p: executionPrice,
          s: params.size,
          r: true,
          t: {
            trigger: {
              isMarket: true,
              triggerPx: originalSlPrice,
              tpsl: 'sl',
            },
          },
        };
        orders.push(slOrder);
      }

      const response = await this.placeOrderRaw(
        {
          orders,
          grouping: orders.length > 1 ? 'normalTpsl' : 'na',
        },
        {
          action: 'orderOpen',
          originalParams: params,
          extra: {
            hasTp: Boolean(params.tpTriggerPx),
            hasSl: Boolean(params.slTriggerPx),
            isMarket,
          },
        },
      );
      return response;
    } catch (error) {
      throw new OneKeyLocalError(
        `Failed to place market order open: ${String(error)}`,
      );
    }
  }

  @backgroundMethod()
  async orderTrigger(params: ITriggerOrderParams): Promise<IOrderResponse> {
    await this.checkAccountCanTrade();
    try {
      const { isMarket } = mapTriggerOrderType(params.triggerOrderType);
      const { tpsl } = params;

      // Format trigger price
      const triggerPxDecimals = getValidPriceDecimals(params.triggerPx);
      const formattedTriggerPx = formatPriceToSignificantDigits(
        +params.triggerPx,
        MAX_DECIMALS_PERP - triggerPxDecimals,
      );

      // Determine execution price (p):
      // - Market trigger: apply slippage to triggerPx
      // - Limit trigger: use executionPx directly
      let executionPrice: string;
      if (isMarket) {
        executionPrice = this._calculateSlippagePrice({
          markPrice: params.triggerPx,
          isBuy: params.isBuy,
          slippage: params.slippage || this.slippage,
        });
      } else {
        if (!params.executionPx) {
          throw new OneKeyLocalError(
            'Limit trigger orders require an execution price',
          );
        }
        const execDecimals = getValidPriceDecimals(params.executionPx);
        executionPrice = formatPriceToSignificantDigits(
          +params.executionPx,
          MAX_DECIMALS_PERP - execDecimals,
        );
      }

      const order: IOrderParams = {
        a: params.assetId,
        b: params.isBuy,
        p: executionPrice,
        s: params.size,
        r: params.reduceOnly,
        t: {
          trigger: {
            isMarket,
            triggerPx: formattedTriggerPx,
            tpsl,
          },
        },
      };

      const response = await this.placeOrderRaw(
        {
          orders: [order],
          grouping: 'na',
        },
        {
          action: 'orderTrigger',
          originalParams: params,
          extra: {
            triggerOrderType: params.triggerOrderType,
            isMarket,
            tpsl,
            reduceOnly: params.reduceOnly,
          },
        },
      );
      return response;
    } catch (error) {
      throw new OneKeyLocalError(
        `Failed to place trigger order: ${String(error)}`,
      );
    }
  }

  @backgroundMethod()
  async ordersClose(params: IOrderCloseParams[]): Promise<IOrderResponse> {
    await this.checkAccountCanTrade();
    const ordersParam = params.map((param) => {
      let price: string;

      if (param.limitPx) {
        price = param.limitPx;
      } else if (param.midPx) {
        price = this._calculateSlippagePrice({
          markPrice: param.midPx,
          isBuy: !param.isBuy,
          slippage: param.slippage || this.slippage,
        });
      } else {
        throw new OneKeyLocalError(
          'Either limitPx or midPx must be provided for order close',
        );
      }

      const orderParams: IOrderParams = {
        a: param.assetId,
        b: !param.isBuy,
        p: price,
        s: param.size,
        r: true,
        t: { limit: { tif: 'Gtc' } },
      };

      return orderParams;
    });

    try {
      const response = await this.placeOrderRaw(
        {
          orders: ordersParam,
          grouping: 'na',
        },
        {
          action: 'ordersClose',
          originalParams: params,
          extra: { orderCount: ordersParam.length },
        },
      );
      return response;
    } catch (error) {
      throw new OneKeyLocalError(
        `Failed to place close order: ${String(error)}`,
      );
    }
  }

  @backgroundMethod()
  async modifyOrder(params: IModifyOrderParams): Promise<IModifyResponse> {
    await this.checkAccountCanTrade();

    const order: IOrderParams = {
      a: params.assetId,
      b: params.isBuy,
      p: params.price,
      s: params.sz,
      r: params.reduceOnly ?? false,
      t: params.orderType ?? { limit: { tif: 'Gtc' } },
    };
    const [formattedOrder = order] = await this._formatOrdersForHyperLiquid([
      order,
    ]);

    const client = await this.getExchangeClientForTrading();
    const requestPayload = { oid: params.oid, order: formattedOrder };
    const context = await this._buildLogContext();
    const extra = { originalParams: params };

    try {
      const response = await convertHyperLiquidResponse(() =>
        client.modify({ oid: params.oid, order: formattedOrder }),
      );
      defaultLogger.perp.hyperliquid.modifyOrder({
        ...context,
        request: requestPayload,
        response,
        extra,
      });
      return response;
    } catch (error) {
      defaultLogger.perp.hyperliquid.modifyOrder({
        ...context,
        request: requestPayload,
        response: extractHyperLiquidErrorResponse<
          IModifyResponse | IApiErrorResponse
        >(error),
        error: serializeHyperLiquidError(error),
        extra,
      });
      throw error;
    }
  }

  @backgroundMethod()
  async cancelOrder(cancels: ICancelOrderParams[]): Promise<ICancelResponse> {
    await this.checkAccountCanTrade();

    const cancelParams = cancels.map((cancel) => ({
      a: cancel.assetId,
      o: cancel.oid,
    }));

    const client = await this.getExchangeClientForTrading();
    const requestPayload = { cancels: cancelParams };
    const context = await this._buildLogContext();
    const extra = {
      originalParams: cancels,
      cancelCount: cancelParams.length,
    };
    try {
      const response = await convertHyperLiquidResponse(() =>
        client.cancel(requestPayload),
      );
      defaultLogger.perp.hyperliquid.cancelOrder({
        ...context,
        request: requestPayload,
        response,
        extra,
      });
      return response;
    } catch (error) {
      defaultLogger.perp.hyperliquid.cancelOrder({
        ...context,
        request: requestPayload,
        response: extractHyperLiquidErrorResponse<
          ICancelResponse | IApiErrorResponse
        >(error),
        error: serializeHyperLiquidError(error),
        extra,
      });
      throw error;
    }
  }

  @backgroundMethod()
  async placeTwapOrder(
    params: IPlaceTwapOrderParams,
  ): Promise<ITwapOrderResponse> {
    await this.checkAccountCanTrade();

    const precisionMap = await this._getOrderAssetPrecisionMap([
      params.assetId,
    ]);
    const precision = precisionMap.get(params.assetId);
    const szDecimals = params.szDecimals ?? precision?.szDecimals ?? 2;
    const size = formatHlSize(params.size, szDecimals);
    if (!size) {
      throw new OneKeyLocalError('TWAP size is too small for HL lot size');
    }

    const assetType = precision?.type;
    const reduceOnly =
      assetType === 'spot' ? false : Boolean(params.reduceOnly);
    const twap = {
      a: params.assetId,
      b: params.isBuy,
      s: size,
      r: reduceOnly,
      m: params.minutes,
      t: params.randomize,
    };
    const client = await this.getExchangeClientForTrading();
    const context = await this._buildLogContext();
    const requestPayload = {
      twap: {
        assetId: params.assetId,
        isBuy: params.isBuy,
        size,
        reduceOnly,
        minutes: params.minutes,
        randomize: params.randomize,
      },
    };

    try {
      const response = await convertHyperLiquidResponse(() =>
        client.twapOrder({
          twap,
        }),
      );
      defaultLogger.perp.hyperliquid.twapOrder({
        ...context,
        request: requestPayload,
        response,
        extra: {
          originalParams: params,
          builder: null,
        },
      });
      void this.backgroundApi.serviceRookieGuide.recordTaskCompleted(
        ERookieTaskType.PERPS,
      );
      return response;
    } catch (error) {
      defaultLogger.perp.hyperliquid.twapOrder({
        ...context,
        request: requestPayload,
        response: extractHyperLiquidErrorResponse<
          ITwapOrderResponse | IApiErrorResponse
        >(error),
        error: serializeHyperLiquidError(error),
        extra: {
          originalParams: params,
          builder: null,
        },
      });
      throw error;
    }
  }

  @backgroundMethod()
  async cancelTwapOrder(
    params: ICancelTwapOrderParams,
  ): Promise<ITwapCancelResponse> {
    await this.checkAccountCanTrade();

    const client = await this.getExchangeClientForTrading();
    const context = await this._buildLogContext();
    const requestPayload = {
      assetId: params.assetId,
      twapId: params.twapId,
    };

    try {
      const response = await convertHyperLiquidResponse(() =>
        client.twapCancel({
          a: params.assetId,
          t: params.twapId,
        }),
      );
      defaultLogger.perp.hyperliquid.twapCancel({
        ...context,
        request: requestPayload,
        response,
        extra: {
          originalParams: params,
        },
      });
      return response;
    } catch (error) {
      defaultLogger.perp.hyperliquid.twapCancel({
        ...context,
        request: requestPayload,
        response: extractHyperLiquidErrorResponse<
          ITwapCancelResponse | IApiErrorResponse
        >(error),
        error: serializeHyperLiquidError(error),
        extra: {
          originalParams: params,
        },
      });
      throw error;
    }
  }

  @backgroundMethod()
  async placeLimitOrderByCoin(params: {
    coin: string;
    isBuy: boolean;
    size: string;
    price: string;
    tif?: 'Gtc' | 'Ioc';
    reduceOnly?: boolean;
  }): Promise<IOrderResponse> {
    const symbolMeta =
      await this.backgroundApi.serviceHyperliquid.getSymbolMeta({
        coin: normalizePerpsCoin(params.coin),
      });
    if (!symbolMeta) {
      throw new OneKeyLocalError(`Unknown coin: ${params.coin}`);
    }

    if (symbolMeta.isSpot) {
      const szDecimals = symbolMeta.spotUniverse?.baseSzDecimals ?? 0;
      return this.placeSpotOrder({
        assetId: symbolMeta.assetId,
        isBuy: params.isBuy,
        sz: params.size,
        limitPx: formatSpotPriceToValid(params.price, szDecimals),
        orderType: 'limit',
        tif: params.tif ?? 'Gtc',
        szDecimals,
      });
    }

    return this.placeOrder({
      assetId: symbolMeta.assetId,
      isBuy: params.isBuy,
      sz: params.size,
      limitPx: formatPriceToSignificantDigits(
        params.price,
        symbolMeta.universe?.szDecimals,
      ),
      orderType: { limit: { tif: params.tif ?? 'Gtc' } },
      reduceOnly: params.reduceOnly,
    });
  }

  @backgroundMethod()
  async amendOrderPriceByOid(params: {
    coin: string;
    oid: number;
    newPrice: string;
    isBuy: boolean;
    size: string;
    reduceOnly: boolean;
  }): Promise<IModifyResponse> {
    const symbolMeta =
      await this.backgroundApi.serviceHyperliquid.getSymbolMeta({
        coin: normalizePerpsCoin(params.coin),
      });
    if (!symbolMeta) {
      throw new OneKeyLocalError(`Unknown coin: ${params.coin}`);
    }

    const formattedPrice = symbolMeta.isSpot
      ? formatSpotPriceToValid(
          params.newPrice,
          symbolMeta.spotUniverse?.baseSzDecimals ?? 0,
        )
      : formatPriceToSignificantDigits(
          params.newPrice,
          symbolMeta.universe?.szDecimals,
        );

    return this.modifyOrder({
      oid: params.oid,
      assetId: symbolMeta.assetId,
      isBuy: params.isBuy,
      sz: params.size,
      price: formattedPrice,
      reduceOnly: params.reduceOnly,
    });
  }

  @backgroundMethod()
  async setPositionTpsl(
    params: IPositionTpslOrderParams,
  ): Promise<IOrderResponse> {
    await this.checkAccountCanTrade();
    try {
      const {
        assetId,
        positionSize,
        isBuy,
        tpTriggerPx,
        slTriggerPx,
        slippage,
      } = params;
      const orders: IOrderParams[] = [];

      // Take Profit order
      if (tpTriggerPx) {
        const tpExecutionPrice = this._calculateSlippagePrice({
          markPrice: tpTriggerPx,
          isBuy: !isBuy,
          slippage: slippage || this.slippage,
        });

        const tpOrder: IOrderParams = {
          a: assetId,
          b: !isBuy,
          p: tpExecutionPrice,
          s: positionSize,
          r: true,
          t: {
            trigger: {
              isMarket: true,
              triggerPx: tpTriggerPx,
              tpsl: 'tp',
            },
          },
        };
        orders.push(tpOrder);
      }

      // Stop Loss order
      if (slTriggerPx) {
        const slExecutionPrice = this._calculateSlippagePrice({
          markPrice: slTriggerPx,
          isBuy: !isBuy,
          slippage: slippage || this.slippage,
        });

        const slOrder: IOrderParams = {
          a: assetId,
          b: !isBuy,
          p: slExecutionPrice,
          s: positionSize,
          r: true,
          t: {
            trigger: {
              isMarket: true,
              triggerPx: slTriggerPx,
              tpsl: 'sl',
            },
          },
        };
        orders.push(slOrder);
      }

      if (orders.length === 0) {
        throw new OneKeyLocalError(
          'At least one TP or SL price must be provided',
        );
      }

      const response = await this.placeOrderRaw(
        {
          orders,
          grouping: 'positionTpsl',
        },
        {
          action: 'setPositionTpsl',
          originalParams: params,
          extra: {
            hasTp: Boolean(tpTriggerPx),
            hasSl: Boolean(slTriggerPx),
          },
        },
      );
      return response;
    } catch (error) {
      throw new OneKeyLocalError(
        `Failed to set position TP/SL: ${String(error)}`,
      );
    }
  }

  @backgroundMethod()
  async setAbstractionWithUserWallet(params: {
    userAccountId: string;
    userAddress: string;
    abstraction:
      | 'disabled'
      | 'unifiedAccount'
      | 'portfolioMargin'
      | 'dexAbstraction';
  }): Promise<void> {
    await this.checkAccountCanTrade();
    const wallet =
      await this.backgroundApi.serviceHyperliquidWallet.getOnekeyWallet({
        userAccountId: params.userAccountId,
      });
    const exchangeClient = this._createLoggedExchangeClient(
      new ExchangeClient({
        transport: new HttpTransport(),
        wallet,
        signatureChainId: PERPS_EVM_CHAIN_ID_HEX,
      }),
    );
    // TODO: i18n — HL returns English errors like "Cannot disable unified account with open positions..."
    // Need to add these to hyperliquidErrorLocales config for localization
    await convertHyperLiquidResponse(() =>
      exchangeClient.userSetAbstraction({
        user: params.userAddress as `0x${string}`,
        abstraction: params.abstraction,
      }),
    );
  }

  @backgroundMethod()
  async withdraw(params: IWithdrawParams): Promise<void> {
    await this.checkAccountCanTrade();
    const wallet =
      await this.backgroundApi.serviceHyperliquidWallet.getOnekeyWallet({
        userAccountId: params.userAccountId,
      });
    const exchangeClient = this._createLoggedExchangeClient(
      new ExchangeClient({
        transport: new HttpTransport(),
        wallet,
        signatureChainId: PERPS_EVM_CHAIN_ID_HEX,
      }),
    );
    const context = await this._buildLogContext();
    try {
      await convertHyperLiquidResponse(() => exchangeClient.withdraw3(params));
      defaultLogger.perp.hyperliquid.withdraw({
        ...context,
        request: params,
        response: { success: true },
      });
    } catch (error) {
      defaultLogger.perp.hyperliquid.withdraw({
        ...context,
        request: params,
        response: extractHyperLiquidErrorResponse<IApiErrorResponse>(error),
        error: serializeHyperLiquidError(error),
      });
      throw error;
    }
  }
}
