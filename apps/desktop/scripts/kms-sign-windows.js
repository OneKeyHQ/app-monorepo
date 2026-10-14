/* eslint-disable onekey/no-raw-error -- standalone build script without app runtime dependencies */
const { execFileSync } = require('node:child_process');
const { X509Certificate } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const desktopDir = path.resolve(__dirname, '..');
const certDir = path.join(desktopDir, 'resources/windows/code-signing');
// Leaf first, then intermediates, as Jsign expects for --certfile.
const certChain = [
  'onekey-limited.cer',
  'globalsign-intermediate.cer',
  'globalsign-cross.cer',
];
const awsRegion = 'ap-southeast-1';
const outputDir = path.join(desktopDir, 'build-electron');

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for Windows AWS KMS signing`);
  }
  return value;
}

function runSignTool(args) {
  try {
    const output = execFileSync(requiredEnv('WIN_SIGNTOOL_PATH'), args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    process.stdout.write(output);
    return output;
  } catch (error) {
    if (error.stdout) {
      process.stdout.write(error.stdout);
    }
    throw error;
  }
}

// SHA-1 thumbprint of the checked-in leaf, so a signature from any other
// certificate (even one that chains to GlobalSign) fails verification.
const expectedThumbprint = new X509Certificate(
  fs.readFileSync(path.join(certDir, certChain[0])),
).fingerprint
  .replace(/:/g, '')
  .toUpperCase();

function verify(file) {
  const output = runSignTool(['verify', '/pa', '/all', '/v', file]);
  // `/all` prints one "Signature Index" block per signature; more than one
  // means a nested signature was appended instead of replaced.
  const signatureCount = (output.match(/^\s*Signature Index:/gm) || []).length;
  if (signatureCount !== 1) {
    throw new Error(
      `Expected exactly one signature on ${file}, found ${signatureCount}`,
    );
  }
  // The signing chain is printed root first, so the last SHA1 hash before the
  // timestamp section is the leaf that signed the file.
  const chainStart = output.indexOf('Signing Certificate Chain:');
  const timestampStart = output.indexOf('The signature is timestamped:');
  if (chainStart === -1 || timestampStart < chainStart) {
    throw new Error(`Missing signing chain or timestamp on ${file}`);
  }
  const chainHashes = [
    ...output
      .slice(chainStart, timestampStart)
      .matchAll(/SHA1 hash:\s*([0-9A-Fa-f]{40})/g),
  ];
  const thumbprint = chainHashes.at(-1)?.[1].toUpperCase();
  if (thumbprint !== expectedThumbprint) {
    throw new Error(
      `Unexpected signer certificate ${thumbprint} on ${file}, expected ${expectedThumbprint}`,
    );
  }
}

function certChainFile() {
  const file = path.join(
    requiredEnv('RUNNER_TEMP'),
    'onekey-codesign-chain.pem',
  );
  if (!fs.existsSync(file)) {
    const pem = certChain
      .map((name) =>
        new X509Certificate(
          fs.readFileSync(path.join(certDir, name)),
        ).toString(),
      )
      .join('');
    fs.writeFileSync(file, pem);
  }
  return file;
}

function signFile(file) {
  // Jsign reads AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN
  // from the environment set by aws-actions/configure-aws-credentials.
  const javaHome = process.env.JAVA_HOME;
  const java = javaHome ? path.join(javaHome, 'bin', 'java') : 'java';
  execFileSync(
    java,
    [
      '-jar',
      requiredEnv('WIN_JSIGN_JAR'),
      '--storetype',
      'AWS',
      '--keystore',
      awsRegion,
      '--alias',
      requiredEnv('WIN_KMS_KEY_ID'),
      '--certfile',
      certChainFile(),
      '--alg',
      'SHA-256',
      '--tsaurl',
      'http://timestamp.digicert.com',
      '--tsmode',
      'RFC3161',
      '--tsretries',
      '3',
      // electron-builder may sign a file that is already signed; replace the
      // existing signature instead of nesting a second one.
      '--replace',
      file,
    ],
    { stdio: 'inherit' },
  );
  verify(file);
  const manifest = path.join(
    requiredEnv('RUNNER_TEMP'),
    'onekey-windows-signed.jsonl',
  );
  fs.appendFileSync(manifest, `${JSON.stringify(file)}\n`);
}

function listExes(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listExes(file);
    }
    return entry.isFile() && entry.name.toLowerCase().endsWith('.exe')
      ? [file]
      : [];
  });
}

function verifyNsisOutput() {
  const manifest = path.join(
    requiredEnv('RUNNER_TEMP'),
    'onekey-windows-signed.jsonl',
  );
  const signed = fs
    .readFileSync(manifest, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const unpackedApps = signed.filter(
    (file) => path.basename(file) === 'OneKey.exe',
  );
  const uninstallers = signed.filter((file) =>
    file.endsWith('__uninstaller.exe'),
  );
  const installers = fs
    .readdirSync(outputDir)
    .filter((name) => name.toLowerCase().endsWith('.exe'))
    .map((name) => path.join(outputDir, name));
  if (
    unpackedApps.length === 0 ||
    uninstallers.length === 0 ||
    installers.length === 0
  ) {
    throw new Error(
      'Missing a signed app, NSIS uninstaller, or outer installer',
    );
  }
  for (const file of installers) {
    if (!signed.includes(file)) {
      throw new Error(`Unsigned NSIS installer: ${file}`);
    }
  }
  // Every executable that ships in an unpacked app (OneKey.exe, elevate.exe,
  // bridge and BLE helpers) must have gone through the signer.
  const unpackedExes = fs
    .readdirSync(outputDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith('-unpacked'))
    .flatMap((entry) => listExes(path.join(outputDir, entry.name)));
  const normalize = (file) => path.resolve(file).toLowerCase();
  const signedSet = new Set(signed.map(normalize));
  for (const file of unpackedExes) {
    if (!signedSet.has(normalize(file))) {
      throw new Error(`Unsigned packaged executable: ${file}`);
    }
  }
  for (const file of signed) {
    if (fs.existsSync(file)) {
      verify(file);
    }
  }
}

module.exports = async function signWithAwsKms(configuration) {
  if (configuration.hash !== 'sha256') {
    throw new Error(`Unsupported Windows signing hash: ${configuration.hash}`);
  }
  signFile(configuration.path);
};

if (require.main === module) {
  const command = process.argv[2];
  if (command === 'verify-nsis') {
    verifyNsisOutput();
  } else {
    throw new Error(`Unknown Windows signing command: ${command}`);
  }
}
