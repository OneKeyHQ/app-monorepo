import { defineConfig } from 'tsup';

import type { Plugin } from 'esbuild';

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

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['cjs'],
  target: 'node22',
  clean: true,
  noExternal: [/.*/],
  banner: {
    js: [
      '#!/usr/bin/env node',
      '// Polyfill globals expected by @onekeyhq/shared in Node.js environment',
      'if(typeof globalThis.window==="undefined"){globalThis.window=globalThis;}',
      'if(typeof globalThis.self==="undefined"){globalThis.self=globalThis;}',
      'if(typeof globalThis.localStorage==="undefined"){',
      '  globalThis.localStorage={_d:{},getItem(k){return this._d[k]??null;},setItem(k,v){this._d[k]=String(v);},removeItem(k){delete this._d[k];},clear(){this._d={};},get length(){return Object.keys(this._d).length;},key(i){return Object.keys(this._d)[i]??null;}};',
      '}',
    ].join('\n'),
  },
  splitting: false,
  esbuildPlugins: [shimLocalePlugin, shimReactNativePlugin],
  env: {
    NODE_ENV: 'production',
  },
});
