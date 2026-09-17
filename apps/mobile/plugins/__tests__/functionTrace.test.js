const babel = require('@babel/core');

const functionTracePlugin = require('../functionTrace');

function transform(source, filename) {
  return babel.transformSync(source, {
    babelrc: false,
    configFile: false,
    filename,
    parserOpts: {
      sourceType: 'module',
      plugins: ['typescript', 'classProperties'],
    },
    plugins: [functionTracePlugin],
  }).code;
}

describe('functionTrace Babel plugin', () => {
  it('wraps business functions with NativeLogger hooks', () => {
    const code = transform(
      `
        const arrow = (value) => value + 1;
        function ordinary(value) { return value; }
        const object = { method() { return arrow(1); } };
        class Example { constructor() {} method() { return 4; } }
      `,
      '/repo/packages/kit/src/example.ts',
    );

    expect(code).toContain('__onekeyFunctionTraceStart');
    expect(code).toContain('__onekeyFunctionTraceEnd');
    expect(code).toContain('name: "arrow"');
    expect(code).toContain('name: "ordinary"');
    expect(code).toContain('name: "method"');
    expect(code).toContain('name: "Example.constructor"');
    expect(code).toContain('name: "Example.method"');
  });

  it('does not instrument dependencies or test files', () => {
    const dependencyCode = transform(
      'export const dependency = () => 1;',
      '/repo/node_modules/example/index.js',
    );
    const testCode = transform(
      'export const testHelper = () => 1;',
      '/repo/packages/kit/src/example.test.ts',
    );

    expect(dependencyCode).not.toContain('__onekeyFunctionTraceStart');
    expect(testCode).not.toContain('__onekeyFunctionTraceStart');
  });
});
