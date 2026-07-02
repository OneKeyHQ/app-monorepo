#!/usr/bin/env node

/* cspell:ignore nextcursor prefilter quasis */

/**
 * Find translation keys that have no static references in source files.
 *
 * This reports candidates, not a deletion list. Dynamic keys, server payloads,
 * and keys referenced only by external systems still need manual review.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const https = require('https');
const path = require('path');

const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const REPO_ROOT = path.join(__dirname, '../../..');
const SHARED_PACKAGE_ROOT = path.join(REPO_ROOT, 'packages/shared');
const LOCALE_JSON_PATH = path.join(
  REPO_ROOT,
  'packages/shared/src/locale/json/en_US.json',
);
const TRANSLATIONS_ENUM_PATH = path.join(
  REPO_ROOT,
  'packages/shared/src/locale/enum/translations.ts',
);

const DEFAULT_ROOTS = ['apps', 'packages', 'development'];
const DEFAULT_LIMIT = 200;
const DEFAULT_MAX_FILE_SIZE = 1024 * 1024;

const SERVER_DYNAMIC_I18N_RESERVATIONS = [
  {
    name: 'rebate-dynamic-labels',
    endpoints: [
      'GET /rebate/v1/invite/summary',
      'GET /rebate/v1/invite/level-detail',
    ],
    fields: ['labelKey', 'commissionRatesLabelKey', 'levelUpLabelKey'],
    keyPrefixes: ['referral.', 'referral_', 'rebate.', 'rebate_'],
  },
  {
    name: 'rebate-redemption-errors',
    endpoints: ['POST /rebate/v1/redemption-center/redemption-code/redeem'],
    fields: ['messageId'],
    keyPrefixes: ['redemption.', 'redemption_'],
  },
  {
    name: 'rebate-wallet-bind-status',
    endpoints: ['POST /rebate/v1/wallet/batch-check-v2'],
    fields: ['reason'],
    keyPrefixes: ['referral.', 'referral_'],
  },
  {
    name: 'rebate-post-config-locales',
    endpoints: ['GET /rebate/v1/invite/post-config'],
    fields: ['locales'],
    keyPrefixes: ['referral.', 'referral_'],
  },
  {
    name: 'perp-server-config-locales',
    endpoints: ['GET /utility/v1/perp-config'],
    fields: [
      'hyperLiquidErrorLocales[].i18nKey',
      'perpsAssetMetaMap.*.i18nKey',
    ],
    keyPrefixes: ['perp.', 'perp_', 'perps.', 'perps_'],
  },
];

const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const JSON_EXTENSIONS = new Set(['.json']);
const TRANSLATION_ALIAS_MARKERS = ['ETranslations', 'ElectronTranslations'];

const IGNORE_DIRS = new Set([
  '.git',
  '.history',
  '.next',
  '.turbo',
  '.yarn',
  '.tamagui',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'tmp',
  'web-build',
]);

const GENERATED_FILES = new Set([
  'apps/desktop/public/static/preload.js',
  'packages/shared/src/locale/enum/translations.ts',
  'packages/shared/src/locale/localeJsonMap.ts',
]);

const GENERATED_DIRS = [
  'packages/shared/src/locale/json',
  'apps/desktop/public/static/js-sdk',
  'apps/mobile/android/app/src/main/assets/web-embed',
  'apps/mobile/ios/OneKeyWallet/web-embed',
  'apps/ext/src/entry',
];

const LOCK_FILES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
]);

function parseArgs(argv) {
  const options = {
    format: 'table',
    includeTests: false,
    includeServerDynamic: false,
    deleteBatchSize: 100,
    deleteLimit: 0,
    deleteLokalise: false,
    deleteLokaliseConfirm: false,
    limit: DEFAULT_LIMIT,
    maxFileSize: DEFAULT_MAX_FILE_SIZE,
    output: '',
    pullAfterDelete: false,
    roots: [],
    verbose: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) {
        throw new Error(`Missing value for ${arg}`);
      }
      return argv[i];
    };

    if (arg === '--format') {
      options.format = next();
    } else if (arg.startsWith('--format=')) {
      options.format = arg.slice('--format='.length);
    } else if (arg === '--output') {
      options.output = next();
    } else if (arg.startsWith('--output=')) {
      options.output = arg.slice('--output='.length);
    } else if (arg === '--limit') {
      options.limit = Number(next());
    } else if (arg.startsWith('--limit=')) {
      options.limit = Number(arg.slice('--limit='.length));
    } else if (arg === '--root') {
      options.roots.push(next());
    } else if (arg.startsWith('--root=')) {
      options.roots.push(arg.slice('--root='.length));
    } else if (arg === '--max-file-size') {
      options.maxFileSize = Number(next());
    } else if (arg.startsWith('--max-file-size=')) {
      options.maxFileSize = Number(arg.slice('--max-file-size='.length));
    } else if (arg === '--include-tests') {
      options.includeTests = true;
    } else if (arg === '--include-server-dynamic') {
      options.includeServerDynamic = true;
    } else if (arg === '--delete-lokalise') {
      options.deleteLokalise = true;
    } else if (arg === '--yes' || arg === '--confirm-delete') {
      options.deleteLokaliseConfirm = true;
    } else if (arg === '--delete-limit') {
      options.deleteLimit = Number(next());
    } else if (arg.startsWith('--delete-limit=')) {
      options.deleteLimit = Number(arg.slice('--delete-limit='.length));
    } else if (arg === '--delete-batch-size') {
      options.deleteBatchSize = Number(next());
    } else if (arg.startsWith('--delete-batch-size=')) {
      options.deleteBatchSize = Number(
        arg.slice('--delete-batch-size='.length),
      );
    } else if (arg === '--pull-after-delete') {
      options.pullAfterDelete = true;
    } else if (arg === '--all') {
      options.limit = 0;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!['table', 'json', 'csv'].includes(options.format)) {
    throw new Error('--format must be one of: table, json, csv');
  }
  if (!Number.isFinite(options.limit) || options.limit < 0) {
    throw new Error('--limit must be a non-negative number');
  }
  if (!Number.isFinite(options.maxFileSize) || options.maxFileSize <= 0) {
    throw new Error('--max-file-size must be a positive number');
  }
  if (!Number.isFinite(options.deleteLimit) || options.deleteLimit < 0) {
    throw new Error('--delete-limit must be a non-negative number');
  }
  if (
    !Number.isFinite(options.deleteBatchSize) ||
    options.deleteBatchSize <= 0
  ) {
    throw new Error('--delete-batch-size must be a positive number');
  }
  if (options.deleteLokaliseConfirm && !options.deleteLokalise) {
    throw new Error('--yes requires --delete-lokalise');
  }
  if (options.pullAfterDelete && !options.deleteLokaliseConfirm) {
    throw new Error('--pull-after-delete requires --delete-lokalise --yes');
  }
  if (options.roots.length === 0) {
    options.roots = DEFAULT_ROOTS;
  }

  return options;
}

function printHelp() {
  console.log(`
Usage: yarn i18n:unused [options]

Options:
  --format table|json|csv   Output format. Default: table
  --output <path>           Write full output to a file
  --limit <n>               Table rows to print. 0 means all. Default: 200
  --all                     Shortcut for --limit 0
  --root <path>             Root to scan. Can be repeated
  --include-tests           Count test/spec/e2e files as usage
  --include-server-dynamic  Include keys reserved for unconfirmed server APIs
  --delete-lokalise         Build a Lokalise deletion plan for unused keys
  --yes                     Actually delete from Lokalise. Requires --delete-lokalise
  --delete-limit <n>        Delete only the first n unused keys. 0 means all
  --delete-batch-size <n>   Lokalise bulk-delete batch size. Default: 100
  --pull-after-delete       Run yarn i18n:pull after confirmed deletion
  --max-file-size <bytes>   Skip larger files. Default: ${DEFAULT_MAX_FILE_SIZE}
  --verbose                 Print parse and dynamic-reference warnings

Examples:
  yarn i18n:unused
  yarn i18n:unused --all
  yarn i18n:unused --format json --output tmp/i18n-unused.json
  yarn i18n:unused --include-tests --root packages/kit
  yarn i18n:unused --delete-lokalise
  yarn i18n:unused --delete-lokalise --yes --pull-after-delete
`);
}

function toRepoPath(filePath) {
  return path.relative(REPO_ROOT, filePath).split(path.sep).join('/');
}

function resolveRoot(root) {
  return path.isAbsolute(root) ? root : path.join(REPO_ROOT, root);
}

function isInGeneratedDir(repoPath) {
  return GENERATED_DIRS.some(
    (dir) => repoPath === dir || repoPath.startsWith(`${dir}/`),
  );
}

function isTestFile(repoPath) {
  return (
    /(^|\/)(__tests__|__mocks__|e2e|test|tests)\//.test(repoPath) ||
    /\.(test|spec|e2e)\.[cm]?[jt]sx?$/.test(repoPath)
  );
}

function shouldSkipFile(filePath, options) {
  const repoPath = toRepoPath(filePath);
  const basename = path.basename(filePath);
  const ext = path.extname(filePath);

  if (GENERATED_FILES.has(repoPath) || isInGeneratedDir(repoPath)) {
    return 'generated';
  }
  if (LOCK_FILES.has(basename)) {
    return 'lock';
  }
  if (!options.includeTests && isTestFile(repoPath)) {
    return 'test';
  }
  if (!CODE_EXTENSIONS.has(ext) && !JSON_EXTENSIONS.has(ext)) {
    return 'extension';
  }

  return '';
}

function walkFiles(roots, options) {
  const files = [];
  const skipped = {
    generated: 0,
    large: [],
    missingRoots: [],
    test: 0,
    unsupported: 0,
  };

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_error) {
      skipped.missingRoots.push(toRepoPath(dir));
      return;
    }

    for (const entry of entries) {
      const currentPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name)) {
          walk(currentPath);
        }
      } else if (entry.isFile()) {
        const skipReason = shouldSkipFile(currentPath, options);
        if (skipReason) {
          if (skipReason === 'generated') {
            skipped.generated += 1;
          } else if (skipReason === 'test') {
            skipped.test += 1;
          } else {
            skipped.unsupported += 1;
          }
        } else {
          const stat = fs.statSync(currentPath);
          if (stat.size > options.maxFileSize) {
            skipped.large.push({
              path: toRepoPath(currentPath),
              size: stat.size,
            });
          } else {
            files.push(currentPath);
          }
        }
      }
    }
  }

  for (const root of roots) {
    walk(resolveRoot(root));
  }

  return { files, skipped };
}

function loadTranslations() {
  return JSON.parse(fs.readFileSync(LOCALE_JSON_PATH, 'utf8'));
}

function loadEnumMembers() {
  const enumText = fs.readFileSync(TRANSLATIONS_ENUM_PATH, 'utf8');
  const memberToKey = new Map();
  const keyToMember = new Map();
  const enumEntryRegex =
    /^\s*([A-Za-z_$][\w$]*)\s*=\s*(['"])((?:\\.|(?!\2).)+)\2,?/gm;
  let match = enumEntryRegex.exec(enumText);

  while (match) {
    const member = match[1];
    const key = match[3].replace(/\\(['"\\])/g, '$1');
    memberToKey.set(member, key);
    keyToMember.set(key, member);
    match = enumEntryRegex.exec(enumText);
  }

  return { keyToMember, memberToKey };
}

function collectPossibleStringKeys(content, keySet) {
  const keys = new Set();
  const stringRegex = /(['"`])((?:\\.|(?!\1)[^\\]){1,300})\1/gm;
  let match = stringRegex.exec(content);

  while (match) {
    const value = match[2]
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\(['"`\\])/g, '$1');
    if (keySet.has(value)) {
      keys.add(value);
    }
    match = stringRegex.exec(content);
  }

  return keys;
}

function parseCode(content, filePath) {
  const ext = path.extname(filePath);
  const plugins = [
    'classProperties',
    'classPrivateMethods',
    'classPrivateProperties',
    'decorators-legacy',
    'dynamicImport',
    'exportDefaultFrom',
    'exportNamespaceFrom',
    'importMeta',
    'jsx',
    'nullishCoalescingOperator',
    'objectRestSpread',
    'optionalChaining',
    'topLevelAwait',
  ];

  if (ext === '.ts' || ext === '.tsx') {
    plugins.push('typescript');
  }

  return parser.parse(content, {
    allowAwaitOutsideFunction: true,
    allowImportExportEverywhere: true,
    allowReturnOutsideFunction: true,
    errorRecovery: true,
    plugins,
    sourceType: 'unambiguous',
  });
}

function getStringLiteralValue(node) {
  if (!node) {
    return undefined;
  }
  if (node.type === 'StringLiteral') {
    return node.value;
  }
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value?.cooked;
  }
  return undefined;
}

function getPropertyName(node) {
  if (!node) {
    return undefined;
  }
  if (node.type === 'Identifier') {
    return node.name;
  }
  if (node.type === 'StringLiteral') {
    return node.value;
  }
  return undefined;
}

function getStaticComputedPrefix(node) {
  if (!node) {
    return '';
  }
  if (node.type === 'TemplateLiteral') {
    return node.quasis[0]?.value?.cooked || '';
  }
  if (node.type === 'BinaryExpression' && node.operator === '+') {
    const left = getStringLiteralValue(node.left);
    if (left) {
      return left;
    }
    return getStaticComputedPrefix(node.left);
  }
  if (node.type === 'TSAsExpression' || node.type === 'TSTypeAssertion') {
    return getStaticComputedPrefix(node.expression);
  }
  return '';
}

function isTranslationNamespace(node, namespaceAliases) {
  return (
    node?.type === 'MemberExpression' &&
    node.object?.type === 'Identifier' &&
    namespaceAliases.has(node.object.name) &&
    getPropertyName(node.property) === 'ETranslations'
  );
}

function addDynamicPrefixUsage({ filePath, memberToKey, prefix, usedKeys }) {
  let count = 0;
  for (const [member, key] of memberToKey) {
    if (member.startsWith(prefix)) {
      addUsage(usedKeys, key, filePath, 'enum-dynamic-prefix');
      count += 1;
    }
  }
  return count;
}

function addUsage(usedKeys, key, filePath, type) {
  const repoPath = toRepoPath(filePath);
  const existing = usedKeys.get(key);
  if (existing) {
    existing.count += 1;
    if (existing.samples.length < 3) {
      existing.samples.push({ path: repoPath, type });
    }
    return;
  }

  usedKeys.set(key, {
    count: 1,
    samples: [{ path: repoPath, type }],
  });
}

function addWarning(warnings, filePath, message) {
  const repoPath = toRepoPath(filePath);
  if (warnings.length < 50) {
    warnings.push(`${repoPath}: ${message}`);
  }
}

function scanCodeFile({
  content,
  filePath,
  keySet,
  memberToKey,
  usedKeys,
  warnings,
}) {
  const possibleStringKeys = collectPossibleStringKeys(content, keySet);
  if (
    !TRANSLATION_ALIAS_MARKERS.some((marker) => content.includes(marker)) &&
    possibleStringKeys.size === 0
  ) {
    return { parsed: false, skipped: true };
  }

  let ast;
  try {
    ast = parseCode(content, filePath);
  } catch (error) {
    for (const key of possibleStringKeys) {
      addUsage(usedKeys, key, filePath, 'string-fallback');
    }
    addWarning(warnings, filePath, `parse failed: ${error.message}`);
    return { parsed: false, skipped: false };
  }

  const enumAliases = new Set(['ETranslations']);
  const namespaceAliases = new Set();

  traverse(ast, {
    ImportDeclaration(importPath) {
      const source = importPath.node.source.value;
      const isLocaleImport =
        source.includes('@onekeyhq/shared/src/locale') ||
        source.endsWith('/locale') ||
        source.endsWith('/locale/enum/translations');
      const hasElectronTranslationsSpecifier = importPath.node.specifiers.some(
        (specifier) =>
          specifier.type === 'ImportSpecifier' &&
          getPropertyName(specifier.imported) === 'ElectronTranslations',
      );

      if (!isLocaleImport && !hasElectronTranslationsSpecifier) {
        return;
      }

      for (const specifier of importPath.node.specifiers) {
        if (
          specifier.type === 'ImportSpecifier' &&
          getPropertyName(specifier.imported) === 'ETranslations'
        ) {
          enumAliases.add(specifier.local.name);
        } else if (
          specifier.type === 'ImportSpecifier' &&
          getPropertyName(specifier.imported) === 'ElectronTranslations'
        ) {
          enumAliases.add(specifier.local.name);
        } else if (specifier.type === 'ImportNamespaceSpecifier') {
          namespaceAliases.add(specifier.local.name);
        }
      }
    },

    VariableDeclarator(variablePath) {
      const { id, init } = variablePath.node;
      if (
        init?.type !== 'CallExpression' ||
        init.callee?.type !== 'Identifier' ||
        init.callee.name !== 'require' ||
        init.arguments.length !== 1
      ) {
        return;
      }

      const source = getStringLiteralValue(init.arguments[0]);
      const isLocaleRequire =
        source &&
        (source.includes('@onekeyhq/shared/src/locale') ||
          source.endsWith('/locale') ||
          source.endsWith('/locale/enum/translations'));
      const hasElectronTranslationsProperty =
        id.type === 'ObjectPattern' &&
        id.properties.some(
          (property) =>
            property.type === 'ObjectProperty' &&
            getPropertyName(property.key) === 'ElectronTranslations',
        );

      if (!isLocaleRequire && !hasElectronTranslationsProperty) {
        return;
      }

      if (id.type === 'Identifier') {
        namespaceAliases.add(id.name);
      } else if (id.type === 'ObjectPattern') {
        for (const property of id.properties) {
          if (
            property.type === 'ObjectProperty' &&
            getPropertyName(property.key) === 'ETranslations' &&
            property.value.type === 'Identifier'
          ) {
            enumAliases.add(property.value.name);
          } else if (
            property.type === 'ObjectProperty' &&
            getPropertyName(property.key) === 'ElectronTranslations' &&
            property.value.type === 'Identifier'
          ) {
            enumAliases.add(property.value.name);
          }
        }
      }
    },
  });

  traverse(ast, {
    StringLiteral(stringPath) {
      const key = stringPath.node.value;
      if (keySet.has(key)) {
        addUsage(usedKeys, key, filePath, 'string');
      }
    },

    TemplateLiteral(templatePath) {
      if (templatePath.node.expressions.length > 0) {
        return;
      }
      const key = templatePath.node.quasis[0]?.value?.cooked;
      if (key && keySet.has(key)) {
        addUsage(usedKeys, key, filePath, 'template');
      }
    },

    MemberExpression(memberPath) {
      const { node } = memberPath;
      const object = node.object;
      const isEnumObject =
        (object.type === 'Identifier' && enumAliases.has(object.name)) ||
        isTranslationNamespace(object, namespaceAliases);

      if (!isEnumObject) {
        return;
      }

      if (node.computed && node.property.type !== 'StringLiteral') {
        const prefix = getStaticComputedPrefix(node.property);
        if (prefix) {
          const count = addDynamicPrefixUsage({
            filePath,
            memberToKey,
            prefix,
            usedKeys,
          });
          addWarning(
            warnings,
            filePath,
            `dynamic ETranslations access with prefix "${prefix}" marked ${count} keys`,
          );
          return;
        }
        addWarning(warnings, filePath, 'dynamic ETranslations access ignored');
        return;
      }

      const member = getPropertyName(node.property);
      const key = member ? memberToKey.get(member) : undefined;
      if (key) {
        addUsage(usedKeys, key, filePath, 'enum');
      }
    },

    CallExpression(callPath) {
      const { node } = callPath;
      if (
        node.callee.type === 'MemberExpression' &&
        node.callee.object.type === 'Identifier' &&
        node.callee.object.name === 'Object' &&
        ['keys', 'values', 'entries'].includes(
          getPropertyName(node.callee.property),
        ) &&
        node.arguments.some(
          (arg) =>
            (arg.type === 'Identifier' && enumAliases.has(arg.name)) ||
            isTranslationNamespace(arg, namespaceAliases),
        )
      ) {
        addWarning(
          warnings,
          filePath,
          `Object.${getPropertyName(node.callee.property)}(ETranslations) ignored`,
        );
      }
    },
  });

  return { parsed: true, skipped: false };
}

function scanJsonValue(value, filePath, keySet, usedKeys) {
  if (typeof value === 'string') {
    if (keySet.has(value)) {
      addUsage(usedKeys, value, filePath, 'json-string');
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      scanJsonValue(item, filePath, keySet, usedKeys);
    }
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (keySet.has(key)) {
        addUsage(usedKeys, key, filePath, 'json-key');
      }
      scanJsonValue(item, filePath, keySet, usedKeys);
    }
  }
}

function scanJsonFile({ content, filePath, keySet, usedKeys, warnings }) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    addWarning(warnings, filePath, `JSON parse failed: ${error.message}`);
    return;
  }
  scanJsonValue(parsed, filePath, keySet, usedKeys);
}

function getServerDynamicReservationForKey(key) {
  return SERVER_DYNAMIC_I18N_RESERVATIONS.find((rule) =>
    rule.keyPrefixes.some((prefix) => key.startsWith(prefix)),
  );
}

function getOptionalEnvVar(name) {
  return process.env[name] || '';
}

function getRequiredEnvVar(name) {
  const value = getOptionalEnvVar(name);
  if (!value) {
    throw new Error(
      `${name} environment variable is required for confirmed Lokalise deletion`,
    );
  }
  return value;
}

function requestLokalise({ body, method, path: requestPath, token }) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const req = https.request(
      {
        hostname: 'api.lokalise.com',
        method,
        path: requestPath,
        port: 443,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Api-Token': token,
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        res.on('end', () => {
          let parsed;
          try {
            parsed = responseBody ? JSON.parse(responseBody) : {};
          } catch (_error) {
            parsed = responseBody;
          }

          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ body: parsed, headers: res.headers });
            return;
          }

          reject(
            new Error(`Lokalise API error: ${res.statusCode} ${responseBody}`),
          );
        });
      },
    );

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

function getNextCursor(headers) {
  const value =
    headers.nextcursor ||
    headers['next-cursor'] ||
    headers['x-next-cursor'] ||
    headers['x-pagination-next-cursor'];
  return Array.isArray(value) ? value[0] : value || '';
}

async function fetchLokaliseKeys({ filterKeys, projectId, token }) {
  const keys = [];
  let cursor = '';
  const seenCursors = new Set();

  do {
    const params = new URLSearchParams({
      disable_references: '1',
      include_comments: '0',
      include_screenshots: '0',
      include_translations: '0',
      limit: '500',
      pagination: 'cursor',
    });
    if (filterKeys?.length) {
      params.set('filter_keys', filterKeys.join(','));
    }
    if (cursor) {
      if (seenCursors.has(cursor)) {
        throw new Error(`Lokalise cursor pagination loop detected: ${cursor}`);
      }
      seenCursors.add(cursor);
      params.set('cursor', cursor);
    }

    const response = await requestLokalise({
      method: 'GET',
      path: `/api2/projects/${encodeURIComponent(projectId)}/keys?${params}`,
      token,
    });
    const bodyKeys = Array.isArray(response.body?.keys)
      ? response.body.keys
      : [];
    keys.push(...bodyKeys);
    cursor = getNextCursor(response.headers);
  } while (cursor);

  return keys;
}

async function fetchLokaliseKeysForLocalKeys({ localKeys, projectId, token }) {
  const allKeys = [];
  const seenKeyIds = new Set();
  const batchSize = 50;

  for (let i = 0; i < localKeys.length; i += batchSize) {
    const batch = localKeys.slice(i, i + batchSize);
    const filterKeys = [
      ...new Set(batch.flatMap((key) => getLokaliseKeyNameVariants(key))),
    ];
    const keys = await fetchLokaliseKeys({ filterKeys, projectId, token });
    for (const keyInfo of keys) {
      const keyId = String(keyInfo?.key_id ?? '');
      if (keyId && !seenKeyIds.has(keyId)) {
        seenKeyIds.add(keyId);
        allKeys.push(keyInfo);
      }
    }
    console.error(
      `Resolved Lokalise key IDs: ${Math.min(
        i + batch.length,
        localKeys.length,
      )}/${localKeys.length} candidates...`,
    );
  }

  return allKeys;
}

function getLokaliseKeyNames(keyInfo) {
  const keyName = keyInfo?.key_name;
  if (typeof keyName === 'string') {
    return [keyName];
  }
  if (keyName && typeof keyName === 'object') {
    return Object.values(keyName).filter(
      (value) => typeof value === 'string' && value,
    );
  }
  return [];
}

function buildLokaliseKeyIndex(keys) {
  const index = new Map();
  for (const keyInfo of keys) {
    for (const name of getLokaliseKeyNames(keyInfo)) {
      const list = index.get(name) || [];
      list.push(keyInfo);
      index.set(name, list);
    }
  }
  return index;
}

function getLokaliseKeyNameVariants(localKey) {
  const variants = new Set([localKey]);
  if (localKey.includes('.')) {
    variants.add(localKey.replace('.', '::'));
    variants.add(localKey.replace(/\./g, '::'));
  }
  return [...variants];
}

function findLokaliseKeyMatches(localKey, keyIndex) {
  const matchesById = new Map();
  for (const variant of getLokaliseKeyNameVariants(localKey)) {
    const matches = keyIndex.get(variant) || [];
    for (const match of matches) {
      if (match?.key_id !== undefined && match?.key_id !== null) {
        matchesById.set(String(match.key_id), {
          keyId: String(match.key_id),
          keyName: variant,
        });
      }
    }
  }
  return [...matchesById.values()];
}

function buildLokaliseDeletePlan({ keyIndex, unused }) {
  const ambiguous = [];
  const missing = [];
  const toDelete = [];
  const seenKeyIds = new Set();

  for (const item of unused) {
    const matches = findLokaliseKeyMatches(item.key, keyIndex);
    if (matches.length === 0) {
      missing.push(item);
    } else if (matches.length > 1) {
      ambiguous.push({
        ...item,
        matches,
      });
    } else {
      const match = matches[0];
      if (!seenKeyIds.has(match.keyId)) {
        seenKeyIds.add(match.keyId);
        toDelete.push({
          ...item,
          lokaliseKeyId: match.keyId,
          lokaliseKeyName: match.keyName,
        });
      }
    }
  }

  return { ambiguous, missing, toDelete };
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function deleteLokaliseKeys({ keyIds, options, projectId, token }) {
  const chunks = chunkArray(keyIds, options.deleteBatchSize);
  let deleted = 0;

  for (const chunk of chunks) {
    await requestLokalise({
      body: { keys: chunk },
      method: 'DELETE',
      path: `/api2/projects/${encodeURIComponent(projectId)}/keys`,
      token,
    });
    deleted += chunk.length;
    console.error(`Deleted ${deleted}/${keyIds.length} keys from Lokalise...`);
  }

  return deleted;
}

function runPullAfterDelete() {
  const scriptPath = path.resolve(__dirname, 'i18n-pull.js');
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: SHARED_PACKAGE_ROOT,
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }
  if (typeof result.status === 'number' && result.status !== 0) {
    throw new Error(`i18n pull failed with exit code ${result.status}`);
  }
  if (result.signal) {
    throw new Error(`i18n pull was terminated by signal ${result.signal}`);
  }
}

async function applyLokaliseDeleteIfRequested(report, options) {
  if (!options.deleteLokalise) {
    return;
  }

  const selectedUnused =
    options.deleteLimit > 0
      ? report.unused.slice(0, options.deleteLimit)
      : report.unused;

  const summary = {
    dryRun: !options.deleteLokaliseConfirm,
    requestedCandidates: report.unused.length,
    selectedCandidates: selectedUnused.length,
    matched: 0,
    missing: 0,
    ambiguous: 0,
    deleted: 0,
    pulledAfterDelete: false,
    note: '',
    sampleMissing: [],
    sampleAmbiguous: [],
    sampleToDelete: [],
  };
  report.lokaliseDelete = summary;

  if (selectedUnused.length === 0) {
    summary.note = 'No unused candidates selected for Lokalise deletion.';
    return;
  }

  const token = options.deleteLokaliseConfirm
    ? getRequiredEnvVar('LOKALISE_TOKEN')
    : getOptionalEnvVar('LOKALISE_TOKEN');
  const projectId = options.deleteLokaliseConfirm
    ? getRequiredEnvVar('LOKALISE_PROJECT_ID')
    : getOptionalEnvVar('LOKALISE_PROJECT_ID');

  if (!token || !projectId) {
    summary.note =
      'Dry run only: set LOKALISE_TOKEN and LOKALISE_PROJECT_ID to resolve Lokalise key IDs.';
    return;
  }

  console.error('Resolving Lokalise key IDs for deletion plan...');
  const lokaliseKeys = await fetchLokaliseKeysForLocalKeys({
    localKeys: selectedUnused.map((item) => item.key),
    projectId,
    token,
  });
  const keyIndex = buildLokaliseKeyIndex(lokaliseKeys);
  const plan = buildLokaliseDeletePlan({
    keyIndex,
    unused: selectedUnused,
  });

  summary.matched = plan.toDelete.length;
  summary.missing = plan.missing.length;
  summary.ambiguous = plan.ambiguous.length;
  summary.sampleMissing = plan.missing.slice(0, 20).map((item) => item.key);
  summary.sampleAmbiguous = plan.ambiguous.slice(0, 20).map((item) => ({
    key: item.key,
    matches: item.matches,
  }));
  summary.sampleToDelete = plan.toDelete.slice(0, 20).map((item) => ({
    key: item.key,
    lokaliseKeyId: item.lokaliseKeyId,
    lokaliseKeyName: item.lokaliseKeyName,
  }));

  if (summary.ambiguous > 0) {
    summary.note =
      'Ambiguous Lokalise key matches found. Resolve them before confirmed deletion.';
    if (options.deleteLokaliseConfirm) {
      throw new Error(summary.note);
    }
    return;
  }

  if (!options.deleteLokaliseConfirm) {
    summary.note =
      'Dry run: add --yes to delete matched keys from Lokalise. Server dynamic reserved keys are excluded unless --include-server-dynamic is used.';
    return;
  }

  if (plan.toDelete.length === 0) {
    summary.note = 'No matching Lokalise keys found for selected candidates.';
    return;
  }

  summary.deleted = await deleteLokaliseKeys({
    keyIds: plan.toDelete.map((item) => item.lokaliseKeyId),
    options,
    projectId,
    token,
  });
  summary.note = `Deleted ${summary.deleted} keys from Lokalise.`;

  if (options.pullAfterDelete) {
    runPullAfterDelete();
    summary.pulledAfterDelete = true;
  }
}

function scanFiles(files, keySet, memberToKey) {
  const usedKeys = new Map();
  const warnings = [];
  const stats = {
    codeFilesParsed: 0,
    codeFilesSkippedByPreFilter: 0,
    jsonFilesParsed: 0,
    parseWarnings: 0,
    scannedFiles: files.length,
  };

  for (const filePath of files) {
    const ext = path.extname(filePath);
    const content = fs.readFileSync(filePath, 'utf8');

    if (JSON_EXTENSIONS.has(ext)) {
      scanJsonFile({ content, filePath, keySet, usedKeys, warnings });
      stats.jsonFilesParsed += 1;
    } else {
      const beforeWarnings = warnings.length;
      const result = scanCodeFile({
        content,
        filePath,
        keySet,
        memberToKey,
        usedKeys,
        warnings,
      });

      if (result.skipped) {
        stats.codeFilesSkippedByPreFilter += 1;
      } else if (result.parsed) {
        stats.codeFilesParsed += 1;
      }
      stats.parseWarnings += warnings.length - beforeWarnings;
    }
  }

  return { stats, usedKeys, warnings };
}

function buildReport({
  options,
  skipped,
  stats,
  translations,
  usedKeys,
  warnings,
}) {
  const { keyToMember } = loadEnumMembers();
  const allKeys = Object.keys(translations).toSorted((a, b) =>
    a.localeCompare(b),
  );
  const unused = allKeys
    .filter((key) => !usedKeys.has(key))
    .map((key) => ({
      key,
      enumMember: keyToMember.get(key) || '',
      value: translations[key],
    }));

  const serverDynamicReserved = unused
    .map((item) => {
      const reservation = getServerDynamicReservationForKey(item.key);
      return reservation
        ? {
            ...item,
            reservedBy: reservation.name,
          }
        : undefined;
    })
    .filter(Boolean);

  const serverDynamicReservedKeys = new Set(
    serverDynamicReserved.map((item) => item.key),
  );
  const unusedCandidates = options.includeServerDynamic
    ? unused
    : unused.filter((item) => !serverDynamicReservedKeys.has(item.key));

  const used = allKeys
    .filter((key) => usedKeys.has(key))
    .map((key) => ({
      key,
      enumMember: keyToMember.get(key) || '',
      value: translations[key],
      usage: usedKeys.get(key),
    }));

  return {
    meta: {
      defaultLocale: 'en_US',
      generatedAt: new Date().toISOString(),
      includeTests: options.includeTests,
      includeServerDynamic: options.includeServerDynamic,
      roots: options.roots,
      serverDynamicReservationRules: SERVER_DYNAMIC_I18N_RESERVATIONS,
      note: options.includeServerDynamic
        ? 'Unused entries include keys reserved for unconfirmed server APIs. Review dynamic keys and external references before deletion.'
        : 'Unused entries exclude keys reserved for unconfirmed server APIs. Review serverDynamicReserved before deletion.',
    },
    stats: {
      totalKeys: allKeys.length,
      usedKeys: used.length,
      rawUnusedCandidates: unused.length,
      serverDynamicReserved: serverDynamicReserved.length,
      unusedCandidates: unusedCandidates.length,
      scannedFiles: stats.scannedFiles,
      codeFilesParsed: stats.codeFilesParsed,
      codeFilesSkippedByPreFilter: stats.codeFilesSkippedByPreFilter,
      jsonFilesParsed: stats.jsonFilesParsed,
      skippedGeneratedFiles: skipped.generated,
      skippedLargeFiles: skipped.large.length,
      skippedTestFiles: skipped.test,
      skippedUnsupportedFiles: skipped.unsupported,
      warnings: warnings.length,
    },
    skippedLargeFiles: skipped.large,
    missingRoots: skipped.missingRoots,
    warnings,
    serverDynamicReserved,
    unused: unusedCandidates,
    used,
  };
}

function escapeCsvCell(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function formatCsv(report) {
  const rows = [['key', 'enumMember', 'value']];
  for (const item of report.unused) {
    rows.push([item.key, item.enumMember, item.value]);
  }
  return `${rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n')}\n`;
}

function truncate(value, maxLength) {
  const text = String(value ?? '');
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 3)}...`;
}

function formatTable(report, options) {
  const lines = [];
  const limit = options.limit === 0 ? report.unused.length : options.limit;
  const visibleRows = report.unused.slice(0, limit);

  lines.push('i18n unused key scan');
  lines.push('');
  lines.push(`Total keys: ${report.stats.totalKeys}`);
  lines.push(`Used keys: ${report.stats.usedKeys}`);
  lines.push(`Raw unused candidates: ${report.stats.rawUnusedCandidates}`);
  lines.push(`Server dynamic reserved: ${report.stats.serverDynamicReserved}`);
  lines.push(`Unused candidates: ${report.stats.unusedCandidates}`);
  lines.push(`Scanned files: ${report.stats.scannedFiles}`);
  lines.push(`Parsed code files: ${report.stats.codeFilesParsed}`);
  lines.push(`Parsed JSON files: ${report.stats.jsonFilesParsed}`);
  lines.push(`Skipped tests: ${report.stats.skippedTestFiles}`);
  lines.push(`Skipped generated files: ${report.stats.skippedGeneratedFiles}`);
  lines.push(`Skipped large files: ${report.stats.skippedLargeFiles}`);
  lines.push(`Warnings: ${report.stats.warnings}`);
  lines.push('');
  lines.push(report.meta.note);
  lines.push('');

  if (visibleRows.length === 0) {
    lines.push('No unused candidates found.');
  } else {
    lines.push(
      `Unused candidates (showing ${visibleRows.length}/${report.unused.length}):`,
    );
    for (const item of visibleRows) {
      const enumText = item.enumMember
        ? `ETranslations.${item.enumMember}`
        : '';
      lines.push(
        `  ${item.key}${enumText ? ` (${enumText})` : ''} -> "${truncate(
          item.value,
          80,
        )}"`,
      );
    }
  }

  if (report.unused.length > visibleRows.length) {
    lines.push('');
    lines.push(
      `Use --all to print every row, or --format json --output tmp/i18n-unused.json for the full report.`,
    );
  }

  if (report.lokaliseDelete) {
    const deleteSummary = report.lokaliseDelete;
    lines.push('');
    lines.push('Lokalise deletion:');
    lines.push(`  Mode: ${deleteSummary.dryRun ? 'dry-run' : 'confirmed'}`);
    lines.push(
      `  Selected candidates: ${deleteSummary.selectedCandidates}/${deleteSummary.requestedCandidates}`,
    );
    lines.push(`  Matched Lokalise keys: ${deleteSummary.matched}`);
    lines.push(`  Missing in Lokalise: ${deleteSummary.missing}`);
    lines.push(`  Ambiguous matches: ${deleteSummary.ambiguous}`);
    lines.push(`  Deleted: ${deleteSummary.deleted}`);
    lines.push(`  Pull after delete: ${deleteSummary.pulledAfterDelete}`);
    if (deleteSummary.note) {
      lines.push(`  Note: ${deleteSummary.note}`);
    }
  }

  if (options.verbose) {
    if (report.warnings.length) {
      lines.push('');
      lines.push('Warnings:');
      for (const warning of report.warnings) {
        lines.push(`  ${warning}`);
      }
    }
    if (report.serverDynamicReserved.length) {
      lines.push('');
      lines.push('Server dynamic reserved:');
      for (const item of report.serverDynamicReserved.slice(0, 100)) {
        const enumText = item.enumMember
          ? `ETranslations.${item.enumMember}`
          : '';
        lines.push(
          `  ${item.key}${enumText ? ` (${enumText})` : ''} [${
            item.reservedBy
          }]`,
        );
      }
      if (report.serverDynamicReserved.length > 100) {
        lines.push(
          `  ... ${report.serverDynamicReserved.length - 100} more reserved keys`,
        );
      }
    }
    if (report.skippedLargeFiles.length) {
      lines.push('');
      lines.push('Skipped large files:');
      for (const file of report.skippedLargeFiles.slice(0, 50)) {
        lines.push(`  ${file.path} (${file.size} bytes)`);
      }
    }
  }

  return `${lines.join('\n')}\n`;
}

function formatReport(report, options) {
  if (options.format === 'json') {
    return `${JSON.stringify(report, null, 2)}\n`;
  }
  if (options.format === 'csv') {
    return formatCsv(report);
  }
  return formatTable(report, options);
}

function writeOutput(content, outputPath) {
  if (!outputPath) {
    process.stdout.write(content);
    return;
  }

  const resolved = path.isAbsolute(outputPath)
    ? outputPath
    : path.join(REPO_ROOT, outputPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, content);
  console.log(`Wrote ${toRepoPath(resolved)}`);
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const translations = loadTranslations();
    const { memberToKey } = loadEnumMembers();
    const keySet = new Set(Object.keys(translations));
    const { files, skipped } = walkFiles(options.roots, options);
    const { stats, usedKeys, warnings } = scanFiles(files, keySet, memberToKey);
    const report = buildReport({
      options,
      skipped,
      stats,
      translations,
      usedKeys,
      warnings,
    });
    await applyLokaliseDeleteIfRequested(report, options);
    const output = formatReport(report, options);
    writeOutput(output, options.output);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.error('Run `yarn i18n:unused --help` for usage.');
    process.exit(1);
  }
}

void main();
