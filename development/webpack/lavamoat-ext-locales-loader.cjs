// cspell:ignore LavaMoat lavamoat

const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { parse } = require('@babel/parser');

const { LavaMoatError } = require('../lavamoat/error.cjs');

function createExtensionLocaleRule(
  sourcePath = path.resolve(
    __dirname,
    '../../packages/shared/src/locale/localeLoaders.ts',
  ),
) {
  const expectedPath = fs.realpathSync(sourcePath);
  return {
    realResource: (resource) => resource === expectedPath,
    enforce: 'pre',
    use: [{ loader: __filename, options: { expectedPath } }],
  };
}

function extensionLocalesLoader(source) {
  const { expectedPath } = this.getOptions();
  if (
    this.resourcePath !== expectedPath ||
    fs.realpathSync(this.resourcePath) !== expectedPath ||
    this.resourceQuery ||
    this._module.rawRequest.includes('!') ||
    source !== fs.readFileSync(expectedPath, 'utf8')
  ) {
    throw new LavaMoatError(
      'Packaged locales require the unchanged physical locale loader',
    );
  }
  const ast = parse(source, { sourceType: 'module', plugins: ['typescript'] });
  const declarations = ast.program.body.flatMap((statement) =>
    statement.type === 'ExportNamedDeclaration' &&
    statement.declaration?.type === 'VariableDeclaration'
      ? statement.declaration.declarations
      : [],
  );
  const tables = declarations.filter(
    (declaration) =>
      declaration.id.type === 'Identifier' &&
      declaration.id.name === 'LOCALE_LOADERS',
  );
  const table = tables[0]?.init;
  if (
    tables.length !== 1 ||
    table?.type !== 'TSSatisfiesExpression' ||
    table.expression.type !== 'ObjectExpression' ||
    /\b(?:createPackagedLocaleLoader|loadPackagedLocale)\b/.test(source)
  ) {
    throw new LavaMoatError(
      'Locale loader structure changed; review packaged locale generation',
    );
  }
  const replacements = [];
  const index = {};
  const keys = new Set();
  const jsonDirectory = path.join(path.dirname(expectedPath), 'json');
  this.addContextDependency(jsonDirectory);
  for (const property of table.expression.properties) {
    const key = property.key?.name ?? property.key?.value;
    const arrow = property.value;
    const then = arrow?.body;
    const request = then?.callee?.object;
    const specifier = request?.arguments?.[0]?.value;
    if (
      property.type !== 'ObjectProperty' ||
      property.computed ||
      typeof key !== 'string' ||
      keys.has(key) ||
      arrow?.type !== 'ArrowFunctionExpression' ||
      arrow.params.length ||
      arrow.async ||
      then?.type !== 'CallExpression' ||
      then.callee.type !== 'MemberExpression' ||
      then.callee.computed ||
      then.callee.property.name !== 'then' ||
      then.arguments.length !== 1 ||
      then.arguments[0].type !== 'Identifier' ||
      then.arguments[0].name !== 'resolveLocaleModule' ||
      request?.type !== 'CallExpression' ||
      request.callee.type !== 'Import' ||
      request.arguments.length !== 1 ||
      request.arguments[0].type !== 'StringLiteral' ||
      typeof specifier !== 'string' ||
      !/^\.\/json\/[a-zA-Z0-9_]+\.json$/.test(specifier)
    ) {
      throw new LavaMoatError(
        'Locale import structure changed; review packaged locale generation',
      );
    }
    keys.add(key);
    const name = specifier.slice('./json/'.length);
    const file = path.join(jsonDirectory, name);
    if (fs.realpathSync(file) !== file) {
      throw new LavaMoatError(
        'Packaged locale sources must not be symbolic links',
      );
    }
    const bytes = fs.readFileSync(file);
    const value = JSON.parse(bytes.toString('utf8'));
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.values(value).some((message) => typeof message !== 'string')
    ) {
      throw new LavaMoatError(
        'Packaged locale source must contain string messages',
      );
    }
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const assetPath = `static/locales/${name.slice(0, -5)}.${sha256}.json`;
    index[name] = { path: assetPath, sha256, byteLength: bytes.length };
    this.addDependency(file);
    this.emitFile(assetPath, bytes);
    replacements.push({
      start: request.start,
      end: request.end,
      // Preserve the JSON module namespace before the original default unwrap.
      // A translation whose own key is "default" must stay part of the data.
      code: `loadPackagedLocale(${JSON.stringify(name)}).then((messages) => ({ default: messages }))`,
    });
  }
  const allFiles = fs
    .readdirSync(jsonDirectory)
    .filter((file) => file.endsWith('.json'))
    .toSorted();
  if (
    JSON.stringify(Object.keys(index).toSorted()) !== JSON.stringify(allFiles)
  ) {
    throw new LavaMoatError(
      'Packaged locale index must cover every shipped language',
    );
  }
  let transformed = source;
  for (const replacement of replacements.toSorted(
    (left, right) => right.start - left.start,
  )) {
    transformed =
      transformed.slice(0, replacement.start) +
      replacement.code +
      transformed.slice(replacement.end);
  }
  return `import { createPackagedLocaleLoader } from './packagedLocale';\nconst loadPackagedLocale = createPackagedLocaleLoader(${JSON.stringify(index)});\n${transformed}`;
}

module.exports = extensionLocalesLoader;
module.exports.createExtensionLocaleRule = createExtensionLocaleRule;
