// cspell:ignore LavaMoat lavamoat napi

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const { createRequire } = require('node:module');
const os = require('node:os');
const path = require('node:path');
const { parseArgs } = require('node:util');

async function smokeCli({ outputPath, productionOutput = false } = {}) {
  const directory = outputPath
    ? path.resolve(outputPath)
    : fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-cli-smoke-'));
  fs.mkdirSync(directory, { recursive: true });
  const artifact = path.resolve(
    __dirname,
    productionOutput ? '../dist/cli.js' : '../dist-lavamoat/cli.js',
  );
  const source = fs.readFileSync(artifact, 'utf8');
  const pluginRequire = createRequire(require.resolve('@lavamoat/webpack'));
  const rawSes = fs.readFileSync(pluginRequire.resolve('ses'), 'utf8');
  assert.equal(source.split(rawSes).length, 2, 'one exact SES prelude');
  const report = {
    artifact,
    node: { version: process.version, executable: process.execPath },
    sha256: crypto.createHash('sha256').update(source).digest('hex'),
    commands: [],
    requests: [],
  };
  // A local proxy supplies an explicit offline response. No production service
  // or account is involved; the CLI still traverses its real HTTP adapter.
  const server = http.createServer((request, response) => {
    report.requests.push({ method: request.method, url: request.url });
    response.writeHead(503, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ message: 'Synthetic offline endpoint' }));
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const proxy = `http://127.0.0.1:${server.address().port}`;
  async function run(args) {
    const caseDirectory = fs.mkdtempSync(path.join(directory, 'command-'));
    const bootstrap = path.join(caseDirectory, 'bootstrap.cjs');
    const securityPath = path.join(caseDirectory, 'security.json');
    fs.writeFileSync(
      bootstrap,
      `const fs = require('node:fs');
      const os = require('node:os');
      const Module = require('node:module');
      os.homedir = () => ${JSON.stringify(path.join(caseDirectory, 'profile'))};
      const originalLoad = Module._load;
      let keyringLoads = 0;
      Module._load = function(request, ...rest) {
        if (request === '@napi-rs/keyring' || request.startsWith('@napi-rs/keyring-')) {
          keyringLoads += 1;
          throw new Error('Smoke commands must not load the system keyring');
        }
        return Reflect.apply(originalLoad, this, [request, ...rest]);
      };
      process.once('exit', () => fs.writeFileSync(${JSON.stringify(securityPath)}, JSON.stringify({
        harden: typeof harden, object: Object.isFrozen(Object.prototype),
        array: Object.isFrozen(Array.prototype), fn: Object.isFrozen(Function.prototype),
        tamper: Reflect.set(Object.prototype, '__cliSmokeMutation', true), keyringLoads
      })));
      process.argv = [process.execPath, ${JSON.stringify(artifact)}, ...${JSON.stringify(args)}];
      require(${JSON.stringify(artifact)});`,
    );
    const child = spawn(process.execPath, [bootstrap], {
      env: {
        ...process.env,
        HTTP_PROXY: proxy,
        HTTPS_PROXY: proxy,
        ALL_PROXY: proxy,
        NO_PROXY: '',
        http_proxy: proxy,
        https_proxy: proxy,
        all_proxy: proxy,
        no_proxy: '',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => {
      stdout += data;
    });
    child.stderr.on('data', (data) => {
      stderr += data;
    });
    const timeout = setTimeout(() => child.kill(), 30_000);
    const status = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', resolve);
    }).finally(() => clearTimeout(timeout));
    const result = { args, status, stdout, stderr };
    report.commands.push(result);
    assert.equal(
      stderr
        .replace(
          /\(node:\d+\) \[DEP0040\] DeprecationWarning: The `punycode` module is deprecated\. Please use a userland alternative instead\.\n\(Use `node --trace-deprecation \.\.\.` to show where the warning was created\)\n/g,
          '',
        )
        .trim(),
      '',
      'Unexpected CLI stderr',
    );
    assert.ok(fs.existsSync(securityPath), stderr);
    result.security = JSON.parse(fs.readFileSync(securityPath, 'utf8'));
    assert.deepEqual(result.security, {
      harden: 'function',
      object: true,
      array: true,
      fn: true,
      tamper: false,
      keyringLoads: 0,
    });
    return result;
  }
  try {
    let result = await run(['schema', '--list']);
    assert.equal(result.status, 0, result.stderr);
    const commands = JSON.parse(result.stdout);
    for (const name of ['auth-login', 'wallet-address-types', 'status']) {
      assert.ok(commands.includes(name), name);
    }
    result = await run(['schema', 'wallet-address-types']);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).name, 'wallet-address-types');
    result = await run(['--json', 'wallet', 'address-types', '--chain', 'btc']);
    assert.equal(result.status, 0, result.stderr);
    const metadata = JSON.parse(result.stdout);
    assert.equal(metadata.ok, true);
    assert.ok(
      metadata.data.some(
        (entry) =>
          entry.addressType === 'native-segwit' &&
          entry.addressEncoding === 'P2WPKH',
      ),
    );
    result = await run(['--json', '--env', 'invalid', 'version']);
    assert.notEqual(result.status, 0);
    assert.equal(JSON.parse(result.stdout).error.code, 'PARAM_INVALID_CONFIG');
    assert.deepEqual(
      report.requests,
      [],
      'static discovery must not use the network',
    );
    result = await run(['--json', 'status']);
    assert.notEqual(result.status, 0);
    assert.equal(JSON.parse(result.stdout).error.code, 'NET_HTTP_ERROR');
    assert.equal(report.requests.length, 1);
    assert.match(
      report.requests[0].url,
      /\/wallet\/v1\/account\/get-account\?/,
    );
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed';
    report.error = { message: error.message, stack: error.stack };
    throw error;
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.writeFileSync(
      path.join(directory, 'report.json'),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  }
}

if (require.main === module) {
  const { values } = parseArgs({
    options: {
      output: { type: 'string' },
      'production-output': { type: 'boolean' },
    },
    strict: true,
  });
  smokeCli({
    outputPath: values.output,
    productionOutput: values['production-output'],
  }).catch((error) => {
    process.stderr.write(`${error.stack || error}\n`);
    process.exitCode = 1;
  });
}

module.exports = { smokeCli };
