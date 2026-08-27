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
        SOURCE_FILE_RE.test(filePath) && !isIgnoredSourceFile(filePath),
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

function getDecoratorName(decorator) {
  let expression = decorator?.expression;
  while (
    expression &&
    ['CallExpression', 'OptionalCallExpression'].includes(expression.type)
  ) {
    expression = expression.callee;
  }
  return getMemberChain(expression)?.at(-1);
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
          .map(getDecoratorName)
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

function collectUiReferences(referenceFiles, getAst) {
  const references = [];
  const dynamicAccesses = [];
  const referenceKeys = new Set();

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

  for (const filePath of referenceFiles) {
    const ast = getAst(filePath);
    const proxyIdentifiers = new Set();
    const serviceAliases = new Map();
    const simpleDbAliases = new Set();
    const entityAliases = new Map();

    for (const statement of ast.program.body) {
      if (statement.type !== 'ImportDeclaration') {
        continue;
      }
      if (isProxyImport(statement.source.value)) {
        for (const specifier of statement.specifiers) {
          if (specifier.type === 'ImportDefaultSpecifier') {
            proxyIdentifiers.add(specifier.local.name);
          }
        }
      }
    }

    walkAst(ast, (node) => {
      if (
        node.type === 'VariableDeclarator' &&
        node.id.type === 'Identifier' &&
        /^(?:backgroundApiProxy|bgApiProxy)$/iu.test(node.id.name)
      ) {
        proxyIdentifiers.add(node.id.name);
      }
    });

    const isProxyChain = (chain) =>
      Boolean(
        chain &&
        (proxyIdentifiers.has(chain[0]) ||
          chain.includes('$backgroundApiProxy')),
      );

    const getProxyAnchorIndex = (chain) => {
      if (!chain) {
        return -1;
      }
      if (proxyIdentifiers.has(chain[0])) {
        return 0;
      }
      return chain.indexOf('$backgroundApiProxy');
    };

    const findDirectServiceIndex = (chain) => {
      if (!chain) {
        return -1;
      }
      const index = chain.findIndex(isServiceName);
      const proxyAnchorIndex = getProxyAnchorIndex(chain);
      return proxyAnchorIndex >= 0 && index === proxyAnchorIndex + 1
        ? index
        : -1;
    };

    const resolveExactService = (chain) => {
      if (!chain) {
        return undefined;
      }
      if (serviceAliases.has(chain[0]) && chain.length === 1) {
        return serviceAliases.get(chain[0]);
      }
      const serviceIndex = findDirectServiceIndex(chain);
      return serviceIndex >= 0 && serviceIndex === chain.length - 1
        ? chain[serviceIndex]
        : undefined;
    };

    const resolveExactSimpleDb = (chain) => {
      if (!chain) {
        return false;
      }
      if (simpleDbAliases.has(chain[0]) && chain.length === 1) {
        return true;
      }
      const simpleDbIndex = chain.indexOf('simpleDb');
      return (
        simpleDbIndex === getProxyAnchorIndex(chain) + 1 &&
        simpleDbIndex === chain.length - 1 &&
        getProxyAnchorIndex(chain) >= 0
      );
    };

    const resolveExactEntity = (chain) => {
      if (!chain) {
        return undefined;
      }
      if (entityAliases.has(chain[0]) && chain.length === 1) {
        return entityAliases.get(chain[0]);
      }
      if (simpleDbAliases.has(chain[0]) && chain.length === 2) {
        return chain[1];
      }
      const simpleDbIndex = chain.indexOf('simpleDb');
      return simpleDbIndex === getProxyAnchorIndex(chain) + 1 &&
        simpleDbIndex === chain.length - 2 &&
        getProxyAnchorIndex(chain) >= 0
        ? chain[simpleDbIndex + 1]
        : undefined;
    };

    const collectAliases = (node) => {
      if (node.type !== 'VariableDeclarator' || !node.init) {
        return;
      }
      const initChain = getMemberChain(node.init);
      if (node.id.type === 'Identifier') {
        if (
          initChain &&
          isProxyChain(initChain) &&
          (initChain.length === 1 ||
            initChain.at(-1) === '$backgroundApiProxy') &&
          !proxyIdentifiers.has(node.id.name)
        ) {
          proxyIdentifiers.add(node.id.name);
        }
        const serviceName = resolveExactService(initChain);
        if (serviceName && !serviceAliases.has(node.id.name)) {
          serviceAliases.set(node.id.name, serviceName);
        }
        if (
          resolveExactSimpleDb(initChain) &&
          !simpleDbAliases.has(node.id.name)
        ) {
          simpleDbAliases.add(node.id.name);
        }
        const entityName = resolveExactEntity(initChain);
        if (entityName && !entityAliases.has(node.id.name)) {
          entityAliases.set(node.id.name, entityName);
        }
        return;
      }
      if (node.id.type !== 'ObjectPattern' || !isProxyChain(initChain)) {
        return;
      }
      for (const property of node.id.properties) {
        if (property.type !== 'ObjectProperty' || property.computed) {
          continue;
        }
        const propertyName = getClassElementName(property);
        const localName =
          property.value.type === 'Identifier'
            ? property.value.name
            : undefined;
        if (!localName || typeof propertyName !== 'string') {
          continue;
        }
        if (isServiceName(propertyName) && !serviceAliases.has(localName)) {
          serviceAliases.set(localName, propertyName);
        }
        if (propertyName === 'simpleDb' && !simpleDbAliases.has(localName)) {
          simpleDbAliases.add(localName);
        }
      }
    };

    let previousAliasCount = -1;
    while (
      previousAliasCount !==
      proxyIdentifiers.size +
        serviceAliases.size +
        simpleDbAliases.size +
        entityAliases.size
    ) {
      previousAliasCount =
        proxyIdentifiers.size +
        serviceAliases.size +
        simpleDbAliases.size +
        entityAliases.size;
      walkAst(ast, collectAliases);
    }

    const getReferenceFromChain = (chain, node) => {
      if (!chain) {
        return undefined;
      }
      if (serviceAliases.has(chain[0]) && chain.length >= 2) {
        return {
          filePath,
          kind: 'service',
          line: node.loc?.start.line ?? 1,
          method: chain[1],
          owner: serviceAliases.get(chain[0]),
        };
      }
      const serviceIndex = findDirectServiceIndex(chain);
      if (serviceIndex >= 0 && chain[serviceIndex + 1]) {
        return {
          filePath,
          kind: 'service',
          line: node.loc?.start.line ?? 1,
          method: chain[serviceIndex + 1],
          owner: chain[serviceIndex],
        };
      }
      if (entityAliases.has(chain[0]) && chain.length >= 2) {
        return {
          filePath,
          kind: 'simpleDb',
          line: node.loc?.start.line ?? 1,
          method: chain[1],
          owner: entityAliases.get(chain[0]),
        };
      }
      if (simpleDbAliases.has(chain[0]) && chain.length >= 3) {
        return {
          filePath,
          kind: 'simpleDb',
          line: node.loc?.start.line ?? 1,
          method: chain[2],
          owner: chain[1],
        };
      }
      const simpleDbIndex = chain.indexOf('simpleDb');
      if (
        simpleDbIndex === getProxyAnchorIndex(chain) + 1 &&
        chain[simpleDbIndex + 1] &&
        chain[simpleDbIndex + 2] &&
        getProxyAnchorIndex(chain) >= 0
      ) {
        return {
          filePath,
          kind: 'simpleDb',
          line: node.loc?.start.line ?? 1,
          method: chain[simpleDbIndex + 2],
          owner: chain[simpleDbIndex + 1],
        };
      }
      return undefined;
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
      const reference = getReferenceFromChain(getMemberChain(node), node);
      if (reference) {
        addReference(reference);
      }
    });

    walkAst(ast, (node) => {
      if (
        node.type !== 'VariableDeclarator' ||
        node.id.type !== 'ObjectPattern' ||
        !node.init
      ) {
        return;
      }
      const initChain = getMemberChain(node.init);
      const serviceName = resolveExactService(initChain);
      const entityName = resolveExactEntity(initChain);
      if (!serviceName && !entityName) {
        return;
      }
      for (const property of node.id.properties) {
        if (property.type !== 'ObjectProperty' || property.computed) {
          continue;
        }
        const methodName = getClassElementName(property);
        if (typeof methodName === 'string') {
          addReference({
            filePath,
            kind: serviceName ? 'service' : 'simpleDb',
            line: property.loc?.start.line ?? 1,
            method: methodName,
            owner: serviceName ?? entityName,
          });
        }
      }
    });

    walkAst(ast, (node) => {
      if (
        !['MemberExpression', 'OptionalMemberExpression'].includes(node.type) ||
        !node.computed ||
        getStaticPropertyName(node)
      ) {
        return;
      }
      const objectChain = getMemberChain(node.object);
      if (
        isProxyChain(objectChain) ||
        resolveExactService(objectChain) ||
        resolveExactSimpleDb(objectChain) ||
        resolveExactEntity(objectChain)
      ) {
        dynamicAccesses.push({
          filePath,
          line: node.loc?.start.line ?? 1,
        });
      }
    });
  }

  return { dynamicAccesses, references };
}

function resolveClassRecord(classIndex, className) {
  const records = classIndex.get(className) ?? [];
  if (records.length === 1) {
    return { record: records[0] };
  }
  return records.length
    ? { error: `class ${className} is ambiguous` }
    : { error: `class ${className} was not found` };
}

function resolveMethodExposure(classIndex, className, methodName) {
  const visitedClasses = new Set();
  let currentName = className;
  while (currentName && !visitedClasses.has(currentName)) {
    visitedClasses.add(currentName);
    const resolved = resolveClassRecord(classIndex, currentName);
    if (!resolved.record) {
      return { error: resolved.error };
    }
    const declaration = resolved.record.methods.get(methodName);
    if (declaration) {
      return declaration.decorated
        ? { declaration, exposed: true }
        : { declaration, exposed: false };
    }
    currentName = resolved.record.parentName;
  }
  return { error: `method ${className}.${methodName} was not found` };
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
  const backgroundFiles = filePaths.filter((filePath) =>
    filePath.startsWith(BACKGROUND_SOURCE_PREFIX),
  );
  const referenceFiles = filePaths.filter(
    (filePath) =>
      REFERENCE_SOURCE_PREFIXES.some((prefix) => filePath.startsWith(prefix)) &&
      fs
        .readFileSync(path.join(rootDir, filePath), 'utf8')
        .includes('backgroundApiProxy'),
  );
  const requiredFiles = new Set([
    ...backgroundFiles,
    ...referenceFiles,
    BACKGROUND_API_PROXY_FILE,
    SIMPLE_DB_FILE,
    SIMPLE_DB_PROXY_FILE,
  ]);
  const sources = readSources(rootDir, [...requiredFiles]);
  const getAst = createAstCache(sources);
  const classIndex = collectClassIndex(backgroundFiles, getAst);
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
  parseSource,
  resolveMethodExposure,
};

if (require.main === module) {
  main();
}
