import { CHAINS } from '../config';
import { AppError, ERROR_CODES } from '../errors';
import { apiClient } from '../infra';
import { getSignerByImpl } from '../signer';

import type { OutputFormatter } from '../output';
import type { Command } from 'commander';

interface IAccountResponse {
  address: string;
  balance?: string;
  balanceParsed?: string;
  nonce?: number;
}

export function registerBalanceCommand(program: Command): void {
  program
    .command('balance')
    .description('Query wallet token balance on specified chain')
    .requiredOption('--chain <chain>', 'Target blockchain (e.g., eth, bsc)')
    .option('--address <address>', 'Override wallet address to query')
    .action(async (options: { chain: string; address?: string }, command) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const globalOpts = command.optsWithGlobals() as Record<string, unknown>;
      const output = globalOpts._outputFormatter as OutputFormatter;

      try {
        const chainName = options.chain;
        const chainConfig = CHAINS[chainName];
        if (!chainConfig) {
          throw new AppError(
            ERROR_CODES.PARAM_INVALID_CHAIN.code,
            `Unsupported chain: ${chainName}`,
            `Supported: ${Object.keys(CHAINS).join(', ')}`,
          );
        }

        let address = options.address;
        if (!address) {
          const signer = await getSignerByImpl(chainConfig.impl);
          const addrInfo = await signer.getAddress(chainConfig.networkId);
          address = addrInfo.address;
        } else if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
          throw new AppError(
            ERROR_CODES.PARAM_INVALID_ADDRESS.code,
            `Invalid address format: ${address}`,
            'Provide a valid 0x-prefixed EVM address (42 chars)',
          );
        }

        const account = await apiClient.get<IAccountResponse>(
          'wallet',
          '/wallet/v1/account/get-account',
          {
            networkId: chainConfig.networkId,
            accountAddress: address,
            withNetWorth: true,
          },
        );

        const balanceDisplay = account.balanceParsed ?? account.balance;
        if (balanceDisplay === null || balanceDisplay === undefined) {
          throw new AppError(
            ERROR_CODES.BIZ_UNKNOWN.code,
            'API response is missing balance data',
            'This may indicate an API contract change — please report this issue',
          );
        }

        output.success(
          { address, chain: chainName, balance: balanceDisplay },
          { chain: chainName },
        );
      } catch (error) {
        const appError = AppError.from(error);
        output.error(appError.toErrorDetail());
        process.exitCode = appError.exitCode;
      }
    });
}
