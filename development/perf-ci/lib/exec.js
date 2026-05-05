const { spawn } = require('child_process');

function execCmd(cmd, args, { cwd, env, timeoutMs, stdout, stderr } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let out = '';
    let err = '';

    const onStdout = stdout || ((d) => (out += d.toString()));
    const onStderr = stderr || ((d) => (err += d.toString()));

    child.stdout.on('data', onStdout);
    child.stderr.on('data', onStderr);

    let t = null;
    if (timeoutMs && timeoutMs > 0) {
      t = setTimeout(() => {
        child.kill('SIGKILL');
        reject(
          new Error(
            `Command timed out after ${timeoutMs}ms: ${cmd} ${args.join(' ')}`,
          ),
        );
      }, timeoutMs);
    }

    child.on('error', (e) => {
      if (t) clearTimeout(t);
      reject(e);
    });

    child.on('close', (code, signal) => {
      if (t) clearTimeout(t);
      resolve({ code, signal, stdout: out, stderr: err });
    });
  });
}

module.exports = {
  execCmd,
};
