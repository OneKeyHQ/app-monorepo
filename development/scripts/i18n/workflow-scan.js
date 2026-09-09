const fs = require('node:fs');
const path = require('node:path');

const ts = require('typescript');

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
        if (!['node_modules', '.git', '__tests__', '__mocks__'].includes(name))
          walk(path.join(full, name));
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
    const source = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    if (source.parseDiagnostics.length)
      throw new Error(
        `Cannot parse ${file}: ${ts.flattenDiagnosticMessageText(source.parseDiagnostics[0].messageText, ' ')}`,
      );
    const aliases = new Set(['ETranslations']);
    const location = (node, kind) => {
      const { line, character } = source.getLineAndCharacterOfPosition(
        node.getStart(source),
      );
      return { file, line: line + 1, column: character + 1, kind };
    };
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
    const visit = (node) => {
      if (ts.isImportDeclaration(node)) {
        const bindings = node.importClause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings))
          for (const spec of bindings.elements)
            if ((spec.propertyName || spec.name).text === 'ETranslations')
              aliases.add(spec.name.text);
        const dependency = node.moduleSpecifier.text;
        if (
          typeof dependency === 'string' &&
          (dependency.startsWith('.') ||
            dependency.startsWith('@onekeyhq/kit/'))
        )
          dependencies.add(`${file}: ${dependency}`);
        return;
      }
      if (
        ts.isPropertyAccessExpression(node) &&
        aliases.has(node.expression.getText(source))
      )
        addReference(node.name.text, node);
      if (
        ts.isElementAccessExpression(node) &&
        aliases.has(node.expression.getText(source))
      ) {
        if (ts.isStringLiteral(node.argumentExpression))
          addReference(node.argumentExpression.text, node);
        else
          unresolved.push({
            ...location(node, 'dynamic-translation'),
            expression: node.getText(source),
          });
      }
      if (ts.isJsxText(node))
        recordCandidate(node, node.text, 'description', 'high');
      if (
        ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateExpression(node)
      ) {
        let parent = node.parent;
        if (ts.isJsxExpression(parent) || ts.isArrayLiteralExpression(parent))
          parent = parent.parent;
        const property =
          ts.isPropertyAssignment(parent) || ts.isJsxAttribute(parent)
            ? parent.name.getText(source)
            : '';
        const isUi = UI_NAME.test(property);
        const isText = /\s|[\u3400-\u9fff]/.test(node.text || '');
        const ignored =
          /^(testID|key|id|icon|screen|name|route|event|color|backgroundColor)$/i.test(
            property,
          ) ||
          ts.isImportDeclaration(parent) ||
          ts.isExportDeclaration(parent) ||
          (ts.isCallExpression(parent) &&
            /^(console|logger|defaultLogger|require)(\.|$)/.test(
              parent.expression.getText(source),
            ));
        if (
          !ignored &&
          (isUi ||
            isText ||
            ts.isTemplateExpression(node) ||
            ts.isJsxExpression(node.parent))
        ) {
          if (ts.isTemplateExpression(node))
            unresolved.push({
              ...location(node, 'dynamic-copy'),
              expression: node.getText(source),
            });
          else
            recordCandidate(
              node,
              node.text,
              property,
              isUi ? 'high' : 'review',
            );
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
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
