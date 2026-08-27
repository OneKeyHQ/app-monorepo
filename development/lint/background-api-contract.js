#!/usr/bin/env node
/* eslint-disable no-continue */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const { parse } = require('@babel/parser');

const SOURCE_FILE_RE = /\.(?:js|jsx|ts|tsx)$/u;
const TYPESCRIPT_FILE_RE = /\.tsx?$/u;
const JSX_FILE_RE = /\.(?:jsx|tsx)$/u;
const BACKGROUND_SOURCE_PREFIX = 'packages/kit-bg/src/';
const REFERENCE_SOURCE_PREFIXES = ['apps/', 'packages/'];
const BACKGROUND_API_PROXY_FILE =
  'packages/kit-bg/src/apis/BackgroundApiProxy.ts';
const SIMPLE_DB_FILE = 'packages/kit-bg/src/dbs/simple/base/SimpleDb.ts';
const SIMPLE_DB_PROXY_FILE =
  'packages/kit-bg/src/dbs/simple/base/SimpleDbProxy.ts';
const BACKGROUND_DECORATORS_SUFFIX = '/background/backgroundDecorators';
const EXPOSED_DECORATORS = new Set([
  'backgroundMethod',
  'backgroundMethodForDev',
]);

function isIgnoredSourceFile(filePath) {
  return (
    /(?:^|\/)(?:__mocks__|__tests__|__test-utils__|test-utils)(?:\/|$)/u.test(
      filePath,
    ) || /\.(?:spec|test)\.(?:js|jsx|ts|tsx)$/u.test(filePath)
  );
}

function getRepositorySourceFiles(rootDir) {
  const result = spawnSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--'],
    {
      cwd: rootDir,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 50,
    },
  );
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || 'Unable to list repository files.');
  }
  return result.stdout
    .split('\0')
    .filter(
      (filePath) =>
        SOURCE_FILE_RE.test(filePath) &&
        !isIgnoredSourceFile(filePath) &&
        fs.existsSync(path.join(rootDir, filePath)),
    );
}

function getMatchingSourceFiles(
  rootDir,
  repositoryFiles,
  pattern,
  sourcePrefixes,
) {
  const result = spawnSync(
    'git',
    [
      'grep',
      '--untracked',
      '--exclude-standard',
      '--files-with-matches',
      '--fixed-strings',
      '--null',
      pattern,
      '--',
      ...sourcePrefixes,
    ],
    {
      cwd: rootDir,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 50,
    },
  );
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(
      result.stderr || `Unable to find source pattern: ${pattern}`,
    );
  }
  const repositoryFileSet = new Set(repositoryFiles);
  return result.stdout
    .split('\0')
    .filter(
      (filePath) =>
        repositoryFileSet.has(filePath) && !isIgnoredSourceFile(filePath),
    );
}

function getReferenceSourceFiles(rootDir, repositoryFiles) {
  return getMatchingSourceFiles(
    rootDir,
    repositoryFiles,
    'backgroundApiProxy',
    REFERENCE_SOURCE_PREFIXES,
  );
}

function readSources(rootDir, filePaths) {
  return new Map(
    filePaths.map((filePath) => [
      filePath,
      fs.readFileSync(path.join(rootDir, filePath), 'utf8'),
    ]),
  );
}

function parseSource(filePath, source) {
  const plugins = [
    'decorators-legacy',
    'classProperties',
    'classPrivateProperties',
    'classPrivateMethods',
    'dynamicImport',
    'importAttributes',
    'topLevelAwait',
  ];
  if (TYPESCRIPT_FILE_RE.test(filePath)) {
    plugins.push('typescript');
  }
  if (!TYPESCRIPT_FILE_RE.test(filePath) || JSX_FILE_RE.test(filePath)) {
    plugins.push('jsx');
  }
  try {
    return parse(source, {
      sourceType: 'unambiguous',
      plugins,
    });
  } catch (error) {
    error.message = `${filePath}: ${error.message}`;
    throw error;
  }
}

function createAstCache(sources) {
  const cache = new Map();
  return (filePath) => {
    if (!sources.has(filePath)) {
      return undefined;
    }
    if (!cache.has(filePath)) {
      cache.set(filePath, parseSource(filePath, sources.get(filePath)));
    }
    return cache.get(filePath);
  };
}

const SKIPPED_AST_KEYS = new Set([
  'comments',
  'end',
  'extra',
  'innerComments',
  'leadingComments',
  'loc',
  'start',
  'trailingComments',
]);

function walkAst(node, visitor, parent = undefined) {
  if (!node || typeof node !== 'object') {
    return;
  }
  visitor(node, parent);
  for (const [key, value] of Object.entries(node)) {
    if (SKIPPED_AST_KEYS.has(key)) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const child of value) {
        walkAst(child, visitor, node);
      }
    } else if (value && typeof value === 'object' && value.type) {
      walkAst(value, visitor, node);
    }
  }
}

function unwrapExpression(node) {
  let current = node;
  while (
    current &&
    [
      'ChainExpression',
      'TSAsExpression',
      'TSNonNullExpression',
      'TSSatisfiesExpression',
      'TSTypeAssertion',
    ].includes(current.type)
  ) {
    current = current.expression;
  }
  return current;
}

function getStaticPropertyName(node) {
  if (!node) {
    return undefined;
  }
  if (!node.computed && node.property?.type === 'Identifier') {
    return node.property.name;
  }
  if (
    node.computed &&
    ['Literal', 'StringLiteral'].includes(node.property?.type) &&
    typeof node.property.value === 'string'
  ) {
    return node.property.value;
  }
  return undefined;
}

function getMemberChain(node) {
  const current = unwrapExpression(node);
  if (!current) {
    return undefined;
  }
  if (current.type === 'Identifier') {
    return [current.name];
  }
  if (current.type === 'ThisExpression') {
    return ['this'];
  }
  if (
    current.type === 'MemberExpression' ||
    current.type === 'OptionalMemberExpression'
  ) {
    const objectChain = getMemberChain(current.object);
    const propertyName = getStaticPropertyName(current);
    if (!objectChain || !propertyName) {
      return undefined;
    }
    return [...objectChain, propertyName];
  }
  return undefined;
}

function collectExposedDecoratorBindings(ast) {
  const named = new Map();
  const namespaces = new Set();
  for (const statement of ast.program.body) {
    if (
      statement.type !== 'ImportDeclaration' ||
      !statement.source.value.endsWith(BACKGROUND_DECORATORS_SUFFIX)
    ) {
      continue;
    }
    for (const specifier of statement.specifiers) {
      if (specifier.type === 'ImportNamespaceSpecifier') {
        namespaces.add(specifier.local.name);
        continue;
      }
      if (specifier.type !== 'ImportSpecifier') {
        continue;
      }
      const importedName = specifier.imported.name ?? specifier.imported.value;
      if (EXPOSED_DECORATORS.has(importedName)) {
        named.set(specifier.local.name, importedName);
      }
    }
  }
  return { named, namespaces };
}

function getDecoratorName(decorator, bindings) {
  let expression = decorator?.expression;
  while (
    expression &&
    ['CallExpression', 'OptionalCallExpression'].includes(expression.type)
  ) {
    expression = expression.callee;
  }
  const chain = getMemberChain(expression);
  if (chain?.length === 1) {
    return bindings.named.get(chain[0]);
  }
  if (
    chain?.length === 2 &&
    bindings.namespaces.has(chain[0]) &&
    EXPOSED_DECORATORS.has(chain[1])
  ) {
    return chain[1];
  }
  return undefined;
}

function getClassElementName(element) {
  if (element.computed) {
    if (
      ['Literal', 'StringLiteral'].includes(element.key?.type) &&
      typeof element.key.value === 'string'
    ) {
      return element.key.value;
    }
    return undefined;
  }
  return element.key?.name ?? element.key?.value;
}

function collectClassIndex(backgroundFiles, getAst) {
  const classIndex = new Map();
  for (const filePath of backgroundFiles) {
    const ast = getAst(filePath);
    const decoratorBindings = collectExposedDecoratorBindings(ast);
    walkAst(ast, (node) => {
      if (
        !['ClassDeclaration', 'ClassExpression'].includes(node.type) ||
        !node.id?.name
      ) {
        return;
      }
      const methods = new Map();
      for (const element of node.body.body) {
        const isMethod = [
          'ClassMethod',
          'ClassPrivateMethod',
          'TSDeclareMethod',
        ].includes(element.type);
        const isFunctionProperty =
          ['ClassProperty', 'ClassPrivateProperty'].includes(element.type) &&
          ['ArrowFunctionExpression', 'FunctionExpression'].includes(
            unwrapExpression(element.value)?.type,
          );
        if (!isMethod && !isFunctionProperty) {
          continue;
        }
        const methodName = getClassElementName(element);
        if (typeof methodName !== 'string') {
          continue;
        }
        const decoratorNames = (element.decorators ?? [])
          .map((decorator) => getDecoratorName(decorator, decoratorBindings))
          .filter(Boolean);
        const existing = methods.get(methodName);
        methods.set(methodName, {
          decorated:
            existing?.decorated ||
            decoratorNames.some((name) => EXPOSED_DECORATORS.has(name)),
          decorators: [...(existing?.decorators ?? []), ...decoratorNames],
          filePath,
          line: element.loc?.start.line ?? 1,
        });
      }
      const record = {
        filePath,
        methods,
        name: node.id.name,
        parentName:
          unwrapExpression(node.superClass)?.type === 'Identifier'
            ? unwrapExpression(node.superClass).name
            : undefined,
      };
      const records = classIndex.get(record.name) ?? [];
      records.push(record);
      classIndex.set(record.name, records);
    });
  }
  return classIndex;
}

function collectTypeReferenceNames(node, names = []) {
  if (!node || typeof node !== 'object') {
    return names;
  }
  if (node.type === 'TSTypeReference' && node.typeName?.type === 'Identifier') {
    names.push(node.typeName.name);
  }
  for (const [key, value] of Object.entries(node)) {
    if (SKIPPED_AST_KEYS.has(key)) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const child of value) {
        collectTypeReferenceNames(child, names);
      }
    } else if (value && typeof value === 'object') {
      collectTypeReferenceNames(value, names);
    }
  }
  return names;
}

function collectServiceTypes(ast) {
  const serviceTypes = new Map();
  walkAst(ast, (node) => {
    if (node.type !== 'ClassMethod' || node.kind !== 'get' || node.computed) {
      return;
    }
    const serviceName = getClassElementName(node);
    if (
      typeof serviceName !== 'string' ||
      (!serviceName.startsWith('service') && serviceName !== 'walletConnect')
    ) {
      return;
    }
    const typeNames = collectTypeReferenceNames(node.returnType);
    const serviceType =
      typeNames.find((name) => /^(?:ProviderApi|Service)/u.test(name)) ??
      typeNames.at(-1);
    if (serviceType) {
      serviceTypes.set(serviceName, serviceType);
    }
  });
  return serviceTypes;
}

function collectSimpleDbTypes(ast) {
  const simpleDbTypes = new Map();
  walkAst(ast, (node) => {
    if (node.type !== 'ClassMethod' || node.kind !== 'get' || node.computed) {
      return;
    }
    let entityType;
    walkAst(node.body, (child) => {
      const callee = unwrapExpression(child.callee);
      if (
        !entityType &&
        child.type === 'NewExpression' &&
        callee?.type === 'Identifier' &&
        callee.name.startsWith('SimpleDbEntity')
      ) {
        entityType = callee.name;
      }
    });
    const entityName = getClassElementName(node);
    if (typeof entityName === 'string' && entityType) {
      simpleDbTypes.set(entityName, entityType);
    }
  });
  return simpleDbTypes;
}

function collectSimpleDbImmediateMethods(ast) {
  const immediateMethods = new Set();
  walkAst(ast, (node) => {
    if (!['ClassProperty', 'PropertyDefinition'].includes(node.type)) {
      return;
    }
    walkAst(node.value, (child) => {
      if (
        child.type !== 'CallExpression' ||
        getStaticPropertyName(child.callee) !== '_createProxyService'
      ) {
        return;
      }
      const entityArg = unwrapExpression(child.arguments[0]);
      const immediateArg = unwrapExpression(child.arguments[1]);
      if (
        !['Literal', 'StringLiteral'].includes(entityArg?.type) ||
        typeof entityArg.value !== 'string' ||
        immediateArg?.type !== 'ObjectExpression'
      ) {
        return;
      }
      for (const property of immediateArg.properties) {
        if (
          !['ObjectMethod', 'ObjectProperty', 'Property'].includes(
            property.type,
          )
        ) {
          continue;
        }
        const methodName = getClassElementName(property);
        if (typeof methodName === 'string') {
          immediateMethods.add(`${entityArg.value}.${methodName}`);
        }
      }
    });
  });
  return immediateMethods;
}

function isProxyImport(source) {
  return /(?:^|\/)backgroundApiProxy(?:\.[^/]*)?$/u.test(source);
}

function isServiceName(value) {
  return value === 'walletConnect' || /^service[A-Z]/u.test(value);
}

const LEXICAL_SCOPE_NODE_TYPES = new Set([
  'ArrowFunctionExpression',
  'BlockStatement',
  'CatchClause',
  'ClassExpression',
  'ClassDeclaration',
  'ClassMethod',
  'ClassPrivateMethod',
  'ForInStatement',
  'ForOfStatement',
  'ForStatement',
  'FunctionDeclaration',
  'FunctionExpression',
  'ObjectMethod',
  'SwitchStatement',
]);
const FUNCTION_NODE_TYPES = new Set([
  'ArrowFunctionExpression',
  'ClassMethod',
  'ClassPrivateMethod',
  'FunctionDeclaration',
  'FunctionExpression',
  'ObjectMethod',
]);

function forEachAstChild(node, callback) {
  for (const [key, value] of Object.entries(node)) {
    if (SKIPPED_AST_KEYS.has(key)) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const child of value) {
        if (child?.type) {
          callback(child);
        }
      }
    } else if (value?.type) {
      callback(value);
    }
  }
}

function collectPatternBindings(pattern, callback, propertyPath = []) {
  if (!pattern) {
    return;
  }
  if (pattern.type === 'Identifier') {
    callback(pattern, propertyPath);
    return;
  }
  if (pattern.type === 'AssignmentPattern') {
    collectPatternBindings(pattern.left, callback, propertyPath);
    return;
  }
  if (pattern.type === 'TSParameterProperty') {
    collectPatternBindings(pattern.parameter, callback, propertyPath);
    return;
  }
  if (pattern.type === 'RestElement') {
    collectPatternBindings(pattern.argument, callback);
    return;
  }
  if (pattern.type === 'ObjectPattern') {
    for (const property of pattern.properties) {
      if (property.type === 'RestElement') {
        collectPatternBindings(property.argument, callback);
        continue;
      }
      const propertyName = getClassElementName(property);
      collectPatternBindings(
        property.value,
        callback,
        typeof propertyName === 'string' ? [...propertyPath, propertyName] : [],
      );
    }
    return;
  }
  if (pattern.type === 'ArrayPattern') {
    pattern.elements.forEach((element, index) => {
      collectPatternBindings(element, callback, [
        ...propertyPath,
        String(index),
      ]);
    });
  }
}

function createLexicalIndex(ast) {
  const scopeByNode = new WeakMap();
  const parentByNode = new WeakMap();
  const rootScope = { bindings: new Map(), parent: undefined };

  const setUnknownBinding = (scope, identifier) => {
    if (identifier?.type === 'Identifier') {
      scope.bindings.set(identifier.name, { kind: 'unknown' });
    }
  };

  const visit = (node, parent, inheritedScope) => {
    if (parent) {
      parentByNode.set(node, parent);
    }
    if (
      ['ClassDeclaration', 'FunctionDeclaration'].includes(node.type) &&
      node.id
    ) {
      setUnknownBinding(inheritedScope, node.id);
    }

    const scope =
      node.type !== 'Program' && LEXICAL_SCOPE_NODE_TYPES.has(node.type)
        ? { bindings: new Map(), parent: inheritedScope }
        : inheritedScope;
    scopeByNode.set(node, scope);

    if (node.type === 'ImportDeclaration') {
      for (const specifier of node.specifiers) {
        scope.bindings.set(specifier.local.name, {
          kind:
            specifier.type === 'ImportDefaultSpecifier' &&
            isProxyImport(node.source.value)
              ? 'proxy'
              : 'unknown',
        });
      }
    }

    if (node.type === 'VariableDeclarator') {
      collectPatternBindings(node.id, (identifier, propertyPath) => {
        scope.bindings.set(identifier.name, {
          assumeProxy:
            propertyPath.length === 0 &&
            /^(?:backgroundApiProxy|bgApiProxy)$/iu.test(identifier.name),
          init: node.init,
          kind: 'variable',
          propertyPath,
          scope,
        });
      });
    }

    if (FUNCTION_NODE_TYPES.has(node.type)) {
      if (node.type === 'FunctionExpression' && node.id) {
        setUnknownBinding(scope, node.id);
      }
      node.params.forEach((parameter, parameterIndex) => {
        collectPatternBindings(parameter, (identifier) => {
          scope.bindings.set(identifier.name, {
            functionNode: node,
            kind: 'parameter',
            parameterIndex,
          });
        });
      });
    }

    if (node.type === 'CatchClause') {
      collectPatternBindings(node.param, (identifier) => {
        setUnknownBinding(scope, identifier);
      });
    }

    forEachAstChild(node, (child) => visit(child, node, scope));
  };

  visit(ast.program, undefined, rootScope);
  return { parentByNode, scopeByNode };
}

function findLexicalBinding(scope, name) {
  let currentScope = scope;
  while (currentScope) {
    if (currentScope.bindings.has(name)) {
      return currentScope.bindings.get(name);
    }
    currentScope = currentScope.parent;
  }
  return undefined;
}

function appendDescriptorProperty(descriptor, propertyName) {
  if (!descriptor) {
    return undefined;
  }
  if (descriptor.kind === 'proxy') {
    if (isServiceName(propertyName)) {
      return { kind: 'service', owner: propertyName };
    }
    if (propertyName === 'simpleDb') {
      return { kind: 'simpleDb' };
    }
    return undefined;
  }
  if (descriptor.kind === 'proxyModule') {
    return propertyName === 'default' ? { kind: 'proxy' } : undefined;
  }
  if (descriptor.kind === 'service') {
    return {
      kind: 'reference',
      method: propertyName,
      owner: descriptor.owner,
      referenceKind: 'service',
    };
  }
  if (descriptor.kind === 'simpleDb') {
    return { kind: 'entity', owner: propertyName };
  }
  if (descriptor.kind === 'entity') {
    return {
      kind: 'reference',
      method: propertyName,
      owner: descriptor.owner,
      referenceKind: 'simpleDb',
    };
  }
  return undefined;
}

function collectUiReferences(referenceFiles, getAst) {
  const references = [];
  const dynamicAccesses = [];
  const referenceKeys = new Set();
  const dynamicAccessKeys = new Set();

  function addReference(reference) {
    const key = [
      reference.kind,
      reference.owner,
      reference.method,
      reference.filePath,
      reference.line,
    ].join(':');
    if (!referenceKeys.has(key)) {
      referenceKeys.add(key);
      references.push(reference);
    }
  }

  function addDynamicAccess(access) {
    const key = `${access.filePath}:${access.line}`;
    if (!dynamicAccessKeys.has(key)) {
      dynamicAccessKeys.add(key);
      dynamicAccesses.push(access);
    }
  }

  for (const filePath of referenceFiles) {
    const ast = getAst(filePath);
    const { parentByNode, scopeByNode } = createLexicalIndex(ast);

    const resolveExpression = (
      expression,
      scope = scopeByNode.get(expression),
      visitedBindings = new Set(),
    ) => {
      const current = unwrapExpression(expression);
      if (!current) {
        return undefined;
      }

      const rawChain = getMemberChain(current);
      const globalProxyIndex = rawChain?.indexOf('$backgroundApiProxy') ?? -1;
      if (globalProxyIndex >= 0) {
        let descriptor = { kind: 'proxy' };
        for (const propertyName of rawChain.slice(globalProxyIndex + 1)) {
          descriptor = appendDescriptorProperty(descriptor, propertyName);
          if (!descriptor) {
            return undefined;
          }
        }
        return descriptor;
      }

      if (current.type === 'Identifier') {
        const binding = findLexicalBinding(scope, current.name);
        if (!binding || binding.kind === 'unknown') {
          return undefined;
        }
        if (binding.kind === 'proxy') {
          return { kind: 'proxy' };
        }
        if (visitedBindings.has(binding)) {
          return undefined;
        }
        const nextVisitedBindings = new Set(visitedBindings);
        nextVisitedBindings.add(binding);
        if (binding.kind === 'variable') {
          let descriptor = binding.assumeProxy
            ? { kind: 'proxy' }
            : resolveExpression(
                binding.init,
                binding.scope,
                nextVisitedBindings,
              );
          for (const propertyName of binding.propertyPath) {
            descriptor = appendDescriptorProperty(descriptor, propertyName);
          }
          return descriptor;
        }
        if (binding.kind === 'parameter' && binding.parameterIndex === 0) {
          const callExpression = parentByNode.get(binding.functionNode);
          const callee = unwrapExpression(callExpression?.callee);
          if (
            callExpression?.type === 'CallExpression' &&
            ['MemberExpression', 'OptionalMemberExpression'].includes(
              callee?.type,
            ) &&
            getStaticPropertyName(callee) === 'then'
          ) {
            return resolveExpression(
              callee.object,
              scopeByNode.get(callee.object),
              nextVisitedBindings,
            );
          }
        }
        return undefined;
      }

      if (current.type === 'AwaitExpression') {
        return resolveExpression(
          current.argument,
          scopeByNode.get(current.argument),
          visitedBindings,
        );
      }

      if (['CallExpression', 'OptionalCallExpression'].includes(current.type)) {
        const callee = unwrapExpression(current.callee);
        if (
          callee?.type === 'Identifier' &&
          callee.name === 'getBackgroundApiProxy'
        ) {
          return { kind: 'proxy' };
        }
        const firstArgument = unwrapExpression(current.arguments[0]);
        if (
          callee?.type === 'Identifier' &&
          callee.name === 'require' &&
          ['Literal', 'StringLiteral'].includes(firstArgument?.type) &&
          typeof firstArgument.value === 'string' &&
          isProxyImport(firstArgument.value)
        ) {
          return { kind: 'proxyModule' };
        }
        return undefined;
      }

      if (current.type === 'NewExpression') {
        const calleeName = getMemberChain(current.callee)?.at(-1);
        return calleeName === 'BackgroundApiProxy'
          ? { kind: 'proxy' }
          : undefined;
      }

      if (
        ['MemberExpression', 'OptionalMemberExpression'].includes(current.type)
      ) {
        const propertyName = getStaticPropertyName(current);
        if (!propertyName) {
          return undefined;
        }
        return appendDescriptorProperty(
          resolveExpression(
            current.object,
            scopeByNode.get(current.object),
            visitedBindings,
          ),
          propertyName,
        );
      }

      if (current.type === 'SequenceExpression') {
        const lastExpression = current.expressions.at(-1);
        return resolveExpression(
          lastExpression,
          scopeByNode.get(lastExpression),
          visitedBindings,
        );
      }

      return undefined;
    };

    const addReferenceDescriptor = (descriptor, node) => {
      if (descriptor?.kind !== 'reference') {
        return;
      }
      addReference({
        filePath,
        kind: descriptor.referenceKind,
        line: node.loc?.start.line ?? 1,
        method: descriptor.method,
        owner: descriptor.owner,
      });
    };

    walkAst(ast, (node, parent) => {
      if (
        !['MemberExpression', 'OptionalMemberExpression'].includes(node.type)
      ) {
        return;
      }
      if (
        ['MemberExpression', 'OptionalMemberExpression'].includes(
          parent?.type,
        ) &&
        parent.object === node
      ) {
        return;
      }
      if (node.computed && !getStaticPropertyName(node)) {
        const descriptor = resolveExpression(
          node.object,
          scopeByNode.get(node.object),
        );
        if (
          ['entity', 'proxy', 'service', 'simpleDb'].includes(descriptor?.kind)
        ) {
          addDynamicAccess({
            filePath,
            line: node.loc?.start.line ?? 1,
          });
        }
        return;
      }
      addReferenceDescriptor(
        resolveExpression(node, scopeByNode.get(node)),
        node,
      );
    });

    walkAst(ast, (node) => {
      if (
        node.type !== 'VariableDeclarator' ||
        node.id.type !== 'ObjectPattern' ||
        !node.init
      ) {
        return;
      }
      const descriptor = resolveExpression(
        node.init,
        scopeByNode.get(node.init),
      );
      collectPatternBindings(node.id, (identifier, propertyPath) => {
        let propertyDescriptor = descriptor;
        for (const propertyName of propertyPath) {
          propertyDescriptor = appendDescriptorProperty(
            propertyDescriptor,
            propertyName,
          );
        }
        addReferenceDescriptor(propertyDescriptor, identifier);
      });
    });
  }

  return { dynamicAccesses, references };
}

function getPlatformVariant(filePath) {
  return filePath.match(
    /\.(android|desktop|ext|ios|native|web|web-only)\.(?:js|jsx|ts|tsx)$/u,
  )?.[1];
}

function getParentClassRecords(classIndex, className, childRecord) {
  const records = classIndex.get(className) ?? [];
  if (records.length <= 1) {
    return records;
  }
  const childPlatform = getPlatformVariant(childRecord.filePath);
  if (childPlatform) {
    const matchingPlatformRecords = records.filter(
      (record) => getPlatformVariant(record.filePath) === childPlatform,
    );
    if (matchingPlatformRecords.length) {
      return matchingPlatformRecords;
    }
  }
  const platformNeutralRecords = records.filter(
    (record) => !getPlatformVariant(record.filePath),
  );
  return platformNeutralRecords.length ? platformNeutralRecords : records;
}

function resolveRecordMethodExposure(
  classIndex,
  record,
  methodName,
  visitedRecords,
) {
  const recordKey = `${record.filePath}:${record.name}`;
  if (visitedRecords.has(recordKey)) {
    return { error: `circular inheritance detected at ${recordKey}` };
  }
  const declaration = record.methods.get(methodName);
  if (declaration) {
    return declaration.decorated
      ? { declaration, exposed: true }
      : { declaration, exposed: false };
  }
  if (!record.parentName) {
    return {
      error: `method ${record.name}.${methodName} was not found in ${record.filePath}`,
    };
  }
  const parentRecords = getParentClassRecords(
    classIndex,
    record.parentName,
    record,
  );
  if (!parentRecords.length) {
    return { error: `class ${record.parentName} was not found` };
  }
  const nextVisitedRecords = new Set(visitedRecords);
  nextVisitedRecords.add(recordKey);
  const results = parentRecords.map((parentRecord) =>
    resolveRecordMethodExposure(
      classIndex,
      parentRecord,
      methodName,
      nextVisitedRecords,
    ),
  );
  return results.find((result) => !result.exposed) ?? results[0];
}

function resolveMethodExposure(classIndex, className, methodName) {
  const records = classIndex.get(className) ?? [];
  if (!records.length) {
    return { error: `class ${className} was not found` };
  }
  const results = records.map((record) =>
    resolveRecordMethodExposure(classIndex, record, methodName, new Set()),
  );
  return results.find((result) => !result.exposed) ?? results[0];
}

function findContractViolations({
  classIndex,
  dynamicAccesses,
  immediateMethods,
  references,
  serviceTypes,
  simpleDbTypes,
}) {
  const violations = dynamicAccesses.map((access) => ({
    ...access,
    message:
      'Dynamic backgroundApiProxy access cannot be checked. Use static service and method names.',
  }));

  for (const reference of references) {
    if (
      reference.kind === 'simpleDb' &&
      immediateMethods.has(`${reference.owner}.${reference.method}`)
    ) {
      continue;
    }
    const className =
      reference.kind === 'service'
        ? serviceTypes.get(reference.owner)
        : simpleDbTypes.get(reference.owner);
    if (!className) {
      violations.push({
        ...reference,
        message: `${reference.kind} owner ${reference.owner} is not registered in its proxy.`,
      });
      continue;
    }
    const exposure = resolveMethodExposure(
      classIndex,
      className,
      reference.method,
    );
    if (exposure.exposed) {
      continue;
    }
    violations.push({
      ...reference,
      declaration: exposure.declaration,
      message:
        exposure.error ??
        `${reference.owner}.${reference.method} is not exposed with @backgroundMethod() or @backgroundMethodForDev().`,
    });
  }
  return violations;
}

function analyzeRepository(rootDir = process.cwd()) {
  const filePaths = getRepositorySourceFiles(rootDir);
  const backgroundClassFiles = getMatchingSourceFiles(
    rootDir,
    filePaths,
    'class',
    [BACKGROUND_SOURCE_PREFIX],
  );
  const referenceFiles = getReferenceSourceFiles(rootDir, filePaths);
  const requiredFiles = new Set([
    ...backgroundClassFiles,
    ...referenceFiles,
    BACKGROUND_API_PROXY_FILE,
    SIMPLE_DB_FILE,
    SIMPLE_DB_PROXY_FILE,
  ]);
  const sources = readSources(rootDir, [...requiredFiles]);
  const getAst = createAstCache(sources);
  const classIndex = collectClassIndex(backgroundClassFiles, getAst);
  const serviceTypes = collectServiceTypes(getAst(BACKGROUND_API_PROXY_FILE));
  const simpleDbTypes = collectSimpleDbTypes(getAst(SIMPLE_DB_FILE));
  const immediateMethods = collectSimpleDbImmediateMethods(
    getAst(SIMPLE_DB_PROXY_FILE),
  );
  const { dynamicAccesses, references } = collectUiReferences(
    referenceFiles,
    getAst,
  );
  const violations = findContractViolations({
    classIndex,
    dynamicAccesses,
    immediateMethods,
    references,
    serviceTypes,
    simpleDbTypes,
  });
  return {
    references,
    serviceTypes,
    simpleDbTypes,
    violations,
  };
}

function formatViolation(violation) {
  const lines = [
    `${violation.filePath}:${violation.line}`,
    `  ${violation.message}`,
  ];
  if (violation.declaration) {
    lines.push(
      `  Declaration: ${violation.declaration.filePath}:${violation.declaration.line}`,
    );
  }
  return lines.join('\n');
}

function main() {
  try {
    const result = analyzeRepository();
    if (result.violations.length) {
      process.stderr.write(
        [
          `Background API contract check failed with ${result.violations.length} violation(s):`,
          '',
          ...result.violations.map(formatViolation),
          '',
          'Expose each UI-called method with @backgroundMethod(), or route it through an exposed background wrapper.',
          '',
        ].join('\n'),
      );
      process.exitCode = 1;
      return;
    }
    process.stdout.write(
      `Background API contract check passed (${result.references.length} proxy references, ${result.serviceTypes.size} services, ${result.simpleDbTypes.size} simpleDb entities).\n`,
    );
  } catch (error) {
    process.stderr.write(
      `Background API contract check crashed: ${error.stack ?? error.message}\n`,
    );
    process.exitCode = 1;
  }
}

module.exports = {
  collectClassIndex,
  collectUiReferences,
  findContractViolations,
  getRepositorySourceFiles,
  parseSource,
  resolveMethodExposure,
};

if (require.main === module) {
  main();
}
