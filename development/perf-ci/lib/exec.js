const { spawn } = require('child_process');
const path = require('path');

function appendTail(buffer, chunk, maxChars) {
  const next = `${buffer}${chunk}`;
  return next.length > maxChars ? next.slice(next.length - maxChars) : next;
}

function execCmd(
  cmd,
  args,
  { cwd, env, timeoutMs, stdout, stderr, maxBufferChars = 200_000 } = {},
) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });

    let out = '';
    let err = '';
    let settled = false;

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

    let t = null;
    if (timeoutMs && timeoutMs > 0) {
      t = setTimeout(() => {
        const message = [
          `Command timed out after ${timeoutMs}ms: ${cmd} ${args.join(' ')}`,
          formatExecResultError('timed out command', {
            code: 'timeout',
            stdout: out,
            stderr: err,
          }),
        ].join('\n');
        try {
          const childPid = child.pid;
          if (typeof childPid === 'number') {
            process.kill(0 - childPid, 'SIGKILL');
          } else {
            child.kill('SIGKILL');
          }
        } catch {
          child.kill('SIGKILL');
        }
        if (!settled) {
          settled = true;
          reject(new Error(message));
        }
      }, timeoutMs);
    }

    child.on('error', (e) => {
      if (t) clearTimeout(t);
      if (settled) return;
      settled = true;
      reject(e);
    });

    child.on('close', (code, signal) => {
      if (t) clearTimeout(t);
      if (settled) return;
      settled = true;
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
