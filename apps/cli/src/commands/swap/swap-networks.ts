import { getPresetNetworks } from '@onekeyhq/shared/src/config/presetNetworks';

import { ConfigManager } from '../../config';
import { apiClient } from '../../infra';

import type { IEndpointEnv } from '../../config';
import type { Command } from 'commander';

interface ISwapNetworkResult {
  networkId: string;
  name: string;
  chainId: string;
  nativeSymbol: string;
  supportSingleSwap: boolean;
  supportCrossChainSwap: boolean;
  supportLimit: boolean;
}

let cachedNetworks: ISwapNetworkResult[] | null = null;

/** @internal Reset cache between tests */
export function _resetSwapNetworksCache(): void {
  cachedNetworks = null;
}

export async function fetchSwapNetworks(
  env: IEndpointEnv,
): Promise<ISwapNetworkResult[]> {
  if (cachedNetworks) return cachedNetworks;

  try {
    const res = await apiClient.get<
      Array<{
        networkId: string;
        supportSingleSwap: boolean;
        supportCrossChainSwap: boolean;
        supportLimit: boolean;
      }>
    >('swap', '/swap/v1/networks', { protocol: 'All' });

    const presetNetworks = getPresetNetworks();
    const presetMap = new Map(presetNetworks.map((n) => [n.id, n]));

    const results: ISwapNetworkResult[] = [];
    for (const net of res) {
      if (!net.networkId.startsWith('evm--')) continue;
      const preset = presetMap.get(net.networkId);
      if (!preset) continue;

      results.push({
        networkId: net.networkId,
        name: preset.name,
        chainId: preset.chainId,
        nativeSymbol: preset.symbol,
        supportSingleSwap: net.supportSingleSwap,
        supportCrossChainSwap: net.supportCrossChainSwap,
        supportLimit: net.supportLimit,
      });
    }

    cachedNetworks = results;
    return results;
  } catch {
    return [];
  }
}

export function registerSwapNetworksCommand(parent: Command): void {
  parent
    .command('networks')
    .description('List supported swap networks')
    .option('--json', 'Output as JSON')
    .action(async (options: { json?: boolean }) => {
      const config = await ConfigManager.load();
      const networks = await fetchSwapNetworks(config.env);

      if (networks.length === 0) {
        console.error(
          'Failed to fetch swap networks. Check your internet connection.',
        );
        process.exitCode = 1;
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(networks, null, 2));
        return;
      }

      const tick = '\u2713';
      const cross = '\u2717';
      const header = [
        'Network'.padEnd(20),
        'Chain ID'.padEnd(10),
        'Token'.padEnd(8),
        'Swap'.padEnd(6),
        'Bridge'.padEnd(8),
        'Limit'.padEnd(6),
      ].join('');
      console.log(header);
      console.log('-'.repeat(header.length));

      for (const net of networks) {
        console.log(
          [
            net.name.padEnd(20),
            net.chainId.padEnd(10),
            net.nativeSymbol.padEnd(8),
            (net.supportSingleSwap ? tick : cross).padEnd(6),
            (net.supportCrossChainSwap ? tick : cross).padEnd(8),
            (net.supportLimit ? tick : cross).padEnd(6),
          ].join(''),
        );
      }
    });
}
