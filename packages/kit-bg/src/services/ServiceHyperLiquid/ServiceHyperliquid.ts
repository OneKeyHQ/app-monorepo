import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  FALLBACK_BUILDER_ADDRESS,
  FALLBACK_MAX_BUILDER_FEE,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';
import type { IHex } from '@onekeyhq/shared/types/hyperliquid/sdk';

import ServiceBase from '../ServiceBase';

import type ServiceHyperliquidExchange from './ServiceHyperliquidExchange';
import type ServiceHyperliquidInfo from './ServiceHyperliquidInfo';
import type ServiceHyperliquidWallet from './ServiceHyperliquidWallet';

interface IWalletStatus {
  extraAgents: any[];
  maxBuilderFee: boolean;
}

interface IEnableTradingParams {
  userAddress: IHex;
  userAccountId: string;
  approveAgent?: boolean;
  approveBuilderFee?: boolean;
}

@backgroundClass()
export default class ServiceHyperliquid extends ServiceBase {
  public builderAddress: IHex = FALLBACK_BUILDER_ADDRESS;

  public maxBuilderFee: number = FALLBACK_MAX_BUILDER_FEE;

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
    void this.init();
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

  private async init() {
    void this.backgroundApi.simpleDb.perp
      .getPerpConfig()
      .then((config) => {
        this.builderAddress = (config.hyperliquidBuilderAddress ||
          FALLBACK_BUILDER_ADDRESS) as IHex;
        this.maxBuilderFee =
          config.hyperliquidMaxBuilderFee || FALLBACK_MAX_BUILDER_FEE;
      })
      .catch((error) => {
        console.error('Failed to load perp config:', error);
      });
  }

  @backgroundMethod()
  async checkWalletStatus(params: {
    userAddress: IHex;
  }): Promise<IWalletStatus> {
    try {
      const [extraAgents, maxBuilderFee] = await Promise.all([
        this.infoService.getExtraAgents({
          user: params.userAddress,
        }),
        this.infoService.getMaxBuilderFee({
          user: params.userAddress,
          builder: this.builderAddress,
        }),
      ]);

      return {
        extraAgents,
        maxBuilderFee: !!(maxBuilderFee >= this.maxBuilderFee),
      };
    } catch (error) {
      throw new OneKeyLocalError(
        `Failed to check wallet status: ${String(error)}`,
      );
    }
  }

  @backgroundMethod()
  async enableTrading(params: IEnableTradingParams): Promise<{
    success: boolean;
    agentApproved?: boolean;
    builderFeeApproved?: boolean;
  }> {
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
        tasks.push(
          this.exchangeService.approveBuilderFee({
            builder: this.builderAddress,
            maxFeeRate: `${this.maxBuilderFee / 100}%`, // maxBuilderFee=40, maxFeeRate=0.04%
          }),
        );
        result.builderFeeApproved = true;
      }

      const proxyWalletAddress = await this.walletService.getProxyWalletAddress(
        {
          userAddress: params.userAddress,
        },
      );
      if (params.approveAgent) {
        tasks.push(
          this.exchangeService.approveAgent({
            agent: proxyWalletAddress,
            authorize: true,
          }),
        );

        result.agentApproved = true;
      }

      await Promise.all(tasks);

      await this.exchangeService.setup({
        userAddress: params.userAddress,
      });

      return result;
    } catch (error) {
      throw new OneKeyLocalError(`Failed to enable trading: ${String(error)}`);
    }
  }

  async dispose(): Promise<void> {
    // Cleanup resources if needed
  }
}
