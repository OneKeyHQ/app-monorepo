const path = require('path');

const babel = require('@babel/core');

const functionTracePlugin = require('../functionTrace');

const { isBusinessFile, relativeBusinessPath } = functionTracePlugin._internal;
const repoRoot = path.resolve(__dirname, '../../../..');

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
      path.join(repoRoot, 'packages/kit/src/example.ts'),
    );

    expect(code).toContain('__onekeyFunctionTraceStart');
    expect(code).toContain('__onekeyFunctionTraceEnd');
    expect(code).toContain('file: "packages/kit/src/example.ts"');
    // The wrapper must not declare anything: in a worklet function,
    // react-native-worklets captures any variable added here as a closure
    // variable and emits it at module scope, where it does not exist.
    expect(code).not.toMatch(/_functionTraceToken/);
    expect(code).not.toMatch(/(?:const|let|var)\s+_\w*[tT]race\w*\s*=/);
    expect(code).toContain('name: "arrow"');
    expect(code).toContain('name: "ordinary"');
    expect(code).toContain('name: "method"');
    expect(code).toContain('name: "Example.constructor"');
    expect(code).toContain('name: "Example.method"');
  });

  it('does not instrument dependencies or test files', () => {
    const dependencyCode = transform(
      'export const dependency = () => 1;',
      path.join(repoRoot, 'node_modules/example/index.js'),
    );
    const testCode = transform(
      'export const testHelper = () => 1;',
      path.join(repoRoot, 'packages/kit/src/example.test.ts'),
    );

    expect(dependencyCode).not.toContain('__onekeyFunctionTraceStart');
    expect(testCode).not.toContain('__onekeyFunctionTraceStart');
  });

  it('does not instrument worklets or functions nested in them', () => {
    const code = transform(
      `
        const shift = (bottom) => {
          'worklet';
          const clamp = (value) => Math.max(0, value);
          return clamp(bottom);
        };
        const plain = (value) => value + 1;
      `,
      path.join(repoRoot, 'packages/components/src/anim.ts'),
    );

    expect(code).toContain('name: "plain"');
    expect(code).not.toContain('name: "shift"');
    expect(code).not.toContain('name: "clamp"');
  });

  it('matches paths relative to the monorepo root', () => {
    // EAS checks the project out into a directory named "build".
    const easRoot = '/home/expo/workingdir/build';
    const businessFile = `${easRoot}/packages/kit/src/views/Sample.tsx`;

    expect(isBusinessFile(businessFile, easRoot)).toBe(true);
    expect(relativeBusinessPath(businessFile, easRoot)).toBe(
      'packages/kit/src/views/Sample.tsx',
    );
    expect(
      isBusinessFile(`${easRoot}/node_modules/example/index.js`, easRoot),
    ).toBe(false);
    expect(
      isBusinessFile(`${easRoot}/packages/kit/build/generated.js`, easRoot),
    ).toBe(false);
    expect(
      isBusinessFile('/elsewhere/packages/kit/src/views/Sample.tsx', easRoot),
    ).toBe(false);
  });
});
