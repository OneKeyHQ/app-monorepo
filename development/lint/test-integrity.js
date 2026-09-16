#!/usr/bin/env node
/**
 * Test integrity lint.
 *
 * Rejects tests that assert on the *text* of first-party source instead of
 * executing it. Such a test passes the moment it is written, fails on any
 * unrelated refactor, and can never fail for a real defect.
 *
 * Rules:
 *   source-text-assertion  read a first-party source file, assert on its text
 *   source-slice-eval      slice a first-party source file, eval the fragment
 *   missing-subject-import test loads no first-party module at all
 *
 * Usage:
 *   node development/lint/test-integrity.js            human report, exit 1 on violations
 *   node development/lint/test-integrity.js --json     machine readable report
 *   node development/lint/test-integrity.js --list     whole-file violations, one path per line
 */

const fs = require('node:fs');
const path = require('node:path');

const { parse } = require('@babel/parser');

const REPO_ROOT = path.resolve(__dirname, '../..');
const ALLOWLIST_PATH = path.join(__dirname, 'test-integrity.allowlist.json');

const TEST_FILE_RE = /\.(?:test|spec|node-test)\.(?:ts|tsx|js|jsx|mjs|cjs)$/u;
const SKIP_DIRECTORIES = new Set([
  '.cxx',
  '.expo',
  '.git',
  '.yarn',
  'Pods',
  'android',
  'build',
  'coverage',
  'dist',
  'ios',
  'node_modules',
]);

// A path literal naming first-party source. Build output and vendored code are
// legitimate read targets (supply-chain gates audit artifacts, not source).
const SCRIPT_PATH_RE = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/u;
// A JS test cannot execute these, so a text assertion is the only tool Jest has.
// Reported so the check can move to the native toolchain, but never gated.
const NATIVE_PATH_RE = /\.(?:kt|kts|swift|java|mm?|gradle|podspec|sh)$/u;
const ANY_EXTENSION_RE = /\.[A-Za-z0-9]{1,6}$/u;
const ARTIFACT_PATH_RE = /(?:^|\/)(?:node_modules|dist|build|out|\.next)\//u;
// A regex used to pick source files out of a directory listing.
const SOURCE_FILTER_RE = /\.\((?:\?:)?[a-z|]*(?:tsx?|jsx?)[a-z|]*\)/u;

// Cheap pre-filter so the parser only runs on files that could violate.
const SCANNABLE_SOURCE_RE = /readFileSync|readFile\s*\(|import |require\(/u;

const READ_FUNCTIONS = new Set(['readFileSync', 'readFile']);
const TEXT_MATCHERS = new Set([
  'toContain',
  'toContainEqual',
  'toMatch',
  'toEqual',
  'toBe',
  'toStrictEqual',
  'toHaveLength',
  // `expect(source.indexOf(a)).toBeLessThan(source.indexOf(b))` and
  // `expect(source.match(re)).toBeTruthy()` are the same assertion in disguise.
  'toBeTruthy',
  'toBeFalsy',
  'toBeDefined',
  'toBeUndefined',
  'toBeNull',
  'toBeGreaterThan',
  'toBeGreaterThanOrEqual',
  'toBeLessThan',
  'toBeLessThanOrEqual',
]);
const ASSERT_TEXT_METHODS = new Set(['match', 'doesNotMatch']);
const TAINT_PROPAGATORS = new Set([
  'slice',
  'substring',
  'substr',
  'match',
  'matchAll',
  'split',
  'trim',
  'replace',
  'replaceAll',
  'toString',
  'normalize',
  'at',
]);
const EVAL_FUNCTIONS = new Set([
  'runInNewContext',
  'runInThisContext',
  'runInContext',
  'transformSync',
  'transformFileSync',
  'transform',
]);

const TEST_BLOCK_NAMES = new Set(['it', 'test', 'fit', 'xit', 'xtest']);
// Reported for visibility but never fails the gate: script-level tests that
// drive a real subprocess legitimately load nothing first-party.
const ADVISORY_RULES = new Set([
  'missing-subject-import',
  'native-source-text-assertion',
]);
const NODE_BUILTIN_RE =
  /^(?:node:)?(?:assert|buffer|child_process|crypto|events|fs|http|https|net|os|path|process|readline|stream|timers|url|util|vm|worker_threads|zlib)(?:\/|$)/u;
const TEST_TOOLING_RE =
  /^(?:@babel\/|@jest\/|@swc\/|@testing-library\/|detox$|expect$|fast-glob$|glob$|jest|js-yaml$|supertest$|ts-morph$|typescript$|vitest|yaml$)/u;
const FIRST_PARTY_MODULE_RE = /^(?:\.{1,2}\/|@onekeyhq\/|@onekeyfe\/cli)/u;
// Every way a test can pull a module in, jest helpers included.
const MODULE_LOADERS = new Set([
  'require',
  'import',
  'requireActual',
  'mock',
  'requireMock',
  'resolve',
  'unmock',
]);

function loadAllowlist() {
  if (!fs.existsSync(ALLOWLIST_PATH)) {
    return [];
  }
  const parsed = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
  return Array.isArray(parsed.entries) ? parsed.entries : [];
}

function collectTestFiles(directory, collected) {
  let entries;
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return collected;
  }
  for (const entry of entries.filter((item) => !item.name.startsWith('.'))) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRECTORIES.has(entry.name)) {
        collectTestFiles(absolutePath, collected);
      }
    } else if (TEST_FILE_RE.test(entry.name)) {
      collected.push(absolutePath);
    }
  }
  return collected;
}

function parseSource(source) {
  return parse(source, {
    sourceType: 'unambiguous',
    allowReturnOutsideFunction: true,
    errorRecovery: true,
    plugins: ['typescript', 'jsx', 'classProperties', 'decorators-legacy'],
  });
}

const NON_CHILD_KEYS = new Set(['loc', 'leadingComments', 'trailingComments']);

function childKeys(node) {
  return Object.keys(node).filter((key) => !NON_CHILD_KEYS.has(key));
}

function walk(node, visit, parent) {
  if (!node || typeof node.type !== 'string') {
    return;
  }
  visit(node, parent);
  for (const key of childKeys(node)) {
    const value = node[key];
    if (Array.isArray(value)) {
      for (const child of value) {
        if (child && typeof child.type === 'string') {
          walk(child, visit, node);
        }
      }
    } else if (value && typeof value.type === 'string') {
      walk(value, visit, node);
    }
  }
}

function collectStringLiterals(node, collected = []) {
  walk(node, (current) => {
    if (current.type === 'StringLiteral') {
      collected.push(current.value);
    } else if (current.type === 'TemplateElement') {
      collected.push(current.value.cooked ?? current.value.raw ?? '');
    }
  });
  return collected;
}

function containsIdentifier(node, name) {
  let found = false;
  walk(node, (current) => {
    if (current.type === 'Identifier' && current.name === name) {
      found = true;
    }
  });
  return found;
}

function calleeName(callee) {
  if (!callee) {
    return undefined;
  }
  if (callee.type === 'Identifier') {
    return callee.name;
  }
  if (
    callee.type === 'MemberExpression' &&
    callee.property.type === 'Identifier'
  ) {
    return callee.property.name;
  }
  return undefined;
}

/**
 * Classify a read target: 'script' for first-party JS/TS the test could have
 * imported instead, 'native' for sources no JS runtime can execute, undefined
 * for build artifacts, data files and temp directories.
 */
function classifyReadTarget(callNode) {
  const pathArgument = callNode.arguments[0];
  if (!pathArgument) {
    return undefined;
  }
  const literals = collectStringLiterals(pathArgument).filter(Boolean);
  if (literals.some((literal) => ARTIFACT_PATH_RE.test(literal))) {
    return undefined;
  }
  if (literals.some((literal) => SCRIPT_PATH_RE.test(literal))) {
    return 'script';
  }
  if (literals.some((literal) => NATIVE_PATH_RE.test(literal))) {
    return 'native';
  }
  // A literal extension we do not police (.css, .yml, .json, .md) is data, not
  // source; asserting on it is a config contract, not a fake unit test.
  if (literals.some((literal) => ANY_EXTENSION_RE.test(literal))) {
    return undefined;
  }
  // `path.resolve(__dirname, fileFromTestTable)` reads a sibling of the test
  // file. Temp directories never resolve off `__dirname`.
  return containsIdentifier(pathArgument, '__dirname') ? 'script' : undefined;
}

/** Identifier at the root of a member/call chain, e.g. `source` in `source.slice(x).trim()`. */
function rootIdentifierName(node) {
  let current = node;
  while (current) {
    if (current.type === 'Identifier') {
      return current.name;
    }
    if (current.type === 'MemberExpression') {
      current = current.object;
    } else if (
      current.type === 'CallExpression' ||
      current.type === 'OptionalCallExpression'
    ) {
      current = current.callee;
    } else if (current.type === 'OptionalMemberExpression') {
      current = current.object;
    } else if (
      current.type === 'TSNonNullExpression' ||
      current.type === 'TSAsExpression'
    ) {
      current = current.expression;
    } else {
      return undefined;
    }
  }
  return undefined;
}

/** 'script' | 'native' | undefined for the source text a node carries. */
function taintKind(node, tainted) {
  if (!node) {
    return undefined;
  }
  const rootName = rootIdentifierName(node);
  if (rootName && tainted.has(rootName)) {
    return tainted.get(rootName);
  }
  if (node.type === 'TemplateLiteral') {
    for (const expression of node.expressions) {
      const kind = taintKind(expression, tainted);
      if (kind) {
        return kind;
      }
    }
  }
  if (node.type === 'AwaitExpression') {
    return taintKind(node.argument, tainted);
  }
  return undefined;
}

/** Binding name a value is assigned to, if any. */
function assignedName(node, parent) {
  if (parent?.type === 'VariableDeclarator' && parent.init === node) {
    return parent.id.type === 'Identifier' ? parent.id.name : undefined;
  }
  if (parent?.type === 'AssignmentExpression' && parent.right === node) {
    return parent.left.type === 'Identifier' ? parent.left.name : undefined;
  }
  return undefined;
}

function analyzeFile(absolutePath, source) {
  const relativePath = path
    .relative(REPO_ROOT, absolutePath)
    .split(path.sep)
    .join('/');
  const ast = parseSource(source);

  // `readdirSync` + a source-extension filter + `readFileSync` is a directory
  // walk over first-party source; the read path is then a variable, so the
  // per-call classifier alone cannot see it.
  const walksSourceTree =
    /\breaddirSync\b|\breaddir\b/u.test(source) &&
    /\breadFileSync\b|\breadFile\b/u.test(source) &&
    walksSource(ast);

  // Pass 1: taint every binding that holds first-party source text. Iterate to
  // a fixpoint so derived bindings (`const body = source.slice(a, b)`) follow.
  const tainted = new Map();
  for (let round = 0; round < 6; round += 1) {
    const before = tainted.size;
    walk(ast, (node, parent) => {
      if (
        node.type !== 'CallExpression' &&
        node.type !== 'OptionalCallExpression'
      ) {
        return;
      }
      const name = calleeName(node.callee);
      if (name && READ_FUNCTIONS.has(name)) {
        const kind =
          classifyReadTarget(node) ?? (walksSourceTree ? 'script' : undefined);
        if (kind) {
          const binding = assignedName(node, parent);
          if (binding) {
            tainted.set(binding, kind);
          }
        }
        return;
      }
      if (name && TAINT_PROPAGATORS.has(name)) {
        const kind = taintKind(node.callee, tainted);
        const binding = kind && assignedName(node, parent);
        if (binding) {
          tainted.set(binding, kind);
        }
      }
    });
    walk(ast, (node, parent) => {
      if (
        node.type === 'MemberExpression' ||
        node.type === 'AwaitExpression' ||
        node.type === 'TSNonNullExpression'
      ) {
        const kind = taintKind(node, tainted);
        const binding = kind && assignedName(node, parent);
        if (binding) {
          tainted.set(binding, kind);
        }
      }
    });
    if (tainted.size === before) {
      break;
    }
  }

  // Pass 2: locate assertions and eval sinks fed by tainted text, and record
  // which `it()` block each one sits in so partial files can be fixed in place.
  const violations = [];
  const testBlocks = [];
  const blockStack = [];

  let sharedSetupViolation = false;
  const record = (rule, node, message) => {
    violations.push({
      rule,
      file: relativePath,
      line: node.loc?.start.line ?? 0,
      block: blockStack.length
        ? blockStack[blockStack.length - 1].title
        : undefined,
      message,
    });
    if (blockStack.length) {
      blockStack[blockStack.length - 1].violated = true;
    } else if (!ADVISORY_RULES.has(rule)) {
      // Outside any test block: shared setup every test in the file depends on.
      sharedSetupViolation = true;
    }
  };

  const visit = (node) => {
    if (
      node.type === 'CallExpression' ||
      node.type === 'OptionalCallExpression'
    ) {
      const name = calleeName(node.callee);

      if (isTestBlock(node)) {
        const titleNode = node.arguments[0];
        const title =
          titleNode?.type === 'StringLiteral'
            ? titleNode.value
            : collectStringLiterals(titleNode ?? {}).join(' ') ||
              '(dynamic title)';
        const block = {
          title,
          line: node.loc?.start.line ?? 0,
          violated: false,
        };
        testBlocks.push(block);
        blockStack.push(block);
        for (const key of childKeys(node)) {
          const value = node[key];
          if (Array.isArray(value)) {
            for (const child of value) {
              if (child && typeof child.type === 'string') {
                visitTree(child);
              }
            }
          } else if (value && typeof value.type === 'string') {
            visitTree(value);
          }
        }
        blockStack.pop();
        return false;
      }

      // expect(<tainted>).toContain(...) / .not.toMatch(...)
      if (name && TEXT_MATCHERS.has(name)) {
        const expectCall = findExpectCall(node.callee);
        const kind = expectCall
          ? expectCall.arguments.map((a) => taintKind(a, tainted)).find(Boolean)
          : undefined;
        if (kind) {
          record(
            kind === 'native'
              ? 'native-source-text-assertion'
              : 'source-text-assertion',
            node,
            `expect(...).${name}() asserts on the text of a ${kind} source file`,
          );
        }
      }

      // assert.match(<tainted>, /.../)
      if (
        name &&
        ASSERT_TEXT_METHODS.has(name) &&
        node.callee.type === 'MemberExpression'
      ) {
        const kind = taintKind(node.arguments[0], tainted);
        if (kind) {
          record(
            kind === 'native'
              ? 'native-source-text-assertion'
              : 'source-text-assertion',
            node,
            `assert.${name}() asserts on the text of a ${kind} source file`,
          );
        }
      }

      // vm.runInNewContext(<tainted>) / transformSync(<tainted>)
      if (name && EVAL_FUNCTIONS.has(name)) {
        const kind = node.arguments
          .map((a) => taintKind(a, tainted))
          .find(Boolean);
        if (kind === 'script') {
          record(
            'source-slice-eval',
            node,
            `${name}() evaluates a fragment sliced out of a source file`,
          );
        }
      }
    }
    return true;
  };

  function visitTree(node) {
    if (!node || typeof node.type !== 'string') {
      return;
    }
    if (visit(node) === false) {
      return;
    }
    for (const key of childKeys(node)) {
      const value = node[key];
      if (Array.isArray(value)) {
        for (const child of value) {
          if (child && typeof child.type === 'string') {
            visitTree(child);
          }
        }
      } else if (value && typeof value.type === 'string') {
        visitTree(value);
      }
    }
  }

  visitTree(ast);

  if (!collectsFirstPartyModule(ast)) {
    violations.push({
      rule: 'missing-subject-import',
      file: relativePath,
      line: 1,
      message:
        'test loads no first-party module, so it cannot execute the code it claims to cover',
    });
  }

  const blockingViolations = violations.filter(
    (violation) => !ADVISORY_RULES.has(violation.rule),
  );
  const violatedBlocks = testBlocks.filter((block) => block.violated).length;
  const wholeFile =
    blockingViolations.length > 0 &&
    (sharedSetupViolation ||
      (testBlocks.length > 0 && violatedBlocks === testBlocks.length));

  return { file: relativePath, violations, testBlocks, wholeFile };
}

/** Does the AST contain a regex that selects first-party source files? */
function walksSource(ast) {
  let found = false;
  walk(ast, (node) => {
    if (node.type === 'RegExpLiteral' && SOURCE_FILTER_RE.test(node.pattern)) {
      found = true;
    }
  });
  return found;
}

/**
 * `it(...)`, `it.only(...)`, `it.each(table)(...)` and the tagged-template form.
 * Anchored on the *object* so `/re/.test(x)` is never mistaken for a test block.
 */
function isTestBlock(node) {
  const callee = node.callee;
  if (callee?.type === 'Identifier') {
    return TEST_BLOCK_NAMES.has(callee.name);
  }
  let member;
  if (callee?.type === 'MemberExpression') {
    member = callee;
  } else if (callee?.type === 'CallExpression') {
    member = callee.callee;
  } else if (callee?.type === 'TaggedTemplateExpression') {
    member = callee.tag;
  }
  if (member?.type !== 'MemberExpression') {
    return false;
  }
  return (
    member.object.type === 'Identifier' &&
    TEST_BLOCK_NAMES.has(member.object.name)
  );
}

function findExpectCall(node) {
  let current = node;
  while (current) {
    if (
      current.type === 'MemberExpression' ||
      current.type === 'OptionalMemberExpression'
    ) {
      current = current.object;
    } else if (
      current.type === 'CallExpression' ||
      current.type === 'OptionalCallExpression'
    ) {
      if (calleeName(current.callee) === 'expect') {
        return current;
      }
      current = current.callee;
    } else {
      return undefined;
    }
  }
  return undefined;
}

/** Does the test load anything first-party — statically, dynamically or via jest? */
function collectsFirstPartyModule(ast) {
  let found = false;
  walk(ast, (node) => {
    if (found) {
      return;
    }
    let specifier;
    if (node.type === 'ImportDeclaration') {
      specifier = node.source.value;
    } else if (
      (node.type === 'CallExpression' ||
        node.type === 'OptionalCallExpression') &&
      MODULE_LOADERS.has(calleeName(node.callee) ?? '') &&
      node.arguments[0]?.type === 'StringLiteral'
    ) {
      specifier = node.arguments[0].value;
    } else if (node.type === 'Import') {
      return;
    }
    if (!specifier) {
      return;
    }
    if (NODE_BUILTIN_RE.test(specifier) || TEST_TOOLING_RE.test(specifier)) {
      return;
    }
    if (FIRST_PARTY_MODULE_RE.test(specifier)) {
      found = true;
    }
  });
  return found;
}

function isAllowed(allowlist, file, rule) {
  return allowlist.some((entry) => entry.file === file && entry.rule === rule);
}

function analyzeOne(absolutePath, allowlist) {
  const source = fs.readFileSync(absolutePath, 'utf8');
  if (!SCANNABLE_SOURCE_RE.test(source)) {
    return undefined;
  }
  const relativePath = path
    .relative(REPO_ROOT, absolutePath)
    .split(path.sep)
    .join('/');
  let result;
  try {
    result = analyzeFile(absolutePath, source);
  } catch (error) {
    return {
      file: relativePath,
      parseError: error.message,
      violations: [],
      testBlocks: [],
      wholeFile: false,
    };
  }
  result.violations = result.violations.filter(
    (violation) => !isAllowed(allowlist, result.file, violation.rule),
  );
  return result.violations.length ? result : undefined;
}

function run() {
  const allowlist = loadAllowlist();
  const files = collectTestFiles(REPO_ROOT, []);
  const results = files
    .map((absolutePath) => analyzeOne(absolutePath, allowlist))
    .filter(Boolean);
  const failing = results.filter((result) =>
    result.violations.some((violation) => !ADVISORY_RULES.has(violation.rule)),
  );
  const advisory = results.filter((result) => !failing.includes(result));
  return { scanned: files.length, results: failing, advisory };
}

function main() {
  const flags = new Set(process.argv.slice(2));
  const { scanned, results, advisory } = run();

  if (flags.has('--json')) {
    process.stdout.write(
      `${JSON.stringify({ scanned, results, advisory }, null, 2)}\n`,
    );
    process.exitCode = results.length ? 1 : 0;
    return;
  }

  if (flags.has('--list')) {
    for (const result of results.filter((entry) => entry.wholeFile)) {
      process.stdout.write(`${result.file}\n`);
    }
    return;
  }

  if (!results.length) {
    process.stdout.write(
      `Test integrity check passed (${scanned} test files).\n`,
    );
    return;
  }

  const lines = [
    `Test integrity check failed: ${results.length} of ${scanned} test file(s) assert on source text.`,
    '',
  ];
  for (const result of results) {
    lines.push(
      `${result.file}${result.wholeFile ? '  [whole file]' : '  [partial]'}`,
    );
    for (const violation of result.violations.filter(
      (v) => !ADVISORY_RULES.has(v.rule),
    )) {
      lines.push(
        `  ${result.file}:${violation.line}  ${violation.rule}`,
        `    ${violation.message}${violation.block ? ` (in "${violation.block}")` : ''}`,
      );
    }
    lines.push('');
  }
  const advisoryCount =
    advisory.length +
    results.filter((result) =>
      result.violations.some((v) => ADVISORY_RULES.has(v.rule)),
    ).length;
  if (advisoryCount) {
    lines.push(
      `Advisory (not gated): ${advisoryCount} test file(s) load no first-party module,`,
      'or assert on native source Jest cannot execute. Run with --json to list them.',
      '',
    );
  }
  lines.push(
    'A test must execute the code under test. If the unit is unreachable, export it',
    'from a sibling module and test it for real -- or write no test and say so.',
    'Genuine exceptions go in development/lint/test-integrity.allowlist.json with a reason.',
    '',
  );
  process.stderr.write(lines.join('\n'));
  process.exitCode = 1;
}

module.exports = { analyzeFile, collectTestFiles, run };

if (require.main === module) {
  main();
}
