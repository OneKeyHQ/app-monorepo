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
  if (!process.env.RN_HARNESS) {
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
          // jest.mock('module', factory) ->
          // globalThis.__harness_mock_module__(require('module'), factory)
          path.replaceWith(
            t.expressionStatement(
              t.callExpression(
                t.memberExpression(
                  t.identifier('globalThis'),
                  t.identifier('__harness_mock_module__'),
                ),
                [
                  t.callExpression(t.identifier('require'), [args[0]]),
                  args[1],
                ],
              ),
            ),
          );
        } else {
          // jest.mock('module') without factory -> remove (auto-mock not supported)
          path.remove();
        }
      },

      CallExpression(path) {
        const callee = path.node.callee;

        // jest.requireActual('module') -> require('module')
        // jest.requireMock('module') -> require('module')
        if (
          t.isMemberExpression(callee) &&
          t.isIdentifier(callee.object, { name: 'jest' }) &&
          (t.isIdentifier(callee.property, { name: 'requireActual' }) ||
            t.isIdentifier(callee.property, { name: 'requireMock' }))
        ) {
          path.replaceWith(
            t.callExpression(t.identifier('require'), path.node.arguments),
          );
        }
      },
    },
  };
};
