#!/usr/bin/env node
/* cspell:words quasis pbxproj combinators */
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
const { NodePath } = require('@babel/traverse');

const REPO_ROOT = path.resolve(__dirname, '../..');
const ALLOWLIST_PATH = path.join(__dirname, 'test-integrity.allowlist.json');

const TEST_FILE_RE = /\.(?:test|spec|node-test)\.(?:ts|tsx|js|jsx|mjs|cjs)$/u;
const SKIP_DIRECTORIES = new Set([
  '.cxx',
  '.expo',
  '.git',
  '.yarn',
  'Pods',
  'build',
  'coverage',
  'dist',
  'node_modules',
  // Generated mobile bundle output, gitignored.
  'out-dir-bundle',
]);
// `ios` and `android` are skipped only when they are native project roots,
// which is where the cost is. A JavaScript directory that happens to use one
// of those names is scanned like any other.
const PLATFORM_DIRECTORY_NAMES = new Set(['ios', 'android']);
const NATIVE_PROJECT_MARKERS = new Set([
  'Podfile',
  'build.gradle',
  'build.gradle.kts',
  'settings.gradle',
  'settings.gradle.kts',
  'gradlew',
]);

function isNativeProjectRoot(directory) {
  let names;
  try {
    names = fs.readdirSync(directory);
  } catch {
    return false;
  }
  return names.some(
    (name) =>
      NATIVE_PROJECT_MARKERS.has(name) ||
      name.endsWith('.xcodeproj') ||
      name.endsWith('.xcworkspace'),
  );
}

// A path literal naming first-party source. Build output and vendored code are
// legitimate read targets (supply-chain gates audit artifacts, not source).
const SCRIPT_PATH_RE = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/u;
// A JS test cannot execute these, so a text assertion is the only tool Jest has.
// Reported so the check can move to the native toolchain, but never gated.
const NATIVE_PATH_RE = /\.(?:kt|kts|swift|java|mm?|gradle|podspec|sh)$/u;
// Any dotted final segment, so `.text-js`, `.pbxproj` and `.gitignore` are
// treated as data rather than falling through as unextended source.
const ANY_EXTENSION_RE = /\.[A-Za-z0-9_-]{1,12}$/u;
// Matches a trailing segment too, so a directory that merely ends in
// `node_modules` counts as an artifact root.
const ARTIFACT_PATH_RE =
  /(?:^|\/)(?:node_modules|dist|build|out|\.next)(?:\/|$)/u;
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
  // Object-shaped assertions are still assertions about the values inside.
  'toMatchObject',
  'toHaveProperty',
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
// Where assertion functions are imported from, however they are renamed.
const ASSERT_MODULE_RE = /^(?:node:)?assert(?:\/strict)?$/u;
const EXPECT_MODULE_RE = /^(?:@jest\/globals|expect|vitest)$/u;
// node:assert, used by the *.node-test.js files this check also scans.
const ASSERT_TEXT_METHODS = new Set([
  'match',
  'doesNotMatch',
  'ok',
  'equal',
  'notEqual',
  'strictEqual',
  'notStrictEqual',
  'deepEqual',
  'notDeepEqual',
  'deepStrictEqual',
  'notDeepStrictEqual',
]);
// Methods that take the source text as an argument rather than a receiver.
// Every other method propagates from its receiver, whatever it is named.
const ARGUMENT_PROPAGATORS = new Set(['test', 'exec', 'replace', 'replaceAll']);
// `Promise.all([read(a), read(b)])` settles with the texts it was handed.
const PROMISE_COMBINATORS = new Set(['all', 'allSettled', 'any', 'race']);
// Iteration methods whose result is decided by what the callback saw. A read
// inside the callback is still a claim about that text, wherever the assertion
// finally lands. Each maps to the callback parameters that receive the
// receiver's text: the element and the array, and a reducer's accumulator.
const CALLBACK_PROPAGATORS = new Map([
  ['filter', [0, 2]],
  ['map', [0, 2]],
  ['flatMap', [0, 2]],
  ['some', [0, 2]],
  ['every', [0, 2]],
  ['find', [0, 2]],
  ['findIndex', [0, 2]],
  ['findLast', [0, 2]],
  ['findLastIndex', [0, 2]],
  ['reduce', [0, 1, 3]],
  ['reduceRight', [0, 1, 3]],
  ['sort', [0, 1]],
  ['forEach', [0, 2]],
]);
// These cannot cut a fragment out, so they leave a whole read whole. `replace`
// is deliberately absent: a regex replace is one of the ways to cut.
const WHOLE_PRESERVING_METHODS = new Set([
  'toString',
  'valueOf',
  'trim',
  'trimStart',
  'trimEnd',
  'normalize',
]);
// Cutting a fragment out of a file is what makes an eval a reconstruction of a
// unit that could not be imported. Evaluating a whole file is a different
// thing: a text artifact shipped to another runtime, checked by running it.
const EVAL_FUNCTIONS = new Set([
  'runInNewContext',
  'runInThisContext',
  'runInContext',
  'transformSync',
  'transformFileSync',
  'transform',
  // The rest of the vm surface: `new vm.Script(code)` and
  // `vm.compileFunction(code)` run text just as `runInNewContext` does.
  'Script',
  'compileFunction',
  // Direct evaluation, with or without a vm. `new Function(...)` reaches here
  // as a NewExpression, which the sink handles alongside calls.
  'eval',
  'Function',
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
    if (!Number.isInteger(entry.count) || entry.count < 1) {
      throw new Error(
        `${label} needs a "count": how many violations were reviewed, so a new one added to the same block is still reported.`,
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
      const skipped =
        SKIP_DIRECTORIES.has(entry.name) ||
        (PLATFORM_DIRECTORY_NAMES.has(entry.name) &&
          isNativeProjectRoot(absolutePath));
      if (!skipped) {
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

// Babel reports a redeclared name through the hub it is given, and without one
// it fails with a TypeError about the missing hub instead. A redeclaration
// makes the file invalid, so it is reported the way any parse error is.
const SYNTAX_ERROR_HUB = {
  getCode() {},
  getScope() {},
  addHelper() {
    throw new Error('test-integrity reads code; it never adds helpers');
  },
  buildError: (_node, message) => new SyntaxError(message),
};

// Every identifier that names a variable, mapped to the binding it resolves
// to. Taint, path anchoring and helpers are all keyed by binding, so two
// variables that happen to share a name never share a verdict. Keyed by node,
// so nothing needs resetting between files.
const bindingByIdentifier = new WeakMap();

function bindingOf(node) {
  return node?.type === 'Identifier'
    ? bindingByIdentifier.get(node)
    : undefined;
}

function resolveBindings(ast) {
  const program = NodePath.get({
    hub: SYNTAX_ERROR_HUB,
    parentPath: null,
    parent: ast,
    container: ast,
    key: 'program',
  }).setContext();
  // A name nothing declares is one global, however many places use it.
  const globals = new Map();
  program.traverse({
    Identifier(identifierPath) {
      if (
        !identifierPath.isReferencedIdentifier() &&
        !identifierPath.isBindingIdentifier()
      ) {
        return;
      }
      const { node, parent } = identifierPath;
      // A function declaration's name belongs to the scope around it. Looked
      // up from the function itself, a parameter of the same name would win.
      const scope =
        parent.type === 'FunctionDeclaration' && parent.id === node
          ? identifierPath.parentPath.scope.parent
          : identifierPath.scope;
      let binding = scope.getBinding(node.name);
      if (!binding) {
        if (!globals.has(node.name)) {
          globals.set(node.name, { global: node.name });
        }
        binding = globals.get(node.name);
      }
      bindingByIdentifier.set(node, binding);
    },
  });
}

// Some values hold text the way a variable does without being one: what a
// constructed promise settles with, what a named function returns, and what is
// stored under a property of a variable. Each gets a stable key of its own, so
// definitions taint it exactly as they taint a binding.
const SETTLED_VALUES = new WeakMap();
const RETURNED_VALUES = new WeakMap();
const STORED_VALUES = new WeakMap();

function derivedKey(keys, owner, name) {
  if (!owner || name === undefined) {
    return undefined;
  }
  if (!keys.has(owner)) {
    keys.set(owner, new Map());
  }
  const byName = keys.get(owner);
  if (!byName.has(name)) {
    byName.set(name, { derivedFrom: owner, name });
  }
  return byName.get(name);
}

/** The key for what `new Promise(...)` settles with. */
function settledKey(node) {
  return derivedKey(SETTLED_VALUES, node, 'settled');
}

/** The key for what a call to the function bound as `binding` returns. */
function returnedKey(binding) {
  return derivedKey(RETURNED_VALUES, binding, 'returned');
}

/** The key for what the variable bound as `owner` stores under `name`. */
function propertyKey(owner, name) {
  return derivedKey(STORED_VALUES, owner, name);
}

/**
 * `ctx.source`, `ctx['source']`, `files[0]` and `load().source`: the key for
 * what that property of that owner holds.
 */
function storedKey(node) {
  if (
    node?.type !== 'MemberExpression' &&
    node?.type !== 'OptionalMemberExpression'
  ) {
    return undefined;
  }
  return propertyKey(ownerKey(node.object), staticName(node.property, node));
}

/**
 * What properties can be recorded against: a variable, a property of one
 * (`results[1].value`), or what a call to a named function returns, awaited
 * or not.
 */
function ownerKey(node) {
  switch (node?.type) {
    case 'Identifier':
      return bindingOf(node);
    case 'MemberExpression':
    case 'OptionalMemberExpression':
      return storedKey(node);
    case 'AwaitExpression':
      return ownerKey(node.argument);
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
    case 'ParenthesizedExpression':
      return ownerKey(node.expression);
    case 'CallExpression':
    case 'OptionalCallExpression':
      return node.callee.type === 'Identifier'
        ? returnedKey(bindingOf(node.callee))
        : undefined;
    default:
      return undefined;
  }
}

/** The name a property key or member access spells out, if it is static. */
function staticName(key, container) {
  if (key.type === 'StringLiteral') {
    return key.value;
  }
  if (key.type === 'NumericLiteral') {
    return String(key.value);
  }
  return key.type === 'Identifier' && !container.computed
    ? key.name
    : undefined;
}

function holdsWholeFile(key, tainted, fragments) {
  return tainted.has(key) && !fragments.has(key);
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

function calleeName(callee) {
  if (!callee) {
    return undefined;
  }
  if (callee.type === 'Identifier') {
    return callee.name;
  }
  // `(0, eval)(code)`, the standard way to reach indirect eval.
  if (callee.type === 'SequenceExpression') {
    return calleeName(callee.expressions.at(-1));
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
/**
 * Classify a path expression on its own, wherever it was written. `callSite`
 * carries what a wrapper's caller contributes: the literals of the argument it
 * passed, and whether that argument names the file outright.
 */
function classifyPath(pathArgument, repoAnchored, anchoredHelpers, callSite) {
  if (!pathArgument) {
    return undefined;
  }
  // A checked-in file is always reached from `__dirname`. A path built from a
  // temp directory or a fixture root is something the test itself produced, so
  // reading it is not a source-text assertion however the file is named.
  // When a wrapper's caller supplies the head of the path, only the caller can
  // say where that path starts; the parameter name in the template says nothing.
  const anchored = callSite?.headIsParameter
    ? callSite.anchored
    : isRepoAnchored(pathArgument, repoAnchored, anchoredHelpers);
  if (!anchored) {
    return undefined;
  }
  const literals = [
    ...(callSite?.literals ?? []),
    ...pathLiterals(pathArgument, repoAnchored),
  ];
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
  // No extension to go on. Only two shapes still say "source": a sibling of the
  // test file named by a variable, and a module specifier. Anything else
  // anchored but unextended is left alone.
  // A wrapper's tail is whatever its caller passed, not the parameter name.
  if (callSite && !callSite.endsInVariable) {
    return undefined;
  }
  return namesUnextendedSource(pathArgument, literals, repoAnchored)
    ? 'script'
    : undefined;
}

/**
 * 'script' | 'native' | undefined for the source text a node carries.
 * `tainted` maps a binding to the kind of source it can hold; `calls` says how
 * a call relates to source text (see analyzeFile).
 */
function taintKind(node, tainted, calls) {
  if (!node) {
    return undefined;
  }
  switch (node.type) {
    case 'Identifier':
      return tainted.get(bindingOf(node));
    case 'AwaitExpression':
      return taintKind(node.argument, tainted, calls);
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
    case 'ParenthesizedExpression':
      return taintKind(node.expression, tainted, calls);
    case 'MemberExpression':
    case 'OptionalMemberExpression': {
      const stored = storedKey(node);
      // A property an object or array literal spells out holds what it was
      // given and nothing else, so `ctx.count` is not source because
      // `ctx.source` is. A property only ever assigned may still hold whatever
      // the rest of its owner does.
      if (stored?.fromLiteral) {
        return tainted.get(stored);
      }
      return (
        (stored?.defined ? tainted.get(stored) : undefined) ??
        taintKind(node.object, tainted, calls)
      );
    }
    case 'TemplateLiteral':
      return firstTaint(node.expressions, tainted, calls);
    case 'BinaryExpression':
      return node.operator === '+'
        ? firstTaint([node.left, node.right], tainted, calls)
        : undefined;
    case 'UnaryExpression':
      // `expect(!source.includes(x))` is still a claim about source.
      return node.operator === '!'
        ? taintKind(node.argument, tainted, calls)
        : undefined;
    case 'LogicalExpression':
      return firstTaint([node.left, node.right], tainted, calls);
    case 'ConditionalExpression':
      return firstTaint([node.consequent, node.alternate], tainted, calls);
    case 'ArrayExpression':
      return firstTaint(node.elements, tainted, calls);
    case 'ObjectExpression':
      // `{ text: read(...) }` and `{ source }` hold source text as a value.
      return firstTaint(
        node.properties.map((property) =>
          property.type === 'SpreadElement'
            ? property.argument
            : property.value,
        ),
        tainted,
        calls,
      );
    case 'SpreadElement':
      return taintKind(node.argument, tainted, calls);
    case 'SequenceExpression':
      return taintKind(node.expressions.at(-1), tainted, calls);
    case 'NewExpression':
      // `new Promise(...)` holds whatever its executor resolves it with.
      return tainted.get(settledKey(node));
    case 'CallExpression':
    case 'OptionalCallExpression': {
      const fromRead = calls.readKind(node);
      if (fromRead) {
        return fromRead;
      }
      // `normalize(source)` hands its argument's text back, reworked.
      const transformed = calls.transform(node);
      const handedBack =
        transformed && taintKind(transformed.argument, tainted, calls);
      if (handedBack) {
        return handedBack;
      }
      // `loadBody()` hands back whatever its own returns carry.
      const returned = tainted.get(returnedKey(bindingOf(node.callee)));
      if (returned) {
        return returned;
      }
      const name = calleeName(node.callee);
      if (
        node.callee.type === 'MemberExpression' ||
        node.callee.type === 'OptionalMemberExpression'
      ) {
        // Any method called on source text keeps the claim about that text
        // alive, whatever it is named: .slice, .indexOf, .split().filter().
        const fromReceiver = taintKind(node.callee.object, tainted, calls);
        if (fromReceiver) {
          return fromReceiver;
        }
        // `/re/.test(source)` and `x.replace(source, y)` carry the text in an
        // argument instead, as do the Promise combinators; no other method is
        // assumed to.
        if (
          name &&
          (ARGUMENT_PROPAGATORS.has(name) ||
            (PROMISE_COMBINATORS.has(name) &&
              node.callee.object.type === 'Identifier' &&
              node.callee.object.name === 'Promise'))
        ) {
          return firstTaint(node.arguments, tainted, calls);
        }
        // `files.filter((f) => readFileSync(f).includes(x))` decides its result
        // from source text even though nothing tainted was passed in.
        if (name && CALLBACK_PROPAGATORS.has(name)) {
          return node.arguments
            .map((argument) => callbackBodyTaint(argument, tainted, calls))
            .find(Boolean);
        }
        return undefined;
      }
      if (node.callee.type === 'Identifier' && name === 'String') {
        return taintKind(node.arguments[0], tainted, calls);
      }
      return undefined;
    }
    default:
      return undefined;
  }
}

/**
 * Is this the unmodified contents of one file? Defined this way round on
 * purpose: every other shape - a slice, a regex replace, a join of matches -
 * is a fragment, and enumerating the ways to cut a string up is a losing game.
 * `fragments` holds the bindings that can hold less than a whole file.
 */
function isWholeFileRead(node, tainted, fragments, calls) {
  if (!node) {
    return false;
  }
  const partsAreWhole = (parts) =>
    parts.every(
      (part) =>
        !taintKind(part, tainted, calls) ||
        isWholeFileRead(part, tainted, fragments, calls),
    );
  switch (node.type) {
    case 'Identifier':
      return holdsWholeFile(bindingOf(node), tainted, fragments);
    case 'NewExpression':
      return holdsWholeFile(settledKey(node), tainted, fragments);
    case 'MemberExpression':
    case 'OptionalMemberExpression': {
      const stored = storedKey(node);
      return (
        Boolean(stored?.defined) && holdsWholeFile(stored, tainted, fragments)
      );
    }
    case 'AwaitExpression':
      return isWholeFileRead(node.argument, tainted, fragments, calls);
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
    case 'ParenthesizedExpression':
      return isWholeFileRead(node.expression, tainted, fragments, calls);
    case 'TemplateLiteral':
      return partsAreWhole(node.expressions);
    case 'BinaryExpression':
      return node.operator === '+' && partsAreWhole([node.left, node.right]);
    case 'CallExpression':
    case 'OptionalCallExpression': {
      const name = calleeName(node.callee);
      if (calls.readKind(node)) {
        return true;
      }
      // A transform helper hands a whole file back whole only if its own body
      // does: `(text) => text.trim()` does, `(text) => text.slice(1)` cuts.
      const transformed = calls.transform(node);
      if (transformed && taintKind(transformed.argument, tainted, calls)) {
        return (
          transformed.preservesWhole &&
          isWholeFileRead(transformed.argument, tainted, fragments, calls)
        );
      }
      const returned = returnedKey(bindingOf(node.callee));
      if (tainted.has(returned)) {
        return holdsWholeFile(returned, tainted, fragments);
      }
      if (
        name &&
        WHOLE_PRESERVING_METHODS.has(name) &&
        (node.callee.type === 'MemberExpression' ||
          node.callee.type === 'OptionalMemberExpression')
      ) {
        return isWholeFileRead(node.callee.object, tainted, fragments, calls);
      }
      if (node.callee.type === 'Identifier' && name === 'String') {
        return isWholeFileRead(node.arguments[0], tainted, fragments, calls);
      }
      return false;
    }
    default:
      return false;
  }
}

const FUNCTION_NODE_TYPES = new Set([
  'ArrowFunctionExpression',
  'FunctionExpression',
  'FunctionDeclaration',
  'ObjectMethod',
  'ClassMethod',
]);

/** Walk a function body without descending into functions nested inside it. */
function walkOwnBody(node, visit) {
  if (!node || typeof node.type !== 'string') {
    return;
  }
  visit(node);
  for (const key of childKeys(node)) {
    const value = node[key];
    const children = Array.isArray(value) ? value : [value];
    for (const child of children) {
      if (
        child &&
        typeof child.type === 'string' &&
        !FUNCTION_NODE_TYPES.has(child.type)
      ) {
        walkOwnBody(child, visit);
      }
    }
  }
}

/**
 * The source an assertion call makes a claim about, and how the call spells
 * it: an `expect()` matcher, a `node:assert` method, a call to a helper that
 * asserts on the argument it is given, or such a helper handed to a callback
 * that receives the text.
 */
function assertedSource(node, tainted, calls, helpers) {
  if (
    node.type !== 'CallExpression' &&
    node.type !== 'OptionalCallExpression'
  ) {
    return undefined;
  }
  const name = calleeName(node.callee);
  if (name && TEXT_MATCHERS.has(name)) {
    const expectCall = findExpectCall(node.callee);
    const kind = expectCall && firstTaint(expectCall.arguments, tainted, calls);
    if (kind) {
      return { kind, label: `expect(...).${name}()` };
    }
  }
  const method = assertMethod(node.callee);
  if (ASSERT_TEXT_METHODS.has(method)) {
    const kind = firstTaint(node.arguments, tainted, calls);
    if (kind) {
      return { kind, label: `assert.${method}()` };
    }
  }
  const parameterIndex = helpers.get(bindingOf(node.callee));
  if (parameterIndex !== undefined) {
    const kind = taintKind(node.arguments[parameterIndex], tainted, calls);
    if (kind) {
      return { kind, label: `${name}()` };
    }
  }
  // `lines.forEach(expectNoConsole)`: the helper is called with the text.
  const handedToHelper = callbackSlots(node, calls).find(
    (slot) =>
      slot.parameters.includes(helpers.get(bindingOf(slot.callback))) &&
      taintKind(slot.value, tainted, calls),
  );
  return handedToHelper
    ? {
        kind: taintKind(handedToHelper.value, tainted, calls),
        label: `${handedToHelper.callback.name}()`,
      }
    : undefined;
}

/**
 * Named helpers that make the assertion for you: `expectNoTimers(source)` puts
 * the sink inside the helper, where the parameter is just a parameter. The
 * claim is still made about whatever the caller handed over. A helper that
 * hands its parameter on to another helper is one too, so this runs until no
 * new helper turns up.
 */
function collectAssertionHelpers(ast, definitions, tainted, calls) {
  const helpers = new Map();
  let before;
  do {
    before = helpers.size;
    walk(ast, (node) => {
      const named = namedFunction(node);
      if (!named || helpers.has(named.binding)) {
        return;
      }
      const index = named.parameters.findIndex(
        (parameter) =>
          parameter !== undefined &&
          assertsOnParameter(named.fn, parameter, {
            definitions,
            tainted,
            calls,
            helpers,
          }),
      );
      if (index >= 0) {
        helpers.set(named.binding, index);
      }
    });
  } while (helpers.size > before);
  return helpers;
}

/**
 * Does anything inside `fn` - its callbacks and `it(...)` bodies included -
 * assert on text that came in through `parameter`? The text is followed
 * through the locals built from it. An assertion already about source without
 * the parameter is recorded where it stands, so it makes nothing a helper.
 */
function assertsOnParameter(
  fn,
  parameter,
  { definitions, tainted, calls, helpers },
) {
  const probe = new Map(tainted);
  probe.set(parameter, 'script');
  propagateTaint(
    definitions.filter(
      (definition) =>
        definition.node.start >= fn.start && definition.node.end <= fn.end,
    ),
    probe,
    new Set(),
    calls,
  );
  let asserts = false;
  walk(fn.body, (node) => {
    asserts =
      asserts ||
      (Boolean(assertedSource(node, probe, calls, helpers)) &&
        !assertedSource(node, tainted, calls, helpers));
  });
  return asserts;
}

/**
 * A function declaration or a function-valued binding: the binding a call to
 * it goes through, and the binding of each plain parameter.
 */
function namedFunction(node) {
  let binding;
  let fn;
  if (node.type === 'FunctionDeclaration' && node.id) {
    binding = bindingOf(node.id);
    fn = node;
  } else if (
    node.type === 'VariableDeclarator' &&
    node.id.type === 'Identifier' &&
    (node.init?.type === 'ArrowFunctionExpression' ||
      node.init?.type === 'FunctionExpression')
  ) {
    binding = bindingOf(node.id);
    fn = node.init;
  }
  if (!binding) {
    return undefined;
  }
  return {
    binding,
    fn,
    parameters: fn.params.map((parameter) =>
      parameter.type === 'Identifier' ? bindingOf(parameter) : undefined,
    ),
  };
}

/**
 * Named helpers that hand back a reworked version of one of their arguments,
 * `(source) => source.replace(/\s+/gu, ' ')` being the usual shape. A call to
 * one carries whatever text it was given.
 */
function collectTransformHelpers(ast, calls, helpers) {
  // Until nothing new turns up, so a helper can call one defined below it.
  let before;
  do {
    before = helpers.size;
    walk(ast, (node) => {
      const returned = returnedPathExpression(node);
      if (!returned || helpers.has(returned.binding)) {
        return;
      }
      returned.parameters.some((parameter, parameterIndex) => {
        if (!parameter) {
          return false;
        }
        const probe = new Map([[parameter, 'script']]);
        if (!taintKind(returned.value, probe, calls)) {
          return false;
        }
        helpers.set(returned.binding, {
          parameterIndex,
          preservesWhole: isWholeFileRead(
            returned.value,
            probe,
            new Set(),
            calls,
          ),
        });
        return true;
      });
    });
  } while (helpers.size > before);
}

/**
 * Everywhere a binding is given a value: a declarator's initializer, the
 * right-hand side of an assignment to it (compound ones included), a callback
 * parameter a known API fills, or a `for...of` loop variable. `fragment` marks
 * a value that is only ever part of the expression it comes from, such as one
 * element of it.
 */
function collectDefinitions(ast, calls) {
  const definitions = [];
  const define = (node, value, identifiers, fragment = false) => {
    const bindings = identifiers.map(bindingOf).filter(Boolean);
    if (bindings.length > 0) {
      definitions.push({ node, value, bindings, fragment });
    }
  };
  const store = (node, { key, value, literal = false }) => {
    key.defined = true;
    key.fromLiteral = key.fromLiteral || literal;
    definitions.push({ node, value, bindings: [key], fragment: false });
  };
  const namedFunctions = [];
  walk(ast, (node) => {
    const named = namedFunction(node);
    if (named) {
      namedFunctions.push(named);
    }
    const target = bindingTarget(node);
    if (target) {
      destructured(target).forEach(({ pattern, identifiers, value }) => {
        define(node, value, identifiers);
        // A variable given a literal knows what each part of it holds.
        if (pattern?.type === 'Identifier') {
          literalParts(bindingOf(pattern), value).forEach((part) =>
            store(node, part),
          );
        }
      });
      storedValues(target).forEach((part) => store(node, part));
    }
    callbackSlots(node, calls).forEach(
      ({ callback, parameters, value, fragment }) => {
        if (
          callback?.type === 'ArrowFunctionExpression' ||
          callback?.type === 'FunctionExpression'
        ) {
          define(
            callback,
            value,
            parameters.flatMap((index) =>
              patternIdentifiers(callback.params[index]),
            ),
            fragment,
          );
        }
      },
    );
    if (node.type === 'ForOfStatement') {
      const pattern =
        node.left.type === 'VariableDeclaration'
          ? node.left.declarations[0]?.id
          : node.left;
      define(node, node.right, patternIdentifiers(pattern), true);
    }
    if (
      node.type === 'NewExpression' &&
      node.callee.type === 'Identifier' &&
      node.callee.name === 'Promise'
    ) {
      const settled = settledKey(node);
      settlements(node, calls).forEach((settlement) =>
        definitions.push({ ...settlement, bindings: [settled] }),
      );
    }
  });
  // What a named function returns, once every local it could build a path
  // from is known. A read whose path comes from the function's parameters is
  // left out: only the call says what that reads, which is why such a
  // function is a read helper when it is simple enough to be one.
  namedFunctions.forEach((named) => {
    if (calls.isReadHelper(named.binding)) {
      return;
    }
    const values = returnedValues(named.fn);
    const reads = values.flatMap((value) => readCalls(value, calls));
    if (reads.length > 0 && named.parameters.some(Boolean)) {
      const fromParameters = parameterDerived(named, definitions);
      if (
        reads.some((read) =>
          read.arguments.some((argument) =>
            refersToAny(argument, fromParameters),
          ),
        )
      ) {
        return;
      }
    }
    const returned = returnedKey(named.binding);
    values.forEach((value) => {
      definitions.push({
        node: value,
        value,
        bindings: [returned],
        fragment: false,
      });
      // `return { source, ast }` hands back each property on its own too.
      literalParts(returned, value).forEach((part) => store(value, part));
    });
  });
  return definitions;
}

/**
 * What each identifier in a definition's pattern is given. An element of an
 * array literal goes to the identifier in the same position, and destructuring
 * an owner by static key or position reads that property, as `ctx.source` or
 * `files[0]` would. Anything else receives the whole value.
 */
function destructured({ pattern, identifiers, value }) {
  const whole = [{ pattern, identifiers, value }];
  if (pattern.type === 'ArrayPattern') {
    const literal = unwrapCollection(value);
    if (
      literal?.type === 'ArrayExpression' &&
      !literal.elements.some((element) => element?.type === 'SpreadElement')
    ) {
      return pattern.elements.map((element, index) => ({
        pattern: element,
        identifiers: patternIdentifiers(element),
        value:
          element?.type === 'RestElement' ? value : literal.elements[index],
      }));
    }
    return ownerKey(value)
      ? pattern.elements.map((element, index) =>
          element?.type === 'RestElement'
            ? { identifiers: patternIdentifiers(element), value }
            : {
                identifiers: patternIdentifiers(element),
                value: propertyAccess(value, {
                  type: 'NumericLiteral',
                  value: index,
                }),
              },
        )
      : whole;
  }
  if (pattern.type !== 'ObjectPattern' || !ownerKey(value)) {
    return whole;
  }
  return pattern.properties.map((property) => {
    const name =
      property.type === 'ObjectProperty'
        ? staticName(property.key, property)
        : undefined;
    return name === undefined
      ? {
          identifiers: patternIdentifiers(
            property.type === 'RestElement' ? property : property.value,
          ),
          value,
        }
      : {
          identifiers: patternIdentifiers(property.value),
          value: propertyAccess(value, property.key, property.computed),
        };
  });
}

/**
 * A property access the source never spells out, so that taint and wholeness
 * are read for it exactly as they would be for `owner.name` or `owner[0]`.
 */
function propertyAccess(owner, key, computed = key.type !== 'Identifier') {
  return { type: 'MemberExpression', object: owner, property: key, computed };
}

/**
 * Properties a definition stores on a member: `ctx.source = read(...)` stores
 * under `source` on `ctx`, along with anything the assigned literal spells
 * out beneath it.
 */
function storedValues({ pattern, value }) {
  const stored = storedKey(pattern);
  return stored ? [{ key: stored, value }, ...literalParts(stored, value)] : [];
}

/**
 * The parts an object or array literal gives its owner, by property name or
 * position, all the way down through nested literals.
 */
function literalParts(owner, value) {
  const literal = unwrapCollection(value);
  let parts = [];
  if (literal?.type === 'ObjectExpression') {
    parts = literal.properties
      .filter((property) => property.type === 'ObjectProperty')
      .map((property) => ({
        key: propertyKey(owner, staticName(property.key, property)),
        value: property.value,
        literal: true,
      }))
      .filter(({ key }) => key);
  } else if (literal?.type === 'ArrayExpression') {
    const spread = literal.elements.findIndex(
      (element) => element?.type === 'SpreadElement',
    );
    parts = literal.elements
      .slice(0, spread === -1 ? undefined : spread)
      .map((element, index) => ({
        key: propertyKey(owner, String(index)),
        value: element,
        literal: true,
      }))
      .filter(({ value: element }) => element);
  }
  return parts.flatMap((part) => [part, ...literalParts(part.key, part.value)]);
}

/**
 * The literal a collection settles into. `await Promise.all([...])` is the
 * array of what each input settles with, and `Promise.allSettled([...])` the
 * array of `{ status, value, reason }` records with each input as `value`.
 */
function unwrapCollection(node) {
  switch (node?.type) {
    case 'AwaitExpression':
      return unwrapCollection(node.argument);
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
    case 'ParenthesizedExpression':
      return unwrapCollection(node.expression);
    case 'CallExpression': {
      const name =
        node.callee.type === 'MemberExpression' &&
        node.callee.object.type === 'Identifier' &&
        node.callee.object.name === 'Promise'
          ? calleeName(node.callee)
          : undefined;
      const inputs =
        name === 'all' || name === 'allSettled'
          ? unwrapCollection(node.arguments[0])
          : undefined;
      if (name === 'allSettled' && inputs?.type === 'ArrayExpression') {
        return {
          type: 'ArrayExpression',
          elements: inputs.elements.map((input) =>
            input?.type === 'SpreadElement' ? input : settledRecord(input),
          ),
        };
      }
      return name === 'all' ? inputs : node;
    }
    default:
      return node;
  }
}

/** `{ status, value, reason }`, of which only `value` holds the input. */
function settledRecord(input) {
  const property = (name, value) => ({
    type: 'ObjectProperty',
    key: { type: 'Identifier', name },
    value,
    computed: false,
  });
  return {
    type: 'ObjectExpression',
    properties: [
      property('status', undefined),
      property('value', input),
      property('reason', undefined),
    ],
  };
}

/** The expressions a function hands back to its caller. */
function returnedValues(fn) {
  if (fn.body.type !== 'BlockStatement') {
    return [fn.body];
  }
  const values = [];
  walkOwnBody(fn.body, (node) => {
    if (node.type === 'ReturnStatement' && node.argument) {
      values.push(node.argument);
    }
  });
  return values;
}

/** Bindings inside a function whose value is built from its parameters. */
function parameterDerived({ fn, parameters }, definitions) {
  const derived = new Set(parameters.filter(Boolean));
  const inside = definitions.filter(
    (definition) =>
      definition.node.start >= fn.start && definition.node.end <= fn.end,
  );
  let before;
  do {
    before = derived.size;
    inside
      .filter((definition) => refersToAny(definition.value, derived))
      .forEach((definition) =>
        definition.bindings.forEach((binding) => derived.add(binding)),
      );
  } while (derived.size > before);
  return derived;
}

/** The reads in an expression, direct or through a read helper. */
function readCalls(node, calls) {
  const found = [];
  walk(node, (current) => {
    if (
      (current.type === 'CallExpression' ||
        current.type === 'OptionalCallExpression') &&
      (calls.isRead(current) || calls.isReadHelper(bindingOf(current.callee)))
    ) {
      found.push(current);
    }
  });
  return found;
}

function refersToAny(node, bindings) {
  let found = false;
  walk(node, (current) => {
    if (bindings.has(bindingOf(current))) {
      found = true;
    }
  });
  return found;
}

/**
 * What a `new Promise(...)` executor resolves with: the argument of each
 * `resolve(...)` call, and the text any callback slot hands to `resolve`
 * passed by reference, as in `read(path).then(resolve)`.
 */
function settlements(promise, calls) {
  const executor = promise.arguments[0];
  const resolve =
    executor?.type === 'ArrowFunctionExpression' ||
    executor?.type === 'FunctionExpression'
      ? bindingOf(executor.params[0])
      : undefined;
  const found = [];
  if (resolve) {
    walk(executor.body, (node) => {
      if (
        (node.type === 'CallExpression' ||
          node.type === 'OptionalCallExpression') &&
        bindingOf(node.callee) === resolve &&
        node.arguments[0]
      ) {
        found.push({ node, value: node.arguments[0], fragment: false });
      }
      callbackSlots(node, calls)
        .filter(
          (slot) =>
            bindingOf(slot.callback) === resolve && slot.parameters.includes(0),
        )
        .forEach((slot) =>
          found.push({ node, value: slot.value, fragment: slot.fragment }),
        );
    });
  }
  return found;
}

/**
 * Taint every binding a definition can fill with first-party source text, and
 * record the ones it can fill with less than a whole file. Deliberately blind
 * to control flow: a binding holds source if any definition puts it there,
 * whether that sits in a hook, a callback or a later statement. A kind only
 * ever rises and a fragment is never unmarked, so the loop always settles.
 */
function propagateTaint(definitions, tainted, fragments, calls) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const { value, bindings, fragment } of definitions) {
      const kind = taintKind(value, tainted, calls);
      const filled = kind ? bindings : [];
      const whole =
        filled.length > 0 &&
        !fragment &&
        isWholeFileRead(value, tainted, fragments, calls);
      for (const binding of filled) {
        // 'script' outranks 'native': it is the kind that fails the gate.
        const current = tainted.get(binding);
        if (current !== kind && current !== 'script') {
          tainted.set(binding, kind);
          changed = true;
        }
        if (!whole && !fragments.has(binding)) {
          fragments.add(binding);
          changed = true;
        }
      }
    }
  }
}

/**
 * The source text a callback hands back, if any. Only the returned value
 * counts: a read performed for a side effect does not decide the result.
 */
function callbackBodyTaint(node, tainted, calls) {
  if (
    node?.type !== 'ArrowFunctionExpression' &&
    node?.type !== 'FunctionExpression'
  ) {
    return undefined;
  }
  if (node.body.type !== 'BlockStatement') {
    return taintKind(node.body, tainted, calls);
  }
  let kind;
  walkOwnBody(node.body, (current) => {
    if (!kind && current.type === 'ReturnStatement') {
      kind = taintKind(current.argument, tainted, calls);
    }
  });
  return kind;
}

/**
 * Where a call hands text to a callback it is given: the callback argument,
 * which of its parameters receive the text, the expression that text comes
 * from, and whether a parameter only ever gets part of it.
 */
function callbackSlots(node, calls) {
  if (
    node.type !== 'CallExpression' &&
    node.type !== 'OptionalCallExpression'
  ) {
    return [];
  }
  // `readFile(path, 'utf8', (error, text) => ...)`
  if (calls.isRead(node)) {
    return [
      {
        callback: node.arguments.at(-1),
        parameters: [1],
        value: node,
        fragment: false,
      },
    ];
  }
  if (
    node.callee.type !== 'MemberExpression' &&
    node.callee.type !== 'OptionalMemberExpression'
  ) {
    return [];
  }
  const name = calleeName(node.callee);
  const receiver = node.callee.object;
  // `readFile(path, 'utf8').then((text) => ...)`
  if (name === 'then') {
    return [
      {
        callback: node.arguments[0],
        parameters: [0],
        value: receiver,
        fragment: false,
      },
    ];
  }
  // `source.split('\n').forEach((line) => ...)`
  if (CALLBACK_PROPAGATORS.has(name)) {
    return [
      {
        callback: node.arguments[0],
        parameters: CALLBACK_PROPAGATORS.get(name),
        value: receiver,
        fragment: true,
      },
    ];
  }
  // `source.replace(/import .*/gu, (statement) => ...)`
  if (name === 'replace' || name === 'replaceAll') {
    return [
      {
        callback: node.arguments[1],
        parameters: [0],
        value: receiver,
        fragment: true,
      },
    ];
  }
  return [];
}

function firstTaint(nodes, tainted, calls) {
  for (const node of nodes ?? []) {
    const kind = taintKind(node, tainted, calls);
    if (kind) {
      return kind;
    }
  }
  return undefined;
}

// `path.dirname` and `require.resolve` land inside the tree; `process.cwd()` is
// the repository root because Jest runs from it.
const PATH_BUILDERS = new Set(['join', 'resolve', 'normalize', 'dirname']);
const REPO_ANCHOR_IDENTIFIERS = new Set(['__dirname', '__filename']);
// A checked-in path written literally: relative, or from a workspace root.
// Answers "does this stay inside the repository", so `../../..` qualifies.
const WORKSPACE_PATH_RE = /^(?:\.{1,2}\/|apps\/|packages\/|development\/)/u;
// Answers the narrower "does this name a directory that holds source", which
// an ascent like `../../..` and a dotfile directory like `.github/` do not.
const SOURCE_DIRECTORY_RE = /^(?:apps|packages|development)\//u;

/**
 * The node:assert method a call reaches: `assert.equal(...)`,
 * `assert.strict.equal(...)` and `t.assert.equal(...)` but not `x.equal(...)`,
 * the module called directly as `assert(...)`, and any of them imported or
 * required under another name.
 */
function assertMethod(callee) {
  if (callee.type === 'Identifier') {
    const imported = importOf(callee);
    if (imported && ASSERT_MODULE_RE.test(imported.module)) {
      return assertExportMethod(imported.name);
    }
    return callee.name === 'assert' ? 'ok' : undefined;
  }
  if (callee.type !== 'MemberExpression' || !reachesAssert(callee.object)) {
    return undefined;
  }
  return assertExportMethod(staticName(callee.property, callee));
}

/** The module itself and `strict` are callable, and assert like `ok`. */
function assertExportMethod(name) {
  return name === 'default' || name === 'strict' ? 'ok' : name;
}

/** `assert`, `assert.strict`, a test context's `t.assert`, or node:assert imported under any name. */
function reachesAssert(node) {
  if (node.type === 'Identifier') {
    const imported = importOf(node);
    return (
      node.name === 'assert' ||
      Boolean(
        imported &&
        ASSERT_MODULE_RE.test(imported.module) &&
        assertExportMethod(imported.name) === 'ok',
      )
    );
  }
  return (
    node.type === 'MemberExpression' &&
    (staticName(node.property, node) === 'assert' || reachesAssert(node.object))
  );
}

/**
 * The module and export an identifier was imported or required as, with
 * `default` standing for a default import, a namespace, or the whole module.
 */
function importOf(identifier) {
  const binding = bindingOf(identifier);
  const declaration = binding?.path?.node;
  switch (declaration?.type) {
    case 'ImportDefaultSpecifier':
    case 'ImportNamespaceSpecifier':
      return { module: binding.path.parent.source.value, name: 'default' };
    case 'ImportSpecifier':
      return {
        module: binding.path.parent.source.value,
        name: staticName(declaration.imported, declaration),
      };
    case 'VariableDeclarator':
      return requiredAs(declaration, binding.identifier);
    default:
      return undefined;
  }
}

/**
 * `const assert = require('node:assert')`, `require('assert').strict`, and
 * `const { match } = require('node:assert')`.
 */
function requiredAs(declarator, identifier) {
  let required = declarator.init;
  let name = 'default';
  if (required?.type === 'MemberExpression') {
    name = staticName(required.property, required);
    required = required.object;
  }
  if (
    required?.type !== 'CallExpression' ||
    required.callee.type !== 'Identifier' ||
    required.callee.name !== 'require' ||
    required.arguments[0]?.type !== 'StringLiteral'
  ) {
    return undefined;
  }
  const module = required.arguments[0].value;
  if (declarator.id === identifier) {
    return { module, name };
  }
  const property =
    name === 'default' && declarator.id.type === 'ObjectPattern'
      ? declarator.id.properties.find(
          (candidate) =>
            candidate.type === 'ObjectProperty' &&
            (candidate.value === identifier ||
              candidate.value.left === identifier),
        )
      : undefined;
  return property
    ? { module, name: staticName(property.key, property) }
    : undefined;
}

/** Leading literal chunk of a template, which is where a path prefix sits. */
function firstTemplateChunk(node) {
  const [head] = node.quasis;
  return head?.value.cooked ?? head?.value.raw ?? '';
}

/** Is this path expression rooted at the checked-in tree rather than a temp dir? */
function isRepoAnchored(node, repoAnchored, anchoredHelpers) {
  if (!node) {
    return false;
  }
  switch (node.type) {
    case 'Identifier':
      return (
        REPO_ANCHOR_IDENTIFIERS.has(node.name) ||
        repoAnchored.has(bindingOf(node))
      );
    case 'StringLiteral':
      return WORKSPACE_PATH_RE.test(node.value);
    case 'TemplateLiteral':
      return (
        WORKSPACE_PATH_RE.test(firstTemplateChunk(node)) ||
        node.expressions.some((expression) =>
          isRepoAnchored(expression, repoAnchored, anchoredHelpers),
        )
      );
    case 'CallExpression':
    case 'OptionalCallExpression': {
      const name = calleeName(node.callee);
      if (name === 'cwd') {
        return true;
      }
      // A helper that returns a repository path, e.g. `repoRoot()`. Matched on
      // a bare identifier so `fixture.repoRoot()` and a helper that happens to
      // be named `resolve` cannot stand in for the head check below.
      if (anchoredHelpers.has(bindingOf(node.callee))) {
        return true;
      }
      // Only the head of a built path says where it starts. A workspace-shaped
      // literal further along is a suffix under whatever the head was, which
      // may well be a temp directory that mirrors the repository layout.
      return (
        Boolean(name) &&
        PATH_BUILDERS.has(name) &&
        isRepoAnchored(node.arguments[0], repoAnchored, anchoredHelpers)
      );
    }
    default:
      return false;
  }
}

/**
 * Bindings that hold a path into the checked-in tree, mapped to the string
 * literals that built them. A read whose argument is one of these bindings has
 * no literal of its own, so the extension that decides source-vs-data lives
 * here.
 */
function collectRepoAnchoredBindings(ast) {
  const anchored = new Map();
  const helpers = new Set();
  let before;
  do {
    before = anchored.size;
    walk(ast, (node) => {
      const returned = returnedPathExpression(node);
      if (returned && isRepoAnchored(returned.value, anchored, helpers)) {
        helpers.add(returned.binding);
        anchored.set(returned.binding, describePath(returned.value, anchored));
        return;
      }
      const target = bindingTarget(node);
      if (!target || !isRepoAnchored(target.value, anchored, helpers)) {
        return;
      }
      const described = describePath(target.value, anchored);
      target.identifiers
        .map(bindingOf)
        .filter(Boolean)
        .forEach((binding) => anchored.set(binding, described));
    });
  } while (anchored.size > before);
  return { anchored, helpers };
}

/**
 * What a path expression contributes to classifying a read made through it:
 * the literals that built it, whether it ends in a value only known at run
 * time, and whether its shape alone makes an unextended name source. All of
 * it has to travel with the binding, because a read through a bare identifier
 * carries none of its own.
 */
function describePath(node, anchored) {
  const literals = pathLiterals(node, anchored);
  return {
    literals,
    endsInVariable: endsInVariableName(node, anchored),
    unextendedSource: namesUnextendedSource(node, literals, anchored),
  };
}

/** `readFileSync`, `fs.readFileSync`, or a binding that aliases one. */
function isReadReference(node, aliases) {
  const name = calleeName(node);
  if (!name) {
    return false;
  }
  const reference =
    node.type === 'SequenceExpression' ? node.expressions.at(-1) : node;
  return READ_FUNCTIONS.has(name) || aliases.has(bindingOf(reference));
}

/**
 * Bindings that stand in for `readFileSync` / `readFile`: an alias binding, a
 * renamed destructure, or a renamed import.
 */
function collectReadAliases(ast) {
  const aliases = new Set();
  const add = (identifier) => {
    const binding = bindingOf(identifier);
    if (binding) {
      aliases.add(binding);
    }
  };
  let before;
  do {
    before = aliases.size;
    walk(ast, (node) => {
      if (node.type === 'ImportDeclaration') {
        node.specifiers.forEach((specifier) => {
          if (
            specifier.type === 'ImportSpecifier' &&
            specifier.imported.type === 'Identifier' &&
            READ_FUNCTIONS.has(specifier.imported.name)
          ) {
            add(specifier.local);
          }
        });
        return;
      }
      if (node.type !== 'VariableDeclarator') {
        return;
      }
      // `const read = fs.readFileSync`, `const read = readFileSync`, and
      // `const read = promisify(fs.readFile)`
      if (node.id.type === 'Identifier') {
        const reference =
          calleeName(node.init?.callee) === 'promisify'
            ? node.init.arguments[0]
            : node.init;
        if (reference && isReadReference(reference, aliases)) {
          add(node.id);
        }
        return;
      }
      // `const { readFileSync: slurp } = require('fs')`
      if (node.id.type === 'ObjectPattern') {
        node.id.properties.forEach((property) => {
          if (
            property.type === 'ObjectProperty' &&
            property.key.type === 'Identifier' &&
            READ_FUNCTIONS.has(property.key.name)
          ) {
            add(property.value);
          }
        });
      }
    });
  } while (aliases.size > before);
  return aliases;
}

/** Is `binding` the head of this path expression, rather than a later segment? */
function isHeadIdentifier(node, binding) {
  if (!node || !binding) {
    return false;
  }
  if (node.type === 'Identifier') {
    return bindingOf(node) === binding;
  }
  if (
    node.type === 'CallExpression' ||
    node.type === 'OptionalCallExpression'
  ) {
    return isHeadIdentifier(node.arguments[0], binding);
  }
  return false;
}

function refersTo(node, binding) {
  let found = false;
  walk(node, (current) => {
    if (bindingOf(current) === binding) {
      found = true;
    }
  });
  return found;
}

/**
 * Named helpers whose whole job is to read a file, mapped either to the kind
 * their own path resolves to, or to the index of the parameter they read.
 */
function collectReadHelpers(ast, isReadCallee, classify) {
  const helpers = new Map();
  walk(ast, (node) => {
    const returned = returnedPathExpression(node);
    const call = returned && unwrapWholeConversion(returned.value);
    if (
      !call ||
      (call.type !== 'CallExpression' && call.type !== 'OptionalCallExpression')
    ) {
      return;
    }
    if (!isReadCallee(call.callee)) {
      return;
    }
    const pathArgument = call.arguments[0];
    if (!pathArgument) {
      return;
    }
    // The whole path is the parameter: classify the call-site argument.
    const passedWhole = returned.parameters.findIndex(
      (parameter) =>
        parameter !== undefined && bindingOf(pathArgument) === parameter,
    );
    if (passedWhole >= 0) {
      helpers.set(returned.binding, { parameterIndex: passedWhole });
      return;
    }
    // The parameter is spliced into a path the helper owns, e.g.
    // `(name) => readFileSync(join(__dirname, '__fixtures__', name))`. The
    // filename still comes from the caller, so the body alone cannot say
    // whether a call reads source or data.
    const splicedIn = returned.parameters.findIndex(
      (parameter) =>
        parameter !== undefined && refersTo(pathArgument, parameter),
    );
    if (splicedIn >= 0) {
      helpers.set(returned.binding, {
        parameterIndex: splicedIn,
        path: pathArgument,
        // `(root) => readFileSync(join(root, 'index.ts'))`: the caller supplies
        // the head, so the caller decides whether this reads the repository.
        headIsParameter: isHeadIdentifier(
          pathArgument,
          returned.parameters[splicedIn],
        ),
      });
      return;
    }
    const kind = classify(pathArgument);
    if (kind) {
      helpers.set(returned.binding, { kind });
    }
  });
  return helpers;
}

/**
 * The expression under conversions that keep a whole file whole, so
 * `readFileSync(file).toString()` and `await readFile(file)` are still reads.
 */
function unwrapWholeConversion(node) {
  switch (node?.type) {
    case 'AwaitExpression':
      return unwrapWholeConversion(node.argument);
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
    case 'ParenthesizedExpression':
      return unwrapWholeConversion(node.expression);
    case 'CallExpression':
    case 'OptionalCallExpression': {
      const name = calleeName(node.callee);
      if (
        name &&
        WHOLE_PRESERVING_METHODS.has(name) &&
        (node.callee.type === 'MemberExpression' ||
          node.callee.type === 'OptionalMemberExpression')
      ) {
        return unwrapWholeConversion(node.callee.object);
      }
      if (node.callee.type === 'Identifier' && name === 'String') {
        return unwrapWholeConversion(node.arguments[0]);
      }
      return node;
    }
    default:
      return node;
  }
}

/**
 * A named function whose body is a single returned expression, so a call to it
 * can be treated the same as the expression it returns.
 */
function returnedPathExpression(node) {
  const named = namedFunction(node);
  if (!named) {
    return undefined;
  }
  const { binding, fn, parameters } = named;
  if (fn.body.type !== 'BlockStatement') {
    return { binding, value: fn.body, parameters };
  }
  const [statement, ...rest] = fn.body.body;
  return statement?.type === 'ReturnStatement' &&
    rest.length === 0 &&
    statement.argument
    ? { binding, value: statement.argument, parameters }
    : undefined;
}

/** Literals in a path expression, including those behind anchored bindings. */
function pathLiterals(node, anchored) {
  const literals = collectStringLiterals(node).filter(Boolean);
  const seen = new Set();
  walk(node, (current) => {
    const binding = bindingOf(current);
    if (anchored.has(binding) && !seen.has(binding)) {
      seen.add(binding);
      literals.push(...anchored.get(binding).literals);
    }
  });
  return literals;
}

/** Does the path finish with a value only known at run time? */
function endsInVariableName(node, anchored) {
  if (node.type === 'StringLiteral' || node.type === 'TemplateLiteral') {
    return false;
  }
  if (node.type === 'Identifier') {
    // A binding built from a literal filename already said what it is; only an
    // unknown name is genuinely a tail that is only known at run time.
    const described = anchored.get(bindingOf(node));
    return described ? described.endsInVariable : true;
  }
  if (
    node.type === 'CallExpression' ||
    node.type === 'OptionalCallExpression'
  ) {
    const last = node.arguments.at(-1);
    return Boolean(last) && endsInVariableName(last, anchored);
  }
  return true;
}

/** Does this path reach source whose extension is not written down? */
function namesUnextendedSource(node, literals, anchored) {
  // `const file = path.join(__dirname, name)` already said what it names.
  const described = anchored.get(bindingOf(node));
  if (described) {
    return described.unextendedSource;
  }
  // `path.join(repoRoot, 'packages/kit/src/views/X', name)` names a source
  // directory explicitly and ends in a variable, so the filename is source.
  // Only that shape: a path that ends in a literal already said what it is,
  // and a repo path naming no source directory (`.github/workflows`) is not.
  if (
    endsInVariableName(node, anchored) &&
    literals.some((literal) => SOURCE_DIRECTORY_RE.test(literal))
  ) {
    return true;
  }
  let found = false;
  walk(node, (current) => {
    if (
      current.type === 'Identifier' &&
      REPO_ANCHOR_IDENTIFIERS.has(current.name)
    ) {
      // `path.resolve(__dirname, fileFromTestTable)` reads a sibling of the
      // test file, which is source whatever the table happens to hold.
      found = true;
    }
    if (
      (current.type === 'CallExpression' ||
        current.type === 'OptionalCallExpression') &&
      current.callee.type === 'MemberExpression' &&
      current.callee.object.type === 'Identifier' &&
      current.callee.object.name === 'require' &&
      calleeName(current.callee) === 'resolve'
    ) {
      // A module specifier resolves to JS/TS by definition.
      found = true;
    }
  });
  return found;
}

/** Every identifier a pattern binds, so destructuring carries taint too. */
function patternIdentifiers(node, collected = []) {
  if (!node) {
    return collected;
  }
  switch (node.type) {
    case 'Identifier':
      collected.push(node);
      break;
    case 'ArrayPattern':
      node.elements.forEach((element) =>
        patternIdentifiers(element, collected),
      );
      break;
    case 'ObjectPattern':
      node.properties.forEach((property) =>
        patternIdentifiers(
          property.type === 'RestElement' ? property.argument : property.value,
          collected,
        ),
      );
      break;
    case 'RestElement':
      patternIdentifiers(node.argument, collected);
      break;
    case 'AssignmentPattern':
      patternIdentifiers(node.left, collected);
      break;
    default:
      break;
  }
  return collected;
}

/**
 * The identifiers a definition fills and the value it fills them with, for
 * `const x = ...`, `x = ...` and `x += ...`.
 */
function bindingTarget(node) {
  if (node.type === 'VariableDeclarator' && node.init) {
    return {
      pattern: node.id,
      identifiers: patternIdentifiers(node.id),
      value: node.init,
    };
  }
  if (node.type === 'AssignmentExpression') {
    return {
      pattern: node.left,
      identifiers: patternIdentifiers(node.left),
      value: node.right,
    };
  }
  return undefined;
}

function analyzeFile(
  absolutePath,
  source,
  allowlist = [],
  usedEntries = new Map(),
) {
  const relativePath = path
    .relative(REPO_ROOT, absolutePath)
    .split(path.sep)
    .join('/');
  const ast = parseSource(source);
  resolveBindings(ast);

  // `readdirSync` + a source-extension filter + `readFileSync` is a directory
  // walk over first-party source; the read path is then a variable, so the
  // per-call classifier alone cannot see it.
  const walksSourceTree =
    /\breaddirSync\b|\breaddir\b/u.test(source) &&
    /\breadFileSync\b|\breadFile\b/u.test(source) &&
    walksSource(ast);

  const { anchored: repoAnchored, helpers: anchoredHelpers } =
    collectRepoAnchoredBindings(ast);
  const classify = (pathNode, callSite) =>
    classifyPath(pathNode, repoAnchored, anchoredHelpers, callSite) ??
    (walksSourceTree ? 'script' : undefined);
  const readAliases = collectReadAliases(ast);
  const isReadCallee = (callee) => isReadReference(callee, readAliases);
  const readHelpers = collectReadHelpers(ast, isReadCallee, classify);
  const transformHelpers = new Map();
  // How a call relates to source text. A read is a direct call, a call through
  // an alias of one, or a call to a helper that does nothing but read. A
  // transform helper is not a read, but it hands an argument's text back, so
  // the taint travels through it.
  const calls = {
    isRead: (callNode) => isReadCallee(callNode.callee),
    isReadHelper: (binding) => readHelpers.has(binding),
    readKind(callNode) {
      if (isReadCallee(callNode.callee)) {
        return classify(callNode.arguments[0]);
      }
      const helper = readHelpers.get(bindingOf(callNode.callee));
      if (!helper) {
        return undefined;
      }
      if (helper.kind) {
        return helper.kind;
      }
      const passed = callNode.arguments[helper.parameterIndex];
      if (!helper.path) {
        return classify(passed);
      }
      // Classify the helper's own path with what the caller actually named.
      return classify(helper.path, {
        literals: passed ? pathLiterals(passed, repoAnchored) : [],
        endsInVariable: passed
          ? endsInVariableName(passed, repoAnchored)
          : true,
        headIsParameter: helper.headIsParameter,
        anchored: Boolean(
          passed && isRepoAnchored(passed, repoAnchored, anchoredHelpers),
        ),
      });
    },
    transform(callNode) {
      const helper = transformHelpers.get(bindingOf(callNode.callee));
      return helper
        ? {
            argument: callNode.arguments[helper.parameterIndex],
            preservesWhole: helper.preservesWhole,
          }
        : undefined;
    },
  };
  collectTransformHelpers(ast, calls, transformHelpers);

  // Pass 1: taint every binding that holds first-party source text. Seeding
  // walks down from each definition rather than up from each read, so the read
  // can sit anywhere inside it -- behind an await, a cast, an optional chain,
  // or a string method -- and derived bindings (`const body =
  // source.slice(a, b)`) follow.
  const definitions = collectDefinitions(ast, calls);
  const tainted = new Map();
  const fragments = new Set();
  propagateTaint(definitions, tainted, fragments, calls);
  const assertionHelpers = collectAssertionHelpers(
    ast,
    definitions,
    tainted,
    calls,
  );

  // Pass 2: locate assertions and eval sinks fed by tainted text, and record
  // which `it()` block each one sits in so partial files can be fixed in place.
  const violations = [];
  const testBlocks = [];
  const blockStack = [];

  let sharedSetupViolation = false;
  const record = (rule, node, message) => {
    const violation = {
      rule,
      file: relativePath,
      line: node.loc?.start.line ?? 0,
      block: blockStack.length
        ? blockStack[blockStack.length - 1].title
        : undefined,
      message,
    };
    // Exemptions are applied here, not by the caller, so a reviewed block never
    // counts toward the whole-file verdict that --list drives.
    const entry = matchingEntry(allowlist, relativePath, violation);
    if (entry) {
      const seen = (usedEntries.get(entry) ?? 0) + 1;
      usedEntries.set(entry, seen);
      // Beyond the reviewed count the block has grown unchecked assertions.
      if (seen <= entry.count) {
        return;
      }
    }
    violations.push(violation);
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

  const recordEvalSink = (node, name) => {
    if (!name || !EVAL_FUNCTIONS.has(name)) {
      return;
    }
    const kind = firstTaint(node.arguments, tainted, calls);
    // A fragment is anything that is not the file as it was read.
    const sliced = node.arguments.some(
      (a) =>
        taintKind(a, tainted, calls) &&
        !isWholeFileRead(a, tainted, fragments, calls),
    );
    if (kind === 'script' && sliced) {
      record(
        'source-slice-eval',
        node,
        `${name}() evaluates a fragment sliced out of a source file`,
      );
    }
  };

  const visit = (node) => {
    if (node.type === 'NewExpression') {
      recordEvalSink(node, calleeName(node.callee));
    }
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

      // expect(<tainted>).toContain(...), assert.match(<tainted>, /.../), and
      // expectNoTimers(<tainted>), where the sink is inside the helper but the
      // claim is about what this call handed it.
      const asserted = assertedSource(node, tainted, calls, assertionHelpers);
      if (asserted) {
        record(
          asserted.kind === 'native'
            ? 'native-source-text-assertion'
            : 'source-text-assertion',
          node,
          `${asserted.label} asserts on the text of a ${asserted.kind} source file`,
        );
      }

      // vm.runInNewContext(<tainted>) / transformSync(<tainted>)
      recordEvalSink(node, name);
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

/** `expect`, `x.expect`, or Jest's or Vitest's `expect` imported under another name. */
function isExpectCallee(callee) {
  if (calleeName(callee) === 'expect') {
    return true;
  }
  const imported = callee.type === 'Identifier' ? importOf(callee) : undefined;
  return Boolean(
    imported &&
    EXPECT_MODULE_RE.test(imported.module) &&
    (imported.name === 'expect' || imported.name === 'default'),
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
      if (isExpectCallee(current.callee)) {
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
    result = analyzeFile(absolutePath, source, allowlist, usedEntries);
  } catch (error) {
    // Unparseable input is a fact about the file; anything else is a defect in
    // this check, and swallowing it would drop the whole file from the gate
    // without saying so.
    if (!(error instanceof SyntaxError)) {
      throw error;
    }
    return {
      file: relativePath,
      parseError: error.message,
      violations: [],
      testBlocks: [],
      wholeFile: false,
    };
  }
  return result.violations.length ? result : undefined;
}

function run() {
  const allowlist = loadAllowlist();
  const usedEntries = new Map();
  const files = collectTestFiles(REPO_ROOT, []);
  const results = files
    .map((absolutePath) => analyzeOne(absolutePath, allowlist, usedEntries))
    .filter(Boolean);
  const failing = results.filter((result) =>
    result.violations.some((violation) => !ADVISORY_RULES.has(violation.rule)),
  );
  const advisory = results.filter((result) => !failing.includes(result));
  // An exemption must describe the code that is there now: one that matches
  // nothing has to go, and one that matches less than it claims is wider than
  // anybody reviewed.
  const staleEntries = allowlist
    .map((entry) => ({ ...entry, seen: usedEntries.get(entry) ?? 0 }))
    .filter((entry) => entry.seen < entry.count);
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
    // Advisories are the whole reason the advisory rules exist, so say how many
    // there are on a passing run too rather than only when something fails.
    const advisoryNote = advisory.length
      ? ` ${advisory.length} advisory, not gated: see --json.`
      : '';
    process.stdout.write(
      `Test integrity check passed (${scanned} test files).${advisoryNote}\n`,
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
      `    ${entry.rule} in ${
        entry.block === null ? 'shared setup' : `"${entry.block}"`
      }: reviewed ${entry.count}, found ${entry.seen}. ${
        entry.seen === 0 ? 'Remove the entry.' : 'Lower its "count".'
      }`,
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
