/* eslint-disable onekey/no-raw-error */
const fs = require('fs');
const path = require('path');

const parser = require('@babel/parser');

const buildDir = path.resolve(__dirname, '../web-build');
const indexHtmlPath = path.join(buildDir, 'index.html');
const unsupportedNodeTypes = new Set([
  'ClassAccessorProperty',
  'ClassPrivateMethod',
  'ClassPrivateProperty',
  'ClassProperty',
  'DecimalLiteral',
  'ModuleExpression',
  'OptionalCallExpression',
  'OptionalMemberExpression',
  'PrivateName',
  'RecordExpression',
  'StaticBlock',
  'TupleExpression',
]);
const unsupportedAssignmentOperators = new Set(['&&=', '||=', '??=']);
const ignoredTraversalKeys = new Set([
  'comments',
  'end',
  'errors',
  'extra',
  'loc',
  'start',
  'tokens',
]);

function collectJavaScriptFiles(directoryPath) {
  return fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        return collectJavaScriptFiles(entryPath);
      }
      return entry.isFile() && entry.name.endsWith('.js') ? [entryPath] : [];
    });
}

function getUnsupportedReason(node) {
  if (unsupportedNodeTypes.has(node.type)) {
    return node.type;
  }
  if (
    node.type === 'AssignmentExpression' &&
    unsupportedAssignmentOperators.has(node.operator)
  ) {
    return `assignment operator ${node.operator}`;
  }
  if (node.type === 'LogicalExpression' && node.operator === '??') {
    return 'nullish coalescing';
  }
  if (
    (node.type === 'NumericLiteral' || node.type === 'BigIntLiteral') &&
    node.extra?.raw?.includes('_')
  ) {
    return 'numeric separator';
  }
  if (
    node.type === 'RegExpLiteral' &&
    (node.flags.includes('d') || node.flags.includes('v'))
  ) {
    return `regular expression flag ${node.flags}`;
  }
  return undefined;
}

function findUnsupportedSyntax(node, filePath, failures) {
  if (!node || typeof node !== 'object') {
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item) => findUnsupportedSyntax(item, filePath, failures));
    return;
  }
  if (typeof node.type === 'string') {
    const reason = getUnsupportedReason(node);
    if (reason) {
      failures.push({
        filePath,
        reason,
        line: node.loc?.start.line ?? 0,
        column: node.loc?.start.column ?? 0,
      });
    }
  }
  Object.entries(node).forEach(([key, value]) => {
    if (!ignoredTraversalKeys.has(key)) {
      findUnsupportedSyntax(value, filePath, failures);
    }
  });
}

function assertRelativeEntryScripts() {
  const html = fs.readFileSync(indexHtmlPath, 'utf8');
  const scriptSources = Array.from(
    html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g),
    (match) => match[1],
  );
  if (scriptSources.length !== 2) {
    throw new Error(
      `Expected two web-embed entry scripts, found ${scriptSources.length}: ${scriptSources.join(', ')}`,
    );
  }
  const invalidSources = scriptSources.filter(
    (source) => !source.startsWith('./web-embed.'),
  );
  if (invalidSources.length > 0) {
    throw new Error(
      `Web-embed entry scripts must use relative file URLs: ${invalidSources.join(', ')}`,
    );
  }
}

function main() {
  if (!fs.existsSync(indexHtmlPath)) {
    throw new Error(`Web-embed build output is missing: ${indexHtmlPath}`);
  }
  assertRelativeEntryScripts();

  const failures = [];
  const javaScriptFiles = collectJavaScriptFiles(buildDir);
  javaScriptFiles.forEach((filePath) => {
    const source = fs.readFileSync(filePath, 'utf8');
    const ast = parser.parse(source, {
      sourceType: 'unambiguous',
    });
    findUnsupportedSyntax(ast, path.relative(buildDir, filePath), failures);
  });

  if (failures.length > 0) {
    failures.slice(0, 20).forEach((failure) => {
      console.error(
        `${failure.filePath}:${failure.line}:${failure.column} uses unsupported Chromium 67 syntax (${failure.reason})`,
      );
    });
    if (failures.length > 20) {
      console.error(
        `...and ${failures.length - 20} more compatibility failures.`,
      );
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `Verified ${javaScriptFiles.length} web-embed JavaScript assets for Chromium 67 syntax compatibility.`,
  );
}

main();
