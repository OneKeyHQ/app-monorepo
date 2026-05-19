module.exports = (config, projectRoot) => {
  const path = require('path');
  const dotenv = require('dotenv');
  // Just for reading Expo mobile environment variables `SPLIT_BUNDLE`,
  // So we don't create another .expo.plugin file.
  dotenv.config({
    path: path.resolve(__dirname, '../../../.env.expo'),
  });
  if (process.env.SPLIT_BUNDLE) {
    const fs = require('fs-extra');
    const connect = require('connect');
    const dynamicImports = require('./dynamicImports');
    const segmentSerializer = require('./segmentSerializer');
    const { fileToIdMap } = require('./map');
    const useSegments = process.env.SPLIT_BUNDLE_SEGMENTS === 'true';
    const workspaceRoot = path.resolve(projectRoot, '../..');
    const getAssets = require(
      path.resolve(
        __dirname,
        '../../../node_modules',
        'metro/src/DeltaBundler/Serializers/getAssets',
      ),
    ).default;
    const { sourceMapStringNonBlocking } = require(
      path.resolve(
        __dirname,
        '../../../node_modules',
        'metro/src/DeltaBundler/Serializers/sourceMapString',
      ),
    );
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
        )
        .replace(
          '__ASYNC_REQUIRE_CORE__',
          path.join(__dirname, './asyncRequireCore.js'),
        )
        .replace('__NODE_ENV__', process.env.NODE_ENV),
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

    config.serializer.createModuleIdFactory = () => (filePath) => {
      const id = fileToIdMap.get(filePath);
      if (typeof id !== 'number') {
        return fileToIdMap.safeSet(filePath);
      }
      return id;
    };

    // When ONEKEY_STARTUP_PROFILE=1 is set at bundle time, inject a prologue
    // into the main entry module that (1) flips the globalThis flag the JS
    // runtime reads in `apps/mobile/src/startupProfile`, and (2) publishes a
    // moduleId→path map so the profile log can show module paths instead of
    // opaque numeric ids. The map covers entries in `fileToIdMap`.
    //
    // When the env var is NOT set, the prologue reduces to `pendingChunks` only
    // (original behavior) — zero overhead.
    //
    // The prologue construction lives in `./startupProfilePrologue.js` because
    // `scripts/unionBuild.js` needs the exact same injection (its writeBundle
    // path bypasses this customSerializer entirely).
    const { buildStartupProfilePrologue } = require('./startupProfilePrologue');

    const beforeCustomSerializer = (
      entryPoint,
      prepend,
      graph,
      _bundleOptions,
    ) => {
      const profilePrologue = buildStartupProfilePrologue({ fileToIdMap });
      for (const [entryKey, value] of graph.dependencies) {
        // to entry file injection of global variables __APP__
        if (entryPoint === entryKey) {
          for (const { data } of value.output) {
            const headers = ['var pendingChunks = {};'];
            if (profilePrologue) headers.push(profilePrologue);
            data.code = `${headers.join('\n')}\n${data.code}`;
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
    ) => {
      beforeCustomSerializer(entryPoint, prepend, graph, bundleOptions);
      // Use segment serializer for production named segments when enabled.
      // Both main and background runtimes produce segments (Phase 3).
      let bundle;
      if (useSegments && !bundleOptions.dev) {
        bundle = await segmentSerializer(
          entryPoint,
          prepend,
          graph,
          bundleOptions,
        );
      } else {
        bundle = await dynamicImports(
          entryPoint,
          prepend,
          graph,
          bundleOptions,
        );
      }

      // EAS export:embed sets serializerOptions.output='static' and expects
      // { artifacts: [...], assets: [...] } instead of bundleToString's { code, metadata }.
      const isStaticOutput =
        bundleOptions?.serializerOptions?.output === 'static';
      if (isStaticOutput) {
        const code = typeof bundle === 'string' ? bundle : bundle.code;
        const platform = graph.transformOptions?.platform || 'android';

        // Generate source map: bundleToString returns {code, metadata} without a map,
        // so we must generate it from the graph modules for Sentry/debugging.
        let map = typeof bundle === 'object' && bundle.map ? bundle.map : null;
        if (!map) {
          map = await sourceMapStringNonBlocking(
            [...prepend, ...graph.dependencies.values()],
            {
              excludeSource: false,
              processModuleFilter:
                bundleOptions.processModuleFilter || (() => true),
              shouldAddToIgnoreList:
                bundleOptions.shouldAddToIgnoreList || (() => false),
              getSourceUrl: (module) => module.path,
            },
          );
        }

        // Collect Metro assets (images, fonts, etc.) so EAS can copy them into the app
        const metroAssets = await getAssets(graph.dependencies, {
          processModuleFilter:
            bundleOptions.processModuleFilter || (() => true),
          assetPlugins: config.transformer?.assetPlugins || [],
          platform,
          projectRoot,
          publicPath: '/assets/',
        });

        return {
          artifacts: [
            {
              type: 'js',
              source: code,
              filename: 'index.bundle',
              originFilename: entryPoint,
              metadata: {},
            },
            {
              type: 'map',
              source: map,
              filename: 'index.bundle.map',
              originFilename: entryPoint,
              metadata: {},
            },
          ],
          assets: metroAssets,
        };
      }

      return bundle;
    };

    const applyFixImageAssetsMiddleware = (middleware) => {
      return (req, res, next) => {
        console.log('req.url', req.url);
        return middleware(req, res, next);
      };
    };

    const outputChunkDir = path.resolve(projectRoot, 'dist/chunks');
    config.server.enhanceMiddleware = (metroMiddleware, _metroServer) =>
      connect()
        .use(applyFixImageAssetsMiddleware(metroMiddleware))
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
    // config.hooks = {
    //   onEnd: () =>
    //     new Promise((resolve) => {
    //       const { linkAssets } = require('./linkAssets');
    //       linkAssets(projectRoot);
    //       resolve();
    //     }),
    // };
  }
  return config;
};
