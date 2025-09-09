import { ExchangeClient, HttpTransport } from '@nktkas/hyperliquid';
import { BigNumber } from 'bignumber.js';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { formatPriceToSignificantDigits } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IHex,
  IOrderParams,
  IOrderRequest,
  IOrderResponse,
} from '@onekeyhq/shared/types/hyperliquid/sdk';
import type {
  IAgentApprovalRequest,
  IBuilderFeeRequest,
  ICancelOrderParams,
  ILeverageUpdateRequest,
  IMarketOrderCloseParams,
  IMarketOrderOpenParams,
  IMultiOrderParams,
  IPlaceOrderParams,
} from '@onekeyhq/shared/types/hyperliquid/types';

import ServiceBase from '../ServiceBase';

import type {
  WalletHyperliquidOnekey,
  WalletHyperliquidProxy,
} from './ServiceHyperliquidWallet';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';

// TODO: Dynamic set agent name based on client type
const AGENT_NAME = 'OneKey_Desktop';

@backgroundClass()
export default class ServiceHyperliquidExchange extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: IBackgroundApi }) {
    super({ backgroundApi });
  }

  private _account: string | null = null;

  private _exchangeClient: ExchangeClient | null = null;

  public slippage = 0.08;

  @backgroundMethod()
  async setup(params: {
    userAddress: IHex;
    userAccountId?: string;
  }): Promise<void> {
    try {
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
            userAddress: params.userAddress,
          });
        wallet = proxyWallet.wallet;
        account = proxyWallet.address;
      }

      this._exchangeClient = new ExchangeClient({
        transport,
        wallet,
      });

      this._account = account;
    } catch (error) {
      throw new OneKeyLocalError(
        `Failed to setup exchange client: ${String(error)}`,
      );
    }
  }

  @backgroundMethod()
  async getOnekeyWalletClient(params: {
    userAddress: IHex;
    userAccountId?: string;
  }): Promise<ExchangeClient> {
    const transport = new HttpTransport();

    let wallet: WalletHyperliquidProxy | WalletHyperliquidOnekey;

    if (params.userAccountId) {
      wallet =
        await this.backgroundApi.serviceHyperliquidWallet.getOnekeyWallet({
          userAccountId: params.userAccountId,
        });
    } else {
      const proxyWallet =
        await this.backgroundApi.serviceHyperliquidWallet.getProxyWallet({
          userAddress: params.userAddress,
        });
      wallet = proxyWallet.wallet;
    }

    return new ExchangeClient({
      transport,
      wallet,
    });
  }

  private _ensureSetup(): void {
    if (!this._account || !this._exchangeClient) {
      throw new OneKeyLocalError(
        'Exchange client not setup. Call setup() first.',
      );
    }
  }

  @backgroundMethod()
  async updateLeverage(params: ILeverageUpdateRequest): Promise<void> {
    this._ensureSetup();

    try {
      await this._exchangeClient!.updateLeverage(params);
    } catch (error) {
      throw new OneKeyLocalError(`Failed to update leverage: ${String(error)}`);
    }
  }

  @backgroundMethod()
  async approveBuilderFee(params: IBuilderFeeRequest): Promise<void> {
    this._ensureSetup();

    try {
      await this._exchangeClient!.approveBuilderFee(params);
    } catch (error) {
      throw new OneKeyLocalError(
        `Failed to approve builder fee: ${String(error)}`,
      );
    }
  }

  @backgroundMethod()
  async approveAgent(params: IAgentApprovalRequest): Promise<void> {
    this._ensureSetup();

    try {
      await this._exchangeClient!.approveAgent({
        agentAddress: params.agent,
        agentName: AGENT_NAME,
      });
    } catch (error) {
      throw new OneKeyLocalError(`Failed to approve agent: ${String(error)}`);
    }
  }

  @backgroundMethod()
  async getAccount(): Promise<string | null> {
    return this._account;
  }

  @backgroundMethod()
  async placeOrderRaw(params: IOrderRequest): Promise<IOrderResponse> {
    this._ensureSetup();
    try {
      return await this._exchangeClient!.order({
        orders: params.action.orders,
        grouping: params.action.grouping,
      });
    } catch (error) {
      throw new OneKeyLocalError(`Failed to place order: ${String(error)}`);
    }
  }

  @backgroundMethod()
  async isSetup(): Promise<boolean> {
    return this._account !== null && this._exchangeClient !== null;
  }

  async dispose(): Promise<void> {
    this._account = null;
    this._exchangeClient = null;
  }

  private _calculateSlippagePrice(
    markPrice: string,
    isBuy: boolean,
    slippage: number,
  ): string {
    const price = new BigNumber(markPrice);
    const slippageMultiplier = isBuy
      ? new BigNumber(1).plus(slippage)
      : new BigNumber(1).minus(slippage);
    const adjustedPrice = price.multipliedBy(slippageMultiplier);
    return formatPriceToSignificantDigits(adjustedPrice.toNumber(), 5);
  }

  @backgroundMethod()
  async placeOrder(params: IPlaceOrderParams): Promise<IOrderResponse> {
    this._ensureSetup();

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
        r: false,
        t:
          'limit' in params.orderType
            ? {
                limit: { tif: params.orderType.limit.tif },
              }
            : {
                limit: { tif: 'Ioc' },
              },
      };

      return await this._exchangeClient!.order({
        orders: [orderParams],
        grouping: 'na',
      });
    } catch (error) {
      throw new OneKeyLocalError(`Failed to place order: ${String(error)}`);
    }
  }

  @backgroundMethod()
  async marketOrderOpen(
    params: IMarketOrderOpenParams,
  ): Promise<IOrderResponse> {
    this._ensureSetup();

    try {
      const isMarket = params.type === 'market';
      const midPx = params.midPx;
      const price = this._calculateSlippagePrice(
        midPx,
        params.isBuy,
        params.slippage || this.slippage,
      );

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
                tif: 'Gtc',
              },
            }
          : { limit: { tif: 'Ioc' } },
      };
      orders.push(mainOrder);

      if (params.tpTriggerPx) {
        if (isMarket) {
          params.tpTriggerPx = this._calculateSlippagePrice(
            params.tpTriggerPx,
            true,
            params.slippage || this.slippage,
          );
        }
        const tpOrder: IOrderParams = {
          a: params.assetId,
          b: !params.isBuy,
          p: params.tpTriggerPx,
          s: params.size,
          r: true,
          t: {
            trigger: {
              isMarket,
              triggerPx: params.tpTriggerPx,
              tpsl: 'tp',
            },
          },
        };
        orders.push(tpOrder);
      }

      if (params.slTriggerPx) {
        if (isMarket) {
          params.slTriggerPx = this._calculateSlippagePrice(
            params.slTriggerPx,
            false,
            params.slippage || this.slippage,
          );
        }
        const slOrder: IOrderParams = {
          a: params.assetId,
          b: !params.isBuy,
          p: params.slTriggerPx,
          s: params.size,
          r: true,
          t: {
            trigger: {
              isMarket,
              triggerPx: params.slTriggerPx,
              tpsl: 'sl',
            },
          },
        };
        orders.push(slOrder);
      }

      return await this._exchangeClient!.order({
        orders,
        grouping: orders.length > 1 ? 'normalTpsl' : 'na',
      });
    } catch (error) {
      throw new OneKeyLocalError(
        `Failed to place market order open: ${String(error)}`,
      );
    }
  }

  @backgroundMethod()
  async marketOrderClose(
    params: IMarketOrderCloseParams,
  ): Promise<IOrderResponse> {
    this._ensureSetup();
    const midPx = params.midPx;
    const price = this._calculateSlippagePrice(
      midPx,
      !params.isBuy,
      params.slippage || this.slippage,
    );

    const orderParams: IOrderParams = {
      a: params.assetId,
      b: !params.isBuy,
      p: price,
      s: params.size,
      r: true,
      t: { limit: { tif: 'Gtc' } },
    };

    try {
      return await this._exchangeClient!.order({
        orders: [orderParams],
        grouping: 'na',
      });
    } catch (error) {
      throw new OneKeyLocalError(
        `Failed to place market close order: ${String(error)}`,
      );
    }
  }

  @backgroundMethod()
  async cancelOrder(cancels: ICancelOrderParams[]): Promise<any> {
    this._ensureSetup();

    try {
      const cancelParams = cancels.map((cancel) => ({
        a: cancel.assetId,
        o: cancel.oid,
      }));

      return await this._exchangeClient!.cancel({
        cancels: cancelParams,
      });
    } catch (error) {
      throw new OneKeyLocalError(`Failed to cancel orders: ${String(error)}`);
    }
  }

  @backgroundMethod()
  async multiOrder(params: IMultiOrderParams): Promise<IOrderResponse> {
    this._ensureSetup();

    try {
      const orderParams = params.orders.map((order) => {
        const orderParam: IOrderParams = {
          a: order.assetId,
          b: order.isBuy,
          p: order.limitPx,
          s: order.sz,
          r: false,
          t: { limit: { tif: order.orderType.limit.tif } },
        };

        return orderParam;
      });

      return await this._exchangeClient!.order({
        orders: orderParams,
        grouping: 'na',
      });
    } catch (error) {
      throw new OneKeyLocalError(
        `Failed to place multi orders: ${String(error)}`,
      );
    }
  }
}
