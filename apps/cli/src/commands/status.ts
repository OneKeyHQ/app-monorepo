import type { Command } from 'commander';
import { AppError } from '../errors';
import { apiClient } from '../infra';
import type { OutputFormatter } from '../output';

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Check system status and API connectivity')
    .action(async (_options, command) => {
      const output = command.optsWithGlobals()
        ._outputFormatter as OutputFormatter;

      try {
        const env = command.optsWithGlobals().env ?? 'test';
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
          output.success({
            status: 'connected',
            env: command.optsWithGlobals().env ?? 'test',
            note: 'API reachable (business error expected for zero address)',
          });
          return;
        }
        output.error(appError.toErrorDetail());
        process.exitCode = appError.exitCode;
      }
    });
}
