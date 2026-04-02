/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');

// React hooks that take callbacks
const REACT_HOOKS_WITH_CALLBACK = new Set([
  'useEffect',
  'useLayoutEffect',
  'useMemo',
  'useCallback',
  'useImperativeHandle',
  'usePromiseResult',
  'useAsyncCall',
]);

function getEnclosingComponentName(funcPath) {
  // Walk up to find enclosing function component or class component
  let current = funcPath.parentPath;
  while (current) {
    // Function component: const MyComponent = () => {} or function MyComponent() {}
    if (current.isVariableDeclarator() && current.get('id').isIdentifier()) {
      const name = current.get('id').node.name;
      // Check if it looks like a component (PascalCase)
      if (name && /^[A-Z]/.test(name)) {
        return name;
      }
    }
    if (current.isFunctionDeclaration() && current.node.id?.name) {
      const name = current.node.id.name;
      if (/^[A-Z]/.test(name)) {
        return name;
      }
    }
    // Class component
    if (current.isClassDeclaration() && current.node.id?.name) {
      return current.node.id.name;
    }
    current = current.parentPath;
  }
  return null;
}

function getFunctionName(funcPath) {
  const { node, parentPath } = funcPath;

  // 1. Named function declaration: function foo() {}
  if (node.id && node.id.name) {
    return node.id.name;
  }

  // 2. Variable declarator: const foo = () => {}
  if (
    parentPath.isVariableDeclarator() &&
    parentPath.get('id').isIdentifier()
  ) {
    return parentPath.get('id').node.name;
  }

  // 3. Object property/method: { foo() {} } or { foo: () => {} }
  if (parentPath.isObjectProperty() || parentPath.isObjectMethod()) {
    const key = parentPath.get('key');
    if (key.isIdentifier()) {
      return key.node.name;
    }
    if (key.isStringLiteral()) {
      return key.node.value;
    }
  }

  // 4. Class method: class Foo { bar() {} }
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

  // 5. React hook callback: useEffect(() => {}, [])
  if (parentPath.isCallExpression()) {
    const callee = parentPath.get('callee');
    let hookName = null;
    if (callee.isIdentifier()) {
      hookName = callee.node.name;
    } else if (
      callee.isMemberExpression() &&
      callee.get('property').isIdentifier()
    ) {
      hookName = callee.get('property').node.name;
    }
    if (hookName && REACT_HOOKS_WITH_CALLBACK.has(hookName)) {
      const componentName = getEnclosingComponentName(funcPath);
      if (componentName) {
        return `${componentName}@${hookName}`;
      }
      return `@${hookName}`;
    }
  }

  // 6. Array callback: arr.map(() => {}), arr.filter(() => {})
  if (
    parentPath.isCallExpression() &&
    parentPath.get('callee').isMemberExpression()
  ) {
    const property = parentPath.get('callee.property');
    if (property.isIdentifier()) {
      const methodName = property.node.name;
      if (
        [
          'map',
          'filter',
          'reduce',
          'forEach',
          'find',
          'some',
          'every',
          'flatMap',
        ].includes(methodName)
      ) {
        const componentName = getEnclosingComponentName(funcPath);
        if (componentName) {
          return `${componentName}@${methodName}Callback`;
        }
        return `@${methodName}Callback`;
      }
    }
  }

  // 7. Assignment expression: this.foo = () => {}
  if (parentPath.isAssignmentExpression()) {
    const left = parentPath.get('left');
    if (left.isMemberExpression() && left.get('property').isIdentifier()) {
      return left.get('property').node.name;
    }
    if (left.isIdentifier()) {
      return left.node.name;
    }
  }

  // 8. Export default: export default function() {} or export default () => {}
  if (parentPath.isExportDefaultDeclaration()) {
    // Try to get filename as component name
    return 'default';
  }

  // 9. JSX expression container callback: onPress={() => {}}
  if (parentPath.isJSXExpressionContainer()) {
    const jsxAttr = parentPath.parentPath;
    if (jsxAttr.isJSXAttribute() && jsxAttr.get('name').isJSXIdentifier()) {
      const attrName = jsxAttr.get('name').node.name;
      const componentName = getEnclosingComponentName(funcPath);
      if (componentName) {
        return `${componentName}@${attrName}`;
      }
      return `@${attrName}`;
    }
  }

  // 10. Promise callbacks: .then(() => {}), .catch(() => {})
  if (
    parentPath.isCallExpression() &&
    parentPath.get('callee').isMemberExpression()
  ) {
    const property = parentPath.get('callee.property');
    if (property.isIdentifier()) {
      const methodName = property.node.name;
      if (['then', 'catch', 'finally'].includes(methodName)) {
        const componentName = getEnclosingComponentName(funcPath);
        if (componentName) {
          return `${componentName}@${methodName}`;
        }
        return `@${methodName}`;
      }
    }
  }

  return 'anonymous';
}

module.exports = function rnHeartbeatPlugin({ types: t }) {
  // Toggle for collecting all packages' function calls.
  // Default is false to keep overhead and noise low. When you want full coverage,
  // manually flip this to true.
  const COLLECT_ALL_PACKAGES = process.env.PERF_MONITOR_ALL_PACKAGES === '1';

  // Focused coverage for runtime performance monitoring
  // Keep scope narrow to reduce overhead and noise
  const allowList = COLLECT_ALL_PACKAGES
    ? [`${path.sep}packages${path.sep}`]
    : [
        `${path.sep}packages${path.sep}kit${path.sep}src${path.sep}views${path.sep}`,
        `${path.sep}packages${path.sep}kit${path.sep}src${path.sep}hooks${path.sep}`,
        `${path.sep}packages${path.sep}kit${path.sep}src${path.sep}provider${path.sep}`,
        `${path.sep}packages${path.sep}kit${path.sep}src${path.sep}states${path.sep}`,
        `${path.sep}packages${path.sep}kit-bg${path.sep}src${path.sep}services${path.sep}`,
        `${path.sep}packages${path.sep}kit-bg${path.sep}src${path.sep}providers${path.sep}`,
        `${path.sep}packages${path.sep}kit-bg${path.sep}src${path.sep}dbs${path.sep}`,
        `${path.sep}packages${path.sep}shared${path.sep}src${path.sep}request${path.sep}`,
      ];

  // Exclude paths that add noise or cause issues
  const denyList = [
    'node_modules',
    '__tests__',
    '__mocks__',
    '.test.',
    '.spec.',
    '.mock.',
    'functionHitLogger', // Avoid self-instrumentation
    `${path.sep}locales${path.sep}`,
    `${path.sep}locale${path.sep}`,
    // Exclude low-level modules that may cause issues
    `${path.sep}polyfills${path.sep}`,
    `${path.sep}logger${path.sep}`,
    `${path.sep}modules3rdParty${path.sep}`,
    `${path.sep}errors${path.sep}`,
    `${path.sep}consts${path.sep}`,
    `${path.sep}config${path.sep}`,
    'platformEnv',
    'debugLogger',
  ];

  return {
    name: 'rn-heartbeat-plugin',
    visitor: {
      Program(programPath, state) {
        const filename = state.filename || '';
        const inAllowList = allowList.some((s) => filename.includes(s));
        const inDenyList = denyList.some((s) => filename.includes(s));
        if (!inAllowList || inDenyList) {
          state.skipFile = true;
        }
        // no-op; we rely on globalThis.__recordFunctionStart/__recordFunctionEnd installed at startup
      },
      Function(funcPath, state) {
        if (state.skipFile) return;

        // Skip getter/setter - they have special semantics
        if (funcPath.node.kind === 'get' || funcPath.node.kind === 'set') {
          return;
        }

        // Skip constructor
        if (funcPath.node.kind === 'constructor') {
          return;
        }

        // Skip if it's a class method named 'constructor'
        if (
          (funcPath.isClassMethod() || funcPath.isClassPrivateMethod()) &&
          funcPath.get('key').isIdentifier() &&
          funcPath.get('key').node.name === 'constructor'
        ) {
          return;
        }

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
            t.objectProperty(t.identifier('line'), t.numericLiteral(line)),
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
