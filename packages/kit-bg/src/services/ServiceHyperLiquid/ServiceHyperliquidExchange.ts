import { ExchangeClient, HttpTransport } from '@nktkas/hyperliquid';
import { BigNumber } from 'bignumber.js';
import { isNumber } from 'lodash';

import type { ICoreHyperLiquidAgentCredential } from '@onekeyhq/core/src/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  type EHyperLiquidAgentName,
  PERPS_EMPTY_ADDRESS,
  PERPS_EVM_CHAIN_ID_HEX,
} from '@onekeyhq/shared/src/consts/perp';
import {
  OneKeyLocalError,
  WatchedAccountTradeError,
} from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  MAX_DECIMALS_PERP,
  formatPriceToSignificantDigits,
  getValidPriceDecimals,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type {
  ICancelResponse,
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
  IMultiOrderParams,
  IOrderCloseParams,
  IOrderOpenParams,
  IPlaceOrderParams,
  IPositionTpslOrderParams,
  ISetReferrerRequest,
  IWithdrawParams,
} from '@onekeyhq/shared/types/hyperliquid/types';

import {
  perpsActiveAccountAtom,
  perpsActiveAccountStatusAtom,
} from '../../states/jotai/atoms';
import ServiceBase from '../ServiceBase';

import type {
  WalletHyperliquidOnekey,
  WalletHyperliquidProxy,
} from './ServiceHyperliquidWallet';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';

@backgroundClass()
export default class ServiceHyperliquidExchange extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: IBackgroundApi }) {
    super({ backgroundApi });
  }

  private _account: string | null = null;

  private _exchangeClient: ExchangeClient | null = null;

  private _builderFeeInfo:
    | {
        b: `0x${string}`;
        f: number;
      }
    | undefined = undefined;

  public slippage = 0.08;

  private get exchangeClient(): ExchangeClient {
    if (!this._account || !this._exchangeClient) {
      throw new OneKeyLocalError(
        'Exchange client not setup. Call setup() first.',
      );
    }
    return this._exchangeClient;
  }

  private _calculateSlippagePrice(params: {
    markPrice: string;
    isBuy: boolean;
    slippage: number;
  }): string {
    const price = new BigNumber(params.markPrice);
    const validDecimals = getValidPriceDecimals(params.markPrice);
    const slippageMultiplier = params.isBuy
      ? new BigNumber(1).plus(params.slippage)
      : new BigNumber(1).minus(params.slippage);
    const adjustedPrice = price.multipliedBy(slippageMultiplier);
    return formatPriceToSignificantDigits(
      +adjustedPrice.toFixed(validDecimals),
      MAX_DECIMALS_PERP - validDecimals,
    );
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

      this._exchangeClient = new ExchangeClient({
        transport,
        wallet,
        signatureChainId: PERPS_EVM_CHAIN_ID_HEX,
      });

      this._account = account;
    } catch (error) {
      throw new OneKeyLocalError(
        `Failed to setup exchange client: ${String(error)}`,
      );
    }
  }

  // @backgroundMethod()
  // async getOnekeyWalletClient(params: {
  //   userAddress: IHex;
  //   userAccountId?: string;
  // }): Promise<ExchangeClient> {
  //   const transport = new HttpTransport();

  //   let wallet: WalletHyperliquidProxy | WalletHyperliquidOnekey;

  //   if (params.userAccountId) {
  //     wallet =
  //       await this.backgroundApi.serviceHyperliquidWallet.getOnekeyWallet({
  //         userAccountId: params.userAccountId,
  //       });
  //   } else {
  //     const proxyWallet =
  //       await this.backgroundApi.serviceHyperliquidWallet.getProxyWallet({
  //         userAddress: params.userAddress,
  //       });
  //     wallet = proxyWallet.wallet;
  //   }

  //   return new ExchangeClient({
  //     transport,
  //     wallet,
  //   });
  // }

  /**
   * Check if agent is ready based on local status only
   */
  private async _ensureAgentReady(): Promise<boolean> {
    const accountStatus = await perpsActiveAccountStatusAtom.get();
    return Boolean(accountStatus?.details?.agentOk && accountStatus?.canTrade);
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
    return this.exchangeClient.setReferrer(params);
  }

  @backgroundMethod()
  async updateLeverage(params: ILeverageUpdateRequest): Promise<void> {
    await this.checkAccountCanTrade();

    const client = await this.getExchangeClientForTrading();
    await client.updateLeverage(params);
  }

  @backgroundMethod()
  async approveBuilderFee(params: IBuilderFeeRequest) {
    await this.checkAccountCanTrade();
    try {
      return await this.exchangeClient.approveBuilderFee(params);
    } catch (error) {
      throw new OneKeyLocalError(
        `Failed to approve builder fee: ${String(error)}`,
      );
    }
  }

  @backgroundMethod()
  async approveAgent(params: IAgentApprovalRequest) {
    await this.checkAccountCanTrade();
    return this.exchangeClient.approveAgent({
      agentAddress: params.agent,
      agentName: params.agentName || null,
    });
  }

  @backgroundMethod()
  async removeAgent(params: { agentName: EHyperLiquidAgentName | undefined }) {
    await this.checkAccountCanTrade();
    return this.approveAgent({
      agent: PERPS_EMPTY_ADDRESS,
      agentName: params.agentName,
      authorize: true,
    });
  }

  @backgroundMethod()
  async getAccount(): Promise<string | null> {
    return this._account;
  }

  @backgroundMethod()
  async placeOrderRaw({
    orders,
    grouping,
  }: {
    orders: IOrderParams[];
    grouping: IOrderRequest['grouping'];
  }): Promise<IOrderResponse> {
    await this.checkAccountCanTrade();

    const client = await this.getExchangeClientForTrading();
    return client.order({
      orders,
      grouping,
      builder: this._builderFeeInfo,
    });
  }

  @backgroundMethod()
  async isSetup(): Promise<boolean> {
    return this._account !== null && this._exchangeClient !== null;
  }

  async dispose(): Promise<void> {
    this._account = null;
    this._exchangeClient = null;
    this._builderFeeInfo = undefined;
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
                limit: { tif: params.orderType.limit.tif },
              }
            : {
                limit: { tif: 'Ioc' },
              },
      };

      return await this.placeOrderRaw({
        orders: [orderParams],
        grouping: 'na',
      });
    } catch (error) {
      throw new OneKeyLocalError(`Failed to place order: ${String(error)}`);
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
          : { limit: { tif: 'Gtc' } },
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
              isMarket,
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
              isMarket,
              triggerPx: originalSlPrice,
              tpsl: 'sl',
            },
          },
        };
        orders.push(slOrder);
      }

      return await this.placeOrderRaw({
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
  async ordersClose(params: IOrderCloseParams[]): Promise<IOrderResponse> {
    await this.checkAccountCanTrade();
    const ordersParam = params.map((param) => {
      const midPx = param.midPx;
      const price = this._calculateSlippagePrice({
        markPrice: midPx,
        isBuy: !param.isBuy,
        slippage: param.slippage || this.slippage,
      });

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
      return await this.placeOrderRaw({
        orders: ordersParam,
        grouping: 'na',
      });
    } catch (error) {
      throw new OneKeyLocalError(
        `Failed to place market close order: ${String(error)}`,
      );
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
    return client.cancel({
      cancels: cancelParams,
    });
  }

  @backgroundMethod()
  async multiOrder(params: IMultiOrderParams): Promise<IOrderResponse> {
    await this.checkAccountCanTrade();
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

      return await this.placeOrderRaw({
        orders: orderParams,
        grouping: 'na',
      });
    } catch (error) {
      throw new OneKeyLocalError(
        `Failed to place multi orders: ${String(error)}`,
      );
    }
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

      return await this.placeOrderRaw({
        orders,
        grouping: 'positionTpsl',
      });
    } catch (error) {
      throw new OneKeyLocalError(
        `Failed to set position TP/SL: ${String(error)}`,
      );
    }
  }

  @backgroundMethod()
  async withdraw(params: IWithdrawParams): Promise<void> {
    await this.checkAccountCanTrade();
    const wallet =
      await this.backgroundApi.serviceHyperliquidWallet.getOnekeyWallet({
        userAccountId: params.userAccountId,
      });
    const exchangeClient = new ExchangeClient({
      transport: new HttpTransport(),
      wallet,
    });
    await exchangeClient.withdraw3(params);
  }
}
