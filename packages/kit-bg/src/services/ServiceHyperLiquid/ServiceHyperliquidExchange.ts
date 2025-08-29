import {
  ExchangeClient,
  HttpTransport,
} from '@nktkas/hyperliquid';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IHLExchangeClient,
  IHLOrderRequest,
  IHLOrderResponse,
  IHLOrderParams,
  IHLTIF,
} from '@onekeyhq/shared/types/hyperliquid/sdk';

import ServiceBase from '../ServiceBase';

import type { WalletHyperliquidProxy, WalletHyperliquidOnekey } from './ServiceHyperliquidWallet';
import { formatPriceToSignificantDigits } from '@onekeyhq/kit/src/views/Perp/utils/tokenUtils';

// SDK-compatible API interfaces
interface IPlaceOrderParams {
  assetId: number;
  isBuy: boolean;
  sz: string;
  limitPx?: string;
  orderType: { limit: { tif: 'Gtc' | 'Ioc' } } | { market?: {} };
  slippage?: number;
}

interface IMarketOrderOpenParams {
  assetId: number;
  isBuy: boolean;
  size: string;
  midPx: string;
  type: 'market' | 'limit';
  tpTriggerPx?: string;
  slTriggerPx?: string;
  slippage?: number;
}

interface IMarketOrderCloseParams {
  assetId: number;
  isBuy: boolean;
  size: string;
  midPx: string;
  slippage?: number;
}

interface IUpdateLeverageParams {
  assetId: number;
  leverage: number;
  isCross?: boolean;
}

interface ICancelOrderParams {
  assetId: number;
  oid: number;
}

interface IMultiOrderParams {
  orders: Array<{
    assetId: number;
    isBuy: boolean;
    sz: string;
    limitPx: string;
    orderType: { limit: { tif: 'Gtc' | 'Ioc' } };
  }>;
}

interface ILeverageUpdateRequest {
  asset: number;
  isCross: boolean;
  leverage: number;
}

interface IBuilderFeeRequest {
  builder: `0x${string}`;
  maxFeeRate: `${string}%`;
}

interface IAgentApprovalRequest {
  agent: `0x${string}`;
  authorize: boolean;
}

const AGENT_NAME = 'OneKey_Desktop';

@backgroundClass()
export default class ServiceHyperliquidExchange extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  private _account: string | null = null;
  private _exchangeClient: IHLExchangeClient | null = null;

  public slippage: number = 0.08;

  @backgroundMethod()
  async setup(params: {
    userAddress: string;
    userAccountId?: string;
  }): Promise<void> {
    try {
      const transport = new HttpTransport();

      let wallet: WalletHyperliquidProxy | WalletHyperliquidOnekey;
      let account: string;

      if (params.userAccountId) {
        wallet = await this.backgroundApi.serviceHyperliquidWallet.getOnekeyWallet({
          userAccountId: params.userAccountId,
        });
        account = params.userAddress;
      } else {
        const proxyWallet = await this.backgroundApi.serviceHyperliquidWallet.getProxyWallet({
          userAddress: params.userAddress,
        });
        wallet = proxyWallet.wallet;
        account = proxyWallet.address;
      }

      this._exchangeClient = new ExchangeClient({
        transport,
        wallet
      }) as IHLExchangeClient;

      this._account = account;
    } catch (error) {
      throw new OneKeyLocalError(`Failed to setup exchange client: ${error}`);
    }
  }

  @backgroundMethod()
  async getOnekeyWalletClient(params: {
    userAddress: string;
    userAccountId?: string;
  }): Promise<IHLExchangeClient> {
    const transport = new HttpTransport();

    let wallet: WalletHyperliquidProxy | WalletHyperliquidOnekey;

    if (params.userAccountId) {
      wallet = await this.backgroundApi.serviceHyperliquidWallet.getOnekeyWallet({
        userAccountId: params.userAccountId,
      });
    } else {
      const proxyWallet = await this.backgroundApi.serviceHyperliquidWallet.getProxyWallet({
        userAddress: params.userAddress,
      });
      wallet = proxyWallet.wallet;
    }

    return new ExchangeClient({
      transport,
      wallet
    }) as IHLExchangeClient;
  }

  private _ensureSetup(): void {
    if (!this._account || !this._exchangeClient) {
      throw new OneKeyLocalError('Exchange client not setup. Call setup() first.');
    }
  }

  @backgroundMethod()
  async updateLeverage(params: ILeverageUpdateRequest): Promise<any> {
    this._ensureSetup();

    try {
      return await this._exchangeClient!.updateLeverage(params);
    } catch (error) {
      throw new OneKeyLocalError(`Failed to update leverage: ${error}`);
    }
  }

  @backgroundMethod()
  async approveBuilderFee(params: IBuilderFeeRequest): Promise<any> {
    this._ensureSetup();

    try {
      return await this._exchangeClient!.approveBuilderFee(params);
    } catch (error) {
      throw new OneKeyLocalError(`Failed to approve builder fee: ${error}`);
    }
  }

  @backgroundMethod()
  async approveAgent(params: IAgentApprovalRequest): Promise<any> {
    this._ensureSetup();

    try {
      return await this._exchangeClient!.approveAgent({
        agentAddress: params.agent as `0x${string}`,
        agentName: AGENT_NAME,
      });
    } catch (error) {
      throw new OneKeyLocalError(`Failed to approve agent: ${error}`);
    }
  }

  @backgroundMethod()
  async getAccount(): Promise<string | null> {
    return this._account;
  }

  @backgroundMethod()
  async placeOrderRaw(params: IHLOrderRequest): Promise<IHLOrderResponse> {
    this._ensureSetup();
    try {
      return await this._exchangeClient!.order({
        orders: params.action.orders,
        grouping: params.action.grouping,
      });
    } catch (error) {
      throw new OneKeyLocalError(`Failed to place order: ${error}`);
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
    slippage: number
  ): string {
    const price = parseFloat(markPrice);
    const szDecimals = markPrice.split('.')[1]?.length || 0;
    const slippageMultiplier = isBuy ? (1 + slippage) : (1 - slippage);
    const adjustedPrice = price * slippageMultiplier;
    return formatPriceToSignificantDigits(adjustedPrice, 5);
  }

  @backgroundMethod()
  async placeOrder(params: IPlaceOrderParams): Promise<IHLOrderResponse> {
    this._ensureSetup();

    try {
      let price = params.limitPx || '0';

      if ('market' in params.orderType && (!params.limitPx || params.limitPx === '0')) {
        throw new OneKeyLocalError('Market orders require current market price - not implemented yet');
      }

      const orderParams: IHLOrderParams = {
        a: params.assetId,
        b: params.isBuy,
        p: price,
        s: params.sz,
        r: false,
        t: 'limit' in params.orderType ? {
          limit: { tif: params.orderType.limit.tif as IHLTIF }
        } : {
          limit: { tif: 'Ioc' as IHLTIF }
        },
      };

      return await this._exchangeClient!.order({
        orders: [orderParams],
        grouping: 'na',
      });
    } catch (error) {
      throw new OneKeyLocalError(`Failed to place order: ${error}`);
    }
  }

  @backgroundMethod()
  async marketOrderOpen(params: IMarketOrderOpenParams): Promise<IHLOrderResponse> {
    this._ensureSetup();

    try {
      const isMarket = params.type === 'market';
      const midPx = params.midPx;
      const price = this._calculateSlippagePrice(
        midPx,
        params.isBuy,
        params.slippage || this.slippage
      );

      const orders: IHLOrderParams[] = [];

      const mainOrder: IHLOrderParams = {
        a: params.assetId,
        b: params.isBuy,
        p: price,
        s: params.size,
        r: false,
        t: isMarket ? {
          limit: {
            tif: 'Gtc'
          }
        } : { limit: { tif: 'Ioc' } },
      };
      orders.push(mainOrder);

      if (params.tpTriggerPx) {
        if (isMarket) {
          params.tpTriggerPx = this._calculateSlippagePrice(
            params.tpTriggerPx,
            true,
            params.slippage || this.slippage
          );
        }
        const tpOrder: IHLOrderParams = {
          a: params.assetId,
          b: !params.isBuy,
          p: params.tpTriggerPx,
          s: params.size,
          r: true,
          t: {
            trigger: {
              isMarket,
              triggerPx: params.tpTriggerPx,
              tpsl: 'tp' as const,
            }
          },
        };
        orders.push(tpOrder);
      }

      if (params.slTriggerPx) {
        if (isMarket) {
          params.slTriggerPx = this._calculateSlippagePrice(
            params.slTriggerPx,
            false,
            params.slippage || this.slippage
          );
        }
        const slOrder: IHLOrderParams = {
          a: params.assetId,
          b: !params.isBuy,
          p: params.slTriggerPx,
          s: params.size,
          r: true,
          t: {
            trigger: {
              isMarket,
              triggerPx: params.slTriggerPx,
              tpsl: 'sl' as const,
            }
          },
        };
        orders.push(slOrder);
      }

      return await this._exchangeClient!.order({
        orders,
        grouping: orders.length > 1 ? 'normalTpsl' : 'na',
      });
    } catch (error) {
      throw new OneKeyLocalError(`Failed to place market order open: ${error}`);
    }
  }

  @backgroundMethod()
  async marketOrderClose(params: IMarketOrderCloseParams): Promise<IHLOrderResponse> {
    this._ensureSetup();

    try {
      const midPx = params.midPx;
      const price = this._calculateSlippagePrice(
        midPx,
        !params.isBuy,
        params.slippage || this.slippage
      );

      const orderParams: IHLOrderParams = {
        a: params.assetId,
        b: !params.isBuy,
        p: price,
        s: params.size,
        r: true,
        t: { limit: { tif: 'Gtc' as IHLTIF } },
      };

      return await this._exchangeClient!.order({
        orders: [orderParams],
        grouping: 'na',
      });
    } catch (error) {
      throw new OneKeyLocalError(`Failed to place market close order: ${error}`);
    }
  }

  @backgroundMethod()
  async updateLeverageByAssetId(params: IUpdateLeverageParams): Promise<any> {
    this._ensureSetup();

    try {
      return await this.updateLeverage({
        asset: params.assetId,
        leverage: params.leverage,
        isCross: params.isCross ?? true,
      });
    } catch (error) {
      throw new OneKeyLocalError(`Failed to update leverage: ${error}`);
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
      throw new OneKeyLocalError(`Failed to cancel orders: ${error}`);
    }
  }

  @backgroundMethod()
  async multiOrder(params: IMultiOrderParams): Promise<IHLOrderResponse> {
    this._ensureSetup();

    try {
      const orderParams = params.orders.map((order) => {
        const orderParam: IHLOrderParams = {
          a: order.assetId,
          b: order.isBuy,
          p: order.limitPx,
          s: order.sz,
          r: false,
          t: { limit: { tif: order.orderType.limit.tif as IHLTIF } },
        };

        return orderParam;
      });

      return await this._exchangeClient!.order({
        orders: orderParams,
        grouping: 'na',
      });
    } catch (error) {
      throw new OneKeyLocalError(`Failed to place multi orders: ${error}`);
    }
  }
}
