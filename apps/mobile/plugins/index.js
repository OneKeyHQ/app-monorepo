/* eslint-disable spellcheck/spell-checker */

const _ = require('lodash');

module.exports = (config, projectRoot) => {
  if (process.env.NODE_ENV !== 'production' && process.env.SPLIT_BUNDLE) {
    const path = require('path');
    const fs = require('fs-extra');
    const connect = require('connect');
    const dynamicImports = require('./dynamicImports');
    const { fileToIdMap } = require('./map');
    const fileMapCacheDirectoryPath = path.resolve(
      projectRoot,
      'node_modules',
      '.cache/file-map-cache',
    );
    fs.ensureDirSync(fileMapCacheDirectoryPath);
    const workspaceRoot = path.resolve(projectRoot, '../..');
    // 1. Watch all files within the monorepo
    config.watchFolders = [workspaceRoot];
    // 2. Let Metro know where to resolve packages and in what order
    config.resolver.nodeModulesPaths = [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ];
    config.fileMapCacheDirectory = fileMapCacheDirectoryPath;

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

    const ip = require('ip');
    const metroServerIP = ip.address();
    const requireTpl = fs.readFileSync(
      path.resolve(__dirname, `./asyncRequireTpl.js`),
      'utf8',
    );
    const asyncRequireModulePath = path.resolve(
      projectRoot,
      'node_modules',
      `.cache/tpl/asyncRequire.js`,
    );
    fs.ensureFileSync(asyncRequireModulePath);
    fs.writeFileSync(
      asyncRequireModulePath,
      requireTpl
        .replace('__METRO_HOST_IP__', metroServerIP)
        .replace(
          '__CHUNK_MODULE_ID_TO_HASH_MAP__',
          path.join(__dirname, './chunkModuleIdToHashMap.js'),
        ),
      'utf8',
    );
    config.transformer.asyncRequireModulePath = asyncRequireModulePath;

    // config.serializer.processModuleFilter = (() => {
    //   const dllArr = [];
    //   const busineArr = [];
    //   const timeId = null;

    //   return (arg) =>
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

    //     true;
    // })();

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

    const beforeCustomSerializer = (
      entryPoint,
      prepend,
      graph,
      bundleOptions,
    ) => {
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

      return bundle;
    };

    const outputChunkDir = path.resolve(projectRoot, 'dist/chunks');
    config.server.enhanceMiddleware = (metroMiddleware, metroServer) =>
      connect()
        .use(metroMiddleware)
        .use('/async-thunks', (req, res, next) => {
          const { url } = req;
          console.log(
            `Fetch Module by http://${req.headers.host}${url}, user-agent:${req.headers['user-agent']}`,
          );
          const query = url.split('?').pop();
          const params = new URLSearchParams(query);
          const hash = params.get('hash');
          console.log(
            `check the file in ${path.join(outputChunkDir, `${hash}.bundle`)}`,
          );
          const content = fs.readFileSync(
            path.resolve(outputChunkDir, `${hash}.bundle`),
            'utf8',
          );
          if (hash) {
            res.end(content);
          } else {
            next();
          }
        });
    config.hooks = {
      onEnd: () =>
        new Promise((resolve) => {
          console.log('onended');
          setTimeout(() => {
            resolve();
          }, 2000);
        }),
    };
  }
  return config;
};
