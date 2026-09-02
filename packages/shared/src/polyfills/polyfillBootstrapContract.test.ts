import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { parse } from '@babel/parser';

const repoRoot = path.resolve(__dirname, '../../../..');

const fullRuntimeEntries = [
  'apps/mobile/index.ts',
  'apps/mobile/background.ts',
  'apps/desktop/index.js',
  'apps/web/index.js',
  'apps/web-embed/index.js',
  'apps/ext/index.js',
  'apps/ext/src/entry/background.ts',
  'apps/ext/src/entry/offscreen.ts',
  'apps/ext/src/entry/ui.tsx',
  'apps/ext/src/entry/ui-popup.tsx',
  'apps/ext/src/entry/ui-passkey.tsx',
] as const;

const limitedRuntimeEntries = ['apps/ext/src/entry/content-script.ts'] as const;

const nativeRuntimeEntries = [
  'apps/mobile/index.ts',
  'apps/mobile/background.ts',
] as const;

function findFirstRuntimeDependency(source: string): string | undefined {
  const ast = parse(source, {
    plugins: ['jsx', 'typescript'],
    sourceType: 'unambiguous',
  });
  for (const statement of ast.program.body) {
    if (
      statement.type === 'ImportDeclaration' &&
      statement.importKind !== 'type' &&
      !(
        statement.specifiers.length > 0 &&
        statement.specifiers.every(
          (specifier) =>
            specifier.type === 'ImportSpecifier' &&
            specifier.importKind === 'type',
        )
      )
    ) {
      return statement.source.value;
    }
  }

  for (const statement of ast.program.body) {
    const dependency = findImmediateRequire(statement);
    if (dependency) {
      return dependency;
    }
  }
  return undefined;
}

function findImmediateRequire(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const dependency = findImmediateRequire(item);
      if (dependency) {
        return dependency;
      }
    }
    return undefined;
  }
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const node = value as {
    arguments?: unknown[];
    callee?: { name?: string; type?: string };
    type?: string;
    [key: string]: unknown;
  };
  if (
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression' ||
    node.type === 'ClassDeclaration' ||
    node.type === 'ClassExpression'
  ) {
    return undefined;
  }
  if (
    node.type === 'CallExpression' &&
    node.callee?.type === 'Identifier' &&
    node.callee.name === 'require'
  ) {
    const firstArgument = node.arguments?.[0] as
      | { type?: string; value?: unknown }
      | undefined;
    if (
      firstArgument?.type === 'StringLiteral' &&
      typeof firstArgument.value === 'string'
    ) {
      return firstArgument.value;
    }
  }

  for (const child of Object.values(node)) {
    const dependency = findImmediateRequire(child);
    if (dependency) {
      return dependency;
    }
  }
  return undefined;
}

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectSourceFiles(absolutePath);
    }
    if (
      !entry.name.endsWith('.test.ts') &&
      (entry.name.endsWith('.js') || entry.name.endsWith('.ts'))
    ) {
      return [absolutePath];
    }
    return [];
  });
}

function containsDynamicImport(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsDynamicImport);
  }
  if (!value || typeof value !== 'object') {
    return false;
  }

  const node = value as {
    callee?: { type?: string };
    type?: string;
    [key: string]: unknown;
  };
  if (
    node.type === 'ImportExpression' ||
    (node.type === 'CallExpression' && node.callee?.type === 'Import')
  ) {
    return true;
  }
  return Object.values(node).some(containsDynamicImport);
}

function containsImmediateCall(value: unknown, calleeName: string): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => containsImmediateCall(item, calleeName));
  }
  if (!value || typeof value !== 'object') {
    return false;
  }

  const node = value as {
    callee?: { name?: string; type?: string };
    type?: string;
    [key: string]: unknown;
  };
  if (
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression' ||
    node.type === 'ClassDeclaration' ||
    node.type === 'ClassExpression'
  ) {
    return false;
  }
  if (
    node.type === 'CallExpression' &&
    node.callee?.type === 'Identifier' &&
    node.callee.name === calleeName
  ) {
    return true;
  }
  return Object.values(node).some((child) =>
    containsImmediateCall(child, calleeName),
  );
}

function collectTopLevelBootstrapEvents(source: string): string[] {
  const ast = parse(source, {
    plugins: ['jsx', 'typescript'],
    sourceType: 'unambiguous',
  });

  return ast.program.body.flatMap((statement) => {
    const dependency = findImmediateRequire(statement);
    if (dependency) {
      return [`require:${dependency}`];
    }
    if (containsImmediateCall(statement, 'markRuntimePolyfillsReady')) {
      return ['call:markRuntimePolyfillsReady'];
    }
    return [];
  });
}

describe('runtime polyfill bootstrap contract', () => {
  it('captures the startup baseline before installing polyfills', () => {
    const source = readFileSync(
      path.join(repoRoot, 'packages/shared/src/polyfills/index.ts'),
      'utf8',
    );

    expect(source.indexOf('$$debugT0')).toBeGreaterThanOrEqual(0);
    expect(source.indexOf('$$debugT0')).toBeLessThan(
      source.indexOf("require('./polyfillsPlatform')"),
    );
  });

  it.each(fullRuntimeEntries)(
    '%s loads the complete polyfill bootstrap before any other dependency',
    (relativePath) => {
      const source = readFileSync(path.join(repoRoot, relativePath), 'utf8');
      expect(findFirstRuntimeDependency(source)).toBe(
        '@onekeyhq/shared/src/polyfills',
      );
    },
  );

  it.each(limitedRuntimeEntries)(
    '%s loads its isolated-world polyfills before any other dependency',
    (relativePath) => {
      const source = readFileSync(path.join(repoRoot, relativePath), 'utf8');
      expect(findFirstRuntimeDependency(source)).toBe(
        '@onekeyhq/shared/src/polyfills/polyfillsExtContentScript',
      );
    },
  );

  it.each(nativeRuntimeEntries)(
    '%s marks polyfills ready before loading any other runtime dependency',
    (relativePath) => {
      const source = readFileSync(path.join(repoRoot, relativePath), 'utf8');

      expect(collectTopLevelBootstrapEvents(source).slice(0, 3)).toEqual([
        'require:@onekeyhq/shared/src/polyfills',
        'require:@onekeyhq/shared/src/polyfills/runtimeCapabilities',
        'call:markRuntimePolyfillsReady',
      ]);
    },
  );

  it.each(
    collectSourceFiles(path.join(repoRoot, 'packages/shared/src/polyfills')),
  )('%s contains no dynamic import boundary', (absolutePath) => {
    const source = readFileSync(absolutePath, 'utf8');
    const ast = parse(source, {
      plugins: ['jsx', 'typescript'],
      sourceType: 'unambiguous',
    });
    expect(containsDynamicImport(ast)).toBe(false);
  });
});
