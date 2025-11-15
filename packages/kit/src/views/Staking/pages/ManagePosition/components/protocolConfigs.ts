/**
 * Protocol-specific configurations for ManagePosition page
 *
 * This file defines custom rendering configurations for special protocols
 * that don't follow the standard deposit/withdraw pattern.
 *
 * Example: USDe uses a subscription model with Receive/Trade actions
 * instead of the standard Deposit/Withdraw flow.
 */

import type { IStakeEarnDetail } from '@onekeyhq/shared/types/staking';

export interface IProtocolCustomConfig {
  // Identifies protocols that need custom rendering
  shouldUseCustomContent: (params: {
    symbol: string;
    provider: string;
    vault?: string;
  }) => boolean;

  // Build custom content configuration
  buildCustomContent?: (data: {
    subscriptionValue?: IStakeEarnDetail['subscriptionValue'];
    detailActions?: IStakeEarnDetail['actions'];
    handlers: {
      onReceive?: () => void;
      onTrade?: () => void;
      [key: string]: (() => void) | undefined;
    };
  }) =>
    | {
        data?: IStakeEarnDetail['subscriptionValue'];
        actions?: IStakeEarnDetail['actions'];
        handlers?: {
          onReceive?: () => void;
          onTrade?: () => void;
          [key: string]: (() => void) | undefined;
        };
      }
    | undefined;
}

/**
 * USDe Protocol Configuration
 *
 * USDe uses a subscription-based model where users:
 * - View their subscription value (holdings)
 * - Can receive more USDe
 * - Can trade USDe
 */
export const usdeProtocolConfig: IProtocolCustomConfig = {
  shouldUseCustomContent: ({ symbol }) => symbol === 'USDe',

  buildCustomContent: ({ subscriptionValue, detailActions, handlers }) => {
    if (!subscriptionValue) return undefined;

    return {
      data: subscriptionValue,
      actions: detailActions,
      handlers,
    };
  },
};

/**
 * Registry of all protocol-specific configurations
 *
 * To add a new custom protocol:
 * 1. Create a configuration object following IProtocolCustomConfig
 * 2. Add it to this array
 * 3. The ManagePositionContent will automatically use it
 */
export const protocolConfigs: IProtocolCustomConfig[] = [
  usdeProtocolConfig,
  // Add more custom protocol configurations here
  // Example:
  // {
  //   shouldUseCustomContent: ({ symbol, provider }) =>
  //     symbol === 'CUSTOM_TOKEN' && provider === 'CustomProvider',
  //   buildCustomContent: ({ subscriptionValue, detailActions, handlers }) => ({
  //     data: subscriptionValue,
  //     actions: detailActions,
  //     handlers,
  //   }),
  // },
];

/**
 * Helper function to check if a protocol needs custom rendering
 */
export function shouldUseCustomContent(params: {
  symbol: string;
  provider: string;
  vault?: string;
}): boolean {
  return protocolConfigs.some((config) =>
    config.shouldUseCustomContent(params),
  );
}

/**
 * Helper function to build custom content configuration
 */
export function buildCustomContent(
  params: {
    symbol: string;
    provider: string;
    vault?: string;
  },
  data: {
    subscriptionValue?: IStakeEarnDetail['subscriptionValue'];
    detailActions?: IStakeEarnDetail['actions'];
    handlers: {
      onReceive?: () => void;
      onTrade?: () => void;
      [key: string]: (() => void) | undefined;
    };
  },
) {
  const config = protocolConfigs.find((c) => c.shouldUseCustomContent(params));
  return config?.buildCustomContent?.(data);
}
