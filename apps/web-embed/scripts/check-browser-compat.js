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
  'ExportNamespaceSpecifier',
  'ModuleExpression',
  'OptionalCallExpression',
  'OptionalMemberExpression',
  'PrivateName',
  'RecordExpression',
  'StaticBlock',
  'TupleExpression',
]);
const unsupportedAssignmentOperators = new Set(['&&=', '||=', '??=']);
const functionNodeTypes = new Set([
  'ArrowFunctionExpression',
  'ClassMethod',
  'ClassPrivateMethod',
  'FunctionDeclaration',
  'FunctionExpression',
  'ObjectMethod',
]);
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

function getUnsupportedReason(node, functionDepth) {
  if (unsupportedNodeTypes.has(node.type)) {
    return node.type;
  }
  if (node.type === 'AwaitExpression' && functionDepth === 0) {
    return 'top-level await';
  }
  if (
    [
      'ExportAllDeclaration',
      'ExportNamedDeclaration',
      'ImportDeclaration',
    ].includes(node.type) &&
    ((node.attributes?.length ?? 0) > 0 || (node.assertions?.length ?? 0) > 0)
  ) {
    return 'import attributes';
  }
  if (
    node.type === 'CallExpression' &&
    node.callee?.type === 'Import' &&
    node.arguments.length > 1
  ) {
    return 'dynamic import attributes';
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

function findUnsupportedSyntax(node, filePath, failures, functionDepth = 0) {
  if (!node || typeof node !== 'object') {
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item) =>
      findUnsupportedSyntax(item, filePath, failures, functionDepth),
    );
    return;
  }
  if (typeof node.type === 'string') {
    const reason = getUnsupportedReason(node, functionDepth);
    if (reason) {
      failures.push({
        filePath,
        reason,
        line: node.loc?.start.line ?? 0,
        column: node.loc?.start.column ?? 0,
      });
    }
  }
  const childFunctionDepth = functionNodeTypes.has(node.type)
    ? functionDepth + 1
    : functionDepth;
  Object.entries(node).forEach(([key, value]) => {
    if (!ignoredTraversalKeys.has(key)) {
      findUnsupportedSyntax(value, filePath, failures, childFunctionDepth);
    }
  });
}

function getScriptAttribute(attributes, name) {
  const match = attributes.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'),
  );
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function inspectJavaScript(source, filePath, failures) {
  try {
    const ast = parser.parse(source, {
      sourceType: 'unambiguous',
    });
    findUnsupportedSyntax(ast, filePath, failures);
  } catch (error) {
    failures.push({
      filePath,
      reason: `parse error: ${error.message}`,
      line: error.loc?.line ?? 0,
      column: error.loc?.column ?? 0,
    });
  }
}

function extractHtmlScripts(html) {
  return Array.from(
    html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi),
    (match) => ({
      attributes: match[1],
      source: match[2],
    }),
  );
}

function inspectHtmlScripts(failures) {
  const html = fs.readFileSync(indexHtmlPath, 'utf8');
  const scripts = extractHtmlScripts(html);
  const entryScripts = scripts.filter((script) =>
    getScriptAttribute(script.attributes, 'src'),
  );
  if (entryScripts.length !== 2) {
    throw new Error(
      `Expected two web-embed entry scripts, found ${entryScripts.length}`,
    );
  }
  entryScripts.forEach((script) => {
    const source = getScriptAttribute(script.attributes, 'src');
    const type = getScriptAttribute(script.attributes, 'type');
    if (!source?.startsWith('./web-embed.')) {
      throw new Error(
        `Web-embed entry scripts must use relative file URLs: ${source}`,
      );
    }
    if (type?.toLowerCase() === 'module') {
      throw new Error(
        `Web-embed entry scripts must be classic scripts: ${source}`,
      );
    }
    if (!fs.existsSync(path.resolve(buildDir, source))) {
      throw new Error(`Web-embed entry script is missing: ${source}`);
    }
  });

  let inlineScriptIndex = 0;
  scripts.forEach((script) => {
    if (getScriptAttribute(script.attributes, 'src')) {
      return;
    }
    const type = getScriptAttribute(script.attributes, 'type')?.toLowerCase();
    if (type === 'module') {
      throw new Error('Web-embed inline scripts must be classic scripts.');
    }
    if (type && !['application/javascript', 'text/javascript'].includes(type)) {
      return;
    }
    if (script.source.trim()) {
      inlineScriptIndex += 1;
      inspectJavaScript(
        script.source,
        `index.html:inline-script-${inlineScriptIndex}`,
        failures,
      );
    }
  });
  return inlineScriptIndex;
}

function main() {
  if (!fs.existsSync(indexHtmlPath)) {
    throw new Error(`Web-embed build output is missing: ${indexHtmlPath}`);
  }
  const failures = [];
  const inlineScriptCount = inspectHtmlScripts(failures);
  const javaScriptFiles = collectJavaScriptFiles(buildDir);
  javaScriptFiles.forEach((filePath) => {
    const source = fs.readFileSync(filePath, 'utf8');
    inspectJavaScript(source, path.relative(buildDir, filePath), failures);
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
    `Verified ${javaScriptFiles.length} web-embed JavaScript assets and ${inlineScriptCount} inline scripts for Chromium 67 syntax compatibility.`,
  );
}

if (require.main === module) {
  main();
}

module.exports = {
  extractHtmlScripts,
  inspectJavaScript,
};
