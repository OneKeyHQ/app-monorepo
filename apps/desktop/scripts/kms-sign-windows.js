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

function runSignTool(args, { quiet = false } = {}) {
  try {
    const output = execFileSync(requiredEnv('WIN_SIGNTOOL_PATH'), args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', quiet ? 'pipe' : 'inherit'],
    });
    if (!quiet) {
      process.stdout.write(output);
    }
    return output;
  } catch (error) {
    if (error.stdout && !quiet) {
      process.stdout.write(error.stdout);
    }
    throw error;
  }
}

// signExts also matches non-Windows binaries shipped by some packages (for
// example macOS-only .node files); only PE images can be code-signed.
function isPortableExecutable(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const header = Buffer.alloc(2);
    return fs.readSync(fd, header, 0, 2, 0) === 2 && header.toString() === 'MZ';
  } finally {
    fs.closeSync(fd);
  }
}

// Verification output when the file already has a valid trusted signature,
// or null otherwise.
function existingSignature(file) {
  try {
    return runSignTool(['verify', '/pa', '/v', file], { quiet: true });
  } catch {
    return null;
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

function recordSigned(file) {
  const manifest = path.join(
    requiredEnv('RUNNER_TEMP'),
    'onekey-windows-signed.jsonl',
  );
  fs.appendFileSync(manifest, `${JSON.stringify(file)}\n`);
}

function signFile(file) {
  if (!isPortableExecutable(file)) {
    console.log(`Skipping non-PE file: ${file}`);
    return;
  }
  const existing = existingSignature(file);
  if (existing && !existing.toUpperCase().includes(expectedThumbprint)) {
    // Keep vendor signatures (e.g. Microsoft VC++ runtime) instead of
    // replacing them with ours.
    console.log(`Keeping existing third-party signature: ${file}`);
    return;
  }
  if (existing) {
    verify(file);
    recordSigned(file);
    return;
  }
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
  recordSigned(file);
}

// Files that NSIS embeds directly into the installer, outside electron-builder's
// signing pipeline: the 7za extractor run during install (path matches the
// app-builder-lib patch) and the custom installer UI plugin.
function installerPayload() {
  const appBuilderLib = path.dirname(
    require.resolve('app-builder-lib/package.json', { paths: [desktopDir] }),
  );
  const sevenZipBin = path.dirname(
    require.resolve('7zip-bin/package.json', { paths: [appBuilderLib] }),
  );
  return [
    path.join(sevenZipBin, 'win', 'ia32', '7za.exe'),
    path.join(
      desktopDir,
      'build/nsis-duilib-ui/plugin/x86-unicode/nsis-duilib-ui.dll',
    ),
  ];
}

const peExtensions = new Set(['.exe', '.dll', '.node']);

function listPeFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listPeFiles(file);
    }
    return entry.isFile() &&
      peExtensions.has(path.extname(entry.name).toLowerCase()) &&
      isPortableExecutable(file)
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
  const normalize = (file) => path.resolve(file).toLowerCase();
  const signedSet = new Set(signed.map(normalize));
  for (const file of installerPayload()) {
    if (!signedSet.has(normalize(file))) {
      throw new Error(`Unsigned installer payload: ${file}`);
    }
  }
  // Every PE file that ships in an unpacked app must have gone through the
  // signer. Executables must carry our signature; DLLs and native modules may
  // instead keep a valid vendor signature (e.g. the Microsoft VC++ runtime).
  const unpackedFiles = fs
    .readdirSync(outputDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith('-unpacked'))
    .flatMap((entry) => listPeFiles(path.join(outputDir, entry.name)));
  for (const file of unpackedFiles) {
    const signedByUs = signedSet.has(normalize(file));
    const isExe = path.extname(file).toLowerCase() === '.exe';
    if (!signedByUs && (isExe || !existingSignature(file))) {
      throw new Error(`Unsigned packaged file: ${file}`);
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
  if (command === 'sign-installer-payload') {
    installerPayload().forEach(signFile);
  } else if (command === 'verify-nsis') {
    verifyNsisOutput();
  } else {
    throw new Error(`Unknown Windows signing command: ${command}`);
  }
}
