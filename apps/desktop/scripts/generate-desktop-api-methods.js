// oxlint-disable onekey/no-raw-error -- Standalone build tooling cannot load application runtime errors.
const fs = require('fs');
const path = require('path');

const { parseSync } = require('oxc-parser');
const { format } = require('oxfmt');

const apiDirectory = path.resolve(
  __dirname,
  '../../../packages/kit-bg/src/desktopApis',
);
const outputPath = path.join(
  apiDirectory,
  'desktopApiPublicMethods.generated.ts',
);

function parse(source, fileName) {
  const { program, errors } = parseSync(fileName, source, {
    lang: 'ts',
    sourceType: 'module',
  });
  if (errors.length) {
    throw new Error(`Cannot parse desktop API: ${fileName}`);
  }
  return program;
}

function memberName(member) {
  // ESTree wraps dynamic member names in a computed key; they cannot be
  // enumerated statically.
  if (member.computed) {
    throw new Error('Desktop API callable names must be statically known');
  }
  const key = member.key;
  if (key.type === 'Identifier') return key.name;
  if (key.type === 'Literal' && typeof key.value === 'string') return key.value;
  throw new Error('Desktop API callable names must be statically known');
}

function isCallableMember(member) {
  if (
    member.type === 'MethodDefinition' &&
    member.kind === 'method' &&
    // Overload signatures are TSEmptyBodyFunctionExpression (no body).
    member.value?.type === 'FunctionExpression'
  )
    return true;
  return (
    member.type === 'PropertyDefinition' &&
    (member.value?.type === 'ArrowFunctionExpression' ||
      member.value?.type === 'FunctionExpression')
  );
}

function publicMethods(source, fileName) {
  const program = parse(source, fileName);
  const defaultExport = program.body.find(
    (node) => node.type === 'ExportDefaultDeclaration',
  );
  const defaultDeclaration = defaultExport?.declaration;
  // `export default class X {}` nests the class in the export declaration,
  // while `export default X;` needs the class declaration resolved by name.
  const declaration =
    (defaultDeclaration?.type === 'ClassDeclaration'
      ? defaultDeclaration
      : undefined) ??
    program.body.find(
      (node) =>
        node.type === 'ClassDeclaration' &&
        defaultDeclaration?.type === 'Identifier' &&
        node.id?.name === defaultDeclaration.name,
    );
  if (!declaration || declaration.superClass) {
    // New inheritance must get an explicit visibility resolver before exposure.
    throw new Error(`Unsupported desktop API class: ${fileName}`);
  }
  const methods = new Set();
  declaration.body.body.forEach((member) => {
    if (
      member.accessibility === 'private' ||
      member.accessibility === 'protected' ||
      member.static
    )
      return;
    if (!isCallableMember(member) || member.key?.type === 'PrivateIdentifier')
      return;
    const name = memberName(member);
    if (!name.startsWith('_')) methods.add(name);
  });
  return [...methods].toSorted();
}

async function generate(directory = apiDirectory) {
  const registryPath = path.join(directory, 'instance/desktopApi.ts');
  const registry = parse(fs.readFileSync(registryPath, 'utf8'), registryPath);
  const declaration = registry.body.find(
    (node) =>
      node.type === 'ClassDeclaration' && node.id?.name === 'DesktopApi',
  );
  if (!declaration) throw new Error('Desktop API registry is missing');
  const table = {};
  const developmentTable = {};
  for (const getter of declaration.body.body.filter(
    (member) => member.type === 'MethodDefinition' && member.kind === 'get',
  )) {
    const imports = [];
    const visit = (node) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }
      if (
        node.type === 'CallExpression' &&
        node.callee?.type === 'Identifier' &&
        node.callee.name === 'require' &&
        node.arguments.length === 1 &&
        node.arguments[0].type === 'Literal' &&
        typeof node.arguments[0].value === 'string'
      )
        imports.push(node.arguments[0].value);
      Object.entries(node).forEach(([key, value]) => {
        if (key !== 'parent') visit(value);
      });
    };
    visit(getter);
    if (imports.length !== 1 || !imports[0].startsWith('../DesktopApi')) {
      throw new Error(
        `Unsupported desktop API registration: ${memberName(getter)}`,
      );
    }
    const fileName = path.resolve(
      path.dirname(registryPath),
      `${imports[0]}.ts`,
    );
    if (path.dirname(fileName) !== directory) {
      throw new Error(
        'Desktop API class must belong to its registry directory',
      );
    }
    const methods = publicMethods(fs.readFileSync(fileName, 'utf8'), fileName);
    const developmentOnly = (name) =>
      name.startsWith('test') || name === 'getSha256FromFilePath';
    table[memberName(getter)] = methods.filter(
      (name) => !developmentOnly(name),
    );
    developmentTable[memberName(getter)] = methods.filter(developmentOnly);
  }
  if (!Object.keys(table).length) throw new Error('Empty desktop API registry');
  const entries = Object.entries(table).map(
    ([name, methods]) =>
      `  ${JSON.stringify(name)}: Object.freeze(${JSON.stringify(methods)}),`,
  );
  const source = [
    '// Generated by apps/desktop/scripts/generate-desktop-api-methods.js. Do not edit.',
    '// Rebuilt before every desktop main build; missing metadata denies remote calls.',
    'export const desktopApiPublicMethods: Readonly<Record<string, readonly string[]>> = Object.freeze({',
    ...entries,
    '});',
    'export const desktopApiDevelopmentMethods: Readonly<Record<string, readonly string[]>> = Object.freeze({',
    ...Object.entries(developmentTable)
      .filter(([, methods]) => methods.length)
      .map(
        ([name, methods]) =>
          `  ${JSON.stringify(name)}: Object.freeze(${JSON.stringify(methods)}),`,
      ),
    '});',
    '',
  ].join('\n');
  const config = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../../../.oxfmtrc.json'), 'utf8'),
  );
  const result = await format(outputPath, source, config);
  if (result.errors.length)
    throw new Error('Cannot format desktop API metadata');
  return result.code;
}

async function update(check = false) {
  const content = await generate();
  const previous = fs.existsSync(outputPath)
    ? fs.readFileSync(outputPath, 'utf8')
    : '';
  if (check && previous !== content)
    throw new Error('Desktop API visibility metadata is stale');
  if (!check && previous !== content) fs.writeFileSync(outputPath, content);
}

module.exports = { generate, publicMethods, update };
if (require.main === module) {
  update(process.argv.includes('--check')).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
