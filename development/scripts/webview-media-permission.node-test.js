const React = require('react');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const babel = require('@babel/core');

const filename = path.resolve(
  __dirname,
  '../../node_modules/react-native-webview/src/WebView.ios.tsx',
);
const moduleUnderTest = { exports: {} };
const transformed = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
  filename,
  configFile: false,
  babelrc: false,
  plugins: [
    ['@babel/plugin-transform-typescript', { isTSX: true }],
    ['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }],
    '@babel/plugin-transform-modules-commonjs',
  ],
}).code;

vm.runInNewContext(transformed, {
  module: moduleUnderTest,
  exports: moduleUnderTest.exports,
  require(name) {
    switch (name) {
      case 'react':
        return {
          ...React,
          forwardRef: (render) => render,
          useRef: (current) => ({ current }),
          useCallback: (callback) => callback,
          useImperativeHandle: () => {},
        };
      case 'react-native':
        return {
          Image: { resolveAssetSource: (source) => source },
          View: 'View',
        };
      case './RNCWebViewNativeComponent':
        return { __esModule: true, default: 'RNCWebView', Commands: {} };
      case './NativeRNCWebViewModule':
        return {};
      case './WebViewShared':
        return { useWebViewLogic: () => ({ viewState: 'IDLE' }) };
      case './WebView.styles':
        return {};
      case 'invariant':
      case 'react/jsx-runtime':
        return require(name);
      default:
        throw new Error(`Unexpected dependency: ${name}`);
    }
  },
});

function nativeProps(props) {
  const view = moduleUnderTest.exports.default(props, null);
  const nativeView = view.props.children[0];
  assert.equal(nativeView.type, 'RNCWebView');
  return nativeView.props;
}

test('omitting the whitelist preserves the default native permission strategy', () => {
  const props = nativeProps({});
  assert.equal(props.hasMediaPermissionWhitelist, false);
  assert.equal(props.mediaPermissionWhitelist, undefined);
});

test('an initial empty whitelist explicitly disables every media origin', () => {
  const whitelist = [];
  const props = nativeProps({ mediaPermissionWhitelist: whitelist });
  assert.equal(props.hasMediaPermissionWhitelist, true);
  assert.equal(props.mediaPermissionWhitelist, whitelist);
});

test('whitelist changes retain the presence flag and forward the new origins', () => {
  for (const whitelist of [
    ['https://allowed.example'],
    ['https://other.example'],
    [],
  ]) {
    const props = nativeProps({ mediaPermissionWhitelist: whitelist });
    assert.equal(props.hasMediaPermissionWhitelist, true);
    assert.equal(props.mediaPermissionWhitelist, whitelist);
  }
  assert.equal(
    nativeProps({ mediaPermissionWhitelist: undefined })
      .hasMediaPermissionWhitelist,
    false,
  );
});

test('a null whitelist retains the legacy unset behavior', () => {
  assert.equal(
    nativeProps({ mediaPermissionWhitelist: null }).hasMediaPermissionWhitelist,
    false,
  );
});
