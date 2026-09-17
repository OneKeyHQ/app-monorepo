/**
 * Babel plugin that wraps first-party function bodies with begin/end trace
 * hooks. Enabled only when ONEKEY_FUNCTION_TRACE=1 (*-function-trace EAS
 * profiles); the hooks are installed by installFunctionTrace() in
 * apps/mobile/src/startupProfile.
 *
 * Known trade-offs, accepted on purpose:
 * - Trace events are written at ERROR level. NativeLogger rate-limits
 *   DEBUG/INFO/WARN (INFO: 400 lines/s, burst 2000, shared by both JS runtimes)
 *   and would drop most per-call events; ERROR is never rate-limited. Logging
 *   cost is included in measured durations, and on long runs the oldest lines
 *   are rotated out of app-latest.log.
 * - Explicit 'worklet' functions can be instrumented twice:
 *   react-native-worklets/plugin runs after this plugin and clones the
 *   already-wrapped function, so the JS-side copy gets a second begin/end pair.
 *   This is only log noise: the hooks are undefined on the UI runtime and every
 *   call site is guarded by a typeof check, so it cannot crash.
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
        const tokenId =
          functionPath.scope.generateUidIdentifier('functionTraceToken');
        const meta = buildFunctionMeta(functionPath, filename, t);
        const startCall = t.variableDeclaration('const', [
          t.variableDeclarator(
            tokenId,
            t.conditionalExpression(
              t.binaryExpression(
                '===',
                t.unaryExpression(
                  'typeof',
                  t.memberExpression(
                    t.identifier('globalThis'),
                    t.identifier(FUNCTION_TRACE_START),
                  ),
                ),
                t.stringLiteral('function'),
              ),
              t.callExpression(
                t.memberExpression(
                  t.identifier('globalThis'),
                  t.identifier(FUNCTION_TRACE_START),
                ),
                [meta],
              ),
              t.identifier('undefined'),
            ),
          ),
        ]);
        const endCall = t.ifStatement(
          t.binaryExpression(
            '===',
            t.unaryExpression(
              'typeof',
              t.memberExpression(
                t.identifier('globalThis'),
                t.identifier(FUNCTION_TRACE_END),
              ),
            ),
            t.stringLiteral('function'),
          ),
          t.expressionStatement(
            t.callExpression(
              t.memberExpression(
                t.identifier('globalThis'),
                t.identifier(FUNCTION_TRACE_END),
              ),
              [tokenId],
            ),
          ),
        );

        const originalBody = bodyPath.node.body;
        const originalDirectives = bodyPath.node.directives || [];
        const wrappedBody = t.blockStatement([
          startCall,
          t.tryStatement(
            t.blockStatement(originalBody),
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
