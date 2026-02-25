// Babel plugin for jest compatibility when bundling for react-native-harness.
// Active only when RN_HARNESS=true. This is needed because:
// 1. jest.mock() relies on babel-jest hoisting, which Metro does not support
// 2. jest.requireActual/requireMock need to become plain require() calls
// 3. Metro does not support dynamic require(variable), so runtime module
//    mutation must use static require() calls generated at compile time
//
// Transforms:
// - jest.mock('mod', factory) -> globalThis.__harness_mock_module__(require('mod'), factory)
// - jest.mock('mod')          -> (removed, auto-mock not supported)
// - jest.requireActual('x')   -> require('x')
// - jest.requireMock('x')     -> require('x')

module.exports = function ({ types: t }) {
  if (process.env.RN_HARNESS !== 'true') {
    return { visitor: {} };
  }

  return {
    name: 'babel-plugin-jest-compat',
    visitor: {
      ExpressionStatement(path) {
        const expr = path.node.expression;
        if (!t.isCallExpression(expr)) return;

        const callee = expr.callee;
        if (
          !t.isMemberExpression(callee) ||
          !t.isIdentifier(callee.object, { name: 'jest' }) ||
          !t.isIdentifier(callee.property, { name: 'mock' })
        ) {
          return;
        }

        const args = expr.arguments;
        if (args.length >= 2 && t.isStringLiteral(args[0])) {
          // Detect jest.mock('mod', factory, { virtual: true }) — the module
          // doesn't exist on disk so require() would crash Metro bundling.
          const isVirtual =
            args.length >= 3 &&
            t.isObjectExpression(args[2]) &&
            args[2].properties.some(
              (p) =>
                t.isObjectProperty(p) &&
                t.isIdentifier(p.key, { name: 'virtual' }) &&
                t.isBooleanLiteral(p.value, { value: true }),
            );
          if (isVirtual) {
            // Virtual mocks can't be emulated in Metro — remove the statement
            path.remove();
            return;
          }

          // jest.mock('module', factory) ->
          // globalThis.__harness_mock_module__(require('module'), factory)
          path.replaceWith(
            t.expressionStatement(
              t.callExpression(
                t.memberExpression(
                  t.identifier('globalThis'),
                  t.identifier('__harness_mock_module__'),
                ),
                [t.callExpression(t.identifier('require'), [args[0]]), args[1]],
              ),
            ),
          );
        } else {
          // jest.mock('module') without factory -> remove (auto-mock not supported).
          // Warn at build time so developers know this mock is silently dropped.
          const moduleName =
            args.length > 0 && t.isStringLiteral(args[0])
              ? args[0].value
              : '<unknown>';
          const filename = this.filename || this.file?.opts?.filename || '';
          console.warn(
            `[babel-plugin-jest-compat] Removing jest.mock('${moduleName}') without factory ` +
              `(auto-mock not supported in harness). Test may behave differently. ` +
              `File: ${filename}`,
          );
          path.remove();
        }
      },

      CallExpression(path) {
        const callee = path.node.callee;

        if (
          !t.isMemberExpression(callee) ||
          !t.isIdentifier(callee.object, { name: 'jest' })
        ) {
          return;
        }

        // jest.requireActual('module') -> require('module')
        if (t.isIdentifier(callee.property, { name: 'requireActual' })) {
          path.replaceWith(
            t.callExpression(t.identifier('require'), path.node.arguments),
          );
          return;
        }

        // jest.requireMock('module') -> extract default export for ES modules
        // so that mutation via `const m = jest.requireMock('mod'); m.prop = x`
        // affects the same object that `import m from 'mod'` resolves to.
        // Transform: (function(_m){return _m&&_m.__esModule?_m.default||_m:_m})(require('module'))
        if (t.isIdentifier(callee.property, { name: 'requireMock' })) {
          path.replaceWith(
            t.callExpression(
              t.functionExpression(
                null,
                [t.identifier('_m')],
                t.blockStatement([
                  t.returnStatement(
                    t.conditionalExpression(
                      t.logicalExpression(
                        '&&',
                        t.identifier('_m'),
                        t.memberExpression(
                          t.identifier('_m'),
                          t.identifier('__esModule'),
                        ),
                      ),
                      t.logicalExpression(
                        '||',
                        t.memberExpression(
                          t.identifier('_m'),
                          t.identifier('default'),
                        ),
                        t.identifier('_m'),
                      ),
                      t.identifier('_m'),
                    ),
                  ),
                ]),
              ),
              [t.callExpression(t.identifier('require'), path.node.arguments)],
            ),
          );
        }
      },
    },
  };
};
