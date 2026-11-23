// cspell:ignore breeztech
import fs from 'fs';
import path from 'path';

import { parse } from '@babel/parser';

import type { Node } from '@babel/types';

// Loading the Breez SDK React Native package installs the Rust crate into the
// JS runtime that loads it, and the SDK serves one runtime per process. Only
// the loader may load it: it does so on demand, in the background runtime
// (breezSdk.native.ts). Anywhere else a top-level import would load it in
// whatever runtime imports that module, the UI runtime included. Type-only
// imports are erased and load nothing.
const NATIVE_PACKAGE = '@breeztech/breez-sdk-spark-react-native';
const ALLOWED_LOADS = [
  'packages/kit-bg/src/services/ServiceLightningSpark/sdk/breezSdk.native.ts | require',
];

const REPO_ROOT = path.resolve(__dirname, '../../../../../..');
const SOURCE_ROOTS = ['packages', 'apps'];
const SKIPPED_DIRS = new Set([
  'node_modules',
  'build',
  'dist',
  'android',
  'ios',
  'out-dir-bundle',
  'coverage',
]);
const SOURCE_FILE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
// Tests may mock the package; they never run in the app.
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;

function listFilesNamingThePackage(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return SKIPPED_DIRS.has(entry.name) || entry.name.startsWith('.')
        ? []
        : listFilesNamingThePackage(entryPath);
    }
    if (!SOURCE_FILE.test(entry.name) || TEST_FILE.test(entry.name)) {
      return [];
    }
    return fs.readFileSync(entryPath, 'utf8').includes(NATIVE_PACKAGE)
      ? [entryPath]
      : [];
  });
}

function isNode(value: unknown): value is Node {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string'
  );
}

function namesThePackage(node: Node | null | undefined) {
  return node?.type === 'StringLiteral' && node.value === NATIVE_PACKAGE;
}

// How the node loads the package at runtime, if it does.
function getLoad(node: Node): string | undefined {
  switch (node.type) {
    case 'ImportDeclaration': {
      if (!namesThePackage(node.source) || node.importKind === 'type') {
        return undefined;
      }
      const typeOnly =
        node.specifiers.length > 0 &&
        node.specifiers.every(
          (specifier) =>
            specifier.type === 'ImportSpecifier' &&
            specifier.importKind === 'type',
        );
      return typeOnly ? undefined : 'import';
    }
    case 'ExportNamedDeclaration':
    case 'ExportAllDeclaration':
      return namesThePackage(node.source) && node.exportKind !== 'type'
        ? 'export'
        : undefined;
    case 'CallExpression': {
      const [firstArgument] = node.arguments;
      if (!namesThePackage(firstArgument as Node | undefined)) {
        return undefined;
      }
      if (node.callee.type === 'Import') {
        return 'dynamic import';
      }
      return node.callee.type === 'Identifier' && node.callee.name === 'require'
        ? 'require'
        : undefined;
    }
    case 'ImportExpression':
      return namesThePackage(node.source) ? 'dynamic import' : undefined;
    default:
      return undefined;
  }
}

function findLoads({ source, file }: { source: string; file: string }) {
  const loads: string[] = [];
  const visit = (node: Node) => {
    const load = getLoad(node);
    if (load) {
      loads.push(`${file} | ${load}`);
    }
    Object.values(node).forEach((value: unknown) => {
      (Array.isArray(value) ? value : [value]).forEach((child: unknown) => {
        if (isNode(child)) {
          visit(child);
        }
      });
    });
  };
  const ast = parse(source, {
    sourceFilename: file,
    sourceType: 'module',
    plugins: [
      'decorators-legacy',
      'typescript',
      ...(/\.[jt]sx$/.test(file) ? (['jsx'] as const) : []),
    ],
  });
  visit(ast.program);
  return loads;
}

describe('Breez SDK native package loads', () => {
  it('is loaded by the background-runtime loader only', () => {
    const loads = SOURCE_ROOTS.flatMap((root) =>
      listFilesNamingThePackage(path.join(REPO_ROOT, root)),
    ).flatMap((sourcePath) =>
      findLoads({
        source: fs.readFileSync(sourcePath, 'utf8'),
        file: path.relative(REPO_ROOT, sourcePath).split(path.sep).join('/'),
      }),
    );

    expect(loads.toSorted()).toEqual(ALLOWED_LOADS.toSorted());
  });

  it.each([
    [`import { connect } from '${NATIVE_PACKAGE}';`, 'import'],
    [`import * as rn from '${NATIVE_PACKAGE}';`, 'import'],
    [`import '${NATIVE_PACKAGE}';`, 'import'],
    [`const rn = require('${NATIVE_PACKAGE}');`, 'require'],
    [`const load = () => import('${NATIVE_PACKAGE}');`, 'dynamic import'],
    [`export * from '${NATIVE_PACKAGE}';`, 'export'],
    [`export { connect } from '${NATIVE_PACKAGE}';`, 'export'],
  ])('finds the load in %s', (source, load) => {
    expect(findLoads({ source, file: 'a.ts' })).toEqual([`a.ts | ${load}`]);
  });

  it.each([
    `import type * as rn from '${NATIVE_PACKAGE}';`,
    `import type { Config } from '${NATIVE_PACKAGE}';`,
    `import { type Config } from '${NATIVE_PACKAGE}';`,
    `export type { Config } from '${NATIVE_PACKAGE}';`,
    `type Rn = typeof import('${NATIVE_PACKAGE}');`,
  ])('ignores the type-only use in %s', (source) => {
    expect(findLoads({ source, file: 'a.ts' })).toEqual([]);
  });
});
