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
  // Position and predicate methods carry the same claim about the source text,
  // just reduced to a number or a boolean. `const i = source.indexOf(x)` and
  // then `expect(i).toBeLessThan(j)` is the inline offset comparison spread
  // over three statements.
  'indexOf',
  'lastIndexOf',
  'search',
  'includes',
  'startsWith',
  'endsWith',
  'test',
  'exec',
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
// Only a gated rule can be exempted; an advisory one never fails anything.
const GATED_RULES = new Set(['source-text-assertion', 'source-slice-eval']);
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
  const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
  entries.forEach((entry, index) => {
    const label = `entries[${index}]`;
    if (typeof entry.file !== 'string' || !entry.file) {
      throw new Error(`${label} needs a "file".`);
    }
    if (!GATED_RULES.has(entry.rule)) {
      throw new Error(
        `${label} rule must be one of: ${[...GATED_RULES].join(', ')}`,
      );
    }
    if (entry.block !== null && typeof entry.block !== 'string') {
      throw new Error(
        `${label} needs a "block": the exact it()/test() title, or null for a violation in shared setup.`,
      );
    }
    if (typeof entry.reason !== 'string' || entry.reason.trim().length < 40) {
      throw new Error(
        `${label} needs a "reason" saying why no runtime assertion can replace it.`,
      );
    }
  });
  return entries;
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
function classifyReadTarget(callNode, repoAnchored) {
  const pathArgument = callNode.arguments[0];
  if (!pathArgument) {
    return undefined;
  }
  // A checked-in file is always reached from `__dirname`. A path built from a
  // temp directory or a fixture root is something the test itself produced, so
  // reading it is not a source-text assertion however the file is named.
  if (!isRepoAnchored(pathArgument, repoAnchored)) {
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

/** 'script' | 'native' | undefined for the source text a node carries. */
function taintKind(node, tainted, readKind) {
  if (!node) {
    return undefined;
  }
  switch (node.type) {
    case 'Identifier':
      return tainted.get(node.name);
    case 'AwaitExpression':
      return taintKind(node.argument, tainted, readKind);
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
    case 'ParenthesizedExpression':
      return taintKind(node.expression, tainted, readKind);
    case 'MemberExpression':
    case 'OptionalMemberExpression':
      return taintKind(node.object, tainted, readKind);
    case 'TemplateLiteral':
      return firstTaint(node.expressions, tainted, readKind);
    case 'CallExpression':
    case 'OptionalCallExpression': {
      const name = calleeName(node.callee);
      if (name && READ_FUNCTIONS.has(name)) {
        return readKind ? readKind(node) : undefined;
      }
      if (name && TAINT_PROPAGATORS.has(name)) {
        const receiver =
          node.callee.type === 'MemberExpression' ||
          node.callee.type === 'OptionalMemberExpression'
            ? node.callee.object
            : undefined;
        // `source.indexOf(x)` taints through the receiver, `/re/.test(source)`
        // through the argument; both are claims about the same text.
        return (
          taintKind(receiver, tainted, readKind) ??
          firstTaint(node.arguments, tainted, readKind)
        );
      }
      if (node.callee.type === 'Identifier' && name === 'String') {
        return taintKind(node.arguments[0], tainted, readKind);
      }
      return undefined;
    }
    default:
      return undefined;
  }
}

function firstTaint(nodes, tainted, readKind) {
  for (const node of nodes ?? []) {
    const kind = taintKind(node, tainted, readKind);
    if (kind) {
      return kind;
    }
  }
  return undefined;
}

const PATH_BUILDERS = new Set(['join', 'resolve', 'normalize']);

/** Is this path expression rooted at the checked-in tree rather than a temp dir? */
function isRepoAnchored(node, repoAnchored) {
  if (!node) {
    return false;
  }
  if (node.type === 'Identifier') {
    return node.name === '__dirname' || repoAnchored.has(node.name);
  }
  if (
    node.type === 'CallExpression' ||
    node.type === 'OptionalCallExpression'
  ) {
    const name = calleeName(node.callee);
    return (
      Boolean(name) &&
      PATH_BUILDERS.has(name) &&
      node.arguments.some((argument) => isRepoAnchored(argument, repoAnchored))
    );
  }
  if (node.type === 'TemplateLiteral') {
    return node.expressions.some((expression) =>
      isRepoAnchored(expression, repoAnchored),
    );
  }
  return false;
}

/** Bindings that hold a path into the checked-in tree, to a fixpoint. */
function collectRepoAnchoredBindings(ast) {
  const anchored = new Set();
  for (let round = 0; round < 6; round += 1) {
    const before = anchored.size;
    walk(ast, (node) => {
      const binding = bindingTarget(node);
      if (binding && isRepoAnchored(binding.value, anchored)) {
        anchored.add(binding.name);
      }
    });
    if (anchored.size === before) {
      return anchored;
    }
  }
  return anchored;
}

/** The name and initializer of a binding, for `const x = ...` and `x = ...`. */
function bindingTarget(node) {
  if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') {
    return node.init ? { name: node.id.name, value: node.init } : undefined;
  }
  if (node.type === 'AssignmentExpression' && node.left.type === 'Identifier') {
    return { name: node.left.name, value: node.right };
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

  const repoAnchored = collectRepoAnchoredBindings(ast);
  const readKind = (callNode) =>
    classifyReadTarget(callNode, repoAnchored) ??
    (walksSourceTree ? 'script' : undefined);

  // Pass 1: taint every binding that holds first-party source text. Seeding
  // walks down from each binding rather than up from each read, so the read can
  // sit anywhere inside the initializer -- behind an await, a cast, an optional
  // chain, or a string method. Iterate to a fixpoint so derived bindings
  // (`const body = source.slice(a, b)`) follow.
  const tainted = new Map();
  for (let round = 0; round < 6; round += 1) {
    const before = tainted.size;
    walk(ast, (node) => {
      const binding = bindingTarget(node);
      if (!binding) {
        return;
      }
      const kind = taintKind(binding.value, tainted, readKind);
      if (kind) {
        tainted.set(binding.name, kind);
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
    if (ADVISORY_RULES.has(rule)) {
      // An advisory hit is never a reason to delete anything, so it must not
      // feed the whole-file verdict that --list drives.
      return;
    }
    if (blockStack.length) {
      blockStack[blockStack.length - 1].violated = true;
    } else {
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
          ? expectCall.arguments
              .map((a) => taintKind(a, tainted, readKind))
              .find(Boolean)
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
        const kind = taintKind(node.arguments[0], tainted, readKind);
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
          .map((a) => taintKind(a, tainted, readKind))
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

/**
 * An entry exempts one reviewed violation, identified by the test block it sits
 * in, so a later assertion added to the same file is still gated. `block: null`
 * means the violation is in shared setup outside any test block.
 */
function matchingEntry(allowlist, file, violation) {
  return allowlist.find(
    (entry) =>
      entry.file === file &&
      entry.rule === violation.rule &&
      (entry.block ?? null) === (violation.block ?? null),
  );
}

function analyzeOne(absolutePath, allowlist, usedEntries) {
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
  result.violations = result.violations.filter((violation) => {
    const entry = matchingEntry(allowlist, result.file, violation);
    if (entry) {
      usedEntries.add(entry);
      return false;
    }
    return true;
  });
  return result.violations.length ? result : undefined;
}

function run() {
  const allowlist = loadAllowlist();
  const usedEntries = new Set();
  const files = collectTestFiles(REPO_ROOT, []);
  const results = files
    .map((absolutePath) => analyzeOne(absolutePath, allowlist, usedEntries))
    .filter(Boolean);
  const failing = results.filter((result) =>
    result.violations.some((violation) => !ADVISORY_RULES.has(violation.rule)),
  );
  const advisory = results.filter((result) => !failing.includes(result));
  // An entry that no longer matches anything is an exemption nobody reviewed
  // for the code that is there now; it must be removed rather than linger.
  const staleEntries = allowlist.filter((entry) => !usedEntries.has(entry));
  return { scanned: files.length, results: failing, advisory, staleEntries };
}

function main() {
  const flags = new Set(process.argv.slice(2));
  const { scanned, results, advisory, staleEntries } = run();

  if (flags.has('--json')) {
    process.stdout.write(
      `${JSON.stringify({ scanned, results, advisory, staleEntries }, null, 2)}\n`,
    );
    process.exitCode = results.length || staleEntries.length ? 1 : 0;
    return;
  }

  if (flags.has('--list')) {
    for (const result of results.filter((entry) => entry.wholeFile)) {
      process.stdout.write(`${result.file}\n`);
    }
    return;
  }

  if (!results.length && !staleEntries.length) {
    process.stdout.write(
      `Test integrity check passed (${scanned} test files).\n`,
    );
    return;
  }

  const lines = results.length
    ? [
        `Test integrity check failed: ${results.length} of ${scanned} test file(s) assert on source text.`,
        '',
      ]
    : ['Test integrity check failed.', ''];
  for (const entry of staleEntries) {
    lines.push(
      `${entry.file}  [stale allowlist entry]`,
      `    No ${entry.rule} remains in ${entry.block === null ? 'shared setup' : `"${entry.block}"`}. Remove the entry.`,
      '',
    );
  }
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
