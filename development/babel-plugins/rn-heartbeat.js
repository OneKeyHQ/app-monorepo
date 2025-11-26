/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');

function getFunctionName(funcPath) {
  const { node, parentPath } = funcPath;
  if (node.id && node.id.name) {
    return node.id.name;
  }
  if (
    parentPath.isVariableDeclarator() &&
    parentPath.get('id').isIdentifier()
  ) {
    return parentPath.get('id').node.name;
  }
  if (parentPath.isObjectProperty() || parentPath.isObjectMethod()) {
    const key = parentPath.get('key');
    if (key.isIdentifier()) {
      return key.node.name;
    }
    if (key.isStringLiteral()) {
      return key.node.value;
    }
  }
  if (funcPath.isClassMethod() || funcPath.isClassPrivateMethod()) {
    const classPath = funcPath.findParent(
      (p) => p.isClassDeclaration() || p.isClassExpression(),
    );
    const className = classPath?.node.id?.name;
    const key = funcPath.get('key');
    if (key.isIdentifier()) {
      return className ? `${className}.${key.node.name}` : key.node.name;
    }
  }
  return 'anonymous';
}

module.exports = function rnHeartbeatPlugin({ types: t }) {
  const allowList = [
    `${path.sep}packages${path.sep}kit${path.sep}src${path.sep}views${path.sep}`,
    `${path.sep}packages${path.sep}shared${path.sep}src${path.sep}engine${path.sep}`,
    `${path.sep}packages${path.sep}shared${path.sep}src${path.sep}request${path.sep}`,
  ];
  return {
    name: 'rn-heartbeat-plugin',
    visitor: {
      Program(programPath, state) {
        const filename = state.filename || '';
        const matched = allowList.some((s) => filename.includes(s));
        if (!matched) {
          state.skipFile = true;
          return;
        }
        // no-op; we rely on globalThis.__recordFunctionStart/__recordFunctionEnd installed at startup
      },
      Function(funcPath, state) {
        if (state.skipFile) return;
        const bodyPath = funcPath.get('body');
        if (!bodyPath.node) return;
        if (!bodyPath.isBlockStatement()) {
          bodyPath.replaceWith(
            t.blockStatement([t.returnStatement(bodyPath.node)]),
          );
        }
        if (funcPath.getData('hbLogged')) return;

        const filename = state.filename || '';
        const relativeFile = filename
          ? path.relative(process.cwd(), filename)
          : 'unknown';
        const name = getFunctionName(funcPath);
        const line =
          funcPath.node.loc && funcPath.node.loc.start
            ? funcPath.node.loc.start.line
            : null;
        const metaProps = [
          t.objectProperty(t.identifier('name'), t.stringLiteral(name)),
          t.objectProperty(t.identifier('file'), t.stringLiteral(relativeFile)),
        ];
        if (line !== null) {
          metaProps.push(
            t.objectProperty(
              t.identifier('line'),
              t.numericLiteral(line),
            ),
          );
        }
        const startId = funcPath.scope.generateUidIdentifier('_pf');
        const startCall = t.variableDeclaration('const', [
          t.variableDeclarator(
            startId,
            t.logicalExpression(
              '&&',
              t.binaryExpression(
                '===',
                t.unaryExpression(
                  'typeof',
                  t.memberExpression(
                    t.identifier('globalThis'),
                    t.identifier('__recordFunctionStart'),
                  ),
                ),
                t.stringLiteral('function'),
              ),
              t.callExpression(
                t.memberExpression(
                  t.identifier('globalThis'),
                  t.identifier('__recordFunctionStart'),
                ),
                [t.objectExpression(metaProps)],
              ),
            ),
          ),
        ]);
        const endCall = t.expressionStatement(
          t.logicalExpression(
            '&&',
            t.binaryExpression(
              '===',
              t.unaryExpression(
                'typeof',
                t.memberExpression(
                  t.identifier('globalThis'),
                  t.identifier('__recordFunctionEnd'),
                ),
              ),
              t.stringLiteral('function'),
            ),
            t.callExpression(
              t.memberExpression(
                t.identifier('globalThis'),
                t.identifier('__recordFunctionEnd'),
              ),
              [startId],
            ),
          ),
        );
        const originalBody = funcPath.get('body').node.body || [];
        const tryStmt = t.tryStatement(
          t.blockStatement(originalBody.map((n) => t.cloneNode(n))),
          null,
          t.blockStatement([endCall]),
        );
        bodyPath.replaceWith(t.blockStatement([startCall, tryStmt]));
        funcPath.setData('hbLogged', true);
      },
    },
  };
};
