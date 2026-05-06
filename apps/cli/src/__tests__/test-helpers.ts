import { Command } from 'commander';

import { OutputFormatter } from '../output';

export interface ICommandRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Extract parseable JSON from CLI output that may contain debug log lines
 * (e.g., isExtensionBackgroundServiceWorker from shared package).
 * Tries each line (last-to-first) to find one that parses as JSON.
 */
export function extractJson(raw: string): string {
  const lines = raw.split('\n');
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i].trim();
    if (
      (line.startsWith('{') && line.endsWith('}')) ||
      (line.startsWith('[') && line.endsWith(']'))
    ) {
      try {
        JSON.parse(line);
        return line;
      } catch {
        // not valid JSON, try next line
      }
    }
  }
  return raw;
}

/**
 * Strip debug noise from CLI output for non-JSON assertions.
 * Removes lines that start with known debug prefixes.
 */
export function stripDebugOutput(raw: string): string {
  // The debug block looks like:
  //   isExtensionBackgroundServiceWorker {
  //     _isExtensionBackgroundServiceWorker: false,
  //     _isExtensionBackgroundHtml: false
  //   }
  // Remove it as a whole, then strip runtime warnings unrelated to CLI output.
  const cleaned = raw
    .replace(/isExtensionBackgroundServiceWorker\s*\{[\s\S]*?\}/g, '')
    .split('\n')
    .filter(
      (line) =>
        !line.includes('DeprecationWarning') &&
        !line.includes('--localstorage-file') &&
        !line.includes('--trace-warnings'),
    )
    .join('\n')
    .trim();
  return cleaned;
}

export function createTestProgram(): Command {
  const program = new Command();
  program
    .name('onekey-test')
    .exitOverride()
    .option('--json', 'Force JSON output')
    .option('--interactive', 'Force interactive mode')
    .option('--quiet', 'Suppress non-essential output')
    .option('--env <env>', 'Environment: test | prod', 'prod')
    .option('--yes', 'Skip confirmation prompts');

  program.hook('preAction', (_thisCommand, actionCommand) => {
    actionCommand.setOptionValue(
      '_outputFormatter',
      new OutputFormatter('agent'),
    );
  });

  return program;
}

export async function runCommand(
  program: Command,
  args: string[],
): Promise<ICommandRunResult> {
  let stdout = '';
  let stderr = '';
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  const originalExitCode = process.exitCode;

  process.exitCode = 0;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdout += chunk.toString();
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderr += chunk.toString();
    return true;
  }) as typeof process.stderr.write;

  try {
    await program.parseAsync(['node', 'onekey', ...args], { from: 'node' });
  } catch (error) {
    if (typeof process.exitCode !== 'number') {
      process.exitCode =
        typeof (error as { exitCode?: unknown }).exitCode === 'number'
          ? (error as { exitCode: number }).exitCode
          : 1;
    }
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }

  const exitCode = typeof process.exitCode === 'number' ? process.exitCode : 0;
  process.exitCode = originalExitCode;

  return {
    exitCode,
    stdout,
    stderr,
  };
}
