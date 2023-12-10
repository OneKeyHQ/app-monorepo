/* eslint-disable spellcheck/spell-checker */
// Learn more https://docs.expo.dev/guides/monorepos
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs-extra');
const connect = require('connect');
const dynamicImports = require('./dynamicImports');
const { fileToIdMap } = require('./map');
// Find the project and workspace directories
const projectRoot = __dirname;
// This can be replaced with `find-yarn-workspace-root`
// const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.projectRoot = projectRoot;

const fileMapCacheDirectoryPath = path.resolve(
  __dirname,
  'node_modules',
  '.cache/file-map-cache',
);
fs.ensureDirSync(fileMapCacheDirectoryPath);
config.fileMapCacheDirectory = fileMapCacheDirectoryPath;

// hot-reload file type
// cjs is needed for superstruct: https://github.com/ianstormtaylor/superstruct/issues/404#issuecomment-800182972
config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  'text-js',
  'd.ts',
  'cjs',
  'min.js',
];
// https://www.npmjs.com/package/node-libs-react-native
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  crypto: require.resolve(
    '@onekeyhq/shared/src/modules3rdParty/cross-crypto/index.native.js',
  ),
  fs: require.resolve('react-native-level-fs'),
  path: require.resolve('path-browserify'),
  stream: require.resolve('readable-stream'),
  http: require.resolve('stream-http'),
  https: require.resolve('https-browserify'),
  net: require.resolve('react-native-tcp-socket'),
  tls: require.resolve('react-native-tcp-socket'),
  zlib: require.resolve('browserify-zlib'),
};

const workspaceRoot = path.resolve(projectRoot, '../..');
// 1. Watch all files within the monorepo
config.watchFolders = [workspaceRoot];
// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// 3. Force Metro to resolve (sub)dependencies only from the `nodeModulesPaths`
// config.resolver.disableHierarchicalLookup = true;
// config.transformer.getTransformOptions = async () => ({
//   transform: {
//     experimentalImportSupport: false,
//     inlineRequires: true,
//     unstable_disableES6Transforms: false,
//   },
//   preloadedModules: false,
//   ramGroups: [],
// });

// `Dynamic imports` is a feature that allows you to load modules on demand.
config.transformer.asyncRequireModulePath = path.resolve(
  __dirname,
  `asyncRequire.js`,
);

config.serializer.processModuleFilter = (() => {
  const dllArr = [];
  const busineArr = [];
  const timeId = null;

  return (arg) =>
    // const relativePath = replacePath(arg.path);
    // const arr =
    //   this.options.dll.entry.length !== 0 && isBaseDllPath(relativePath)
    //     ? dllArr
    //     : busineArr;
    // arr.push(relativePath);

    // timeId && clearTimeout(timeId);
    // timeId = setTimeout(async () => {
    //   try {
    //     const dllOutputPath = path.resolve(paths.outputDir, dllJsonName);
    //     const dllContent = JSON.stringify([...new Set(dllArr)], null, 2);
    //     await fse.writeFile(dllOutputPath, dllContent);
    //     console.log(
    //       `info Writing json output to: ${replacePath(dllOutputPath)}`,
    //     );
    //   } catch (err) {
    //     console.error(err);
    //   }
    // }, 1500);

    true;
})();

config.serializer.createModuleIdFactory = () => {
  let nextId = 0;
  return (path) => {
    let id = fileToIdMap.get(path);
    if (typeof id !== 'number') {
      // eslint-disable-next-line no-plusplus
      nextId += 1;
      id = nextId;
      fileToIdMap.set(path, id);
    }
    return id;
  };
};

const beforeCustomSerializer = (entryPoint, prepend, graph, bundleOptions) => {
  for (const [key, value] of graph.dependencies) {
    // to entry file injection of global variables __APP__
    if (entryPoint === key) {
      for (const { data } of value.output) {
        data.code = `__APP__= {}\n${data.code}`;
      }
      break;
    }
  }
};

config.serializer.customSerializer = async (
  entryPoint,
  prepend,
  graph,
  bundleOptions,
  ...args
) => {
  beforeCustomSerializer(entryPoint, prepend, graph, bundleOptions);
  const bundle = await dynamicImports(
    entryPoint,
    prepend,
    graph,
    bundleOptions,
  );

  // mcs.hooks.afterCustomSerializer.call(bundle);

  return bundle;
};

const outputChunkDir = path.resolve(__dirname, 'dist/chunks');
config.server.enhanceMiddleware = (metroMiddleware, metroServer) =>
  connect()
    .use(metroMiddleware)
    .use('/async-thunks', (req, res, next) => {
      const { url } = req;
      const query = url.split('?').pop();
      console.log(url, query);
      const params = new URLSearchParams(query);
      const hash = params.get('hash');
      console.log('async-thunks hash:', hash);
      const content = fs.readFileSync(
        path.resolve(outputChunkDir, `${hash}.bundle`),
        'utf8',
      );
      if (hash) {
        res.end(content);
      } else {
        // res.end(JSON.stringify([...dynamicImports.asyncModules]));
        next();
      }
    });

module.exports = config;
