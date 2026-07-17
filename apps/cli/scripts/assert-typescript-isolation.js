const { createRequire } = require('node:module');
const path = require('node:path');

const cliDir = path.resolve(__dirname, '..');
const toolchainDir = path.resolve(cliDir, '../cli-toolchain');
const repoDir = path.resolve(cliDir, '../..');
const cliRequire = createRequire(path.join(cliDir, 'package.json'));
const toolchainRequire = createRequire(path.join(toolchainDir, 'package.json'));
const repoRequire = createRequire(path.join(repoDir, 'package.json'));
const toolchainManifest = toolchainRequire('./package.json');
const toolchainTypescriptManifestPath = toolchainRequire.resolve(
  'typescript/package.json',
);
const toolchainTypescriptManifest = toolchainRequire(
  toolchainTypescriptManifestPath,
);
const expectedVersion = toolchainManifest.dependencies.typescript;
const relativeTypescriptPath = path.relative(
  toolchainDir,
  toolchainTypescriptManifestPath,
);

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (
  relativeTypescriptPath.startsWith(`..${path.sep}`) ||
  path.isAbsolute(relativeTypescriptPath)
) {
  fail(
    `CLI TypeScript must be installed inside apps/cli-toolchain, resolved: ${toolchainTypescriptManifestPath}`,
  );
}

if (toolchainTypescriptManifest.version !== expectedVersion) {
  fail(
    `Expected CLI TypeScript ${expectedVersion}, resolved ${toolchainTypescriptManifest.version}`,
  );
}

for (const [scope, scopedRequire] of [
  ['repository root', repoRequire],
  ['apps/cli', cliRequire],
]) {
  try {
    const typescriptManifest = scopedRequire('typescript/package.json');
    if (typescriptManifest.version.startsWith('6.')) {
      fail(
        `TypeScript 6 must not be resolvable from ${scope}, resolved ${typescriptManifest.version}`,
      );
    }
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') {
      throw error;
    }
  }
}

console.log(
  `CLI TypeScript ${toolchainTypescriptManifest.version} is isolated in apps/cli-toolchain.`,
);
