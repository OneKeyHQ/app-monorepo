/**
 * disclaimer:
 *
 * THIS PLUGIN IS A BIG HACK.
 *
 * don't even try to reason about the quality of the following lines of code.
 */

const path = require('path');
const process = require('process');

const enhancedResolve = require('enhanced-resolve');
const escalade = require('escalade/sync');

// Use me when needed
// const util = require('util');
// const inspect = (object) => {
//   console.log(util.inspect(object, { showHidden: false, depth: null }));
// };

const CWD = process.cwd();

/**
 * Check if two regexes are equal
 * Stolen from https://stackoverflow.com/questions/10776600/testing-for-equality-of-regular-expressions
 *
 * @param {RegExp} x
 * @param {RegExp} y
 * @returns {boolean}
 */
const regexEqual = (x, y) =>
  x instanceof RegExp &&
  y instanceof RegExp &&
  x.source === y.source &&
  x.global === y.global &&
  x.ignoreCase === y.ignoreCase &&
  x.multiline === y.multiline;

/**
 * Logger for the debug mode
 * @param {boolean} enable enable the logger or not
 * @returns {(message: string, force: boolean) => void}
 */
const createLogger = (enable) => (message, force) => {
  if (enable || force) console.info(`next-transpile-modules - ${message}`);
};

/**
 * Matcher function for webpack to decide which modules to transpile
 * TODO: could be simplified
 *
 * @param {string[]} modulesToTranspile
 * @param {function} logger
 * @returns {(path: string) => boolean}
 */
const createWebpackMatcher = (
  modulesToTranspile,
  logger = createLogger(false),
) => {
  // create an array of tuples with each passed in module to transpile and its node_modules depth
  // example: ['/full/path/to/node_modules/button/node_modules/icon', 2]
  const modulePathsWithDepth = modulesToTranspile.map((modulePath) => [
    modulePath,
    (modulePath.match(/node_modules/g) || []).length,
  ]);

  return function withTmFileMatcher(filePath) {
    const nodeModulesDepth = (filePath.match(/node_modules/g) || []).length;

    // TODO fix hardcode
    // @react-navigation back png image build
    if (
      filePath.includes('node_modules/@react-navigation') &&
      filePath.endsWith('.png')
    ) {
      logger(`check file:>>>>>> ${filePath}`);
      return true;
    }

    if (
      filePath.startsWith(path.join(CWD, '')) &&
      !filePath.startsWith(path.join(CWD, 'node_modules'))
    ) {
      logger(`check file:>>>>>> ${filePath}`);
      return true;
    }

    return modulePathsWithDepth.some(([modulePath, moduleDepth]) => {
      // Ensure we aren't implicitly transpiling nested dependencies by comparing depths of modules to be transpiled and the module being checked
      const transpiled =
        filePath.startsWith(modulePath) && nodeModulesDepth === moduleDepth;
      if (transpiled) logger(`transpiled: ${filePath}`);
      return transpiled;
    });
  };
};

/**
 * Transpile modules with Next.js Babel configuration
 * @param {string[]} modules
 * @param {{resolveSymlinks?: boolean, debug?: boolean, __unstable_matcher?: (path: string) => boolean}} options
 */
const withTmInitializer = (modules = [], options = {}) => {
  const withTM = (nextConfig = {}) => {
    if (modules.length === 0) return nextConfig;

    const resolveSymlinks =
      'resolveSymlinks' in options ? options.resolveSymlinks : true;
    const isWebpack5 =
      nextConfig.webpack5 !== undefined ? nextConfig.webpack5 : true;
    const debug = options.debug || false;

    const logger = createLogger(debug);

    /**
     * Our own Node.js resolver that can ignore symlinks resolution and  can support
     * PnP
     */
    const resolve = enhancedResolve.create.sync({
      symlinks: resolveSymlinks,
      extensions: [
        '.js',
        '.jsx',
        '.ts',
        '.d.ts',
        '.tsx',
        '.mjs',
        '.css',
        '.scss',
        '.sass',
      ],
      mainFields: ['main', 'module', 'source'],
      // Is it right? https://github.com/webpack/enhanced-resolve/issues/283#issuecomment-775162497
      conditionNames: ['require'],
      exportsFields: [], // we do that because 'package.json' is usually not present in exports
    });

    /**
     * Deprecated require.resolve
     * @deprecated
     */
    const deprecatedResolve = enhancedResolve.create.sync({
      symlinks: resolveSymlinks,
      extensions: [
        '.js',
        '.jsx',
        '.ts',
        '.d.ts',
        '.tsx',
        '.mjs',
        '.css',
        '.scss',
        '.sass',
      ],
      mainFields: ['main', 'module', 'source'],
      // Is it right? https://github.com/webpack/enhanced-resolve/issues/283#issuecomment-775162497
      conditionNames: ['require'],
    });

    /**
     * Deprecated getPackageRootDirectory
     * @deprecated
     */
    const deprecatedGetPackageRootDirectory = (module) => {
      let packageLookupDirectory;
      let packageRootDirectory;

      // Get the module path
      // eslint-disable-next-line prefer-const
      packageLookupDirectory = deprecatedResolve(CWD, module);

      // Get the location of its package.json
      const packageJsonPath = escalade(
        packageLookupDirectory,
        (_dir, names) => {
          if (names.includes('package.json')) {
            return 'package.json';
          }
          return false;
        },
      );

      if (packageJsonPath == null) {
        throw new Error(
          `next-transpile-modules - an error happened when trying to get the root directory of "${module}". Is it missing a package.json?`,
        );
      }
      // eslint-disable-next-line prefer-const
      packageRootDirectory = path.dirname(packageJsonPath);

      return packageRootDirectory;
    };

    /**
     * Return the root path (package.json directory) of a given module
     * @param {string} module
     * @returns {string}
     */
    const getPackageRootDirectory = (module) => {
      let packageLookupDirectory;
      let packageRootDirectory;

      try {
        packageLookupDirectory = resolve(
          CWD,
          path.join(module, 'package.json'),
        );
        packageRootDirectory = path.dirname(packageLookupDirectory);
      } catch (err) {
        // DEPRECATED: previous lookup for specific modules, it's confusing, and
        // will be removed in a next major version
        try {
          logger(
            `DEPRECATED - fallbacking to previous module resolution system for module "${module}", you can now just pass the name of the package to transpile and it will detect its real path without you having to pass a sub-module.`,
            true,
          );

          packageRootDirectory = deprecatedGetPackageRootDirectory(module);
        } catch (err) {
          throw new Error(
            `next-transpile-modules - an unexpected error happened when trying to resolve "${module}". Are you sure the name module you are trying to transpile is correct, and it has a "main" or an "exports" field?\n${err}`,
          );
        }
      }

      return packageRootDirectory;
    };

    logger(
      `trying to resolve the following modules:\n${modules
        .map((mod) => `  - ${mod}`)
        .join('\n')}`,
    );

    // Resolve modules to their real paths
    const modulesPaths = modules
      .map((name) =>
        name.endsWith('/dist/main.cjs')
          ? name.split('/dist/main.cjs')[0]
          : name,
      )
      .map(getPackageRootDirectory);

    logger(
      `the following paths will get transpiled:\n${modulesPaths
        .map((mod) => `  - ${mod}`)
        .join('\n')}`,
    );

    // Generate Webpack condition for the passed modules
    // https://webpack.js.org/configuration/module/#ruleinclude
    const matcher =
      options.__unstable_matcher || createWebpackMatcher(modulesPaths, logger);

    return {
      ...nextConfig,
      webpack(webpackConfig, nextOptions) {
        if (resolveSymlinks !== undefined) {
          // Avoid Webpack to resolve transpiled modules path to their real path as
          // we want to test modules from node_modules only. If it was enabled,
          // modules in node_modules installed via symlink would then not be
          // transpiled.
          webpackConfig.resolve.symlinks = resolveSymlinks;
        }

        webpackConfig.resolve.alias = {
          ...webpackConfig.resolve.alias,
          'react-native$': 'react-native-web',
        };
        const hasInclude = (context, request) => {
          let absolutePath;
          // If we the code requires/import an absolute path
          if (!request.startsWith('.')) {
            try {
              const moduleDirectory =
                deprecatedGetPackageRootDirectory(request);

              if (!moduleDirectory) return false;

              absolutePath = moduleDirectory;
            } catch (err) {
              return false;
            }
          } else {
            // Otherwise, for relative imports
            absolutePath = path.resolve(context, request);
          }
          return modulesPaths.some((mod) => absolutePath.startsWith(mod));
        };

        // Since Next.js 8.1.0, config.externals is undefined
        if (webpackConfig.externals) {
          webpackConfig.externals = webpackConfig.externals.map((external) => {
            if (typeof external !== 'function') return external;
            if (isWebpack5) {
              return async (options1) => {
                const externalResult = await external(options1);
                if (externalResult) {
                  try {
                    const resolve = options1.getResolve();
                    const resolved = await resolve(
                      options1.context,
                      options1.request,
                    );
                    if (modulesPaths.some((mod) => resolved.startsWith(mod)))
                      return;
                  } catch (e) {
                    console.error(e);
                  }
                }
                return externalResult;
              };
            }
            return (context, request, cb) => {
              external(context, request, (err, external1) => {
                if (err || !external1 || !hasInclude(context, request))
                  return cb(err, external1);
                cb();
              });
            };
          });
        }

        // Add a rule to include and parse all modules (js & ts)
        if (isWebpack5) {
          // isWebpack5

          // nextWithTM/js-loader
          webpackConfig.module.rules.push({
            __ruleName__: 'js-rule@withTM',
            test: /\.+(js|jsx|mjs|ts|tsx)$/,
            use: nextOptions.defaultLoaders.babel,
            include: matcher,
            exclude: [/node_modules/],
            type: 'javascript/auto',
          });

          webpackConfig.module.rules.push({
            __ruleName__: 'rn-js-rule@withTM',
            test: /(@?react-(navigation|native)).*\.(ts|js)x?$/,
            use: nextOptions.defaultLoaders.babel,
            exclude: [
              /react-native-logs/,
              /react-native-modalize/
            ],
            type: 'javascript/auto',
          });

          // nextWithTM/img-loader
          webpackConfig.module.rules.push({
            __ruleName__: 'file-rule@withTM',
            test: /\.(png|jpg|jpeg|gif|webp|ico|bmp|svg|eot|otf|ttf|woff|woff2)$/i,
            // test: /\.(png|jpg|jpeg|gif|webp|ico|bmp|svg)$/i,
            use: {
              loader: 'file-loader',
              options: {
                name: '[name].[hash:6].[ext]',
                esModule: false,
              },
            },
            include: matcher,
            // exclude: /node_modules/,
          });

          webpackConfig.module.rules.push({
            exclude: [/@babel(?:\/|\\{1,2})runtime/],
            test: /\.(js|mjs|jsx|ts|tsx|css)$/,
            resolve: {
              fullySpecified: false,
            },
          });
          if (resolveSymlinks === false) {
            // IMPROVE ME: we are losing all the cache on node_modules, which is terrible
            // The problem is managedPaths does not allow to isolate specific specific folders
            webpackConfig.snapshot = Object.assign(
              webpackConfig.snapshot || {},
              {
                managedPaths: [],
              },
            );
          }
        } else {
          // isWebpack4
          webpackConfig.module.rules.push({
            test: /\.+(js|jsx|mjs|ts|tsx)$/,
            loader: nextOptions.defaultLoaders.babel,
            include: matcher,
          });
        }

        // Support CSS modules + global in node_modules
        // TODO ask Next.js maintainer to expose the css-loader via defaultLoaders
        const nextCssLoaders = webpackConfig.module.rules.find(
          (rule) => typeof rule.oneOf === 'object',
        );

        // .module.css
        if (nextCssLoaders) {
          const nextCssLoader = nextCssLoaders.oneOf.find(
            (rule) =>
              rule.sideEffects === false &&
              regexEqual(rule.test, /\.module\.css$/),
          );

          const nextSassLoader = nextCssLoaders.oneOf.find(
            (rule) =>
              rule.sideEffects === false &&
              regexEqual(rule.test, /\.module\.(scss|sass)$/),
          );

          if (nextCssLoader) {
            nextCssLoader.issuer.or = nextCssLoader.issuer.and
              ? nextCssLoader.issuer.and.concat(matcher)
              : matcher;
            delete nextCssLoader.issuer.not;
            delete nextCssLoader.issuer.and;
          } else {
            console.warn(
              'next-transpile-modules - could not find default CSS rule, CSS imports may not work',
            );
          }

          if (nextSassLoader) {
            nextSassLoader.issuer.or = nextSassLoader.issuer.and
              ? nextSassLoader.issuer.and.concat(matcher)
              : matcher;
            delete nextSassLoader.issuer.not;
            delete nextSassLoader.issuer.and;
          } else {
            console.warn(
              'next-transpile-modules - could not find default SASS rule, SASS imports may not work',
            );
          }
        }

        // Add support for Global CSS imports in transpiled modules
        if (nextCssLoaders) {
          const nextGlobalCssLoader = nextCssLoaders.oneOf.find(
            (rule) =>
              rule.sideEffects === true &&
              regexEqual(rule.test, /(?<!\.module)\.css$/),
          );

          if (nextGlobalCssLoader) {
            nextGlobalCssLoader.issuer = {
              or: [matcher, nextGlobalCssLoader.issuer],
            };
            nextGlobalCssLoader.include = {
              or: [...modulesPaths, nextGlobalCssLoader.include],
            };
          } else if (!nextOptions.isServer) {
            // Note that Next.js ignores global CSS imports on the server
            console.warn(
              'next-transpile-modules - could not find default CSS rule, global CSS imports may not work',
            );
          }

          const nextGlobalSassLoader = nextCssLoaders.oneOf.find(
            (rule) =>
              rule.sideEffects === true &&
              regexEqual(rule.test, /(?<!\.module)\.(scss|sass)$/),
          );

          // FIXME: SASS works only when using a custom _app.js file.
          // See https://github.com/vercel/next.js/blob/24c3929ec46edfef8fb7462a17edc767a90b5d2b/packages/next/build/webpack/config/blocks/css/index.ts#L211
          if (nextGlobalSassLoader) {
            nextGlobalSassLoader.issuer = {
              or: [matcher, nextGlobalSassLoader.issuer],
            };
          } else if (!nextOptions.isServer) {
            // Note that Next.js ignores global SASS imports on the server
            console.info(
              'next-transpile-modules - global SASS imports only work with a custom _app.js file',
            );
          }
        }

        // Make hot reloading work!
        // FIXME: not working on Wepback 5
        // https://github.com/vercel/next.js/issues/13039
        webpackConfig.watchOptions = webpackConfig.watchOptions || {
          // aggregateTimeout: 200,
          // poll: 1000,
          ignored: [
            // '**/node_modules/**'
          ],
        };
        webpackConfig.watchOptions.ignored = [
          ...webpackConfig.watchOptions.ignored.filter(
            (pattern) => pattern !== '**/node_modules/**',
          ),
          `**node_modules/{${modules
            .map((mod) => `!(${mod})`)
            .join(',')}}/**/*`,
        ];

        // Overload the Webpack config if it was already overloaded
        if (typeof nextConfig.webpack === 'function') {
          return nextConfig.webpack(webpackConfig, nextOptions);
        }

        return webpackConfig;
      },
    };
  };

  return withTM;
};

module.exports = withTmInitializer;
