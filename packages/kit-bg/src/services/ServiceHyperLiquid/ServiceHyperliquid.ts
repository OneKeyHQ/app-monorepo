import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import ServiceBase from '../ServiceBase';

import type ServiceHyperliquidExchange from './ServiceHyperliquidExchange';
import type ServiceHyperliquidInfo from './ServiceHyperliquidInfo';
import type ServiceHyperliquidWallet from './ServiceHyperliquidWallet';

interface IWalletStatus {
  extraAgents: any[];
  maxBuilderFee: boolean;
}

interface IEnableTradingParams {
  userAddress: string;
  userAccountId: string;
  approveAgent?: boolean;
  approveBuilderFee?: boolean;
}


const FALLBACK_BUILDER_ADDRESS = '0x9b12E858dA780a96876E3018780CF0D83359b0bb';
const FALLBACK_MAX_BUILDER_FEE = 40;
@backgroundClass()
export default class ServiceHyperliquid extends ServiceBase {
  public builderAddress: string = FALLBACK_BUILDER_ADDRESS;
  public maxBuilderFee: number = FALLBACK_MAX_BUILDER_FEE;

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
    this.backgroundApi.simpleDb.perp.getPerpConfig().then((config) => {
      this.builderAddress = config.hyperliquidBuilderAddress || FALLBACK_BUILDER_ADDRESS;
      this.maxBuilderFee = config.hyperliquidMaxBuilderFee || FALLBACK_MAX_BUILDER_FEE;
    });
  }

  private get infoService(): ServiceHyperliquidInfo {
    return this.backgroundApi.serviceHyperliquidInfo;
  }

  private get exchangeService(): ServiceHyperliquidExchange {
    return this.backgroundApi.serviceHyperliquidExchange;
  }

  private get walletService(): ServiceHyperliquidWallet {
    return this.backgroundApi.serviceHyperliquidWallet;
  }

  @backgroundMethod()
  async checkWalletStatus(params: { userAddress: string }): Promise<IWalletStatus> {
    try {
      const [extraAgents, maxBuilderFee] = await Promise.all([
        this.infoService.getExtraAgents({ user: params.userAddress as `0x${string}` }),
        this.infoService.getMaxBuilderFee({
          user: params.userAddress as `0x${string}`,
          builder: this.builderAddress as `0x${string}`
        }),
      ]);

      return {
        extraAgents,
        maxBuilderFee: !!(maxBuilderFee >= this.maxBuilderFee),
      };
    } catch (error) {
      throw new OneKeyLocalError(`Failed to check wallet status: ${error}`);
    }
  }

  @backgroundMethod()
  async enableTrading(params: IEnableTradingParams): Promise<{
    success: boolean;
    agentApproved?: boolean;
    builderFeeApproved?: boolean;
  }> {
    console.log('[ServiceHyperliquid.enableTrading] params:', params);
    try {
      const result = {
        success: true,
        agentApproved: false,
        builderFeeApproved: false,
      };

      const tasks = [];
      await this.exchangeService.setup({
        userAddress: params.userAddress,
        userAccountId: params.userAccountId,
      });
      if (params.approveBuilderFee) {
        tasks.push(this.exchangeService.approveBuilderFee({
          builder: this.builderAddress as `0x${string}`,
          maxFeeRate: `${this.maxBuilderFee / 100}%`, // maxBuilderFee=40, maxFeeRate=0.04%
        }));
        result.builderFeeApproved = true;
      }

      const proxyWalletAddress = await this.walletService.getProxyWalletAddress({
        userAddress: params.userAddress
      });
      if (params.approveAgent) {
        tasks.push(this.exchangeService.approveAgent({
          agent: proxyWalletAddress as `0x${string}`,
          authorize: true,
        }));

        result.agentApproved = true;
      }


      await Promise.all(tasks);

      await this.exchangeService.setup({
        userAddress: params.userAddress,
      });

      return result;
    } catch (error) {
      throw new OneKeyLocalError(`Failed to enable trading: ${error}`);
    }
  }

  async dispose(): Promise<void> {
  }
}
