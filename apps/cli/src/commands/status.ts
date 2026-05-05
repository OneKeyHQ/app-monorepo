import { AppError } from '../errors';
import { apiClient } from '../infra';

import type { IEndpointEnv } from '../config';
import type { OutputFormatter } from '../output';
import type { Command } from 'commander';

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Check system status and API connectivity')
    .action(async (_options, command) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const globalOpts = command.optsWithGlobals() as Record<string, unknown>;
      const output = globalOpts._outputFormatter as OutputFormatter;

      try {
        const env = ((globalOpts.env as string) ?? 'prod') as IEndpointEnv;
        apiClient.setEnv(env);

        const start = Date.now();
        await apiClient.get('wallet', '/wallet/v1/account/get-account', {
          networkId: 'evm--1',
          accountAddress: '0x0000000000000000000000000000000000000000',
        });
        const latency = Date.now() - start;

        output.success({ status: 'connected', env, latency_ms: latency });
      } catch (error) {
        const appError =
          error instanceof AppError ? error : AppError.from(error);
        if (appError.code.startsWith('BIZ_')) {
          // Server responded with a business error — API is reachable
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          const statusOpts = command.optsWithGlobals() as Record<
            string,
            unknown
          >;
          output.success({
            status: 'connected',
            env: (statusOpts.env as string) ?? 'prod',
            note: 'API reachable (business error expected for zero address)',
          });
          return;
        }
        output.error(appError.toErrorDetail());
        process.exitCode = appError.exitCode;
      }
    });
}
