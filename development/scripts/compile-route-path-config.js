#!/usr/bin/env node
/* eslint-disable no-continue */

const fs = require('node:fs');
const path = require('node:path');

const ts = require('typescript');

const repoRoot = path.resolve(__dirname, '../..');
const outputDirectory = path.join(
  repoRoot,
  'packages/kit/src/routes/generated',
);
const rootRouterFile = path.join(repoRoot, 'packages/kit/src/routes/router.ts');

const targets = ['web', 'ext', 'desktop', 'ios', 'android', 'native'];
const routeProperties = new Set(['name', 'rewrite', 'exact', 'children']);
const generatedTargets = new Set();
const sourceContentCache = new Map();
const sourceFileCache = new Map();
let enumRegistryCache;
let temporaryFileCounter = 0;

const childEntries = [
  {
    rootEnumMember: 'Onboarding',
    file: 'packages/kit/src/routes/Modal/router.tsx',
    exportName: 'onboardingRouterV2Config',
  },
  {
    rootEnumMember: 'Modal',
    file: 'packages/kit/src/routes/Modal/router.tsx',
    exportName: 'modalRouter',
  },
  {
    rootEnumMember: 'iOSFullScreen',
    file: 'packages/kit/src/routes/Modal/router.tsx',
    exportName: 'fullModalRouter',
  },
  {
    rootEnumMember: 'FullScreenPush',
    file: 'packages/kit/src/routes/Modal/router.tsx',
    exportName: 'fullScreenPushRouterConfig',
  },
  {
    rootEnumMember: 'WebView',
    file: 'packages/kit/src/routes/WebView/router.tsx',
    exportName: 'webViewRouter',
  },
];

const normalizePath = (filePath) => path.normalize(filePath);

const readSourceContent = (filePath) => {
  const normalizedFile = normalizePath(filePath);
  if (!sourceContentCache.has(normalizedFile)) {
    sourceContentCache.set(
      normalizedFile,
      fs.readFileSync(normalizedFile, 'utf8'),
    );
  }
  return sourceContentCache.get(normalizedFile);
};

const unwrapExpression = (node) => {
  let current = node;
  while (
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isParenthesizedExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  return current;
};

const nodeLocation = (node) => {
  const sourceFile = node.getSourceFile();
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  return `${path.relative(repoRoot, sourceFile.fileName)}:${position.line + 1}`;
};

const fail = (node, message) => {
  throw new Error(`${message} (${nodeLocation(node)})`);
};

const readSourceFile = (filePath) => {
  const normalizedFile = normalizePath(filePath);
  if (sourceFileCache.has(normalizedFile)) {
    return sourceFileCache.get(normalizedFile);
  }
  const sourceFile = ts.createSourceFile(
    normalizedFile,
    readSourceContent(normalizedFile),
    ts.ScriptTarget.Latest,
    true,
    normalizedFile.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  sourceFileCache.set(normalizedFile, sourceFile);
  return sourceFile;
};

const walkFiles = (directory) => {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(entryPath));
    } else if (/\.(?:ts|tsx)$/u.test(entry.name)) {
      files.push(entryPath);
    }
  }
  return files;
};

const propertyName = (node) => {
  if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) {
    return node.text;
  }
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return node.text;
  }
  return undefined;
};

const loadEnumRegistry = () => {
  if (enumRegistryCache) {
    return enumRegistryCache;
  }
  const enumDeclarations = new Map();
  const routeDirectory = path.join(repoRoot, 'packages/shared/src/routes');
  const viewDirectory = path.join(repoRoot, 'packages/kit/src/views');
  const files = [
    ...walkFiles(routeDirectory),
    ...walkFiles(path.join(repoRoot, 'packages/kit/src/routes')).filter(
      (filePath) =>
        !normalizePath(filePath).startsWith(
          `${normalizePath(outputDirectory)}${path.sep}`,
        ),
    ),
    ...walkFiles(viewDirectory).filter((filePath) =>
      filePath.includes(`${path.sep}router${path.sep}`),
    ),
  ];
  for (const filePath of files) {
    const sourceFile = readSourceFile(filePath);
    for (const statement of sourceFile.statements) {
      if (!ts.isEnumDeclaration(statement)) {
        continue;
      }
      const enumName = statement.name.text;
      const members = enumDeclarations.get(enumName) || new Map();
      for (const member of statement.members) {
        const memberName = propertyName(member.name);
        if (!memberName) {
          fail(member, 'Route enum members must have static names');
        }
        if (members.has(memberName)) {
          fail(member, `Duplicate route enum member ${enumName}.${memberName}`);
        }
        members.set(memberName, member);
      }
      enumDeclarations.set(enumName, members);
    }
  }
  enumRegistryCache = { enumDeclarations };
  return enumRegistryCache;
};

class RouteCompiler {
  constructor({ target, isDev }) {
    this.target = target;
    this.isDev = isDev;
    this.moduleCache = new Map();
    this.exportCache = new Map();
    const enumRegistry = loadEnumRegistry();
    this.enumDeclarations = enumRegistry.enumDeclarations;
    this.enumValueCache = new Map();
  }

  propertyName(node) {
    return propertyName(node);
  }

  enumValue(enumName, memberName, nodeForError) {
    const cacheKey = `${enumName}.${memberName}`;
    if (this.enumValueCache.has(cacheKey)) {
      return this.enumValueCache.get(cacheKey);
    }
    const declaration = this.enumDeclarations.get(enumName)?.get(memberName);
    if (!declaration) {
      fail(nodeForError, `Cannot resolve route enum ${cacheKey}`);
    }
    if (!declaration.initializer) {
      fail(declaration, `Route enum ${cacheKey} needs an explicit initializer`);
    }
    const value = this.evaluatePrimitive(
      declaration.initializer,
      this.contextFor(declaration.getSourceFile().fileName),
      new Map(),
    );
    if (typeof value !== 'string') {
      fail(declaration, `Route enum ${cacheKey} must resolve to a string`);
    }
    this.enumValueCache.set(cacheKey, value);
    return value;
  }

  extensionOrder() {
    const platformExtensions = {
      web: ['.web', '.web-only'],
      ext: ['.ext', '.web'],
      desktop: ['.desktop', '.web'],
      ios: ['.ios', '.native'],
      android: ['.android', '.native'],
      native: ['.native'],
    }[this.target];
    const suffixes = ['.ts', '.tsx', '.mjs', '.js', '.jsx'];
    return [
      ...platformExtensions.flatMap((platform) =>
        suffixes.map((suffix) => `${platform}${suffix}`),
      ),
      ...suffixes,
    ];
  }

  resolveModule(fromFile, specifier) {
    let basePath;
    if (specifier.startsWith('.')) {
      basePath = path.resolve(path.dirname(fromFile), specifier);
    } else {
      const aliasMatch = specifier.match(
        /^@onekeyhq\/(kit|shared|components|kit-bg)\/src\/(.+)$/u,
      );
      if (!aliasMatch) {
        return undefined;
      }
      basePath = path.join(
        repoRoot,
        'packages',
        aliasMatch[1],
        'src',
        aliasMatch[2],
      );
    }

    if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
      return normalizePath(basePath);
    }

    for (const extension of this.extensionOrder()) {
      const candidate = `${basePath}${extension}`;
      if (fs.existsSync(candidate)) {
        return normalizePath(candidate);
      }
    }
    if (fs.existsSync(basePath) && fs.statSync(basePath).isDirectory()) {
      for (const extension of this.extensionOrder()) {
        const candidate = path.join(basePath, `index${extension}`);
        if (fs.existsSync(candidate)) {
          return normalizePath(candidate);
        }
      }
    }
    return undefined;
  }

  contextFor(filePath) {
    const normalizedFile = normalizePath(filePath);
    if (this.moduleCache.has(normalizedFile)) {
      return this.moduleCache.get(normalizedFile);
    }

    const sourceFile = readSourceFile(normalizedFile);
    const context = {
      filePath: normalizedFile,
      sourceFile,
      imports: new Map(),
      locals: new Map(),
      functions: new Map(),
      exports: new Map(),
    };
    this.moduleCache.set(normalizedFile, context);

    for (const statement of sourceFile.statements) {
      if (
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        const resolvedFile = this.resolveModule(
          normalizedFile,
          statement.moduleSpecifier.text,
        );
        const clause = statement.importClause;
        if (!clause) {
          continue;
        }
        if (clause.name) {
          context.imports.set(clause.name.text, {
            filePath: resolvedFile,
            exportName: 'default',
          });
        }
        if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
          for (const element of clause.namedBindings.elements) {
            context.imports.set(element.name.text, {
              filePath: resolvedFile,
              exportName: element.propertyName?.text || element.name.text,
            });
          }
        }
        continue;
      }

      if (ts.isVariableStatement(statement)) {
        const exported = statement.modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
        );
        for (const declaration of statement.declarationList.declarations) {
          if (!ts.isIdentifier(declaration.name)) {
            continue;
          }
          context.locals.set(declaration.name.text, declaration);
          if (exported) {
            context.exports.set(declaration.name.text, {
              localName: declaration.name.text,
            });
          }
        }
        continue;
      }

      if (ts.isFunctionDeclaration(statement) && statement.name) {
        context.functions.set(statement.name.text, statement);
        if (
          statement.modifiers?.some(
            (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
          )
        ) {
          context.exports.set(statement.name.text, {
            localName: statement.name.text,
          });
        }
        continue;
      }

      if (ts.isExportDeclaration(statement) && statement.exportClause) {
        if (!ts.isNamedExports(statement.exportClause)) {
          fail(statement, 'Namespace route exports are not supported');
        }
        const resolvedFile =
          statement.moduleSpecifier &&
          ts.isStringLiteral(statement.moduleSpecifier)
            ? this.resolveModule(normalizedFile, statement.moduleSpecifier.text)
            : undefined;
        for (const element of statement.exportClause.elements) {
          context.exports.set(element.name.text, {
            filePath: resolvedFile,
            localName: resolvedFile
              ? undefined
              : element.propertyName?.text || element.name.text,
            exportName: element.propertyName?.text || element.name.text,
          });
        }
        continue;
      }

      if (ts.isExportAssignment(statement)) {
        context.exports.set('default', { expression: statement.expression });
      }
    }
    return context;
  }

  resolveExport(filePath, exportName) {
    const cacheKey = `${normalizePath(filePath)}#${exportName}#${this.isDev}`;
    if (this.exportCache.has(cacheKey)) {
      return this.exportCache.get(cacheKey);
    }
    const context = this.contextFor(filePath);
    const exported = context.exports.get(exportName);
    let value;
    if (exported?.expression) {
      value = this.evaluateAny(exported.expression, context, new Map());
    } else if (exported?.filePath) {
      value = this.resolveExport(exported.filePath, exported.exportName);
    } else {
      const localName = exported?.localName || exportName;
      value = this.resolveLocal(localName, context, new Map());
    }
    this.exportCache.set(cacheKey, value);
    return value;
  }

  resolveLocal(name, context, environment) {
    if (environment.has(name)) {
      return environment.get(name);
    }
    if (name === 'undefined') {
      return undefined;
    }
    if (name === 'true') {
      return true;
    }
    if (name === 'false') {
      return false;
    }

    const declaration = context.locals.get(name);
    if (declaration) {
      if (!declaration.initializer) {
        fail(declaration, `Route value ${name} has no initializer`);
      }
      const value = this.evaluateAny(
        declaration.initializer,
        context,
        environment,
      );
      if (Array.isArray(value)) {
        return this.applyArrayMutations(name, value, context, environment);
      }
      return value;
    }

    const imported = context.imports.get(name);
    if (imported?.filePath) {
      return this.resolveExport(imported.filePath, imported.exportName);
    }
    fail(context.sourceFile, `Cannot statically resolve route value ${name}`);
  }

  applyArrayMutations(name, original, context, environment) {
    const routes = [...original];
    const visitStatement = (statement, active) => {
      if (ts.isIfStatement(statement)) {
        const condition = this.evaluateBoolean(
          statement.expression,
          context,
          environment,
        );
        if (condition) {
          visitStatement(statement.thenStatement, active);
        } else if (statement.elseStatement) {
          visitStatement(statement.elseStatement, active);
        }
        return;
      }
      if (ts.isBlock(statement)) {
        for (const child of statement.statements) {
          visitStatement(child, active);
        }
        return;
      }
      if (!active || !ts.isExpressionStatement(statement)) {
        return;
      }
      const expression = unwrapExpression(statement.expression);
      if (
        ts.isCallExpression(expression) &&
        ts.isPropertyAccessExpression(expression.expression) &&
        ts.isIdentifier(expression.expression.expression) &&
        expression.expression.expression.text === name &&
        expression.expression.name.text === 'push'
      ) {
        for (const argument of expression.arguments) {
          const route = this.evaluateRoute(argument, context, environment);
          if (route) {
            routes.push(route);
          }
        }
      }
    };
    for (const statement of context.sourceFile.statements) {
      visitStatement(statement, true);
    }
    return routes;
  }

  evaluatePrimitive(node, context, environment) {
    const expression = unwrapExpression(node);
    if (
      ts.isStringLiteral(expression) ||
      ts.isNoSubstitutionTemplateLiteral(expression)
    ) {
      return expression.text;
    }
    if (ts.isNumericLiteral(expression)) {
      return Number(expression.text);
    }
    if (expression.kind === ts.SyntaxKind.TrueKeyword) {
      return true;
    }
    if (expression.kind === ts.SyntaxKind.FalseKeyword) {
      return false;
    }
    if (expression.kind === ts.SyntaxKind.NullKeyword) {
      return null;
    }
    if (ts.isIdentifier(expression)) {
      return this.resolveLocal(expression.text, context, environment);
    }
    if (ts.isPropertyAccessExpression(expression)) {
      if (ts.isIdentifier(expression.expression)) {
        const objectName = expression.expression.text;
        if (objectName === 'platformEnv') {
          return this.platformValue(expression.name.text, expression);
        }
        const importedName = context.imports.get(objectName)?.exportName;
        const enumName = importedName || objectName;
        if (this.enumDeclarations.has(enumName)) {
          return this.enumValue(enumName, expression.name.text, expression);
        }
      }
      fail(
        expression,
        'Only route enums and platformEnv may provide route metadata',
      );
    }
    if (ts.isPrefixUnaryExpression(expression)) {
      if (expression.operator === ts.SyntaxKind.ExclamationToken) {
        return !this.evaluateBoolean(expression.operand, context, environment);
      }
      if (expression.operator === ts.SyntaxKind.MinusToken) {
        return -Number(
          this.evaluatePrimitive(expression.operand, context, environment),
        );
      }
    }
    if (ts.isConditionalExpression(expression)) {
      return this.evaluateBoolean(expression.condition, context, environment)
        ? this.evaluateAny(expression.whenTrue, context, environment)
        : this.evaluateAny(expression.whenFalse, context, environment);
    }
    if (ts.isBinaryExpression(expression)) {
      return this.evaluateBinary(expression, context, environment);
    }
    fail(expression, 'Route metadata must be statically evaluable');
  }

  platformValue(property, node) {
    const isNative = ['ios', 'android', 'native'].includes(this.target);
    const values = {
      isDev: this.isDev,
      isProduction: !this.isDev,
      isWeb: this.target === 'web',
      isWebEmbed: false,
      isExtension: this.target === 'ext',
      isDesktop: this.target === 'desktop',
      isNative,
      isNativeIOS: this.target === 'ios',
      isNativeAndroid: this.target === 'android',
      isNativeIOS26Plus: false,
    };
    if (!Object.hasOwn(values, property)) {
      fail(node, `Unsupported platformEnv route condition ${property}`);
    }
    return values[property];
  }

  evaluateBinary(expression, context, environment) {
    const operator = expression.operatorToken.kind;
    if (operator === ts.SyntaxKind.AmpersandAmpersandToken) {
      return this.evaluateBoolean(expression.left, context, environment)
        ? this.evaluateAny(expression.right, context, environment)
        : undefined;
    }
    if (operator === ts.SyntaxKind.BarBarToken) {
      const left = this.evaluateAny(expression.left, context, environment);
      return left || this.evaluateAny(expression.right, context, environment);
    }
    if (
      operator === ts.SyntaxKind.EqualsEqualsEqualsToken ||
      operator === ts.SyntaxKind.EqualsEqualsToken
    ) {
      return (
        this.evaluatePrimitive(expression.left, context, environment) ===
        this.evaluatePrimitive(expression.right, context, environment)
      );
    }
    if (
      operator === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
      operator === ts.SyntaxKind.ExclamationEqualsToken
    ) {
      return (
        this.evaluatePrimitive(expression.left, context, environment) !==
        this.evaluatePrimitive(expression.right, context, environment)
      );
    }
    fail(expression, 'Unsupported binary expression in route metadata');
  }

  evaluateBoolean(node, context, environment) {
    return Boolean(this.evaluatePrimitive(node, context, environment));
  }

  evaluateAny(node, context, environment) {
    const expression = unwrapExpression(node);
    if (ts.isArrayLiteralExpression(expression)) {
      return this.evaluateRoutes(expression, context, environment);
    }
    if (ts.isObjectLiteralExpression(expression)) {
      return this.evaluateRoute(expression, context, environment);
    }
    if (ts.isCallExpression(expression)) {
      return this.evaluateCall(expression, context, environment);
    }
    if (ts.isConditionalExpression(expression)) {
      return this.evaluateBoolean(expression.condition, context, environment)
        ? this.evaluateAny(expression.whenTrue, context, environment)
        : this.evaluateAny(expression.whenFalse, context, environment);
    }
    return this.evaluatePrimitive(expression, context, environment);
  }

  evaluateRoutes(node, context, environment) {
    const routes = [];
    for (const element of node.elements) {
      if (ts.isSpreadElement(element)) {
        const spread = this.evaluateAny(
          element.expression,
          context,
          environment,
        );
        if (!Array.isArray(spread)) {
          fail(element, 'A route array spread must resolve to an array');
        }
        routes.push(...spread);
        continue;
      }
      const value = this.evaluateAny(element, context, environment);
      if (value === undefined || value === null || value === false) {
        continue;
      }
      if (Array.isArray(value)) {
        routes.push(...value);
      } else {
        routes.push(value);
      }
    }
    this.validateRoutes(routes, node);
    return routes;
  }

  evaluateRoute(node, context, environment) {
    const expression = unwrapExpression(node);
    if (!ts.isObjectLiteralExpression(expression)) {
      const value = this.evaluateAny(expression, context, environment);
      if (value === undefined || value === null || value === false) {
        return undefined;
      }
      if (Array.isArray(value)) {
        fail(expression, 'Expected one route but found a route array');
      }
      return value;
    }

    const route = {};
    for (const property of expression.properties) {
      if (ts.isSpreadAssignment(property)) {
        const spread = this.evaluateAny(
          property.expression,
          context,
          environment,
        );
        if (spread && !Array.isArray(spread)) {
          Object.assign(route, spread);
        }
        continue;
      }
      if (
        !ts.isPropertyAssignment(property) &&
        !ts.isShorthandPropertyAssignment(property)
      ) {
        continue;
      }
      const name = this.propertyName(property.name);
      if (!name || !routeProperties.has(name)) {
        continue;
      }
      const initializer = ts.isShorthandPropertyAssignment(property)
        ? property.name
        : property.initializer;
      if (name === 'children') {
        const children = this.evaluateAny(initializer, context, environment);
        if (
          children !== undefined &&
          children !== null &&
          !Array.isArray(children)
        ) {
          fail(initializer, 'Route children must resolve to an array');
        }
        if (Array.isArray(children)) {
          route.children = children;
        }
      } else {
        route[name] = this.evaluatePrimitive(initializer, context, environment);
      }
    }
    if (typeof route.name !== 'string' || route.name.length === 0) {
      fail(expression, 'Every compiled route object must have a static name');
    }
    if (route.rewrite !== undefined && typeof route.rewrite !== 'string') {
      fail(expression, 'Route rewrite must resolve to a string');
    }
    if (route.exact !== undefined && typeof route.exact !== 'boolean') {
      fail(expression, 'Route exact must resolve to a boolean');
    }
    return route;
  }

  evaluateCall(expression, context, environment) {
    const callee = unwrapExpression(expression.expression);
    if (ts.isPropertyAccessExpression(callee)) {
      const method = callee.name.text;
      if (method === 'map') {
        const routes = this.evaluateAny(
          callee.expression,
          context,
          environment,
        );
        if (!Array.isArray(routes)) {
          fail(expression, 'Route map() receiver must be an array');
        }
        const callback = expression.arguments[0];
        if (
          !callback ||
          (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback))
        ) {
          fail(expression, 'Route map() needs an inline callback');
        }
        const parameter = callback.parameters[0];
        if (!parameter || !ts.isIdentifier(parameter.name)) {
          fail(callback, 'Route map() callback needs one identifier parameter');
        }
        const result = routes.map((route) => {
          const callbackEnvironment = new Map(environment);
          callbackEnvironment.set(parameter.name.text, route);
          const returned = ts.isBlock(callback.body)
            ? this.findReturnExpression(callback.body)
            : callback.body;
          return this.evaluateRoute(returned, context, callbackEnvironment);
        });
        this.validateRoutes(result, expression);
        return result;
      }
      if (method === 'filter') {
        const routes = this.evaluateAny(
          callee.expression,
          context,
          environment,
        );
        if (!Array.isArray(routes)) {
          fail(expression, 'Route filter() receiver must be an array');
        }
        const callback = expression.arguments[0];
        if (
          callback &&
          ts.isIdentifier(callback) &&
          callback.text === 'Boolean'
        ) {
          return routes.filter(Boolean);
        }
        fail(expression, 'Only routeArray.filter(Boolean) is supported');
      }
    }

    if (ts.isIdentifier(callee)) {
      const functionDeclaration = context.functions.get(callee.text);
      const variableInitializer = context.locals.get(callee.text)?.initializer;
      const variableFunction = variableInitializer
        ? unwrapExpression(variableInitializer)
        : undefined;
      const declaration =
        functionDeclaration ||
        (variableFunction &&
        (ts.isArrowFunction(variableFunction) ||
          ts.isFunctionExpression(variableFunction))
          ? variableFunction
          : undefined);
      if (!declaration?.body) {
        fail(
          expression,
          `Cannot statically execute route factory ${callee.text}`,
        );
      }
      if (declaration.parameters.length !== expression.arguments.length) {
        fail(
          expression,
          `Route factory ${callee.text} argument count is not static`,
        );
      }
      const functionEnvironment = new Map(environment);
      declaration.parameters.forEach((parameter, index) => {
        if (!ts.isIdentifier(parameter.name)) {
          fail(parameter, 'Route factory parameters must be identifiers');
        }
        functionEnvironment.set(
          parameter.name.text,
          this.evaluateAny(expression.arguments[index], context, environment),
        );
      });
      const returned = ts.isBlock(declaration.body)
        ? this.findReturnExpression(declaration.body)
        : declaration.body;
      return this.evaluateAny(returned, context, functionEnvironment);
    }
    fail(expression, 'Unsupported call expression in route metadata');
  }

  findReturnExpression(block) {
    for (const statement of block.statements) {
      if (ts.isReturnStatement(statement) && statement.expression) {
        return statement.expression;
      }
    }
    fail(block, 'Route factory must have one direct return statement');
  }

  validateRoutes(routes, node) {
    const names = new Set();
    for (const route of routes) {
      if (!route || typeof route.name !== 'string') {
        fail(node, 'Compiled route arrays may contain only route objects');
      }
      if (names.has(route.name)) {
        fail(node, `Duplicate sibling route ${route.name}`);
      }
      names.add(route.name);
    }
  }

  compileRoot() {
    const roots = this.resolveExport(rootRouterFile, 'rootRouter');
    if (!Array.isArray(roots)) {
      throw new Error('rootRouter must resolve to an array');
    }
    for (const childEntry of childEntries) {
      const rootName = this.enumValue(
        'ERootRoutes',
        childEntry.rootEnumMember,
        this.contextFor(rootRouterFile).sourceFile,
      );
      const root = roots.find((route) => route.name === rootName);
      if (!root) {
        throw new Error(`Missing root route ${rootName}`);
      }
      const children = this.resolveExport(
        path.join(repoRoot, childEntry.file),
        childEntry.exportName,
      );
      if (!Array.isArray(children)) {
        throw new Error(`${childEntry.exportName} must resolve to an array`);
      }
      root.children = children;
    }
    this.validateRoutes(roots, this.contextFor(rootRouterFile).sourceFile);
    return roots;
  }
}

const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

const compileTarget = (target) => {
  const productionCompiler = new RouteCompiler({ target, isDev: false });
  const production = productionCompiler.compileRoot();
  const developmentCompiler = new RouteCompiler({ target, isDev: true });
  const development = developmentCompiler.compileRoot();
  return {
    schemaVersion: 1,
    target,
    production,
    development,
  };
};

const wrapperSource = (target) =>
  `// Generated by development/scripts/compile-route-path-config.js. Do not edit.\nimport routePathConfig from './routePathConfig.generated.${target}.json';\n\nexport default routePathConfig;\n`;

const normalizeTarget = (target) => {
  if (target === 'webEmbed' || target === 'web-embed') {
    return 'web';
  }
  if (!targets.includes(target)) {
    throw new Error(
      `Unknown route generation target "${target}". Expected: ${targets.join(', ')}`,
    );
  }
  return target;
};

const expectedFiles = (selectedTargets) => {
  const files = new Map();
  for (const target of selectedTargets) {
    files.set(
      path.join(outputDirectory, `routePathConfig.generated.${target}.json`),
      stableJson(compileTarget(target)),
    );
    files.set(
      path.join(outputDirectory, `routePathConfig.generated.${target}.ts`),
      wrapperSource(target),
    );
  }
  if (selectedTargets.includes('native')) {
    files.set(
      path.join(outputDirectory, 'routePathConfig.generated.ts'),
      wrapperSource('native'),
    );
  }
  return files;
};

const generateRoutePathConfig = ({
  targetNames = targets,
  check = false,
  silent = false,
  force = false,
} = {}) => {
  const startedAt = performance.now();
  if (force) {
    generatedTargets.clear();
    sourceContentCache.clear();
    sourceFileCache.clear();
    enumRegistryCache = undefined;
  }
  const selectedTargets = [
    ...new Set(targetNames.map((target) => normalizeTarget(target))),
  ];
  const hasGeneratedOutput = (target) =>
    fs.existsSync(
      path.join(outputDirectory, `routePathConfig.generated.${target}.json`),
    ) &&
    fs.existsSync(
      path.join(outputDirectory, `routePathConfig.generated.${target}.ts`),
    ) &&
    (target !== 'native' ||
      fs.existsSync(
        path.join(outputDirectory, 'routePathConfig.generated.ts'),
      ));
  const pendingTargets = selectedTargets.filter(
    (target) => !generatedTargets.has(target) || !hasGeneratedOutput(target),
  );
  if (pendingTargets.length === 0) {
    return { durationMs: 0, targets: [] };
  }
  const files = expectedFiles(pendingTargets);
  if (check) {
    const stale = [];
    for (const [filePath, expected] of files) {
      if (
        !fs.existsSync(filePath) ||
        fs.readFileSync(filePath, 'utf8') !== expected
      ) {
        stale.push(path.relative(repoRoot, filePath));
      }
    }
    if (stale.length > 0) {
      console.error('Generated cold-start route config is stale:');
      for (const filePath of stale) {
        console.error(`  ${filePath}`);
      }
      console.error('Run: yarn routes:generate');
      const error = new Error('Generated cold-start route config is stale');
      error.staleFiles = stale;
      throw error;
    }
    if (!silent) {
      console.log(
        `Cold-start route config is up to date (${pendingTargets.join(', ')}).`,
      );
    }
  } else {
    fs.mkdirSync(outputDirectory, { recursive: true });
    for (const [filePath, content] of files) {
      if (
        !fs.existsSync(filePath) ||
        fs.readFileSync(filePath, 'utf8') !== content
      ) {
        temporaryFileCounter += 1;
        const temporaryFile = `${filePath}.${process.pid}.${temporaryFileCounter}.tmp`;
        try {
          fs.writeFileSync(temporaryFile, content);
          fs.renameSync(temporaryFile, filePath);
        } finally {
          if (fs.existsSync(temporaryFile)) {
            fs.unlinkSync(temporaryFile);
          }
        }
      }
    }
    if (!silent) {
      console.log(
        `Generated cold-start route config for ${pendingTargets.join(', ')}.`,
      );
    }
  }
  for (const target of pendingTargets) {
    generatedTargets.add(target);
  }
  return {
    durationMs: performance.now() - startedAt,
    targets: pendingTargets,
  };
};

const parseTargetNames = (argv) => {
  const values = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--target') {
      values.push(argv[index + 1]);
      index += 1;
    } else if (argument.startsWith('--target=')) {
      values.push(argument.slice('--target='.length));
    }
  }
  return values.length > 0
    ? values.flatMap((value) => value.split(',').filter(Boolean))
    : targets;
};

const main = () => {
  const check = process.argv.includes('--check');
  try {
    const result = generateRoutePathConfig({
      targetNames: parseTargetNames(process.argv.slice(2)),
      check,
      force: true,
    });
    console.log(
      `Route generation completed in ${result.durationMs.toFixed(0)} ms.`,
    );
  } catch (error) {
    if (!error.staleFiles) {
      console.error(error);
    }
    process.exitCode = 1;
  }
};

module.exports = {
  generateRoutePathConfig,
};

if (require.main === module) {
  main();
}
