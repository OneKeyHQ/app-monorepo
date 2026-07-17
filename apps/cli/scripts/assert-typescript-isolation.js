const { createRequire } = require('node:module');
const path = require('node:path');

const cliDir = path.resolve(__dirname, '..');
const repoDir = path.resolve(cliDir, '../..');
const cliRequire = createRequire(path.join(cliDir, 'package.json'));
const repoRequire = createRequire(path.join(repoDir, 'package.json'));
const cliManifest = cliRequire('./package.json');
const cliTypescriptManifestPath = cliRequire.resolve('typescript/package.json');
const cliTypescriptManifest = cliRequire(cliTypescriptManifestPath);
const expectedVersion = cliManifest.devDependencies.typescript;
const relativeTypescriptPath = path.relative(cliDir, cliTypescriptManifestPath);

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (
  relativeTypescriptPath.startsWith(`..${path.sep}`) ||
  path.isAbsolute(relativeTypescriptPath)
) {
  fail(
    `CLI TypeScript must be installed inside apps/cli, resolved: ${cliTypescriptManifestPath}`,
  );
}

if (cliTypescriptManifest.version !== expectedVersion) {
  fail(
    `Expected CLI TypeScript ${expectedVersion}, resolved ${cliTypescriptManifest.version}`,
  );
}

try {
  const rootTypescriptManifest = repoRequire('typescript/package.json');
  if (rootTypescriptManifest.version.startsWith('6.')) {
    fail(
      `TypeScript 6 must not be resolvable from the repository root, resolved ${rootTypescriptManifest.version}`,
    );
  }
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') {
    throw error;
  }
}

console.log(
  `CLI TypeScript ${cliTypescriptManifest.version} is isolated in apps/cli.`,
);
