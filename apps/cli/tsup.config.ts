import { readFile } from 'node:fs/promises';
import * as path from 'node:path';

import { defineConfig } from 'tsup';
import * as ts from 'typescript';

import type { Plugin } from 'esbuild';

const resolvePath = (...paths: string[]) => path.resolve(...paths);
const pathSeparator = path.sep as string;
const readFileText = readFile as (
  filePath: string,
  encoding: BufferEncoding,
) => Promise<string>;

const repoRoot = resolvePath(__dirname, '../..');
const browserStorageGuardRoots = [
  resolvePath(repoRoot, 'apps'),
  resolvePath(repoRoot, 'packages'),
];
const browserStorageAllowlist = new Set<string>([
  resolvePath(repoRoot, 'packages/shared/src/utils/devModeUtils.ts'),
]);

function shouldGuardBrowserStorageSource(filePath: string): boolean {
  const normalizedPath = resolvePath(filePath);

  if (browserStorageAllowlist.has(normalizedPath)) {
    return false;
  }

  if (normalizedPath.endsWith('.d.ts')) {
    return false;
  }

  if (normalizedPath.includes(`${pathSeparator}node_modules${pathSeparator}`)) {
    return false;
  }

  return browserStorageGuardRoots.some((root) =>
    normalizedPath.startsWith(`${root}${pathSeparator}`),
  );
}

function isDeclarationIdentifier(
  node: ts.Identifier,
  parent: ts.Node | undefined,
): boolean {
  if (!parent) {
    return false;
  }

  return (
    (ts.isVariableDeclaration(parent) && parent.name === node) ||
    (ts.isParameter(parent) && parent.name === node) ||
    (ts.isFunctionDeclaration(parent) && parent.name === node) ||
    (ts.isClassDeclaration(parent) && parent.name === node) ||
    (ts.isInterfaceDeclaration(parent) && parent.name === node) ||
    (ts.isTypeAliasDeclaration(parent) && parent.name === node) ||
    (ts.isEnumDeclaration(parent) && parent.name === node) ||
    (ts.isBindingElement(parent) && parent.name === node) ||
    (ts.isPropertyDeclaration(parent) && parent.name === node) ||
    (ts.isPropertySignature(parent) && parent.name === node) ||
    (ts.isMethodDeclaration(parent) && parent.name === node) ||
    (ts.isMethodSignature(parent) && parent.name === node) ||
    (ts.isImportSpecifier(parent) &&
      (parent.propertyName === node || parent.name === node)) ||
    (ts.isImportClause(parent) && parent.name === node) ||
    (ts.isNamespaceImport(parent) && parent.name === node) ||
    (ts.isImportEqualsDeclaration(parent) && parent.name === node) ||
    (ts.isExportSpecifier(parent) &&
      (parent.propertyName === node || parent.name === node))
  );
}

function collectBrowserStorageViolations(
  filePath: string,
  contents: string,
): Array<{ text: string; line: number; column: number }> {
  const sourceFile = ts.createSourceFile(
    filePath,
    contents,
    ts.ScriptTarget.Latest,
    true,
  );
  const violations = new Map<
    string,
    { text: string; line: number; column: number }
  >();
  const storageNames = new Set(['localStorage', 'sessionStorage']);

  const addViolation = (node: ts.Node, accessText: string) => {
    const start = node.getStart(sourceFile);
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(start);
    const key = `${line}:${character}:${accessText}`;

    if (!violations.has(key)) {
      violations.set(key, {
        text: accessText,
        line: line + 1,
        column: character,
      });
    }
  };

  const visit = (node: ts.Node) => {
    if (ts.isPropertyAccessExpression(node)) {
      const objectName = node.expression.getText(sourceFile);
      const propertyName = node.name.text;

      if (
        storageNames.has(objectName) ||
        ((objectName === 'globalThis' ||
          objectName === 'window' ||
          objectName === 'self') &&
          storageNames.has(propertyName))
      ) {
        addViolation(node, node.getText(sourceFile));
      }
    }

    if (ts.isIdentifier(node) && storageNames.has(node.text)) {
      const parent = node.parent;
      const isPropertyAccessName =
        ts.isPropertyAccessExpression(parent) && parent.name === node;

      if (!isDeclarationIdentifier(node, parent) && !isPropertyAccessName) {
        addViolation(node, node.getText(sourceFile));
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return [...violations.values()];
}

const guardBrowserStoragePlugin: Plugin = {
  name: 'guard-browser-storage',
  setup(build) {
    build.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, async (args) => {
      if (!shouldGuardBrowserStorageSource(args.path)) {
        return undefined;
      }

      const contents = await readFileText(args.path, 'utf8');
      const violations = collectBrowserStorageViolations(args.path, contents);

      if (violations.length === 0) {
        return undefined;
      }

      return {
        errors: violations.map((violation) => ({
          text: `CLI bundle must not reference browser storage API "${violation.text}". Move it behind a web-only adapter or guard it explicitly for CLI.`,
          location: {
            file: args.path,
            line: violation.line,
            column: violation.column,
            lineText: contents.split('\n')[violation.line - 1] ?? '',
          },
        })),
      };
    });
  },
};

// Shim non-English locale JSON files — CLI only outputs English, saves ~10MB
const shimLocalePlugin: Plugin = {
  name: 'shim-locale',
  setup(build) {
    // Dynamic imports like: import('./json/ru.json')
    // The filter matches the specifier, not the resolved path
    build.onResolve({ filter: /\.json$/ }, (args) => {
      if (!args.path.includes('json/') || args.path.includes('en_US')) {
        return undefined;
      }
      // Only shim locale JSON files from shared/src/locale/json/
      if (
        args.resolveDir.includes('locale') ||
        args.importer.includes('locale')
      ) {
        return { path: args.path, namespace: 'locale-shim' };
      }
      return undefined;
    });
    build.onLoad({ filter: /.*/, namespace: 'locale-shim' }, () => ({
      contents: 'module.exports = {}',
      loader: 'js',
    }));
  },
};

const shimHdCorePackageJsonPlugin: Plugin = {
  name: 'shim-hd-core-package-json',
  setup(build) {
    build.onResolve({ filter: /^@onekeyfe\/hd-core\/package\.json$/ }, () => ({
      path: resolvePath(
        repoRoot,
        'node_modules/@onekeyfe/hd-core/package.json',
      ),
      namespace: 'hd-core-package-json-shim',
    }));

    build.onLoad(
      { filter: /.*/, namespace: 'hd-core-package-json-shim' },
      async (args) => {
        const pkg = JSON.parse(await readFileText(args.path, 'utf8')) as {
          version?: string;
        };
        return {
          contents: `module.exports = ${JSON.stringify({
            version: pkg.version ?? '0.0.0',
          })};`,
          loader: 'js',
        };
      },
    );
  },
};

const shimReactNativePlugin: Plugin = {
  name: 'shim-react-native',
  setup(build) {
    // Only shim modules that contain native RN code (Flow/JSI)
    // Do NOT shim pure-JS packages like react-native-logs
    const shimmedModules = [
      /^react-native$/,
      /^react-native\//,
      /^react-native-nitro-modules/,
      /^react-native-webview/,
      /^react-native-mmkv/,
      /^react-native-keyboard-controller/,
      /^react-native-reanimated/,
      /^react-native-gesture-handler/,
      /^react-native-safe-area-context/,
      /^react-native-screens/,
      /^@react-native\//,
      /^@react-native-community\//,
      /^@react-native-async-storage/,
      /^@react-native-firebase/,
      /^expo-/,
      /^expo$/,
      /^@sentry\/react-native/,
    ];

    build.onResolve({ filter: /.*/ }, (args) => {
      for (const pattern of shimmedModules) {
        if (pattern.test(args.path)) {
          return { path: args.path, namespace: 'rn-shim' };
        }
      }
      return undefined;
    });

    // CJS shim that works with esbuild's __toESM wrapper.
    // __toESM does: target = Object.create(Object.getPrototypeOf(mod))
    // then copies own props. By making getPrototypeOf return the proxy
    // itself, the created target inherits from the proxy, so any
    // property access falls through to the proxy's get trap.
    build.onLoad({ filter: /.*/, namespace: 'rn-shim' }, () => ({
      contents: `
        "use strict";
        function createShim() {
          var fn = function() { return createShim(); };
          fn.__esModule = true;
          var p = new Proxy(fn, {
            get: function(target, prop) {
              if (typeof prop === 'symbol') return target[prop];
              if (prop === '__esModule') return true;
              return createShim();
            },
            apply: function() { return createShim(); },
            construct: function() { return createShim(); },
            getPrototypeOf: function() { return p; },
          });
          return p;
        }
        var shim = createShim();
        module.exports = shim;
      `,
      loader: 'js',
    }));
  },
};

const shimCrossInpageProviderDebugBrowserPlugin: Plugin = {
  name: 'shim-cross-inpage-provider-debug-browser',
  setup(build) {
    // Intercept the hardcoded `import browser from './browser'` inside
    // @onekeyfe/cross-inpage-provider-core/dist/debug/index.js.
    // The browser.js module tries to use localStorage which doesn't exist in Node.
    build.onResolve({ filter: /^\.\/browser$/ }, (args) => {
      if (
        args.importer.includes(
          `${pathSeparator}@onekeyfe${pathSeparator}cross-inpage-provider-core${pathSeparator}`,
        ) &&
        args.importer.includes(`${pathSeparator}debug${pathSeparator}`)
      ) {
        return {
          path: resolvePath(args.resolveDir, args.path),
          namespace: 'cross-inpage-provider-debug-browser-shim',
        };
      }
      return undefined;
    });

    build.onLoad(
      {
        filter: /.*/,
        namespace: 'cross-inpage-provider-debug-browser-shim',
      },
      () => ({
        resolveDir: resolvePath(repoRoot, 'node_modules'),
        contents: `
          // Node.js-compatible shim for cross-inpage-provider-core debug/browser.js
          var ms = require("ms");
          var noopStorage = {
            getItem: function() { return Promise.resolve(""); },
            setItem: function() { return Promise.resolve(); },
            removeItem: function() { return Promise.resolve(); },
          };
          var exportsBrowser = {
            formatArgs: function(args) {
              args[0] = this.namespace + " " + args[0] + " +" + ms(this.diff);
            },
            save: function() {},
            load: function() {
              return typeof process !== "undefined" && process.env && process.env.DEBUG
                ? process.env.DEBUG
                : "";
            },
            useColors: function() { return false; },
            storage: noopStorage,
            humanize: ms,
            destroy: function() {},
            log: function() {
              if (typeof console !== "undefined" && console.debug) {
                console.debug.apply(console, arguments);
              }
            },
            colors: [],
          };
          module.exports = exportsBrowser;
          module.exports.default = exportsBrowser;
        `,
        loader: 'js',
      }),
    );
  },
};

const shimCrossInpageProviderLoggerPlugin: Plugin = {
  name: 'shim-cross-inpage-provider-logger',
  setup(build) {
    build.onResolve({ filter: /^\.\/loggerConsole$/ }, (args) => {
      if (
        args.importer.includes(
          `${pathSeparator}@onekeyfe${pathSeparator}cross-inpage-provider-core${pathSeparator}`,
        )
      ) {
        return {
          path: resolvePath(args.resolveDir, args.path),
          namespace: 'cross-inpage-provider-logger-shim',
        };
      }
      return undefined;
    });

    build.onLoad(
      { filter: /.*/, namespace: 'cross-inpage-provider-logger-shim' },
      () => ({
        contents: `
          "use strict";
          Object.defineProperty(exports, "__esModule", { value: true });
          exports.commonLogger = exports.LogLevel = exports.Logger = void 0;
          exports.setStoredLogConfig = setStoredLogConfig;
          var LogLevel;
          (function(LogLevel) {
            LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
            LogLevel[LogLevel["LOG"] = 1] = "LOG";
            LogLevel[LogLevel["WARN"] = 2] = "WARN";
            LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
          })(LogLevel || (exports.LogLevel = LogLevel = {}));
          function setStoredLogConfig() {}
          class Logger {
            constructor(module = null) {
              this.module = module;
              this.level = process.env.NODE_ENV === "production"
                ? LogLevel.ERROR
                : LogLevel.DEBUG;
            }
            shouldLog(level) {
              return level >= this.level;
            }
            formatMessage(...args) {
              return this.module ? ["[" + this.module + "]:", ...args] : args;
            }
            debug(...args) {
              if (this.shouldLog(LogLevel.DEBUG)) {
                console.debug(...this.formatMessage(...args));
              }
            }
            log(...args) {
              if (this.shouldLog(LogLevel.LOG)) {
                console.log(...this.formatMessage(...args));
              }
            }
            warn(...args) {
              if (this.shouldLog(LogLevel.WARN)) {
                console.warn(...this.formatMessage(...args));
              }
            }
            error(...args) {
              if (this.shouldLog(LogLevel.ERROR)) {
                console.error(...this.formatMessage(...args));
              }
            }
          }
          exports.Logger = Logger;
          const commonLogger = new Logger();
          exports.commonLogger = commonLogger;
        `,
        loader: 'js',
      }),
    );
  },
};

function replaceExact(
  contents: string,
  filePath: string,
  replacements: Array<{ search: string; replace: string }>,
): string {
  return replacements.reduce((currentContents, replacement) => {
    if (!currentContents.includes(replacement.search)) {
      throw new TypeError(
        `Missing expected deprecated Buffer constructor patch target in ${filePath}: ${replacement.search}`,
      );
    }

    return currentContents.split(replacement.search).join(replacement.replace);
  }, contents);
}

function isNodeModuleFile(filePath: string, segments: string[]): boolean {
  return resolvePath(filePath).endsWith(segments.join(pathSeparator));
}

const pathSeparatorPattern = String.raw`[\/\\]`;
const deprecatedBufferPatchFilter = new RegExp(
  `(?:${[
    ['xmlhttprequest-ssl', 'lib', 'XMLHttpRequest'].join(pathSeparatorPattern),
    // cspell:ignore ethjs
    `ethjs-util${pathSeparatorPattern}(?:lib|src)${pathSeparatorPattern}index`,
    ['protobufjs', 'src', 'util', 'minimal'].join(pathSeparatorPattern),
    ['form-data', 'lib', 'form_data'].join(pathSeparatorPattern),
    ['tweetnacl-util', 'nacl-util'].join(pathSeparatorPattern),
    ['wif', 'index'].join(pathSeparatorPattern),
    ['whatwg-url', 'lib', 'url-state-machine'].join(pathSeparatorPattern),
  ].join('|')})\\.js$`,
);

const patchDeprecatedBufferConstructorPlugin: Plugin = {
  name: 'patch-deprecated-buffer-constructors',
  setup(build) {
    build.onLoad({ filter: deprecatedBufferPatchFilter }, async (args) => {
      let contents = await readFileText(args.path, 'utf8');
      let patched = false;

      if (
        isNodeModuleFile(args.path, [
          'node_modules',
          'xmlhttprequest-ssl',
          'lib',
          'XMLHttpRequest.js',
        ])
      ) {
        contents = replaceExact(contents, args.path, [
          {
            search: 'new Buffer(settings.user + ":" + settings.password)',
            replace: 'Buffer.from(settings.user + ":" + settings.password)',
          },
        ]);
        patched = true;
      }

      if (
        isNodeModuleFile(args.path, [
          'node_modules',
          'ethjs-util',
          'lib',
          'index.js',
        ]) ||
        isNodeModuleFile(args.path, [
          'node_modules',
          'ethjs-util',
          'src',
          'index.js',
        ])
      ) {
        contents = replaceExact(contents, args.path, [
          {
            search: "new Buffer(padToEven(hex.slice(2)), 'hex')",
            replace: "Buffer.from(padToEven(hex.slice(2)), 'hex')",
          },
          {
            search:
              "new Buffer(padToEven(stripHexPrefix(hex).replace(/^0+|0+$/g, '')), 'hex')",
            replace:
              "Buffer.from(padToEven(stripHexPrefix(hex).replace(/^0+|0+$/g, '')), 'hex')",
          },
          {
            search: "new Buffer(stringValue, 'utf8')",
            replace: "Buffer.from(stringValue, 'utf8')",
          },
        ]);
        patched = true;
      }

      if (
        isNodeModuleFile(args.path, [
          'node_modules',
          'protobufjs',
          'src',
          'util',
          'minimal.js',
        ])
      ) {
        contents = replaceExact(contents, args.path, [
          {
            search: 'return new Buffer(value, encoding);',
            replace: 'return Buffer.from(value, encoding);',
          },
          {
            search: 'return new Buffer(size);',
            replace: 'return Buffer.alloc(size);',
          },
        ]);
        patched = true;
      }

      if (
        isNodeModuleFile(args.path, [
          'node_modules',
          'form-data',
          'lib',
          'form_data.js',
        ])
      ) {
        contents = replaceExact(contents, args.path, [
          {
            search:
              'var dataBuffer = new Buffer.alloc(0); // eslint-disable-line new-cap',
            replace: 'var dataBuffer = Buffer.alloc(0);',
          },
        ]);
        patched = true;
      }

      if (
        isNodeModuleFile(args.path, [
          'node_modules',
          'tweetnacl-util',
          'nacl-util.js',
        ])
      ) {
        contents = replaceExact(contents, args.path, [
          {
            search: "return (new Buffer(arr)).toString('base64');",
            replace: "return Buffer.from(arr).toString('base64');",
          },
          {
            search:
              "return new Uint8Array(Array.prototype.slice.call(new Buffer(s, 'base64'), 0));",
            replace:
              "return new Uint8Array(Array.prototype.slice.call(Buffer.from(s, 'base64'), 0));",
          },
        ]);
        patched = true;
      }

      if (isNodeModuleFile(args.path, ['node_modules', 'wif', 'index.js'])) {
        contents = replaceExact(contents, args.path, [
          {
            search: 'var result = new Buffer(compressed ? 34 : 33)',
            replace: 'var result = Buffer.alloc(compressed ? 34 : 33)',
          },
        ]);
        patched = true;
      }

      if (
        isNodeModuleFile(args.path, [
          'node_modules',
          'whatwg-url',
          'lib',
          'url-state-machine.js',
        ])
      ) {
        contents = replaceExact(contents, args.path, [
          {
            search: 'const buf = new Buffer(c);',
            replace: 'const buf = Buffer.from(c);',
          },
          {
            search: 'const input = new Buffer(str);',
            replace: 'const input = Buffer.from(str);',
          },
          {
            search: 'return new Buffer(output).toString();',
            replace: 'return Buffer.from(output).toString();',
          },
          {
            search:
              'const buffer = new Buffer(this.buffer); // TODO: Use encoding override instead',
            replace:
              'const buffer = Buffer.from(this.buffer); // TODO: Use encoding override instead',
          },
        ]);
        patched = true;
      }

      return patched ? { contents, loader: 'js' } : undefined;
    });
  },
};

export default defineConfig((options) => {
  const isProductionBuild = !options.watch;

  return {
    entry: ['src/cli.ts'],
    format: ['cjs'],
    target: 'node22',
    clean: true,
    noExternal: [/.*/],
    external: [],
    banner: {
      js: [
        '#!/usr/bin/env node',
        '// Polyfill globals expected by @onekeyhq/shared in Node.js environment',
        'if(typeof globalThis.window==="undefined"){globalThis.window=globalThis;}',
        'if(typeof globalThis.self==="undefined"){globalThis.self=globalThis;}',
        '// Explicitly disable browser-only storage globals in CLI runtime.',
        'Object.defineProperty(globalThis,"localStorage",{configurable:true,writable:true,value:undefined});',
        'Object.defineProperty(globalThis,"sessionStorage",{configurable:true,writable:true,value:undefined});',
      ].join('\n'),
    },
    splitting: false,
    esbuildPlugins: [
      guardBrowserStoragePlugin,
      shimLocalePlugin,
      shimHdCorePackageJsonPlugin,
      shimReactNativePlugin,
      shimCrossInpageProviderDebugBrowserPlugin,
      shimCrossInpageProviderLoggerPlugin,
      patchDeprecatedBufferConstructorPlugin,
    ],
    esbuildOptions(esbuildOptions) {
      // hd-common-connect-sdk has native USB deps (libusb) — must stay external // cspell:disable-line
      // Only loaded at runtime when --hardware flag is used
      const ext = new Set(esbuildOptions.external ?? []);
      ext.add('@onekeyfe/hd-common-connect-sdk');
      ext.add('@onekeyfe/hd-core');
      ext.add('@onekeyfe/hd-transport-usb');
      // Native N-API addon packages must remain external and be distributed
      // beside the CLI bundle for each target platform.
      ext.add('@napi-rs/keyring');
      esbuildOptions.external = [...ext];

      if (!isProductionBuild) {
        return;
      }

      const drop = new Set(esbuildOptions.drop ?? []);
      drop.add('console');
      drop.add('debugger');
      esbuildOptions.drop = [...drop];
    },
    env: {
      NODE_ENV: 'production',
    },
  };
});
