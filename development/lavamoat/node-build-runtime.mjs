// cspell:ignore LavaMoat lavamoat Loggerr

import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';

import errors from './error.cjs';

const { LavaMoatError } = errors;

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const entry = path.join(
  repoRoot,
  'apps/cli/scripts/build-lavamoat-runtime.cjs',
);
const policyDirectory = path.join(repoRoot, 'lavamoat/node/build-tools');
const policyPath = path.join(policyDirectory, 'policy.json');
const policyOverridePath = path.join(policyDirectory, 'policy-override.json');

function createBuildLogger() {
  const nodeRequire = createRequire(import.meta.url);
  const runtimeRequire = createRequire(
    nodeRequire.resolve('@lavamoat/node/package.json'),
  );
  const { Loggerr } = runtimeRequire('loggerr');
  const log = new Loggerr({
    formatter: 'cli',
    streams: Array(8).fill(process.stderr),
    level: Loggerr.INFO,
  });
  const originalWarning = log.warning.bind(log);
  log.warning = (...args) => {
    const message = stripVTControlCharacters(args.map(String).join(' '));
    if (
      message.includes('is not a builtin module, but was loaded as a builtin')
    ) {
      // esbuild's optional PnP discovery is unreachable with this repository's
      // node-modules linker. Other implicit exits would skip package isolation.
      if (
        !message.startsWith(
          'pnpapi is not a builtin module, but was loaded as a builtin from esbuild.',
        )
      ) {
        throw new LavaMoatError(
          `Unprotected implicit build dependency: ${message}`,
        );
      }
      const cliRequire = createRequire(
        path.join(repoRoot, 'apps/cli/package.json'),
      );
      const esbuildRequire = createRequire(
        cliRequire.resolve('esbuild/package.json'),
      );
      try {
        esbuildRequire.resolve('pnpapi');
      } catch (error) {
        if (error.code === 'MODULE_NOT_FOUND') {
          originalWarning(...args);
          return;
        }
        throw error;
      }
      throw new LavaMoatError(
        'The protected build runner requires the reviewed node-modules linker',
      );
    }
    originalWarning(...args);
  };
  return log;
}

export async function runBuildRuntime({ generate = false, outputPath } = {}) {
  // Importing the official runtime locks down this dedicated process. Keep it
  // out of the ordinary build process and never execute a completed CLI bundle.
  const { generatePolicy, run, writePolicy } = await import('@lavamoat/node');
  const log = createBuildLogger();
  if (generate) {
    await fs.mkdir(policyDirectory, { recursive: true });
    const policy = await generatePolicy(entry, {
      projectRoot: repoRoot,
      log,
      policyPath,
      policyOverridePath,
      write: false,
    });
    if (!policy.resources?.esbuild?.builtin) {
      throw new LavaMoatError(
        'Build policy must include esbuild as a protected package',
      );
    }
    await writePolicy(policyPath, policy);
    return policy;
  }
  await fs.access(policyPath);
  const exports = await run(entry, {
    projectRoot: repoRoot,
    log,
    policyPath,
    policyOverridePath,
  });
  const buildCli = exports.default;
  if (typeof buildCli !== 'function')
    throw new LavaMoatError(
      'Protected build entry must export a build function',
    );
  return buildCli({
    outputPath:
      outputPath || path.join(repoRoot, 'apps/cli/dist-build-runtime'),
  });
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length && args[0] !== '--generate-policy')) {
    throw new LavaMoatError('Expected no arguments or --generate-policy');
  }
  await runBuildRuntime({ generate: args[0] === '--generate-policy' });
}
