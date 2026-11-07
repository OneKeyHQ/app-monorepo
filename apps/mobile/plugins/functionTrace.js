/**
 * Babel plugin that wraps first-party function bodies with begin/end trace
 * hooks. Enabled only when ONEKEY_FUNCTION_TRACE=1 (*-function-trace EAS
 * profiles); the hooks are installed by installFunctionTrace() in
 * apps/mobile/src/startupProfile.
 *
 * The wrapper declares no variables. It passes an equal (not identical) meta
 * object to both hooks, and the runtime pairs them by value. A per-call
 * variable would be rewritten by react-native-worklets/plugin: in a worklet
 * function it treats anything this plugin adds as a captured closure variable
 * and emits it at module scope, where it does not exist, so the module throws
 * "Property '_functionTraceToken8' doesn't exist" on startup.
 *
 * Known trade-offs, accepted on purpose:
 * - Trace events are written at ERROR level. NativeLogger rate-limits
 *   DEBUG/INFO/WARN (INFO: 400 lines/s, burst 2000, shared by both JS runtimes)
 *   and would drop most per-call events; ERROR is never rate-limited. Logging
 *   cost is included in measured durations, and on long runs the oldest lines
 *   are rotated out of app-latest.log.
 * - Explicit 'worklet' functions are not instrumented at all. They run on the
 *   UI runtime, where the hooks do not exist, so tracing them only inflates
 *   the worklet code that react-native-worklets/plugin serializes.
 */
const path = require('path');

const FUNCTION_TRACE_START = '__onekeyFunctionTraceStart';
const FUNCTION_TRACE_END = '__onekeyFunctionTraceEnd';
const MONOREPO_ROOT = path.resolve(__dirname, '../../..');

function normalizePath(filename) {
  return filename.replace(/\\/g, '/');
}

function relativeBusinessPath(filename, rootDir = MONOREPO_ROOT) {
  const normalized = normalizePath(filename || '');
  if (!path.isAbsolute(normalized)) {
    return normalized.replace(/^\.\//, '');
  }
  return normalizePath(path.relative(rootDir, normalized));
}

function isBusinessFile(filename, rootDir = MONOREPO_ROOT) {
  // cspell:ignore workingdir
  // Match on the repo-relative path. The checkout location is arbitrary: EAS
  // builds from /home/expo/workingdir/build/ (or /Users/expo/...), which would
  // otherwise hit the '/build/' exclusion for every file.
  const relative = relativeBusinessPath(filename, rootDir);
  if (
    !relative.startsWith('packages/') &&
    !relative.startsWith('apps/mobile/')
  ) {
    return false;
  }

  const excludedParts = [
    '/node_modules/',
    '/__tests__/',
    '/__mocks__/',
    '/dist/',
    '/lib/',
    '/build/',
    '/bundle-registry/',
    '/scripts/',
    '/plugins/',
    '/e2e/',
    '/src/startupProfile/',
    '/src/performance/',
    '/modules3rdParty/react-native-file-logger/',
  ];
  const normalized = `/${relative}`;
  if (excludedParts.some((part) => normalized.includes(part))) {
    return false;
  }

  return !/(^|[/.])(test|spec|mock)\.[^.]+$/.test(normalized);
}

function getFunctionName(functionPath) {
  const { node, parentPath } = functionPath;
  if (node.id?.name) {
    return node.id.name;
  }

  if (
    parentPath.isVariableDeclarator() &&
    parentPath.get('id').isIdentifier()
  ) {
    return parentPath.get('id').node.name;
  }

  if (
    functionPath.isObjectMethod() ||
    functionPath.isObjectProperty() ||
    parentPath.isObjectProperty() ||
    functionPath.isClassMethod() ||
    functionPath.isClassPrivateMethod()
  ) {
    let key;
    if (functionPath.isObjectMethod() || functionPath.isObjectProperty()) {
      key = functionPath.get('key');
    } else if (parentPath.isObjectProperty()) {
      key = parentPath.get('key');
    } else {
      key = functionPath.get('key');
    }
    if (key?.isIdentifier()) {
      const classPath = functionPath.findParent(
        (parent) => parent.isClassDeclaration() || parent.isClassExpression(),
      );
      const className = classPath?.node.id?.name;
      return className && functionPath.isClassMethod()
        ? `${className}.${key.node.name}`
        : key.node.name;
    }
    if (key?.isStringLiteral()) {
      return key.node.value;
    }
  }

  if (parentPath.isExportDefaultDeclaration()) {
    return 'default';
  }

  return 'anonymous';
}

function hasWorkletDirective(functionPath) {
  const directives = functionPath.node?.body?.directives;
  return (
    Array.isArray(directives) &&
    directives.some((directive) => directive.value?.value === 'worklet')
  );
}

function isWorkletFunction(functionPath) {
  for (let current = functionPath; current; current = current.parentPath) {
    if (typeof current.isFunction === 'function' && current.isFunction()) {
      if (hasWorkletDirective(current)) return true;
    }
  }
  return false;
}

function buildFunctionMeta(functionPath, filename, t) {
  const meta = [
    t.objectProperty(
      t.identifier('name'),
      t.stringLiteral(getFunctionName(functionPath)),
    ),
    t.objectProperty(
      t.identifier('file'),
      t.stringLiteral(relativeBusinessPath(filename)),
    ),
  ];
  if (functionPath.node.loc?.start?.line) {
    meta.push(
      t.objectProperty(
        t.identifier('line'),
        t.numericLiteral(functionPath.node.loc.start.line),
      ),
    );
  }
  return t.objectExpression(meta);
}

module.exports = function functionTracePlugin({ types: t }) {
  const hookCall = (hookName, meta) => {
    const hook = () =>
      t.memberExpression(t.identifier('globalThis'), t.identifier(hookName));
    return t.ifStatement(
      t.binaryExpression(
        '===',
        t.unaryExpression('typeof', hook()),
        t.stringLiteral('function'),
      ),
      t.expressionStatement(t.callExpression(hook(), [meta])),
    );
  };

  return {
    name: 'onekey-function-trace',
    visitor: {
      Program(programPath, state) {
        state.skipFile = !isBusinessFile(state.filename);
      },

      Function(functionPath, state) {
        if (state.skipFile || functionPath.getData('onekeyFunctionTrace')) {
          return;
        }
        if (isWorkletFunction(functionPath)) {
          return;
        }

        const bodyPath = functionPath.get('body');
        if (!bodyPath.node) {
          return;
        }
        if (!bodyPath.isBlockStatement()) {
          bodyPath.replaceWith(
            t.blockStatement([t.returnStatement(bodyPath.node)]),
          );
        }

        const filename = state.filename || 'unknown';
        // Both hooks get their own meta literal: the runtime pairs them by
        // value, so the wrapper needs no variable of its own.
        const startCall = hookCall(
          FUNCTION_TRACE_START,
          buildFunctionMeta(functionPath, filename, t),
        );
        const endCall = hookCall(
          FUNCTION_TRACE_END,
          buildFunctionMeta(functionPath, filename, t),
        );

        const originalBody = bodyPath.node.body;
        const originalDirectives = bodyPath.node.directives || [];
        const wrappedBody = t.blockStatement([
          t.tryStatement(
            t.blockStatement([startCall, ...originalBody]),
            null,
            t.blockStatement([endCall]),
          ),
        ]);
        wrappedBody.directives = originalDirectives;
        bodyPath.replaceWith(wrappedBody);
        functionPath.setData('onekeyFunctionTrace', true);
      },
    },
  };
};

module.exports._internal = {
  isBusinessFile,
  relativeBusinessPath,
};
