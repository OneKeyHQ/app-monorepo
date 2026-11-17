const path = require('node:path');

const { transformSync } = require('@babel/core');

const relativeSourcePath = require('./sentry-relative-source-path');

const sourcePath = 'packages/kit/src/Panel.tsx';
const source = 'function Panel() { return <View><Text>Hello</Text></View>; }';

function annotate(rootDir, code = source, relative = true) {
  const filename = path.join(rootDir, sourcePath);
  return transformSync(code, {
    babelrc: false,
    configFile: false,
    filename,
    parserOpts: { plugins: ['jsx'], sourceFileName: filename },
    plugins: [
      ...(relative ? [[relativeSourcePath, { rootDir }]] : []),
      '@sentry/babel-plugin-component-annotate',
    ],
  }).code;
}

it('keeps Sentry annotations identical across local and CI checkout paths', () => {
  const localRoot = path.resolve('/Users/developer/Code/app-monorepo');
  const ciRoot = path.resolve('/home/runner/work/app-monorepo/app-monorepo');

  expect(annotate(localRoot, source, false)).not.toBe(
    annotate(ciRoot, source, false),
  );
  expect(annotate(localRoot)).toBe(annotate(ciRoot));
  expect(annotate(ciRoot)).toContain(`data-sentry-source-file="${sourcePath}"`);
});

it('preserves component and element annotations with the full repository path', () => {
  const output = annotate(path.resolve('/checkout/app-monorepo'));

  expect(output).toContain('data-sentry-component="Panel"');
  expect(output).toContain('data-sentry-element="Text"');
  expect(output.match(/data-sentry-source-file=/g)).toHaveLength(2);
  expect(output).not.toContain('/checkout/');
});

it('preserves an explicitly supplied source annotation', () => {
  const output = annotate(
    path.resolve('/checkout/app-monorepo'),
    'function Panel() { return <View data-sentry-source-file="manual.tsx" />; }',
  );

  expect(output).toContain('data-sentry-source-file="manual.tsx"');
});

it('preserves third-party paths used by Sentry compatibility exclusions', () => {
  const rootDir = '/checkout/app-monorepo';
  const filename = `${rootDir}/node_modules/@react-navigation/elements/src/Header.tsx`;
  const options = {
    babelrc: false,
    configFile: false,
    filename,
    parserOpts: { plugins: ['jsx'], sourceFileName: filename },
  };
  const original = transformSync(source, {
    ...options,
    plugins: ['@sentry/babel-plugin-component-annotate'],
  }).code;
  const normalized = transformSync(source, {
    ...options,
    plugins: [
      [relativeSourcePath, { rootDir }],
      '@sentry/babel-plugin-component-annotate',
    ],
  }).code;
  expect(normalized).toBe(original);
  expect(normalized).not.toContain('data-sentry-source-file');
});

it('normalizes Windows first-party paths and keeps relative paths stable', () => {
  const rootDir = 'C:\\checkout\\app-monorepo';
  const file = {
    opts: {
      parserOpts: { sourceFileName: `${rootDir}\\packages\\kit\\Panel.tsx` },
    },
  };
  const plugin = relativeSourcePath(null, { rootDir });
  plugin.pre(file);
  expect(file.opts.parserOpts.sourceFileName).toBe('packages/kit/Panel.tsx');
  plugin.pre(file);
  expect(file.opts.parserOpts.sourceFileName).toBe('packages/kit/Panel.tsx');
});
