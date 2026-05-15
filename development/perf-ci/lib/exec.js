const { spawn } = require('child_process');
const path = require('path');

const { stopChild } = require('./processTree');

function appendTail(buffer, chunk, maxChars) {
  const next = `${buffer}${chunk}`;
  return next.length > maxChars ? next.slice(next.length - maxChars) : next;
}

function execCmd(
  cmd,
  args,
  {
    cwd,
    env,
    timeoutMs,
    stdout,
    stderr,
    maxBufferChars = 200_000,
    killProcessGroup = false,
    stopTimeoutMs = 5000,
  } = {},
) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let stoppingForSignal = false;
    let t = null;

    const child = spawn(cmd, args, {
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: killProcessGroup,
    });

    let out = '';
    let err = '';
    let onSigint = null;
    let onSigterm = null;

    const cleanupSignalHandlers = () => {
      if (!killProcessGroup) return;
      if (onSigint) process.off('SIGINT', onSigint);
      if (onSigterm) process.off('SIGTERM', onSigterm);
    };

    const stopForSignal = async (signal, exitCode) => {
      if (stoppingForSignal) return;
      stoppingForSignal = true;
      if (t) clearTimeout(t);
      if (!settled) {
        settled = true;
        await stopChild(child, {
          signal,
          killSignal: 'SIGKILL',
          timeoutMs: stopTimeoutMs,
          killProcessGroup,
        });
        reject(
          new Error(
            `Command interrupted by ${signal}: ${cmd} ${args.join(' ')}`,
          ),
        );
      }
      cleanupSignalHandlers();
      process.exit(exitCode);
    };

    onSigint = () => {
      void stopForSignal('SIGINT', 130);
    };
    onSigterm = () => {
      void stopForSignal('SIGTERM', 143);
    };

    if (killProcessGroup) {
      process.once('SIGINT', onSigint);
      process.once('SIGTERM', onSigterm);
    }

    const onStdout = (d) => {
      out = appendTail(out, d.toString(), maxBufferChars);
      if (stdout) stdout(d);
    };
    const onStderr = (d) => {
      err = appendTail(err, d.toString(), maxBufferChars);
      if (stderr) stderr(d);
    };

    child.stdout.on('data', onStdout);
    child.stderr.on('data', onStderr);

    if (timeoutMs && timeoutMs > 0) {
      t = setTimeout(async () => {
        const message = [
          `Command timed out after ${timeoutMs}ms: ${cmd} ${args.join(' ')}`,
          formatExecResultError('timed out command', {
            code: 'timeout',
            stdout: out,
            stderr: err,
          }),
        ].join('\n');
        if (!settled) {
          settled = true;
          await stopChild(child, {
            signal: 'SIGTERM',
            killSignal: 'SIGKILL',
            timeoutMs: stopTimeoutMs,
            killProcessGroup,
          });
          cleanupSignalHandlers();
          reject(new Error(message));
        }
      }, timeoutMs);
    }

    child.on('error', (e) => {
      if (t) clearTimeout(t);
      if (settled) return;
      settled = true;
      cleanupSignalHandlers();
      reject(e);
    });

    child.on('close', (code, signal) => {
      if (t) clearTimeout(t);
      if (settled) return;
      settled = true;
      cleanupSignalHandlers();
      resolve({ code, signal, stdout: out, stderr: err });
    });
  });
}

function tailLines(text, maxLines = 80, maxChars = 8000) {
  const lines = String(text || '')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .slice(0 - maxLines);
  const tail = lines.join('\n');
  return tail.length > maxChars ? tail.slice(tail.length - maxChars) : tail;
}

function formatExecResultError(label, result, { outputDir } = {}) {
  const pieces = [
    `${label} failed with exit code ${result?.code ?? 'unknown'}`,
    outputDir ? `output=${outputDir}` : null,
  ].filter(Boolean);
  const recentOutput = tailLines([result?.stderr, result?.stdout].join('\n'));

  if (recentOutput) {
    pieces.push(`recent output:\n${recentOutput}`);
  }

  return pieces.join('\n');
}

function withRepoNodeBin(repoRoot, env = {}) {
  const repoBinPath = path.join(repoRoot, 'node_modules', '.bin');
  return {
    ...env,
    PATH: `${repoBinPath}${path.delimiter}${process.env.PATH || ''}`,
  };
}

module.exports = {
  execCmd,
  formatExecResultError,
  withRepoNodeBin,
};
