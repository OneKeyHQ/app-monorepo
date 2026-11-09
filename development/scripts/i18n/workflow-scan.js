// cspell:ignore quasis

const fs = require('node:fs');
const path = require('node:path');

const { parseSync, visitorKeys } = require('oxc-parser');

const {
  ROOT,
  digest,
  fileHashes,
  loadCatalog,
  memberKey,
  workflowMode,
} = require('./workflow-data');

const UI_NAME =
  /title|label|description|message|placeholder|subtitle|details|hint|onCancelText|onConfirmText|children|accessibilityLabel/i;

const IGNORED_PROPERTY =
  /^(testID|key|id|icon|screen|name|route|event|color|backgroundColor)$/i;

const IGNORED_CALLEE = /^(console|logger|defaultLogger|require)(\.|$)/;

const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '__tests__',
  '__mocks__',
]);

const NODE_META_KEYS = new Set(['type', 'start', 'end', 'range', 'loc']);

// TS expression wrappers around a literal initializer (e.g. `as const`).
const TS_EXPRESSION_WRAPPERS = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSConstAssertion',
  'TSTypeAssertion',
  'TSInstantiationExpression',
]);

function roleFor(name) {
  if (/title|label/i.test(name)) return 'title';
  if (/description|details|hint|placeholder|subtitle/i.test(name))
    return 'desc';
  if (/cancel|confirm|action|button/i.test(name)) return 'action';
  if (/message|error|toast/i.test(name)) return 'msg';
  return 'desc';
}

function suggestKey(text, role) {
  const words = text
    .normalize('NFKD')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length || !/^[a-z]/.test(words[0])) return null;
  return `${words.slice(0, 12).join('_')}__${role}`;
}

function collectFiles(root, modules) {
  const result = new Set();
  function walk(full) {
    const stat = fs.lstatSync(full);
    if (stat.isSymbolicLink())
      throw new Error(`Module scan does not follow symlinks: ${full}`);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(full).toSorted()) {
        if (!SKIPPED_DIRECTORIES.has(name)) walk(path.join(full, name));
      }
    } else if (
      /\.[jt]sx?$/.test(full) &&
      !/\.(test|spec|d)\.[jt]sx?$/.test(full)
    ) {
      result.add(path.relative(root, full).split(path.sep).join('/'));
    }
    if (result.size > 500)
      throw new Error(
        'Module scope exceeds 500 source files; select a narrower module.',
      );
  }
  for (const input of modules) {
    const full = path.resolve(root, input);
    if (!full.startsWith(`${root}${path.sep}`))
      throw new Error('Module paths must be inside this repository.');
    walk(full);
  }
  if (!result.size)
    throw new Error('No source files found in the requested module.');
  return [...result].toSorted();
}

// Line breaks match the compiler API: \r\n counts as one break, lone \r, \n,
// U+2028 and U+2029 all start a new line.
function lineStarts(text) {
  const starts = [0];
  for (const match of text.matchAll(/\r\n|[\n\r\u2028\u2029]/g))
    starts.push(match.index + match[0].length);
  return starts;
}

function positionAt(starts, offset) {
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (starts[middle] <= offset) low = middle;
    else high = middle - 1;
  }
  return { line: low + 1, column: offset - starts[low] + 1 };
}

function parseProgram(file, text) {
  const { program, errors } = parseSync(file, text, {
    // JSX stays enabled only for files ending in "x", as the compiler config
    // did before; JS and TS sources share the TypeScript grammar.
    lang: file.endsWith('x') ? 'tsx' : 'ts',
    sourceType: 'module',
    astType: 'ts',
  });
  const error = errors.find((item) => item.severity === 'Error');
  if (error) throw new Error(`Cannot parse ${file}: ${error.message}`);
  return program;
}

// The compiler API reported a JSX text node at its first non-whitespace
// character (getStart skips token trivia); Oxc reports the raw text span.
function jsxTextOffset(node, text) {
  const raw = text.slice(node.start, node.end);
  return node.start + /^\s*/.exec(raw)[0].length;
}

function stringValueOf(node) {
  if (node.type === 'Literal')
    return typeof node.value === 'string' ? node.value : undefined;
  if (node.type === 'TemplateLiteral')
    return node.expressions.length === 0
      ? (node.quasis[0].value.cooked ?? node.quasis[0].value.raw)
      : undefined;
  return undefined;
}

function isTemplateExpression(node) {
  return node.type === 'TemplateLiteral' && node.expressions.length > 0;
}

function nodeText(text, node) {
  return text.slice(node.start, node.end);
}

function scanModule({
  modules,
  root = ROOT,
  includeComplete = false,
  mode: requestedMode,
}) {
  const mode = workflowMode(requestedMode);
  if (includeComplete && mode !== 'update')
    throw new Error('--include-complete requires --mode update.');
  const catalog = loadCatalog(root);
  const files = collectFiles(root, modules);
  const references = new Map();
  const candidates = new Map();
  const unresolved = [];
  const dependencies = new Set();
  for (const file of files) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    const program = parseProgram(file, text);
    const starts = lineStarts(text);
    const ancestors = [];
    const textOf = (node) => nodeText(text, node);
    const parentOf = (node) => {
      const index = ancestors.lastIndexOf(node);
      return index > 0 ? ancestors[index - 1] : undefined;
    };
    // Exported constant literals (`export const label = 'Hello world'`) are
    // module-level data, not UI copy, so keep them out of the candidate scan.
    // Exported object properties (e.g. `export const copy = { title: '...' }`)
    // stay in because the i18n workflow treats them as UI copy maps.
    const isExportedVariableInitializer = (node, parent) => {
      let initializer = node;
      let ancestor = parent;
      while (ancestor && TS_EXPRESSION_WRAPPERS.has(ancestor.type)) {
        initializer = ancestor;
        ancestor = parentOf(ancestor);
      }
      return (
        ancestor?.type === 'VariableDeclarator' &&
        ancestor.init === initializer &&
        ancestors.some(
          (item) =>
            item.type === 'ExportNamedDeclaration' ||
            item.type === 'ExportDefaultDeclaration',
        )
      );
    };
    const location = (node, kind) => {
      const offset =
        node.type === 'JSXText' ? jsxTextOffset(node, text) : node.start;
      const { line, column } = positionAt(starts, offset);
      return { file, line, column, kind };
    };
    const aliases = new Set(['ETranslations']);
    const addReference = (member, node) => {
      const key = catalog.members.get(member);
      if (!key) {
        unresolved.push({
          ...location(node, 'missing-enum-member'),
          expression: member,
        });
        return;
      }
      references.set(key, [
        ...(references.get(key) || []),
        location(node, 'translation-reference'),
      ]);
    };
    const recordCandidate = (node, value, property, confidence) => {
      const normalized = value.replace(/\s+/g, ' ').trim();
      if (
        !normalized ||
        !/[\p{L}]/u.test(normalized) ||
        /^(https?:\/\/|@onekey|\.{0,2}\/)/.test(normalized)
      )
        return;
      const role = roleFor(property);
      const id = digest([normalized, role]).slice(0, 16);
      const candidate = candidates.get(id) || {
        id,
        action: 'review',
        key: suggestKey(normalized, role),
        role,
        confidence,
        text: normalized,
        reuseKeys: Object.entries(catalog.values.en_US)
          .filter(
            ([, existing]) =>
              typeof existing === 'string' &&
              existing.toLowerCase() === normalized.toLowerCase(),
          )
          .slice(0, 5)
          .map(([key]) => ({
            key,
            en_US: catalog.values.en_US[key],
            zh_CN: catalog.values.zh_CN[key],
          })),
        translations: Object.fromEntries(
          catalog.locales.map((locale) => {
            const sourceLocale = /[\u3400-\u9fff]/.test(normalized)
              ? 'zh_CN'
              : 'en_US';
            return [locale, locale === sourceLocale ? normalized : null];
          }),
        ),
        sources: [],
      };
      candidate.sources.push(location(node, 'literal'));
      candidates.set(id, candidate);
    };
    // Only object-literal properties map to PropertyAssignment; destructuring
    // patterns, methods, accessors and shorthand are distinct TS nodes.
    const propertyName = (property, node) => {
      if (!property) return '';
      if (property.type === 'JSXAttribute') return textOf(property.name);
      if (
        property.type !== 'Property' ||
        property.kind !== 'init' ||
        property.method ||
        property.shorthand ||
        parentOf(property)?.type !== 'ObjectExpression'
      )
        return '';
      // In the compiler AST a computed name is wrapped in ComputedPropertyName,
      // so the key itself is not a PropertyAssignment child.
      if (property.computed && property.key === node) return '';
      return property.computed
        ? `[${textOf(property.key)}]`
        : textOf(property.key);
    };
    const visit = (node) => {
      const parent = parentOf(node);
      if (node.type === 'ImportDeclaration') {
        for (const spec of node.specifiers) {
          if (spec.type === 'ImportSpecifier') {
            const imported =
              spec.imported.type === 'Identifier'
                ? spec.imported.name
                : spec.imported.value;
            if (imported === 'ETranslations') aliases.add(spec.local.name);
          }
        }
        const dependency = node.source.value;
        if (
          typeof dependency === 'string' &&
          (dependency.startsWith('.') ||
            dependency.startsWith('@onekeyhq/kit/'))
        )
          dependencies.add(`${file}: ${dependency}`);
        return true;
      }
      if (
        node.type === 'MemberExpression' &&
        aliases.has(textOf(node.object))
      ) {
        if (!node.computed)
          addReference(
            node.property.type === 'Identifier'
              ? node.property.name
              : textOf(node.property),
            node,
          );
        else if (
          node.property.type === 'Literal' &&
          typeof node.property.value === 'string'
        )
          addReference(node.property.value, node);
        else
          unresolved.push({
            ...location(node, 'dynamic-translation'),
            expression: textOf(node),
          });
      }
      if (node.type === 'JSXText')
        recordCandidate(node, node.value, 'description', 'high');
      const isTemplate = isTemplateExpression(node);
      const value = stringValueOf(node);
      if (typeof value === 'string' || isTemplate) {
        let property = parent;
        if (
          property?.type === 'JSXExpressionContainer' ||
          property?.type === 'ArrayExpression'
        )
          property = parentOf(property);
        const propertyText = propertyName(property, node);
        const isUi = UI_NAME.test(propertyText);
        const isText = /\s|[\u3400-\u9fff]/.test(value || '');
        const ignored =
          IGNORED_PROPERTY.test(propertyText) ||
          property?.type === 'ImportDeclaration' ||
          property?.type === 'ExportNamedDeclaration' ||
          property?.type === 'ExportAllDeclaration' ||
          isExportedVariableInitializer(node, parent) ||
          (property?.type === 'CallExpression' &&
            IGNORED_CALLEE.test(textOf(property.callee)));
        if (
          !ignored &&
          (isUi ||
            isText ||
            isTemplate ||
            parent?.type === 'JSXExpressionContainer')
        ) {
          if (isTemplate)
            unresolved.push({
              ...location(node, 'dynamic-copy'),
              expression: textOf(node),
            });
          else
            recordCandidate(
              node,
              value,
              propertyText,
              isUi ? 'high' : 'review',
            );
        }
      }
      return false;
    };
    const walk = (node) => {
      ancestors.push(node);
      const skipChildren = visit(node);
      if (!skipChildren) {
        const keys = visitorKeys[node.type] || Object.keys(node);
        for (const key of keys) {
          if (!NODE_META_KEYS.has(key)) {
            const value = node[key];
            if (Array.isArray(value)) {
              for (const child of value)
                if (child && typeof child.type === 'string') walk(child);
            } else if (value && typeof value.type === 'string') {
              walk(value);
            }
          }
        }
      }
      ancestors.pop();
    };
    walk(program);
  }
  const referenced = [...references].map(([key, sources]) => ({
    key,
    enumMember: memberKey(key),
    sources,
    missingLocales: catalog.locales.filter(
      (locale) =>
        typeof catalog.values[locale][key] !== 'string' ||
        !catalog.values[locale][key].trim(),
    ),
  }));
  const entries = referenced
    .filter((item) => includeComplete || item.missingLocales.length)
    .map((item) => ({
      ...item,
      id: digest(item.key).slice(0, 16),
      action: 'upsert',
      translations: Object.fromEntries(
        catalog.locales.map((locale) => [
          locale,
          catalog.values[locale][item.key] || null,
        ]),
      ),
    }));
  entries.push(...candidates.values());
  return {
    schemaVersion: 1,
    kind: 'i18n-draft',
    mode,
    modulePaths: modules,
    sourceFiles: fileHashes(root, files),
    locales: catalog.locales,
    localeMap: {},
    references: referenced,
    dependencies: [...dependencies].toSorted(),
    unresolved,
    unresolvedReviewed: false,
    entries,
    summary: {
      files: files.length,
      referencedKeys: referenced.length,
      incompleteKeys: referenced.filter((item) => item.missingLocales.length)
        .length,
      literalCandidates: candidates.size,
      unresolved: unresolved.length,
    },
  };
}

module.exports = { scanModule, suggestKey, collectFiles };
