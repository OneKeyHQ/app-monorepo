#!/usr/bin/env node
/* eslint-disable no-continue, onekey/no-raw-error -- dependency graph and AST scanner */
/* cspell:ignore quasis */

const fs = require('node:fs');
const path = require('node:path');

const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const ASYNC_STORAGE_PACKAGE = '@react-native-async-storage/async-storage';
const MMKV_PACKAGE = 'react-native-mmkv';
const LEGACY_ASYNC_STORAGE_PACKAGES = new Set([
  '@onekeyfe/react-native-async-storage',
  '@react-native-community/async-storage',
]);
const ASYNC_STORAGE_IMPLEMENTATION_PACKAGES = new Set([
  ASYNC_STORAGE_PACKAGE,
  '@onekeyfe/react-native-async-storage',
]);
const SUPPORTED_ASYNC_STORAGE_METHODS = new Set([
  'clear',
  'flushGetRequests',
  'getAllKeys',
  'getItem',
  'mergeItem',
  'multiGet',
  'multiMerge',
  'multiRemove',
  'multiSet',
  'removeItem',
  'setItem',
]);
const SOURCE_FILE_PATTERN = /\.(?:cjs|js|jsx|mjs|ts|tsx)$/u;
const TEST_FILE_PATTERN = /(?:^|\.)(?:spec|test|stories)\.[^.]+$/u;
const WEB_FILE_PATTERN = /\.web\.[^.]+$/u;
const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.github',
  '__fixtures__',
  '__mocks__',
  '__tests__',
  'coverage',
  'docs',
  'example',
  'examples',
  'node_modules',
  'scripts',
  'template',
  'templates',
  'test',
  'tests',
]);
const SOURCE_NEEDLES = [
  ASYNC_STORAGE_PACKAGE,
  MMKV_PACKAGE,
  ...LEGACY_ASYNC_STORAGE_PACKAGES,
  'AsyncStorage',
  'RNCAsyncStorage',
];

function getStaticString(node) {
  if (!node) {
    return null;
  }
  if (node.type === 'StringLiteral' || node.type === 'Literal') {
    return typeof node.value === 'string' ? node.value : null;
  }
  if (
    node.type === 'TemplateLiteral' &&
    node.expressions.length === 0 &&
    node.quasis.length === 1
  ) {
    return node.quasis[0].value.cooked ?? node.quasis[0].value.raw;
  }
  return null;
}

function getMemberPropertyName(node) {
  if (!node) {
    return null;
  }
  if (!node.computed && node.property.type === 'Identifier') {
    return node.property.name;
  }
  return getStaticString(node.property);
}

function getIdentifierOrStringName(node) {
  if (node?.type === 'Identifier') {
    return node.name;
  }
  return getStaticString(node);
}

function unwrapExpression(node) {
  let current = node;
  while (
    current &&
    [
      'TSAsExpression',
      'TSSatisfiesExpression',
      'TSNonNullExpression',
      'TypeCastExpression',
    ].includes(current.type)
  ) {
    current = current.expression;
  }
  return current;
}

function parseSource(source, filePath) {
  const isTypeScript = /\.tsx?$/u.test(filePath);
  const pluginAttempts = isTypeScript
    ? [
        ['typescript', 'jsx', 'decorators-legacy'],
        ['typescript', 'jsx'],
      ]
    : [
        ['flow', 'jsx', 'decorators-legacy'],
        ['typescript', 'jsx', 'decorators-legacy'],
        ['jsx', 'decorators-legacy'],
      ];
  let lastError;

  for (const plugins of pluginAttempts) {
    try {
      return parser.parse(source, {
        allowAwaitOutsideFunction: true,
        allowReturnOutsideFunction: true,
        plugins,
        sourceType: 'unambiguous',
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Unable to parse dependency source.');
}

function isTypeOnlyImport(node) {
  if (node.importKind === 'type' || node.importKind === 'typeof') {
    return true;
  }
  return (
    node.specifiers.length > 0 &&
    node.specifiers.every(
      (specifier) =>
        specifier.type === 'ImportSpecifier' &&
        (specifier.importKind === 'type' || specifier.importKind === 'typeof'),
    )
  );
}

function isTypeOnlyExport(node) {
  if (node.exportKind === 'type') {
    return true;
  }
  return (
    node.specifiers.length > 0 &&
    node.specifiers.every((specifier) => specifier.exportKind === 'type')
  );
}

function analyzeSource({ source, filePath = 'unknown.js' }) {
  const violations = [];
  const violationKeys = new Set();
  const methods = new Set();
  const recognizedModuleLiterals = new Set();
  const defaultStorageBindings = new Set();
  const nativeModulesBindings = new Set();
  const storageMemberAliasKeys = new Set();
  const storageModuleBindings = new Set();
  const reactNativeBindings = new Set();
  const identityIds = new WeakMap();
  let identitySequence = 0;
  let importCount = 0;
  let ast;

  const addViolation = (node, code, message) => {
    const line = node?.loc?.start?.line ?? 1;
    const column = (node?.loc?.start?.column ?? 0) + 1;
    const key = `${code}:${line}:${column}`;
    if (violationKeys.has(key)) {
      return;
    }
    violationKeys.add(key);
    violations.push({ code, column, line, message });
  };

  try {
    ast = parseSource(source, filePath);
  } catch (error) {
    addViolation(
      null,
      'parse-error',
      `Unable to inspect the file safely: ${error.message}`,
    );
    return { importCount, methods: [], violations };
  }

  const getBinding = (scope, name) =>
    name && scope ? scope.getBinding(name) : null;

  const addDefaultBinding = (scope, name) => {
    const binding = getBinding(scope, name);
    if (binding) {
      defaultStorageBindings.add(binding);
    }
  };

  const addModuleBinding = (scope, name) => {
    const binding = getBinding(scope, name);
    if (binding) {
      storageModuleBindings.add(binding);
    }
  };

  const addNativeModulesBinding = (scope, name) => {
    const binding = getBinding(scope, name);
    if (binding) {
      nativeModulesBindings.add(binding);
    }
  };

  const addReactNativeBinding = (scope, name) => {
    const binding = getBinding(scope, name);
    if (binding) {
      reactNativeBindings.add(binding);
    }
  };

  const isBindingIn = (pathScope, name, bindings) => {
    const binding = getBinding(pathScope, name);
    return Boolean(binding && bindings.has(binding));
  };

  const isTargetRequireCall = (node) => {
    const expression = unwrapExpression(node);
    return Boolean(
      expression &&
      expression.type === 'CallExpression' &&
      expression.callee.type === 'Identifier' &&
      expression.callee.name === 'require' &&
      getStaticString(expression.arguments[0]) === ASYNC_STORAGE_PACKAGE,
    );
  };

  const isMMKVModule = (moduleName) =>
    moduleName === MMKV_PACKAGE || moduleName.startsWith(`${MMKV_PACKAGE}/`);

  const getIdentityId = (value) => {
    let id = identityIds.get(value);
    if (!id) {
      identitySequence += 1;
      id = identitySequence;
      identityIds.set(value, id);
    }
    return id;
  };

  const getThisOwner = (scope) => {
    const classPath = scope?.path?.findParent((parent) => parent.isClass());
    return classPath?.node ?? ast.program;
  };

  const getStorageMemberAliasKey = (node, scope) => {
    const expression = unwrapExpression(node);
    if (!expression) {
      return null;
    }
    if (expression.type === 'ThisExpression') {
      return `this:${getIdentityId(getThisOwner(scope))}`;
    }
    if (expression.type === 'Identifier') {
      const binding = getBinding(scope, expression.name);
      return binding
        ? `binding:${getIdentityId(binding)}`
        : `global:${expression.name}`;
    }
    if (
      expression.type !== 'MemberExpression' &&
      expression.type !== 'OptionalMemberExpression'
    ) {
      return null;
    }
    const objectKey = getStorageMemberAliasKey(expression.object, scope);
    const propertyName = getMemberPropertyName(expression);
    if (!objectKey || !propertyName) {
      return null;
    }
    return `${objectKey}.${propertyName}`;
  };

  const addStorageMemberAlias = (node, scope) => {
    const key = getStorageMemberAliasKey(node, scope);
    if (key) {
      storageMemberAliasKeys.add(key);
    }
  };

  const isStorageModuleExpression = (node, scope) => {
    const expression = unwrapExpression(node);
    if (!expression) {
      return false;
    }
    if (expression.type === 'Identifier') {
      return isBindingIn(scope, expression.name, storageModuleBindings);
    }
    if (isTargetRequireCall(expression)) {
      return true;
    }
    if (expression.type === 'CallExpression') {
      return expression.arguments.some((argument) =>
        isStorageModuleExpression(argument, scope),
      );
    }
    return false;
  };

  const isDefaultStorageExpression = (node, scope) => {
    const expression = unwrapExpression(node);
    if (!expression) {
      return false;
    }
    if (expression.type === 'Identifier') {
      return isBindingIn(scope, expression.name, defaultStorageBindings);
    }
    if (
      expression.type === 'MemberExpression' ||
      expression.type === 'OptionalMemberExpression'
    ) {
      const aliasKey = getStorageMemberAliasKey(expression, scope);
      if (aliasKey && storageMemberAliasKeys.has(aliasKey)) {
        return true;
      }
      if (getMemberPropertyName(expression) !== 'default') {
        return false;
      }
      const object = unwrapExpression(expression.object);
      if (isTargetRequireCall(object)) {
        return true;
      }
      return Boolean(
        object?.type === 'Identifier' &&
        isBindingIn(scope, object.name, storageModuleBindings),
      );
    }
    return false;
  };

  const isTrackableAliasTarget = (node) => {
    const target = unwrapExpression(node);
    return Boolean(
      target &&
      (target.type === 'Identifier' ||
        target.type === 'MemberExpression' ||
        target.type === 'OptionalMemberExpression'),
    );
  };

  const isSafeDefaultStorageValueUse = (valuePath) => {
    const parentPath = valuePath.parentPath;
    if (!parentPath) {
      return false;
    }
    if (
      (parentPath.isMemberExpression() ||
        parentPath.isOptionalMemberExpression()) &&
      parentPath.node.object === valuePath.node
    ) {
      return true;
    }
    if (
      parentPath.isVariableDeclarator() &&
      parentPath.node.init === valuePath.node
    ) {
      return isTrackableAliasTarget(parentPath.node.id);
    }
    if (
      parentPath.isAssignmentExpression() &&
      parentPath.node.left === valuePath.node
    ) {
      return true;
    }
    if (
      parentPath.isAssignmentExpression() &&
      parentPath.node.right === valuePath.node
    ) {
      return isTrackableAliasTarget(parentPath.node.left);
    }
    return false;
  };

  const isSafeStorageModuleUse = (referencePath) => {
    const parentPath = referencePath.parentPath;
    if (!parentPath) {
      return false;
    }
    if (
      (parentPath.isMemberExpression() ||
        parentPath.isOptionalMemberExpression()) &&
      parentPath.node.object === referencePath.node
    ) {
      return true;
    }
    if (
      parentPath.isCallExpression() &&
      parentPath.node.arguments.includes(referencePath.node)
    ) {
      const declaratorPath = parentPath.parentPath;
      return Boolean(
        declaratorPath?.isVariableDeclarator() &&
        declaratorPath.node.init === parentPath.node &&
        declaratorPath.node.id.type === 'Identifier' &&
        isBindingIn(
          declaratorPath.scope,
          declaratorPath.node.id.name,
          storageModuleBindings,
        ),
      );
    }
    return false;
  };

  const inspectStorageProperty = (node, propertyName) => {
    if (!propertyName || !SUPPORTED_ASYNC_STORAGE_METHODS.has(propertyName)) {
      addViolation(
        node,
        'unsupported-api',
        `The bg proxy does not expose AsyncStorage.${propertyName || '<dynamic>'}.`,
      );
      return;
    }
    methods.add(propertyName);
  };

  const inspectMemberExpression = (memberPath) => {
    const { node, scope } = memberPath;
    const propertyName = getMemberPropertyName(node);
    const object = unwrapExpression(node.object);

    if (
      isDefaultStorageExpression(node, scope) &&
      !isSafeDefaultStorageValueUse(memberPath)
    ) {
      addViolation(
        node,
        'unverified-api-surface',
        'The AsyncStorage object escapes direct bg proxy API verification.',
      );
    }

    if (propertyName === 'RNCAsyncStorage') {
      addViolation(
        node,
        'native-module-access',
        'Direct RNCAsyncStorage access bypasses the bg proxy.',
      );
    }

    if (propertyName === 'AsyncStorage') {
      const isReactNativeObject =
        (object?.type === 'Identifier' &&
          (isBindingIn(scope, object.name, reactNativeBindings) ||
            isBindingIn(scope, object.name, nativeModulesBindings) ||
            object.name === 'global' ||
            object.name === 'globalThis')) ||
        (object?.type === 'CallExpression' &&
          object.callee.type === 'Identifier' &&
          object.callee.name === 'require' &&
          getStaticString(object.arguments[0]) === 'react-native');
      if (isReactNativeObject) {
        addViolation(
          node,
          'legacy-react-native-api',
          'react-native.AsyncStorage is removed and cannot be redirected to the bg proxy.',
        );
      }
    }

    if (isDefaultStorageExpression(object, scope)) {
      inspectStorageProperty(node, propertyName);
      return;
    }

    if (
      object?.type === 'Identifier' &&
      isBindingIn(scope, object.name, storageModuleBindings)
    ) {
      if (propertyName !== 'default' && propertyName !== '__esModule') {
        addViolation(
          node,
          'commonjs-namespace-access',
          `CommonJS consumers must access the proxy default export before using .${propertyName || '<dynamic>'}.`,
        );
      }
      return;
    }

    if (isTargetRequireCall(object) && propertyName !== 'default') {
      addViolation(
        node,
        'commonjs-namespace-access',
        `CommonJS consumers must use require('${ASYNC_STORAGE_PACKAGE}').default.`,
      );
    }
  };

  traverse(ast, {
    CallExpression(callPath) {
      const { node } = callPath;
      const isRequire =
        node.callee.type === 'Identifier' && node.callee.name === 'require';
      const isDynamicImport = node.callee.type === 'Import';
      if (!isRequire && !isDynamicImport) {
        return;
      }

      const sourceNode = node.arguments[0];
      const moduleName = getStaticString(sourceNode);
      if (!moduleName) {
        return;
      }
      recognizedModuleLiterals.add(sourceNode);

      if (isMMKVModule(moduleName)) {
        addViolation(
          node,
          'third-party-mmkv-import',
          `Third-party runtime imports of ${MMKV_PACKAGE} are forbidden; patch the package to use the bg storage proxy.`,
        );
        return;
      }

      if (
        moduleName.startsWith(`${ASYNC_STORAGE_PACKAGE}/`) ||
        LEGACY_ASYNC_STORAGE_PACKAGES.has(moduleName)
      ) {
        addViolation(
          node,
          'unredirected-package',
          `Import ${ASYNC_STORAGE_PACKAGE} from its exact public root so Metro can redirect it. Found: ${moduleName}`,
        );
        return;
      }
      if (moduleName !== ASYNC_STORAGE_PACKAGE) {
        if (moduleName === 'react-native') {
          const declarator = callPath.findParent((parent) =>
            parent.isVariableDeclarator(),
          );
          if (declarator) {
            const id = declarator.node.id;
            if (id.type === 'Identifier') {
              addReactNativeBinding(declarator.scope, id.name);
            } else if (id.type === 'ObjectPattern') {
              for (const property of id.properties) {
                if (
                  property.type === 'ObjectProperty' &&
                  getIdentifierOrStringName(property.key) === 'AsyncStorage'
                ) {
                  addViolation(
                    property,
                    'legacy-react-native-api',
                    'Destructuring AsyncStorage from react-native bypasses the bg proxy.',
                  );
                } else if (
                  property.type === 'ObjectProperty' &&
                  getIdentifierOrStringName(property.key) === 'NativeModules' &&
                  property.value.type === 'Identifier'
                ) {
                  addNativeModulesBinding(
                    declarator.scope,
                    property.value.name,
                  );
                }
              }
            }
          }
        }
        return;
      }

      importCount += 1;
      if (isDynamicImport) {
        addViolation(
          node,
          'dynamic-import',
          'Dynamic AsyncStorage imports are not part of the supported proxy contract.',
        );
        return;
      }

      const declarator = callPath.findParent((parent) =>
        parent.isVariableDeclarator(),
      );
      if (declarator) {
        const id = declarator.node.id;
        const init = unwrapExpression(declarator.node.init);
        if (id.type === 'Identifier') {
          if (
            (init?.type === 'MemberExpression' ||
              init?.type === 'OptionalMemberExpression') &&
            getMemberPropertyName(init) === 'default' &&
            isTargetRequireCall(init.object)
          ) {
            addDefaultBinding(declarator.scope, id.name);
          } else {
            addModuleBinding(declarator.scope, id.name);
          }
        } else if (id.type === 'ObjectPattern') {
          for (const property of id.properties) {
            if (property.type !== 'ObjectProperty') {
              addViolation(
                property,
                'commonjs-namespace-access',
                'Rest destructuring from the AsyncStorage module namespace is unsupported.',
              );
              continue;
            }
            const importedName = getIdentifierOrStringName(property.key);
            if (importedName !== 'default') {
              addViolation(
                property,
                'commonjs-namespace-access',
                `CommonJS destructuring of .${importedName || '<dynamic>'} bypasses the proxy default export.`,
              );
              continue;
            }
            if (property.value.type === 'Identifier') {
              addDefaultBinding(declarator.scope, property.value.name);
            }
          }
        }
      }

      const assignment = callPath.findParent((parent) =>
        parent.isAssignmentExpression(),
      );
      if (assignment && assignment.node.right === node) {
        addViolation(
          node,
          'commonjs-reexport',
          'Re-exporting the raw AsyncStorage CommonJS namespace is unsupported; re-export its default instead.',
        );
      }
    },

    ImportDeclaration(importPath) {
      const { node } = importPath;
      const moduleName = getStaticString(node.source);
      if (!moduleName) {
        return;
      }
      recognizedModuleLiterals.add(node.source);
      if (isTypeOnlyImport(node)) {
        return;
      }

      if (isMMKVModule(moduleName)) {
        addViolation(
          node,
          'third-party-mmkv-import',
          `Third-party runtime imports of ${MMKV_PACKAGE} are forbidden; patch the package to use the bg storage proxy.`,
        );
        return;
      }

      if (
        moduleName.startsWith(`${ASYNC_STORAGE_PACKAGE}/`) ||
        LEGACY_ASYNC_STORAGE_PACKAGES.has(moduleName)
      ) {
        addViolation(
          node,
          'unredirected-package',
          `Import ${ASYNC_STORAGE_PACKAGE} from its exact public root so Metro can redirect it. Found: ${moduleName}`,
        );
        return;
      }

      if (moduleName === ASYNC_STORAGE_PACKAGE) {
        importCount += 1;
        for (const specifier of node.specifiers) {
          if (
            specifier.type === 'ImportSpecifier' &&
            (specifier.importKind === 'type' ||
              specifier.importKind === 'typeof')
          ) {
            continue;
          }
          if (specifier.type === 'ImportDefaultSpecifier') {
            addDefaultBinding(importPath.scope, specifier.local.name);
            continue;
          }
          if (
            specifier.type === 'ImportSpecifier' &&
            getIdentifierOrStringName(specifier.imported) === 'default'
          ) {
            addDefaultBinding(importPath.scope, specifier.local.name);
            continue;
          }
          addViolation(
            specifier,
            'unsupported-import-shape',
            'The bg proxy supports the AsyncStorage default export only.',
          );
        }
        return;
      }

      if (moduleName === 'react-native') {
        for (const specifier of node.specifiers) {
          if (
            specifier.type === 'ImportSpecifier' &&
            getIdentifierOrStringName(specifier.imported) === 'AsyncStorage' &&
            specifier.importKind !== 'type'
          ) {
            addViolation(
              specifier,
              'legacy-react-native-api',
              'Importing AsyncStorage from react-native bypasses the bg proxy.',
            );
          } else if (
            specifier.type === 'ImportSpecifier' &&
            getIdentifierOrStringName(specifier.imported) === 'NativeModules'
          ) {
            addNativeModulesBinding(importPath.scope, specifier.local.name);
          } else if (
            specifier.type === 'ImportDefaultSpecifier' ||
            specifier.type === 'ImportNamespaceSpecifier'
          ) {
            addReactNativeBinding(importPath.scope, specifier.local.name);
          }
        }
      }
    },

    ExportAllDeclaration(exportPath) {
      const { node } = exportPath;
      const moduleName = getStaticString(node.source);
      if (!moduleName) {
        return;
      }
      recognizedModuleLiterals.add(node.source);
      if (isMMKVModule(moduleName)) {
        addViolation(
          node,
          'third-party-mmkv-import',
          `Third-party runtime re-exports of ${MMKV_PACKAGE} are forbidden.`,
        );
        return;
      }
      if (moduleName === ASYNC_STORAGE_PACKAGE) {
        addViolation(
          node,
          'runtime-reexport',
          'Wildcard AsyncStorage re-exports expose runtime names that the bg proxy does not implement.',
        );
      } else if (
        moduleName.startsWith(`${ASYNC_STORAGE_PACKAGE}/`) ||
        LEGACY_ASYNC_STORAGE_PACKAGES.has(moduleName)
      ) {
        addViolation(
          node,
          'unredirected-package',
          `Re-export ${ASYNC_STORAGE_PACKAGE} from its exact public root. Found: ${moduleName}`,
        );
      }
    },

    ExportNamedDeclaration(exportPath) {
      const { node } = exportPath;
      const moduleName = getStaticString(node.source);
      if (!moduleName) {
        return;
      }
      recognizedModuleLiterals.add(node.source);
      if (isTypeOnlyExport(node)) {
        return;
      }
      if (isMMKVModule(moduleName)) {
        addViolation(
          node,
          'third-party-mmkv-import',
          `Third-party runtime re-exports of ${MMKV_PACKAGE} are forbidden.`,
        );
        return;
      }
      if (
        moduleName.startsWith(`${ASYNC_STORAGE_PACKAGE}/`) ||
        LEGACY_ASYNC_STORAGE_PACKAGES.has(moduleName)
      ) {
        addViolation(
          node,
          'unredirected-package',
          `Re-export ${ASYNC_STORAGE_PACKAGE} from its exact public root. Found: ${moduleName}`,
        );
        return;
      }
      if (moduleName === ASYNC_STORAGE_PACKAGE) {
        const hasUnsupportedExport = node.specifiers.some(
          (specifier) =>
            specifier.exportKind !== 'type' &&
            getIdentifierOrStringName(specifier.local) !== 'default',
        );
        if (hasUnsupportedExport) {
          addViolation(
            node,
            'runtime-reexport',
            'The bg proxy only supports re-exporting the AsyncStorage default export.',
          );
        }
      }
    },

    ImportExpression(importPath) {
      const moduleName = getStaticString(importPath.node.source);
      if (!moduleName) {
        return;
      }
      recognizedModuleLiterals.add(importPath.node.source);
      if (isMMKVModule(moduleName)) {
        addViolation(
          importPath.node,
          'third-party-mmkv-import',
          `Third-party dynamic imports of ${MMKV_PACKAGE} are forbidden.`,
        );
        return;
      }
      if (
        moduleName === ASYNC_STORAGE_PACKAGE ||
        moduleName.startsWith(`${ASYNC_STORAGE_PACKAGE}/`) ||
        LEGACY_ASYNC_STORAGE_PACKAGES.has(moduleName)
      ) {
        addViolation(
          importPath.node,
          'dynamic-import',
          'Dynamic AsyncStorage imports are not part of the supported proxy contract.',
        );
      }
    },

    MemberExpression: inspectMemberExpression,
    OptionalMemberExpression: inspectMemberExpression,

    StringLiteral(stringPath) {
      const { node } = stringPath;
      if (node.value === 'RNCAsyncStorage') {
        addViolation(
          node,
          'native-module-access',
          'Direct RNCAsyncStorage access bypasses the bg proxy.',
        );
        return;
      }
      if (!recognizedModuleLiterals.has(node) && isMMKVModule(node.value)) {
        addViolation(
          node,
          'third-party-mmkv-import',
          `A dynamically resolved ${MMKV_PACKAGE} import cannot be restricted to the bg runtime.`,
        );
        return;
      }
      if (
        !recognizedModuleLiterals.has(node) &&
        (node.value === ASYNC_STORAGE_PACKAGE ||
          LEGACY_ASYNC_STORAGE_PACKAGES.has(node.value))
      ) {
        addViolation(
          node,
          'dynamic-reference',
          'A dynamically resolved AsyncStorage package cannot be guaranteed to pass through the Metro bg proxy.',
        );
      }
    },

    VariableDeclarator(variablePath) {
      const { node, scope } = variablePath;
      const init = unwrapExpression(node.init);
      if (!init) {
        return;
      }

      if (
        node.id.type === 'Identifier' &&
        isStorageModuleExpression(init, scope)
      ) {
        addModuleBinding(scope, node.id.name);
      }

      if (isDefaultStorageExpression(init, scope)) {
        if (node.id.type === 'Identifier') {
          addDefaultBinding(scope, node.id.name);
        } else if (node.id.type === 'ObjectPattern') {
          for (const property of node.id.properties) {
            if (property.type !== 'ObjectProperty') {
              addViolation(
                property,
                'unsupported-api',
                'Rest destructuring from AsyncStorage is not covered by the proxy contract.',
              );
              continue;
            }
            inspectStorageProperty(
              property,
              getIdentifierOrStringName(property.key),
            );
          }
        }
      }
    },

    ReferencedIdentifier(referencePath) {
      const { node, scope } = referencePath;
      if (
        isBindingIn(scope, node.name, defaultStorageBindings) &&
        !isSafeDefaultStorageValueUse(referencePath)
      ) {
        addViolation(
          node,
          'unverified-api-surface',
          'The AsyncStorage object escapes direct bg proxy API verification.',
        );
      } else if (
        isBindingIn(scope, node.name, storageModuleBindings) &&
        !isSafeStorageModuleUse(referencePath)
      ) {
        addViolation(
          node,
          'unverified-api-surface',
          'The AsyncStorage module namespace escapes direct bg proxy API verification.',
        );
      }
    },

    AssignmentExpression(assignmentPath) {
      const { node, scope } = assignmentPath;
      if (isStorageModuleExpression(node.right, scope)) {
        if (node.left.type === 'Identifier') {
          addModuleBinding(scope, node.left.name);
        }
        return;
      }
      if (!isDefaultStorageExpression(node.right, scope)) {
        return;
      }
      if (node.left.type === 'Identifier') {
        addDefaultBinding(scope, node.left.name);
      } else if (
        node.left.type === 'MemberExpression' ||
        node.left.type === 'OptionalMemberExpression'
      ) {
        addStorageMemberAlias(node.left, scope);
      }
    },
  });

  if (importCount > 0 && methods.size === 0 && violations.length === 0) {
    addViolation(
      ast.program,
      'unverified-api-surface',
      'The AsyncStorage runtime import escapes static API verification; patch the package so every call targets a supported bg proxy method directly.',
    );
  }

  return {
    importCount,
    methods: [...methods].toSorted(),
    violations: violations.toSorted(
      (left, right) => left.line - right.line || left.column - right.column,
    ),
  };
}

function findInstalledPackageRoot(packageName, fromDirectory) {
  let current = path.resolve(fromDirectory);
  const packageSegments = packageName.split('/');

  while (true) {
    const manifestPath = path.join(
      current,
      'node_modules',
      ...packageSegments,
      'package.json',
    );
    if (fs.existsSync(manifestPath)) {
      return path.dirname(manifestPath);
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function readManifest(packageRoot) {
  return JSON.parse(
    fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
  );
}

function isFirstPartyPackage(packageRoot, manifest, repoRoot) {
  if (manifest.name?.startsWith('@onekeyhq/')) {
    return true;
  }
  const relativePath = path.relative(repoRoot, packageRoot);
  return (
    relativePath !== '' &&
    !relativePath.startsWith('..') &&
    !relativePath.split(path.sep).includes('node_modules')
  );
}

function discoverMobileProductionPackages({ mobileDir, repoRoot }) {
  const mobileManifest = readManifest(mobileDir);
  const queue = Object.keys(mobileManifest.dependencies || {}).map((name) => ({
    fromDirectory: mobileDir,
    name,
  }));
  const seenRoots = new Set();
  const packages = [];

  while (queue.length > 0) {
    const dependency = queue.shift();
    const unresolvedRoot = findInstalledPackageRoot(
      dependency.name,
      dependency.fromDirectory,
    );
    if (!unresolvedRoot) {
      continue;
    }
    const packageRoot = fs.realpathSync(unresolvedRoot);
    if (seenRoots.has(packageRoot)) {
      continue;
    }
    seenRoots.add(packageRoot);

    let manifest;
    try {
      manifest = readManifest(packageRoot);
    } catch {
      continue;
    }

    const firstParty = isFirstPartyPackage(packageRoot, manifest, repoRoot);
    packages.push({
      firstParty,
      name: manifest.name || dependency.name,
      root: packageRoot,
    });

    const dependencies = {
      ...manifest.dependencies,
      ...manifest.optionalDependencies,
      ...manifest.peerDependencies,
    };
    for (const name of Object.keys(dependencies)) {
      queue.push({ fromDirectory: packageRoot, name });
    }
  }

  return packages;
}

function shouldInspectFile(fileName) {
  return (
    SOURCE_FILE_PATTERN.test(fileName) &&
    !fileName.endsWith('.d.ts') &&
    !TEST_FILE_PATTERN.test(fileName) &&
    !WEB_FILE_PATTERN.test(fileName)
  );
}

function collectCandidateFiles(packageRoot) {
  const candidates = [];
  const directories = [packageRoot];

  while (directories.length > 0) {
    const directory = directories.pop();
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        continue;
      }
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) {
          directories.push(entryPath);
        }
        continue;
      }
      if (!entry.isFile() || !shouldInspectFile(entry.name)) {
        continue;
      }

      let source;
      try {
        source = fs.readFileSync(entryPath, 'utf8');
      } catch {
        continue;
      }
      if (SOURCE_NEEDLES.some((needle) => source.includes(needle))) {
        candidates.push({ filePath: entryPath, source });
      }
    }
  }

  return candidates;
}

function scanMobileProductionDependencies({
  repoRoot = path.resolve(__dirname, '../../..'),
  mobileDir = path.resolve(__dirname, '..'),
} = {}) {
  const dependencyPackages = discoverMobileProductionPackages({
    mobileDir,
    repoRoot,
  });
  const consumers = new Map();
  const violations = [];
  let candidateFileCount = 0;

  for (const dependencyPackage of dependencyPackages) {
    if (
      dependencyPackage.firstParty ||
      ASYNC_STORAGE_IMPLEMENTATION_PACKAGES.has(dependencyPackage.name)
    ) {
      continue;
    }

    const candidates = collectCandidateFiles(dependencyPackage.root);
    candidateFileCount += candidates.length;
    for (const candidate of candidates) {
      const result = analyzeSource(candidate);
      if (result.importCount > 0) {
        const existing = consumers.get(dependencyPackage.name) || {
          fileCount: 0,
          methods: new Set(),
        };
        existing.fileCount += 1;
        for (const method of result.methods) {
          existing.methods.add(method);
        }
        consumers.set(dependencyPackage.name, existing);
      }
      for (const violation of result.violations) {
        violations.push({
          ...violation,
          filePath: path.relative(repoRoot, candidate.filePath),
          packageName: dependencyPackage.name,
        });
      }
    }
  }

  return {
    candidateFileCount,
    consumers: [...consumers.entries()]
      .map(([packageName, value]) => ({
        fileCount: value.fileCount,
        methods: [...value.methods].toSorted(),
        packageName,
      }))
      .toSorted((left, right) =>
        left.packageName.localeCompare(right.packageName),
      ),
    dependencyPackageCount: dependencyPackages.filter(
      (dependencyPackage) => !dependencyPackage.firstParty,
    ).length,
    violations: violations.toSorted(
      (left, right) =>
        left.filePath.localeCompare(right.filePath) || left.line - right.line,
    ),
  };
}

function main() {
  const result = scanMobileProductionDependencies();
  console.log(
    `[third-party-native-storage] scanned ${result.dependencyPackageCount} mobile production dependency packages and ${result.candidateFileCount} candidate files.`,
  );

  if (result.consumers.length > 0) {
    console.log(
      '[third-party-native-storage] compatible AsyncStorage consumers:',
    );
    for (const consumer of result.consumers) {
      const methods =
        consumer.methods.length > 0
          ? consumer.methods.join(', ')
          : 'default-export interop';
      console.log(
        `  - ${consumer.packageName}: ${consumer.fileCount} file(s); ${methods}`,
      );
    }
  }

  if (result.violations.length === 0) {
    console.log(
      '[third-party-native-storage] PASS: AsyncStorage consumers are proxy-compatible and no third-party MMKV runtime imports were found.',
    );
    return;
  }

  console.error(
    `[third-party-native-storage] FAIL: ${result.violations.length} incompatible access(es) found.`,
  );
  for (const violation of result.violations) {
    console.error(
      `  - ${violation.filePath}:${violation.line}:${violation.column} [${violation.packageName}] ${violation.message}`,
    );
  }
  console.error(
    `Patch the affected package to use the supported ${ASYNC_STORAGE_PACKAGE} bg proxy contract and remove third-party ${MMKV_PACKAGE} runtime imports before releasing it.`,
  );
  process.exitCode = 1;
}

if (require.main === module) {
  main();
}

module.exports = {
  ASYNC_STORAGE_PACKAGE,
  MMKV_PACKAGE,
  SUPPORTED_ASYNC_STORAGE_METHODS,
  analyzeSource,
  discoverMobileProductionPackages,
  scanMobileProductionDependencies,
};
