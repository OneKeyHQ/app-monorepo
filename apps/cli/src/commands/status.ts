import type { Command } from 'commander';
import { AppError } from '../errors';
import type { IEndpointEnv } from '../config';
import { apiClient } from '../infra';
import type { OutputFormatter } from '../output';

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Check system status and API connectivity')
    .action(async (_options, command) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const globalOpts = command.optsWithGlobals() as Record<string, unknown>;
      const output = globalOpts._outputFormatter as OutputFormatter;

      try {
        const env = ((globalOpts.env as string) ?? 'test') as IEndpointEnv;
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
        if (appError.exitCode <= 1) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          const statusOpts = command.optsWithGlobals() as Record<
            string,
            unknown
          >;
          output.success({
            status: 'connected',
            env: (statusOpts.env as string) ?? 'test',
            note: 'API reachable (business error expected for zero address)',
          });
          return;
        }
        output.error(appError.toErrorDetail());
        process.exitCode = appError.exitCode;
      }
    });
}
