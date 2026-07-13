import { resolveChain } from '../core';
import { AppError, ERROR_CODES } from '../errors';
import { signInputSchema } from '../schemas';
import { getSignerByImpl } from '../signer';

import {
  requireAuthenticatedCommand,
  requireStringOption,
} from './command-guards';

import type { OutputFormatter } from '../output';
import type { ISigner } from '../signer';
import type { Command } from 'commander';

type ISignCommandOptions = {
  address?: string;
  chain?: string;
  path?: string;
  pub?: string;
  tx?: string;
};

type ISignCommandOutput = {
  signature: string;
  txid?: string;
};

type ISignCommandDependencies = {
  getSignerByImpl?: (impl: string) => Promise<ISigner>;
  output: Pick<OutputFormatter, 'error' | 'success'>;
  requireAuthenticatedCommand?: () => Promise<void>;
  resolveChain?: typeof resolveChain;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseEncodedTx(rawTx: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(rawTx) as unknown;
    if (!isRecord(parsed)) {
      throw new AppError(
        ERROR_CODES.INVALID_TX.code,
        'Transaction JSON must be an object.',
        'Pass a JSON object with --tx.',
      );
    }
    return parsed;
  } catch (error) {
    throw new AppError(
      ERROR_CODES.INVALID_TX.code,
      error instanceof Error ? error.message : 'Invalid transaction JSON.',
      'Pass a JSON object with --tx.',
      { cause: error },
    );
  }
}

export async function executeSignCommand(
  options: ISignCommandOptions,
  dependencies: ISignCommandDependencies,
): Promise<void> {
  const {
    getSignerByImpl: getSigner = getSignerByImpl,
    output,
    requireAuthenticatedCommand:
      requireAuthenticated = requireAuthenticatedCommand,
    resolveChain: resolve = resolveChain,
  } = dependencies;

  try {
    await requireAuthenticated();

    const validated = signInputSchema.parse({
      ...options,
      address: requireStringOption(options.address, '--address <address>'),
      path: requireStringOption(options.path, '--path <path>'),
      pub: requireStringOption(options.pub, '--pub <public-key>'),
      tx: requireStringOption(options.tx, '--tx <json>'),
    });
    const chainConfig = resolve(validated.chain ?? 'eth');
    const encodedTx = parseEncodedTx(validated.tx);
    const signer = await getSigner(chainConfig.impl);

    const signedTx = await signer.signTransaction({
      networkId: chainConfig.networkId,
      account: {
        address: validated.address,
        path: validated.path,
        pub: validated.pub,
      },
      unsignedTx: { encodedTx },
    });
    const result: ISignCommandOutput = {
      signature: signedTx.signature ?? signedTx.rawTx,
      ...(signedTx.txid ? { txid: signedTx.txid } : {}),
    };

    output.success(result);
  } catch (error) {
    const appError = AppError.from(error);
    output.error(appError.toErrorDetail());
    process.exitCode = appError.exitCode;
  }
}

export function registerSignCommand(program: Command): void {
  program
    .command('sign')
    .description('Sign an encoded transaction locally')
    .option('--tx <json>', 'JSON encoded transaction payload')
    .option('--address <address>', 'Signing account address')
    .option('--path <path>', 'HD derivation path')
    .option('--pub <public-key>', 'Account public key')
    .option('--chain <chain>', 'Target blockchain (e.g., eth, bsc)', 'eth')
    .action(async (options: ISignCommandOptions, command: Command) => {
      const globalOpts = command.optsWithGlobals();
      const output = globalOpts._outputFormatter as OutputFormatter;
      await executeSignCommand(options, { output });
    });
}
