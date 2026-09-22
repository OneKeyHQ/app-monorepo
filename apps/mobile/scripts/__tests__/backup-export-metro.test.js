const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { transformFileSync } = require('@babel/core');
const { resolve } = require('metro-resolver');
const ts = require('typescript');

const repoRoot = path.resolve(__dirname, '../../../..');
const originModulePath = path.join(
  repoRoot,
  'packages/kit-bg/src/services/ServiceCloudBackupV2/createBackupExportArchive.ts',
);

function getPackage(packageJsonPath) {
  return fs.existsSync(packageJsonPath)
    ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    : null;
}

function getPackageForModule(modulePath) {
  for (
    let directory = path.dirname(modulePath);
    directory !== path.dirname(directory);
    directory = path.dirname(directory)
  ) {
    const packageJson = getPackage(path.join(directory, 'package.json'));
    if (packageJson) {
      return {
        rootPath: directory,
        packageJson,
        packageRelativePath: path.relative(directory, modulePath),
      };
    }
  }
  return null;
}

function createContext() {
  return {
    originModulePath,
    allowHaste: false,
    assetExts: new Set(),
    customResolverOptions: {},
    disableHierarchicalLookup: false,
    dev: false,
    extraNodeModules: {},
    nodeModulesPaths: [path.join(repoRoot, 'node_modules')],
    mainFields: ['react-native', 'browser', 'main'],
    preferNativePlatform: true,
    sourceExts: ['js', 'jsx', 'json', 'ts', 'tsx', 'cjs', 'mjs'],
    unstable_conditionNames: ['require', 'react-native'],
    unstable_conditionsByPlatform: {},
    // Match mobile/metro.config.js; Node/Jest honors exports-only subpaths.
    unstable_enablePackageExports: false,
    unstable_incrementalResolution: false,
    unstable_logWarning: () => {},
    doesFileExist: (file) => fs.existsSync(file) && fs.statSync(file).isFile(),
    fileSystemLookup: (file) => {
      if (!fs.existsSync(file)) return { exists: false };
      return {
        exists: true,
        type: fs.statSync(file).isDirectory() ? 'd' : 'f',
        realPath: fs.realpathSync(file),
      };
    },
    getPackage,
    getPackageForModule,
    resolveAsset: () => null,
    redirectModulePath: (file) => file,
    resolveHasteModule: () => null,
    resolveHastePackage: () => null,
  };
}

it.each(['ios', 'android'])(
  'resolves the actual backup export dependencies with Metro on %s',
  (platform) => {
    const source = ts.createSourceFile(
      originModulePath,
      fs.readFileSync(originModulePath, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const imports = [];
    function visit(node) {
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        imports.push(node.arguments[0].text);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    expect(imports).toHaveLength(2);
    for (const specifier of imports) {
      const resolved = resolve(createContext(), specifier, platform);
      expect(resolved.type).toBe('sourceFile');
      expect(fs.existsSync(resolved.filePath)).toBe(true);
    }
  },
);

it('compiles the ZIP codec loader with the bundled Hermes compiler', () => {
  const zipRoot = path.dirname(require.resolve('@zip.js/zip.js/package.json'));
  const { code } = transformFileSync(
    path.join(zipRoot, 'lib/core/codec-registry.js'),
    {
      babelrc: false,
      configFile: false,
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    },
  );
  const compilerRoot = path.dirname(
    require.resolve('hermes-compiler/package.json'),
  );
  const compilerPlatform = {
    darwin: 'osx-bin',
    linux: 'linux64-bin',
    win32: 'win64-bin',
  }[process.platform];
  const compiler = path.join(
    compilerRoot,
    'hermesc',
    compilerPlatform,
    process.platform === 'win32' ? 'hermesc.exe' : 'hermesc',
  );
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'backup-zip-hermes-'),
  );
  try {
    const input = path.join(directory, 'codec.js');
    fs.writeFileSync(input, code);
    const result = spawnSync(
      compiler,
      ['-emit-binary', '-out', path.join(directory, 'codec.hbc'), input],
      { encoding: 'utf8' },
    );
    expect(result.error).toBeUndefined();
    expect(result.stderr).not.toContain('error:');
    expect(result.status).toBe(0);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
